// @vitest-environment node
/** @spec spec://modules/translation/FEAT-001-engine#acceptance */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProviderId } from '../../src/shared/contracts';
import { MAX_RESPONSE_BYTES, MODEL_CACHE_TTL_MS } from '../../src/shared/constants';
import { toPublicError } from '../../src/shared/errors';
import { getProvider } from '../../src/providers/registry';
import { completion, configFor, inputFor, jsonResponse, requestBody, translatedResponse } from './fixtures';

afterEach(() => { vi.useRealTimers(); });

describe.each<ProviderId>(['openrouter', 'openai-compatible'])('%s provider contract', id => {
  it('uses one non-streaming request with safe fetch options and normalizes IDs', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => translatedResponse(init));
    const result = await getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id));
    expect(result.translations.map(item => item.id)).toEqual(['n1', 'n2']);
    expect(result.fromCache).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(`${configFor(id).baseUrl}/chat/completions`);
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store', headers: { Authorization: 'Bearer synthetic-test-key', 'Content-Type': 'application/json' } });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(requestBody(init)).toMatchObject({ model: 'test/model', stream: false });
    expect(requestBody(init).response_format).toBeUndefined();
  });

  it.each([401, 403, 404, 413])('maps HTTP %s without retries or raw errors', async status => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ error: { message: 'synthetic-test-key RAW-BODY' } }, status));
    const provider = getProvider(id, { fetchImpl });
    const error = await provider.translate(inputFor(), configFor(id)).catch(value => value);
    const code = status === 404 ? 'MODEL_NOT_FOUND' : status === 413 ? 'CONTEXT_TOO_LARGE' : 'INVALID_API_KEY';
    expect(toPublicError(error)).toMatchObject({ code, retryable: false });
    expect(JSON.stringify(toPublicError(error))).not.toMatch(/synthetic-test-key|RAW-BODY/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([429, 500, 502, 503, 504])('bounds HTTP %s retries at three attempts', async status => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({}, status));
    const promise = getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id)).catch(value => value);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(toPublicError(await promise).code).toBe(status === 429 ? 'RATE_LIMIT' : 'PROVIDER_UNAVAILABLE');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('respects Retry-After and caps an excessive value', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => jsonResponse({}, 429, { 'Retry-After': '99999' }))
      .mockImplementation(async (_url, init) => translatedResponse(init));
    const promise = getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id));
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await promise).translations).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handles HTTP-date Retry-After', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T10:00:00Z'));
    const fetchImpl = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => jsonResponse({}, 429, { 'Retry-After': 'Wed, 07 Oct 2026 10:00:03 GMT' }))
      .mockImplementation(async (_url, init) => translatedResponse(init));
    const promise = getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id));
    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{ code: 401 }, 'INVALID_API_KEY'],
    [{ code: 'model_not_found' }, 'MODEL_NOT_FOUND'],
    [{ metadata: { error_type: 'context_length_exceeded' } }, 'CONTEXT_TOO_LARGE'],
    [{ message: 'synthetic-test-key RAW-BODY' }, 'INVALID_MODEL_RESPONSE'],
  ])('rejects an HTTP 200 error envelope %j', async (error, code) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ error }));
    await expect(getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id))).rejects.toMatchObject({ code });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not accept valid-looking partial content with a choice error', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ choices: [{ message: { content: '{"translations":[]}' }, error: { code: 'model_not_found' }, finish_reason: 'error' }] }));
    await expect(getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id))).rejects.toMatchObject({ code: 'MODEL_NOT_FOUND' });
  });

  it('retries a typed rate-limit envelope inside HTTP 200', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => jsonResponse({ error: { metadata: { error_type: 'rate_limit_exceeded' } } }))
      .mockImplementation(async (_url, init) => translatedResponse(init));
    const promise = getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id));
    await vi.advanceTimersByTimeAsync(500);
    expect((await promise).translations).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects a truncated completion without a retry', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ choices: [{ message: { content: '{}' }, finish_reason: 'length' }] }));
    await expect(getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id))).rejects.toMatchObject({ code: 'CONTEXT_TOO_LARGE' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each(['not-json', '{"choices":[]}', '{"choices":[{"message":{"content":null}}]}'])('retries malformed envelope only once: %s', async body => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(body));
    const promise = getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id)).catch(value => value);
    await vi.advanceTimersByTimeAsync(500);
    expect(toPublicError(await promise).code).toBe('INVALID_MODEL_RESPONSE');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries malformed model JSON only once', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(async () => completion('garbage {"translations":[]}'));
    const promise = getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id)).catch(value => value);
    await vi.advanceTimersByTimeAsync(500);
    expect(toPublicError(await promise).code).toBe('INVALID_MODEL_RESPONSE');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('recovers from malformed JSON on its single retry', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => completion('{'))
      .mockImplementation(async (_url, init) => translatedResponse(init));
    const promise = getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id));
    await vi.advanceTimersByTimeAsync(500);
    expect((await promise).translations).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('decodes UTF-8 split across streamed chunks', async () => {
    const content = JSON.stringify({ choices: [{ message: { content: JSON.stringify({ translations: [{ id: 'n1', text: 'Привет' }, { id: 'n2', text: 'Цена' }] }) }, finish_reason: 'stop' }] });
    const bytes = new TextEncoder().encode(content);
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i++) controller.enqueue(bytes.slice(i, i + 1));
        controller.close();
      },
    })));
    expect((await getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id))).translations).toEqual([{ id: 'n1', text: 'Привет' }, { id: 'n2', text: 'Цена' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a network failure twice and redacts its details', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(async () => { throw new Error('Authorization: synthetic-test-key RAW-BODY'); });
    const promise = getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id)).catch(value => value);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(toPublicError(await promise)).toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
    expect(JSON.stringify(toPublicError(await promise))).not.toMatch(/synthetic-test-key|RAW-BODY/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('times out even when injected fetch ignores the abort signal', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise(() => undefined));
    const promise = getProvider(id, { fetchImpl }).translate(inputFor(), { ...configFor(id), timeoutMs: 1_000 }).catch(value => value);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(toPublicError(await promise).code).toBe('REQUEST_TIMEOUT');
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out while reading the body and cancels its stream', async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(new ReadableStream({ cancel })));
    const promise = getProvider(id, { fetchImpl }).translate(inputFor(), { ...configFor(id), timeoutMs: 1_000 }).catch(value => value);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(toPublicError(await promise).code).toBe('REQUEST_TIMEOUT');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('distinguishes cancellation and removes its listener/timer', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise(() => undefined));
    const promise = getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id), controller.signal).catch(value => value);
    controller.abort('synthetic-test-key RAW-BODY');
    expect(toPublicError(await promise).code).toBe('CANCELLED');
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(remove).toHaveBeenCalledTimes(add.mock.calls.length);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels retry sleep without starting another request', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({}, 429));
    const promise = getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id), controller.signal).catch(value => value);
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    expect(toPublicError(await promise).code).toBe('CANCELLED');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not fetch with an already cancelled signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id), controller.signal)).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects an oversized declared body and closes it', async () => {
    const cancel = vi.fn();
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(new ReadableStream({ cancel }), { headers: { 'Content-Length': String(MAX_RESPONSE_BYTES + 1) } }));
    await expect(getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id))).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('counts streamed UTF-8 bytes even when Content-Length is absent or false', async () => {
    const cancel = vi.fn();
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('Я'.repeat(MAX_RESPONSE_BYTES / 2 + 1))); }, cancel,
    }), { headers: { 'Content-Length': '1' } }));
    await expect(getProvider(id, { fetchImpl }).translate(inputFor(), configFor(id))).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('tests connection with one minimal request and a safe normalized result', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => translatedResponse(init));
    const result = await getProvider(id, { fetchImpl }).testConnection(configFor(id));
    expect(result).toMatchObject({ success: true });
    expect(Object.keys(result).sort()).toEqual(['message', 'success']);
    expect(JSON.stringify(result)).not.toContain('synthetic-test-key');
    const data = JSON.parse(requestBody(fetchImpl.mock.calls[0]![1]).messages[1]!.content) as { nodes: unknown[] };
    expect(data.nodes).toEqual([{ id: 'connection-test', text: 'Hello' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns a safe failed connection result', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ error: { message: 'synthetic-test-key RAW-BODY' } }, 401));
    const result = await getProvider(id, { fetchImpl }).testConnection(configFor(id));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/synthetic-test-key|RAW-BODY/);
  });

  it('discovers without a selected model, bounds/deduplicates the list, and protects its cached copy', async () => {
    const data = [null, { id: 'a', name: 'A', context_length: 10_000 }, { id: 'a' }, ...Array.from({ length: 1_100 }, (_, i) => ({ id: `model-${i}` }))];
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ data }));
    const provider = getProvider(id, { fetchImpl });
    const config = { ...configFor(id), model: '' };
    const models = await provider.listModels(config);
    expect(models).toHaveLength(1_000);
    expect(models[0]).toMatchObject({ id: 'a', name: 'A', contextLength: 10_000 });
    expect(new Set(models.map(model => model.id)).size).toBe(1_000);
    models[0]!.name = 'mutated';
    expect((await provider.listModels(config))[0]?.name).toBe('A');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![0]).toBe(`${config.baseUrl}/models${id === 'openrouter' ? '?limit=1000&offset=0' : ''}`);
  });

  it('expires model discovery after 15 minutes and isolates credentials', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ data: [{ id: 'a' }] }));
    const provider = getProvider(id, { fetchImpl });
    await provider.listModels(configFor(id));
    vi.setSystemTime(Date.now() + MODEL_CACHE_TTL_MS - 1);
    await provider.listModels(configFor(id));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 1);
    await provider.listModels(configFor(id));
    await provider.listModels({ ...configFor(id), apiKey: 'different-synthetic-key' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('allows a manually entered model when discovery fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => jsonResponse({}, 404))
      .mockImplementation(async (_url, init) => translatedResponse(init));
    const provider = getProvider(id, { fetchImpl });
    await expect(provider.listModels(configFor(id))).rejects.toMatchObject({ code: 'MODEL_NOT_FOUND' });
    expect((await provider.translate(inputFor(), { ...configFor(id), model: 'manual-model' })).translations).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(requestBody(fetchImpl.mock.calls[1]![1]).model).toBe('manual-model');
  });
});

