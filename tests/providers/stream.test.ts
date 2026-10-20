// @vitest-environment node
/** @spec spec://modules/translation/FEAT-001-engine#providers */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TranslationItem } from '../../src/shared/contracts';
import { MAX_RESPONSE_BYTES } from '../../src/shared/constants';
import { getProvider } from '../../src/providers/registry';
import { readChatStream, SseFrames } from '../../src/providers/stream';
import { IncrementalTranslations } from '../../src/translation/incremental';
import { completion, configFor, inputFor, jsonResponse, requestBody } from './fixtures';

afterEach(() => vi.useRealTimers());
const translations = [{ id: 'n1', text: 'Привет "}\\\n🙂' }, { id: 'n2', text: 'Цена: 12 $ / 3 кг' }];
const content = JSON.stringify({ translations });
const frame = (event: unknown, newline = '\n') => `data: ${JSON.stringify(event)}${newline}${newline}`;
const delta = (text: string, finish: string | null = null) => ({ id: 'generation-local', choices: [{ index: 0, delta: { content: text }, finish_reason: finish }] });
function wire(json = content, newline = '\n') {
  return `: keepalive${newline}${newline}` + frame(delta(json), newline) + frame(delta('', 'stop'), newline)
    + frame({ choices: [], usage: { total_tokens: 15 } }, newline) + `data: [DONE]${newline}${newline}`;
}
function response(text: string, chunkSize = 13) {
  const bytes = new TextEncoder().encode(text);
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    for (let at = 0; at < bytes.length; at += chunkSize) controller.enqueue(bytes.slice(at, at + chunkSize));
    controller.close();
  }, cancel });
  return { response: new Response(body, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'x-generation-id': 'generation-local' } }), body, cancel };
}

describe('incremental JSON and SSE validation', () => {
  /** @spec spec://modules/translation/FEAT-001-engine#validation */
  it('emits only closed objects through every character boundary, escaped strings and a fence', () => {
    const values: TranslationItem[] = [];
    const parser = new IncrementalTranslations(inputFor().nodes, item => values.push(item));
    const firstEnd = content.indexOf('},{') + 1;
    for (const char of content.slice(0, firstEnd - 1)) parser.push(char);
    expect(values).toEqual([]);
    parser.push(content[firstEnd - 1]!);
    expect(values).toEqual([translations[0]]);
    for (const char of content.slice(firstEnd)) parser.push(char);
    expect(parser.finish()).toEqual(translations);
    const fenced = new IncrementalTranslations(inputFor().nodes, () => undefined);
    for (const char of `\n\x60\x60\x60json\n${content}\n\x60\x60\x60`) fenced.push(char);
    expect(fenced.finish()).toEqual(translations);
  });

  it.each([1, 2, 3, 7, 19, 127])('handles SSE/UTF-8/JSON splits at %s bytes and unlocks its reader', async size => {
    for (const newline of ['\n', '\r\n', '\r']) {
      const stream = response(wire(content, newline), size);
      const seen: TranslationItem[] = [];
      expect(await readChatStream(stream.response, inputFor().nodes, new AbortController().signal, item => seen.push(item), {})).toEqual(translations);
      expect(seen).toEqual(translations);
      expect(stream.body.locked).toBe(false);
    }
  });

  it('supports multiline data, comments, role frames and repeated stop with usage', async () => {
    const event = JSON.stringify(delta(content));
    const multiline = `: ping\r\ndata: ${event.slice(0, event.indexOf('"choices"'))}\r\ndata: ${event.slice(event.indexOf('"choices"'))}\r\n\r\n`;
    const stream = response(frame({ choices: [{ delta: { role: 'assistant' }, finish_reason: null }] }) + multiline
      + frame(delta('', 'stop')) + frame({ ...delta('', 'stop'), usage: { total_tokens: 12 } }) + 'data: [DONE]\n\n');
    expect(await readChatStream(stream.response, inputFor().nodes, new AbortController().signal, () => undefined, {})).toEqual(translations);
  });

  it.each([
    JSON.stringify({ translations: [translations[0], translations[0]] }),
    JSON.stringify({ translations: [translations[0], { id: 'unknown', text: 'bad' }] }),
    JSON.stringify({ translations: [translations[0]] }),
    JSON.stringify({ translations, extra: true }),
    content.slice(0, -1),
    content + ' junk',
  ])('rejects corrupt final JSON even after valid previews: %s', async json => {
    const stream = response(wire(json));
    await expect(readChatStream(stream.response, inputFor().nodes, new AbortController().signal, () => undefined, {})).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
    expect(stream.body.locked).toBe(false);
  });

  it.each([frame(delta(content)), frame(delta(content, 'stop')), 'data: [DONE]\n\n', frame(delta(content, 'length')), frame(delta(content, 'tool_calls'))])('rejects unfinished transport or invalid completion', async text => {
    const stream = response(text);
    await expect(readChatStream(stream.response, inputFor().nodes, new AbortController().signal, () => undefined, {})).rejects.toHaveProperty('code');
    expect(stream.body.locked).toBe(false);
  });

  it('maps and sanitizes an API error after HTTP 200 without returning partial success', async () => {
    const stream = response(frame(delta(`{"translations":[${JSON.stringify(translations[0])},`))
      + frame({ error: { code: 401, message: 'Blocked Bearer synthetic-test-key' } }));
    const seen = vi.fn();
    const error = await readChatStream(stream.response, inputFor().nodes, new AbortController().signal, seen, { secrets: ['synthetic-test-key'] }).catch(error => error);
    expect(seen).toHaveBeenCalledOnce();
    expect(error).toMatchObject({ code: 'INVALID_API_KEY', diagnostic: { httpStatus: 200, source: 'api', apiCode: '401' } });
    expect(error.diagnostic).not.toHaveProperty('requestId');
    expect(JSON.stringify(error.diagnostic)).not.toContain('synthetic-test-key');
    expect(stream.body.locked).toBe(false);
  });

  it('rejects invalid or unfinished UTF-8 and unlocks the body', async () => {
    for (const bytes of [new Uint8Array([0xff]), new Uint8Array([0xf0, 0x9f])]) {
      const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close(); } });
      await expect(readChatStream(new Response(body), inputFor().nodes, new AbortController().signal, () => undefined, {})).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
      expect(body.locked).toBe(false);
    }
  });

  it('bounds wire bytes, model bytes and event counts, and cancels pending readers on abort', async () => {
    const parser = new IncrementalTranslations(inputFor().nodes, () => undefined);
    expect(() => parser.push('я'.repeat(MAX_RESPONSE_BYTES))).toThrow();
    const frames = new SseFrames(() => undefined);
    expect(() => frames.push('data: {}\n\n'.repeat(16_385))).toThrow();
    const controller = new AbortController();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const pending = readChatStream(new Response(body), inputFor().nodes, controller.signal, () => undefined, {}).catch(error => error);
    controller.abort();
    expect(await pending).toMatchObject({ code: 'CANCELLED' });
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
    const large = response(' '.repeat(MAX_RESPONSE_BYTES + 1), 200_000);
    await expect(readChatStream(large.response, inputFor().nodes, new AbortController().signal, () => undefined, {})).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
  });
});

