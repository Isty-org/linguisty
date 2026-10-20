/** @spec spec://modules/translation/FEAT-001-engine#errors */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiErrorInput } from '../../src/shared/contracts';
import { getProvider } from '../../src/providers/registry';
import { safeApiToken, safeConfiguredModel } from '../../src/providers/diagnostics';
import { toPublicError } from '../../src/shared/errors';
import { ErrorJournal, ERROR_LOG_KEY } from '../../src/storage/errorLog';
import { configFor, inputFor, jsonResponse, completion } from './fixtures';

vi.mock('wxt/browser', () => ({ browser: {} }));
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe.each(['openrouter', 'openai-compatible'] as const)('%s diagnostic reporter', providerId => {
  it.each([401, 402, 403, 429, 503, 200])('retains safe machine fields and status %i once after bounded retries', async status => {
    const entries: ApiErrorInput[] = [];
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { code: status === 200 ? 503 : status,
      message: 'Service refused this model: account restriction', metadata: { error_type: 'account_restricted', raw: JSON.stringify({ error: { message: 'Upstream detail', secret: 'never copied' } }) } } }, status, { 'x-request-id': 'req-actual' }));
    const provider = getProvider(providerId, { fetchImpl, onError: entry => { entries.push(entry); } });
    const work = provider.translate(inputFor(), configFor(providerId)).catch(error => error);
    await vi.runAllTimersAsync();
    const failure = await work;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ source: 'api', httpStatus: status, apiCode: String(status === 200 ? 503 : status),
      apiType: 'account_restricted', operation: 'translate', model: 'test/model', attempts: fetchImpl.mock.calls.length });
    expect(JSON.stringify(entries)).not.toMatch(/Service refused|Upstream detail|req-actual|never copied|synthetic-test-key|Product page/);
    expect(toPublicError(failure)).not.toHaveProperty('diagnostic');
  });

  it('distinguishes network, timeout and malformed reply without copying raw errors', async () => {
    const cases = [
      { fetchImpl: vi.fn(async () => { throw new Error('Authorization: synthetic-test-key Hello'); }), source: 'network', attempts: 3 },
      { fetchImpl: vi.fn(() => new Promise<Response>(() => undefined)), source: 'timeout', attempts: 1 },
      { fetchImpl: vi.fn(async () => completion('incomplete { "translations":[')), source: 'invalid-response', attempts: 2 },
    ];
    for (const value of cases) {
      const entries: ApiErrorInput[] = [];
      const work = getProvider(providerId, { fetchImpl: value.fetchImpl, onError: entry => { entries.push(entry); } })
        .translate(inputFor(), configFor(providerId)).catch(error => error);
      await vi.runAllTimersAsync(); await work;
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ source: value.source, attempts: value.attempts });
      expect(JSON.stringify(entries)).not.toMatch(/synthetic-test-key|Authorization|Hello|incomplete/);
      expect(vi.getTimerCount()).toBe(0);
    }
  });

  it('reports test connection and discovery as their actual operation; cancellation creates no entry', async () => {
    const entries: ApiErrorInput[] = [];
    const provider = getProvider(providerId, { fetchImpl: async () => jsonResponse({ error: { code: 401, message: 'Credentials rejected' } }, 401), onError: entry => { entries.push(entry); } });
    expect((await provider.testConnection(configFor(providerId))).success).toBe(false);
    await expect(provider.listModels(configFor(providerId))).rejects.toMatchObject({ code: 'INVALID_API_KEY' });
    expect(entries.map(entry => entry.operation)).toEqual(['test-connection', 'list-models']);
    const controller = new AbortController(); controller.abort();
    await expect(provider.translate(inputFor(), configFor(providerId), controller.signal)).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(entries).toHaveLength(2);
  });

  it('redacts keys, source echoes, upstream message echoes and extra metadata before reporting', async () => {
    const input = inputFor(); input.nodes[0]!.text = 'Confidential contents of this listing';
    const entries: ApiErrorInput[] = [];
    const provider = getProvider(providerId, { fetchImpl: async () => jsonResponse({ error: { code: 401,
      message: 'Bad field: Confidential contents of this listing', metadata: { raw: JSON.stringify({ error: { message: 'Bearer synthetic-test-key rejected', request: input } }), extra: input } } }, 401), onError: entry => { entries.push(entry); } });
    await expect(provider.translate(input, configFor(providerId))).rejects.toBeDefined();
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toMatch(/Confidential|synthetic-test-key|contents|listing|nodes|extra|raw/);
    expect(entries[0]!.message).toBeUndefined();
    expect(entries[0]!.providerMessage).toBeUndefined();
  });

  it('drops unknown code and type even when they look like machine fields', async () => {
    const entries: ApiErrorInput[] = [];
    const fetchImpl = async () => jsonResponse({ error: { code: 'John-Smith-250', type: 'Tenant%20John',
      message: 'Invalid field: John / 250 EUR' } }, 400, { 'x-request-id': 'John.Smith-250' });
    await expect(getProvider(providerId, { fetchImpl, onError: entry => { entries.push(entry); } })
      .translate(inputFor(), configFor(providerId))).rejects.toMatchObject({ code: 'INVALID_SETTINGS' });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ source: 'api', httpStatus: 400, errorCode: 'INVALID_SETTINGS', attempts: 1 });
    expect(entries[0]).not.toHaveProperty('apiCode');
    expect(entries[0]).not.toHaveProperty('apiType');
    expect(JSON.stringify(entries)).not.toMatch(/John|Smith|250|Tenant|EUR|%20/);
  });
});

