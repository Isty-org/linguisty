// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConfig, TranslationInput } from '../../src/shared/contracts';
import { PROMPT_VERSION } from '../../src/shared/constants';
import { buildCacheKey } from '../../src/cache/cacheKey';

const input: TranslationInput = {
  nodes: [{ id: 'a', text: 'Bank', group: 'river' }, { id: 'b', text: 'The river bank', group: 'river' }],
  sourceLanguage: 'auto', targetLanguage: 'ru', style: 'natural', customInstructions: 'Keep terminology.',
  pageContext: { title: 'Rivers', domain: 'example.test', contentType: 'article' },
};
const config: ProviderConfig = {
  providerId: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'model/id',
  apiKey: 'private-test-value', timeoutMs: 25_000,
};

afterEach(() => { vi.doUnmock('../../src/shared/constants'); vi.resetModules(); });

/** @spec spec://modules/storage/INFRA-002-local-data#cache.key */
describe('context-sensitive SHA-256 cache keys', () => {
  /** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
  it('separates Codex account caches without changing API keys or keeping token rotations in the identity', async () => {
    const first = { ...config, providerId: 'codex' as const, accountScope: 'a'.repeat(64) };
    const key = await buildCacheKey('Bank', input, first);
    expect(await buildCacheKey('Bank', input, { ...first, accountScope: 'b'.repeat(64) })).not.toBe(key);
    expect(await buildCacheKey('Bank', input, { ...first, apiKey: 'unused-rotated-token' })).toBe(key);
    expect(await buildCacheKey('Bank', input, { ...config, accountScope: 'a'.repeat(64) }))
      .toBe(await buildCacheKey('Bank', input, config));
  });
  /** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
  it('rejects a Codex cache identity with no verified account scope', async () => {
    for (const accountScope of [undefined, '', 'raw-private-subject']) {
      await expect(buildCacheKey('Bank', input, { ...config, providerId: 'codex', accountScope }))
        .rejects.toMatchObject({ code: 'CODEX_NOT_CONNECTED' });
    }
  });
  it('returns a stable digest independent of API keys, timeout and transient node IDs', async () => {
    const key = await buildCacheKey('Bank', input, config);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(await buildCacheKey('Bank', {
      ...input, nodes: input.nodes.map((node, index) => ({ ...node, id: `new-${index}` })),
    }, { ...config, apiKey: 'rotated-private-value', timeoutMs: 10_000 })).toBe(key);
    const withUnreadableKey = Object.defineProperty({ ...config }, 'apiKey', { get() { throw new Error('Key read'); } });
    expect(await buildCacheKey('Bank', input, withUnreadableKey)).toBe(key);
  });

  it('canonicalizes equivalent endpoints but preserves exact text whitespace', async () => {
    const key = await buildCacheKey(' Bank\n', input, config);
    expect(await buildCacheKey(' Bank\n', input, {
      ...config, baseUrl: 'https://OPENROUTER.ai:443/api/v1///',
    })).toBe(key);
    expect(await buildCacheKey('Bank', input, config)).not.toBe(key);
  });

  it('captures a consistent context before hashing even when callers mutate their inputs while awaiting', async () => {
    const mutableInput = { ...input, nodes: input.nodes.map((node) => ({ ...node })), pageContext: { ...input.pageContext } };
    const mutableConfig = { ...config };
    const pending = buildCacheKey('Bank', mutableInput, mutableConfig);
    mutableInput.nodes[0]!.text = 'Mutated';
    mutableInput.pageContext.title = 'Mutated';
    mutableInput.customInstructions = 'Changed instruction';
    mutableConfig.baseUrl = 'https://other.test/v1';
    mutableConfig.model = 'changed/model';
    expect(await pending).toBe(await buildCacheKey('Bank', input, config));
  });

  it.each([
    ['source language', { ...input, sourceLanguage: 'en' }, config],
    ['target language', { ...input, targetLanguage: 'de' }, config],
    ['style', { ...input, style: 'literal' as const }, config],
    ['instructions', { ...input, customInstructions: 'Use financial terms.' }, config],
    ['title', { ...input, pageContext: { ...input.pageContext, title: 'Finance' } }, config],
    ['domain', { ...input, pageContext: { ...input.pageContext, domain: 'another.test' } }, config],
    ['content type', { ...input, pageContext: { ...input.pageContext, contentType: 'forum' } }, config],
    ['provider', input, { ...config, providerId: 'openai-compatible' as const }],
    ['endpoint', input, { ...config, baseUrl: 'https://other.test/v1' }],
    ['model', input, { ...config, model: 'another/model' }],
    ['neighbor text', { ...input, nodes: [input.nodes[0]!, { ...input.nodes[1]!, text: 'An investment bank' }] }, config],
    ['semantic group', { ...input, nodes: input.nodes.map((node) => ({ ...node, group: 'finance' })) }, config],
    ['batch order', { ...input, nodes: [...input.nodes].reverse() }, config],
  ])('invalidates the same phrase when %s changes', async (_label, changedInput, changedConfig) => {
    expect(await buildCacheKey('Bank', changedInput, changedConfig)).not.toBe(await buildCacheKey('Bank', input, config));
  });

  it('invalidates on prompt version change and never hashes the API key or raw instructions into final context', async () => {
    const digest = vi.spyOn(crypto.subtle, 'digest');
    const oldKey = await buildCacheKey('Bank', input, config);
    const payload = digest.mock.calls.at(-1)![1] as Uint8Array;
    const context = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
    expect(context.promptVersion).toBe(PROMPT_VERSION);
    expect(context.instructionsHash).toMatch(/^[a-f0-9]{64}$/);
    expect(new TextDecoder().decode(payload)).not.toContain('private-test-value');
    expect(new TextDecoder().decode(payload)).not.toContain(input.customInstructions);
    const actual = await vi.importActual<typeof import('../../src/shared/constants')>('../../src/shared/constants');
    vi.doMock('../../src/shared/constants', () => ({ ...actual, PROMPT_VERSION: `${PROMPT_VERSION}-next` }));
    vi.resetModules();
    const next = await import('../../src/cache/cacheKey');
    expect(await next.buildCacheKey('Bank', input, config)).not.toBe(oldKey);
  });
});
