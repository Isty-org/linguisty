// @vitest-environment node
/** @spec spec://modules/platform/INFRA-003-local-cli#acceptance */
import { describe, expect, it, vi } from 'vitest';
import { getProvider } from '../../src/providers/registry';
import { normalizeProviderConfig } from '../../src/providers/config';
import { CLI_BASE_URL, CLI_PROVIDERS } from '../../src/shared/providers';
import type { NativeRequester } from '../../src/providers/nativeClient';
import { TranslationEngine } from '../../src/translation/engine';
import { configFor, deferred, fakeCache, inputFor } from './fixtures';
vi.mock('wxt/browser', () => ({ browser: { runtime: {} } }));
for (const providerId of CLI_PROVIDERS) describe(providerId, () => {
  const config = { ...configFor(), providerId, model: '', apiKey: 'private-unused-key', streaming: true };
  it('translates with the CLI default model, disables streaming and never transmits an API key or URL', async () => {
    const nativeRequest = vi.fn<NativeRequester>(async request => {
      const input = JSON.parse(request.messages![1]!.content);
      return { content: JSON.stringify({ translations: input.nodes.map((n: { id: string }) => ({ id: n.id, text: 'Перевод' })) }) };
    });
    const provider = getProvider(providerId, { nativeRequest, fetchImpl: vi.fn(() => { throw new Error('HTTP forbidden'); }) });
    expect((await provider.translate(inputFor(), config)).translations).toHaveLength(2);
    expect(nativeRequest.mock.calls[0]![0]).toMatchObject({ type: 'translate', providerId, model: 'default' });
    const wire = JSON.stringify(nativeRequest.mock.calls);
    expect(wire).not.toContain(config.apiKey); expect(wire).not.toContain(config.baseUrl);
    expect(normalizeProviderConfig(config, providerId)).toMatchObject({ apiKey: '', baseUrl: CLI_BASE_URL, streaming: false });
  });
  it('connection and model discovery check CLI presence without an inference call', async () => {
    const nativeRequest = vi.fn<NativeRequester>(async () => ({ available: true }));
    const provider = getProvider(providerId, { nativeRequest });
    expect(await provider.testConnection(config)).toMatchObject({ success: true, message: expect.stringContaining('не проверялись') });
    expect(await provider.listModels(config)).toEqual([{ id: 'default', name: 'Модель по умолчанию в CLI' }]);
    expect(nativeRequest.mock.calls.map(([request]) => request.type)).toEqual(['status', 'status']);
  });
  it('rejects incomplete or mismatched translations instead of changing unrelated page nodes', async () => {
    const nativeRequest = vi.fn<NativeRequester>(async () => ({ content: '{"translations":[{"id":"wrong","text":"Oops"}]}' }));
    await expect(getProvider(providerId, { nativeRequest }).translate(inputFor(), config)).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
  });
});

it('CLI translation retains cache and concurrent deduplication and releases engine resources', async () => {
  const response = deferred<unknown>();
  const nativeRequest = vi.fn<NativeRequester>(() => response.promise), fetchImpl = vi.fn<typeof fetch>();
  const cache = fakeCache(), engine = new TranslationEngine(cache, { nativeRequest, fetchImpl });
  const config = { ...configFor(), providerId: 'codex-cli' as const, apiKey: '', model: 'default' };
  const input = inputFor();
  const one = engine.translate(input, config);
  await vi.waitFor(() => expect(nativeRequest).toHaveBeenCalledOnce());
  const two = engine.translate({ ...input, nodes: input.nodes.map(n => ({ ...n, id: n.id + '-new' })) }, config);
  await vi.waitFor(() => expect(cache.get).toHaveBeenCalledTimes(4));
  await new Promise(resolve => setImmediate(resolve));
  response.resolve({ content: JSON.stringify({ translations: input.nodes.map(n => ({ id: n.id, text: 'Перевод' })) }) });
  expect((await one).translations.map(n => n.id)).toEqual(['n1', 'n2']);
  expect((await two).translations.map(n => n.id)).toEqual(['n1-new', 'n2-new']);
  expect((await engine.translate(input, config)).fromCache).toBe(2);
  expect(nativeRequest).toHaveBeenCalledOnce(); expect(fetchImpl).not.toHaveBeenCalled();
  expect(engine.inFlightCount).toBe(0);
});
