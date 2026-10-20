// @vitest-environment node
/** @spec spec://modules/translation/FEAT-001-engine#dedup */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TranslationEngine } from '../../src/translation/engine';
import { completion, configFor, deferred, fakeCache, inputFor, jsonResponse, requestBody, translatedResponse } from '../providers/fixtures';

vi.mock('wxt/browser', () => ({ browser: {} }));
afterEach(() => vi.useRealTimers());
const tooLong = () => jsonResponse({ choices: [{ message: { content: '{}' }, finish_reason: 'length' }] });

describe('bounded recovery inside one occupied request slot', () => {
  it('splits truncation into smaller contexts and caches only after both halves validate', async () => {
    const input = { ...inputFor(), nodes: Array.from({ length: 4 }, (_, i) => ({ id: `n${i}`, text: `Text ${i}` })) };
    const second = deferred<Response>();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(tooLong())
      .mockImplementationOnce(async (_url, init) => translatedResponse(init)).mockImplementationOnce(() => second.promise);
    const cache = fakeCache();
    const engine = new TranslationEngine(cache, { fetchImpl });
    const pending = engine.translate(input, configFor());
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(3));
    expect(cache.set).not.toHaveBeenCalled();
    expect(engine.activeRequestCount).toBe(1);
    for (const call of fetchImpl.mock.calls.slice(1)) {
      const body = JSON.parse(requestBody(call[1]).messages[1]!.content);
      expect(body.nodes).toHaveLength(2);
      expect(body.sourceContext).toHaveLength(2);
    }
    second.resolve(translatedResponse(fetchImpl.mock.calls[2]![1]));
    expect((await pending).translations.map(item => item.id)).toEqual(input.nodes.map(node => node.id));
    expect(cache.set).toHaveBeenCalledTimes(4);
    expect(engine.inFlightCount).toBe(0);
    expect(engine.progressListenerCount).toBe(0);
  });

  it('reassembles a single long node with its original ID, preserving all source characters', async () => {
    const source = '人工智能。'.repeat(100);
    const input = { ...inputFor(), nodes: [{ id: 'long', text: source }] };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(tooLong()).mockImplementation(async (_url, init) => {
      const data = JSON.parse(requestBody(init).messages[1]!.content);
      return completion(JSON.stringify({ translations: data.nodes.map((node: { id: string; text: string }) => ({ id: node.id, text: node.text })) }));
    });
    const cache = fakeCache();
    const engine = new TranslationEngine(cache, { fetchImpl });
    expect((await engine.translate(input, configFor())).translations).toEqual([{ id: 'long', text: source }]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const call of fetchImpl.mock.calls.slice(1)) {
      const data = JSON.parse(requestBody(call[1]).messages[1]!.content);
      expect(data.nodes[0].text.length).toBeLessThanOrEqual(source.length * .6);
    }
    expect(cache.set).toHaveBeenCalledTimes(1);
    await engine.translate(input, configFor());
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('stops recovery after a finite depth and leaves no cached halves', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => tooLong());
    const cache = fakeCache();
    const engine = new TranslationEngine(cache, { fetchImpl });
    const input = { ...inputFor(), nodes: Array.from({ length: 16 }, (_, i) => ({ id: `n${i}`, text: `source ${i}` })) };
    await expect(engine.translate(input, configFor())).rejects.toMatchObject({ code: 'CONTEXT_TOO_LARGE' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(cache.set).not.toHaveBeenCalled();
    expect(engine.inFlightCount).toBe(0);
  });

  it('bounds the combined output of validated halves before any cache write', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(tooLong()).mockImplementation(async (_url, init) => {
      const data = JSON.parse(requestBody(init).messages[1]!.content);
      return completion(JSON.stringify({ translations: data.nodes.map((node: { id: string }) => ({ id: node.id, text: 'я'.repeat(300_000) })) }));
    });
    const cache = fakeCache();
    const engine = new TranslationEngine(cache, { fetchImpl });
    await expect(engine.translate(inputFor(), configFor())).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
    expect(cache.set).not.toHaveBeenCalled();
    expect(engine.inFlightCount).toBe(0);
  });

  it.each([401, 429, 503])('does not fan out an HTTP %s failure', async status => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ error: { code: status } }, status));
    const engine = new TranslationEngine(fakeCache(), { fetchImpl });
    const pending = engine.translate(inputFor(), configFor());
    const rejection = expect(pending).rejects.toMatchObject({ code: status === 401 ? 'INVALID_API_KEY' : status === 429 ? 'RATE_LIMIT' : 'PROVIDER_UNAVAILABLE' });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(2_000);
    await rejection;
    expect(fetchImpl).toHaveBeenCalledTimes(status === 401 ? 1 : 3);
    expect(engine.inFlightCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels between successful and pending halves without cache or listeners', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(tooLong())
      .mockImplementationOnce(async (_url, init) => translatedResponse(init)).mockImplementationOnce(() => new Promise(() => {}));
    const cache = fakeCache();
    const engine = new TranslationEngine(cache, { fetchImpl });
    const pending = engine.translate(inputFor(), configFor(), controller.signal, vi.fn());
    const rejection = expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(3));
    controller.abort();
    await rejection;
    await vi.waitFor(() => expect(engine.activeRequestCount).toBe(0));
    expect(cache.set).not.toHaveBeenCalled();
    expect(engine.inFlightCount).toBe(0);
    expect(engine.progressListenerCount).toBe(0);
  });
});