describe('provider boundary', () => {
  it.each(['http://remote.example/v1', 'https://user:pass@example.test/v1', 'https://@example.com/v1', 'https://:@example.com/v1', 'https:///@example.com/v1', 'https:/@example.com/v1', 'https://example.test/v1?x=y', 'https://example.test/v1#part', 'https://example.test/v1?', 'https://example.test/v1#', 'file:///v1'])('rejects unsafe endpoint %s before fetching', async baseUrl => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(getProvider('openai-compatible', { fetchImpl }).translate(inputFor(), { ...configFor('openai-compatible'), baseUrl })).rejects.toMatchObject({ code: 'INVALID_SETTINGS' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(['http://localhost:8000/v1/', 'http://127.0.0.1:8000/v1', 'http://[::1]:8000/v1', 'https://API.Example.test/v1/'])('accepts and canonicalizes endpoint %s', async baseUrl => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => translatedResponse(init));
    await getProvider('openai-compatible', { fetchImpl }).translate(inputFor(), { ...configFor('openai-compatible'), baseUrl });
    expect(fetchImpl.mock.calls[0]![0]).toBe(`${new URL(baseUrl).href.replace(/\/+$/, '')}/chat/completions`);
  });

  it('does not forward an OpenRouter credential to another base URL', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(getProvider('openrouter', { fetchImpl }).translate(inputFor(), { ...configFor(), baseUrl: 'https://other.test/v1' })).rejects.toMatchObject({ code: 'INVALID_SETTINGS' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([{ apiKey: '' }, { apiKey: 'x'.repeat(4_097) }, { apiKey: 'bad\r\nkey' }, { apiKey: 'bad\0key' }, { model: '' }, { model: 'x'.repeat(201) }, { timeoutMs: 120_001 }, { timeoutMs: 999 }])('validates settings %j', async patch => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(getProvider('openrouter', { fetchImpl }).translate(inputFor(), { ...configFor(), ...patch })).rejects.toMatchObject({ code: 'INVALID_SETTINGS' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses JSON schema only for an explicitly discovered OpenRouter capability', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => init?.method === 'GET'
      ? jsonResponse({ data: [{ id: 'test/model', supported_parameters: ['response_format', 'structured_outputs'] }] })
      : translatedResponse(init));
    const provider = getProvider('openrouter', { fetchImpl });
    await provider.listModels(configFor());
    await provider.translate(inputFor(), configFor());
    expect(requestBody(fetchImpl.mock.calls[1]![1]).response_format).toMatchObject({ type: 'json_schema', json_schema: { strict: true } });
    await provider.translate(inputFor(), { ...configFor(), model: 'unknown-model' });
    expect(requestBody(fetchImpl.mock.calls[2]![1]).response_format).toBeUndefined();
    await provider.translate(inputFor(), { ...configFor(), apiKey: 'different-synthetic-key' });
    expect(requestBody(fetchImpl.mock.calls[3]![1]).response_format).toBeUndefined();
  });

  it('generic API never requires response_format, including after model discovery', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => init?.method === 'GET'
      ? jsonResponse({ data: [{ id: 'test/model', supported_parameters: ['structured_outputs'] }] })
      : translatedResponse(init));
    const provider = getProvider('openai-compatible', { fetchImpl });
    await provider.listModels(configFor('openai-compatible'));
    await provider.translate(inputFor(), configFor('openai-compatible'));
    expect(requestBody(fetchImpl.mock.calls[1]![1]).response_format).toBeUndefined();
    expect(requestBody(fetchImpl.mock.calls[1]![1]).provider).toBeUndefined();
  });

  it('does not use a structured-output capability after its discovery TTL expires', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => init?.method === 'GET'
      ? jsonResponse({ data: [{ id: 'test/model', supported_parameters: ['structured_outputs'] }] })
      : translatedResponse(init));
    const provider = getProvider('openrouter', { fetchImpl });
    await provider.listModels(configFor());
    vi.setSystemTime(Date.now() + MODEL_CACHE_TTL_MS);
    await provider.translate(inputFor(), configFor());
    expect(requestBody(fetchImpl.mock.calls[1]![1]).response_format).toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
