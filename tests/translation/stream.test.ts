// @vitest-environment node
/** @spec spec://modules/translation/FEAT-001-engine#dedup */
import { describe, expect, it, vi } from 'vitest';
import { TranslationEngine } from '../../src/translation/engine';
import { configFor, fakeCache, inputFor } from '../providers/fixtures';
vi.mock('wxt/browser', () => ({ browser: {} }));
function controlled() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ start(value) { controller = value; }, cancel });
  const emit = (event: unknown) => controller.enqueue(new TextEncoder().encode(`data: ${typeof event === 'string' ? event : JSON.stringify(event)}\n\n`));
  return { body, cancel, response: new Response(body, { headers: { 'content-type': 'text/event-stream' } }),
    content(text: string) { emit({ choices: [{ index: 0, delta: { content: text }, finish_reason: null }] }); },
    finish() { emit({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }); emit('[DONE]'); }, error() { emit({ error: { code: 401 } }); } };
}
describe('stream subscribers and cache finalization', () => {
  it('remaps deduplicated previews, replays them to late consumers and caches only after complete validation', async () => {
    const stream = controlled(); const cache = fakeCache(); const fetchImpl = vi.fn<typeof fetch>(async () => stream.response);
    const engine = new TranslationEngine(cache, { fetchImpl }); const config = { ...configFor(), streaming: true };
    const input = inputFor(); input.nodes.push({ id: 'duplicate', text: 'Hello' });
    const progress = vi.fn(); const lateProgress = vi.fn();
    const one = engine.translate(input, config, undefined, progress);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    stream.content('{"translations":[{"id":"n1","text":"Привет"},');
    await vi.waitFor(() => expect(progress).toHaveBeenCalledOnce());
    expect(progress.mock.calls[0]![0]).toEqual({ kind: 'segments', translations: [{ id: 'n1', text: 'Привет' }, { id: 'duplicate', text: 'Привет' }] });
    expect(cache.values.size).toBe(0);
    const two = engine.translate({ ...input, nodes: input.nodes.map(node => ({ ...node, id: `late-${node.id}` })) }, config, undefined, lateProgress);
    await vi.waitFor(() => expect(lateProgress).toHaveBeenCalledOnce());
    expect(lateProgress.mock.calls[0]![0].translations.map((item: { id: string }) => item.id)).toEqual(['late-n1', 'late-duplicate']);
    expect(engine.progressListenerCount).toBe(2); expect(fetchImpl).toHaveBeenCalledOnce();
    stream.content('{"id":"n2","text":"Цена"}]}'); stream.finish();
    const [a, b] = await Promise.all([one, two]);
    expect(a.translations.map(item => item.text)).toEqual(b.translations.map(item => item.text));
    expect(cache.values.size).toBe(2); expect(cache.set).toHaveBeenCalledTimes(2);
    expect(engine.inFlightCount).toBe(0); expect(engine.progressListenerCount).toBe(0); expect(engine.activeRequestCount).toBe(0);
    expect(stream.body.locked).toBe(false); expect(stream.cancel).toHaveBeenCalledOnce();
  });

  it('removes cancelled consumers and aborts the last reader with no cached previews', async () => {
    const stream = controlled(); const cache = fakeCache(); const fetchImpl = vi.fn<typeof fetch>(async () => stream.response);
    const engine = new TranslationEngine(cache, { fetchImpl }); const config = { ...configFor(), streaming: true };
    const abort = new AbortController(); const progress = vi.fn();
    const pending = engine.translate(inputFor(), config, abort.signal, progress).catch(error => error);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    stream.content('{"translations":[{"id":"n1","text":"Привет"},');
    await vi.waitFor(() => expect(progress).toHaveBeenCalledOnce()); abort.abort();
    expect(await pending).toMatchObject({ code: 'CANCELLED' });
    await vi.waitFor(() => expect(engine.activeRequestCount).toBe(0));
    expect(engine.progressListenerCount).toBe(0); expect(engine.inFlightCount).toBe(0); expect(engine.pendingRequestCount).toBe(0);
    expect(stream.cancel).toHaveBeenCalledOnce(); expect(stream.body.locked).toBe(false); expect(cache.values.size).toBe(0);
  });

  it('broadcasts a rollback and releases all subscriptions after an HTTP 200 error', async () => {
    const stream = controlled(); const cache = fakeCache(); const engine = new TranslationEngine(cache, { fetchImpl: vi.fn(async () => stream.response) });
    const progress = vi.fn(); const pending = engine.translate(inputFor(), { ...configFor(), streaming: true }, undefined, progress).catch(error => error);
    await vi.waitFor(() => expect(engine.activeRequestCount).toBe(1));
    stream.content('{"translations":[{"id":"n1","text":"Привет"},'); await vi.waitFor(() => expect(progress).toHaveBeenCalledOnce());
    stream.error(); expect(await pending).toMatchObject({ code: 'INVALID_API_KEY' });
    expect(progress.mock.calls.at(-1)?.[0]).toEqual({ kind: 'reset' });
    expect(cache.values.size).toBe(0); expect(engine.inFlightCount).toBe(0); expect(engine.progressListenerCount).toBe(0); expect(stream.body.locked).toBe(false);
  });
});