describe.each(['openrouter', 'openai-compatible'] as const)('%s streaming requests', id => {
  it('streams page translation, keeps test connection regular and accepts JSON fallback without a second request', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => response(wire()).response).mockResolvedValueOnce(response(wire()).response);
    const provider = getProvider(id, { fetchImpl });
    const config = { ...configFor(id), streaming: true };
    const progress = vi.fn();
    expect((await provider.translate(inputFor(), config, undefined, undefined, progress)).translations).toEqual(translations);
    expect(progress.mock.calls.at(-1)?.[0]).toEqual({ kind: 'segments', translations });
    expect(requestBody(fetchImpl.mock.calls[0]![1]).stream).toBe(true);
    fetchImpl.mockResolvedValueOnce(completion(content));
    await provider.translate(inputFor(), config);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    fetchImpl.mockResolvedValueOnce(completion('{"translations":[{"id":"connection-test","text":"Привет"}]}'));
    expect((await provider.testConnection(config)).success).toBe(true);
    expect(requestBody(fetchImpl.mock.calls[2]![1]).stream).toBe(false);
  });

  it('uses one explicit unsupported-stream fallback within the retry limit', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ error: { code: 'unsupported_parameter', param: 'stream' } }, 422))
      .mockResolvedValueOnce(completion(content));
    const progress = vi.fn();
    await getProvider(id, { fetchImpl }).translate(inputFor(), { ...configFor(id), streaming: true }, undefined, undefined, progress);
    expect(fetchImpl.mock.calls.map(call => requestBody(call[1]).stream)).toEqual([true, false]);
    expect(progress).toHaveBeenCalledWith({ kind: 'reset' });
  });

  it('resets previews on malformed retries and journals one terminal failure with released timers', async () => {
    vi.useFakeTimers();
    const bad = JSON.stringify({ translations: [translations[0]] });
    const fetchImpl = vi.fn<typeof fetch>(async () => response(wire(bad)).response);
    const onError = vi.fn(); const progress = vi.fn();
    const pending = getProvider(id, { fetchImpl, onError }).translate(inputFor(), { ...configFor(id), streaming: true }, undefined, undefined, progress).catch(error => error);
    await vi.advanceTimersByTimeAsync(600);
    expect(await pending).toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(progress.mock.calls.filter(call => call[0].kind === 'reset')).toHaveLength(2);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]![0].attempts).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