it('allows only fixed machine tokens and bounded HTTP codes, regardless of token-like echoes', () => {
  expect(safeApiToken('rate_limit_exceeded')).toBe('rate_limit_exceeded');
  expect(safeApiToken(429)).toBe('429');
  for (const echo of ['John', 'Smith_250', 'John%20Smith', 'John-Smith', 'invalid_field_John', '404 John', 'x'.repeat(9000)]) {
    expect(safeApiToken(echo)).toBeUndefined();
  }
  expect(safeApiToken(399)).toBeUndefined();
  expect(safeApiToken(600)).toBeUndefined();
});

it('retains configured model IDs without accepting prose, encoded echoes or credentials', () => {
  expect(safeConfiguredModel('openai/gpt-4o:latest', 'synthetic-test-key')).toBe('openai/gpt-4o:latest');
  expect(safeConfiguredModel('Tenant John Smith')).toBeUndefined();
  expect(safeConfiguredModel('John%20Smith')).toBeUndefined();
  expect(safeConfiguredModel('synthetic-test-key', 'synthetic-test-key')).toBeUndefined();
});

/** @spec spec://modules/storage/INFRA-002-local-data#contracts */
it.each(['openrouter', 'openai-compatible'] as const)('%s does not persist short or encoded request echoes from provider to ErrorJournal', async providerId => {
  const stored: Record<string, unknown> = {};
  const area = {
    get: vi.fn(async () => ({ ...stored })),
    set: vi.fn(async (updates: Record<string, unknown>) => { Object.assign(stored, updates); }),
    remove: vi.fn(async () => { delete stored[ERROR_LOG_KEY]; }),
  };
  const journal = new ErrorJournal(async () => area);
  const input = inputFor();
  input.nodes[0]!.text = 'Tenant John Smith owes 250 EUR.';
  const fetchImpl = vi.fn(async () => jsonResponse({ error: {
    code: 'invalid_request_error', type: 'invalid_request_error',
    message: 'Invalid field John-Smith / 250, EUR',
    metadata: { error_type: 'account_restricted', raw: JSON.stringify({ error: { message: 'Tenant John%20Smith owes 250 EUR' } }) },
  } }, 400, { 'x-request-id': 'John.Smith-250' }));
  const provider = getProvider(providerId, { fetchImpl, onError: entry => journal.append(entry) });
  const pending = provider.translate(input, configFor(providerId)).catch(error => error);
  await vi.runAllTimersAsync();
  const failure = await pending;
  const raw = JSON.stringify(stored[ERROR_LOG_KEY]);
  expect(raw).not.toMatch(/John|Smith|250|Tenant|EUR|%20|synthetic-test-key|Product page/iu);
  expect(await journal.list()).toHaveLength(1);
  expect(JSON.stringify(await journal.list())).not.toMatch(/John|Smith|250|Tenant|EUR|%20|synthetic-test-key|Product page/iu);
  expect((stored[ERROR_LOG_KEY] as { httpStatus: number; apiCode: string; apiType: string; attempts: number }[])[0]).toMatchObject({
    httpStatus: 400, apiCode: 'invalid_request_error', apiType: 'account_restricted', attempts: 1,
  });
  expect(toPublicError(failure)).toMatchObject({ code: 'INVALID_SETTINGS', retryable: false });
  expect(toPublicError(failure)).not.toHaveProperty('diagnostic');
});
