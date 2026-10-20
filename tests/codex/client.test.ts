// @vitest-environment node
/** @spec spec://modules/platform/INFRA-004-codex-connection#resources */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { browser } from 'wxt/browser';
import { CodexClient } from '../../src/codex/client';
import { LinguistyError } from '../../src/shared/errors';
vi.mock('wxt/browser', () => ({ browser: { runtime: {} } }));
const clients = new Set<CodexClient>();
beforeEach(() => vi.useFakeTimers());
afterEach(() => { for (const client of clients) client.dispose(); clients.clear(); vi.useRealTimers(); });
function setup() {
  const messages = new Set<(value: unknown) => void>(), disconnects = new Set<() => void>();
  const post = vi.fn<(value: Record<string, unknown>) => void>(); const disconnect = vi.fn();
  const port = { postMessage: post, disconnect,
    onMessage: { addListener: (f: (v: unknown) => void) => messages.add(f), removeListener: (f: (v: unknown) => void) => messages.delete(f) },
    onDisconnect: { addListener: (f: () => void) => disconnects.add(f), removeListener: (f: () => void) => disconnects.delete(f) },
  } as unknown as ReturnType<typeof browser.runtime.connect>;
  const connect = vi.fn(() => port); const client = new CodexClient(connect); clients.add(client);
  const receive = (value: unknown) => { for (const listener of messages) listener(value); };
  return { client, connect, post, disconnect, messages, disconnects, receive };
}
it('multiplexes replies and repeats thirty lifecycles without retaining ports, listeners or timers', async () => {
  const f = setup();
  for (let index = 0; index < 30; index++) {
    const one = f.client.request({ type: 'status', timeoutMs: 1000 }), two = f.client.request({ type: 'models', timeoutMs: 1000 });
    const a = f.post.mock.calls.at(-2)![0], b = f.post.mock.calls.at(-1)![0];
    f.receive({ version: 1, id: b.id, ok: true, data: [] }); f.receive({ version: 1, id: a.id, ok: true, data: { connected: true } });
    await Promise.all([one, two]); await vi.advanceTimersByTimeAsync(100);
    expect(f.client.pendingCount + f.messages.size + f.disconnects.size + vi.getTimerCount()).toBe(0);
  }
  expect(f.connect).toHaveBeenCalledTimes(30);
});
it('bounds pending requests and cancels timeout/abort without leaving source data queued', async () => {
  const f = setup(), controller = new AbortController(); const promises = Array.from({ length: 16 }, () => f.client.request({ type: 'models', timeoutMs: 1000 }, controller.signal));
  const rejected = promises.map(promise => expect(promise).rejects.toMatchObject({ code: 'CANCELLED' }));
  await expect(f.client.request({ type: 'status', timeoutMs: 1000 })).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  controller.abort(); await Promise.all(rejected); await vi.advanceTimersByTimeAsync(100);
  const timeout = expect(f.client.request({ type: 'status', timeoutMs: 1000 })).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
  await vi.advanceTimersByTimeAsync(1100); await timeout;
  expect(f.client.pendingCount + f.messages.size + f.disconnects.size + vi.getTimerCount()).toBe(0);
});
it('rejects a missing page and malformed frames using safe fixed errors', async () => {
  const missing = new CodexClient(() => { throw new Error('private detail'); }); clients.add(missing);
  await expect(missing.request({ type: 'status', timeoutMs: 1000 })).rejects.toMatchObject({ code: 'CODEX_NOT_CONNECTED' });
  const f = setup(), promise = f.client.request({ type: 'status', timeoutMs: 1000 });
  f.receive({ version: 99, id: f.post.mock.calls[0]![0].id, ok: false, code: 'SECRET_TEXT' });
  await expect(promise).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' }); expect(f.client.connected).toBe(false);
});

/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
it.each(['LGT-response-completion', 'LGT-response-empty', 'LGT-response-phase', 'LGT-response-conflict', 'private-token', 'LGT-response-private-token'])('allows only fixed translation failure references across the port: %s', async reference => {
  const f = setup(), promise = f.client.request({ type: 'models', timeoutMs: 1000 });
  f.receive({ version: 1, id: f.post.mock.calls[0]![0].id, ok: false, code: 'INVALID_MODEL_RESPONSE', reference,
    message: 'private-provider-message', body: 'private-source-text' });
  const error = await promise.catch(value => value);
  if (!(error instanceof LinguistyError)) throw new Error('Expected a safe LinguistyError');
  expect(error.code).toBe('INVALID_MODEL_RESPONSE');
  expect(error.message).toBe('Модель вернула некорректный ответ.' + (reference.includes('private') ? '' : ` [${reference}]`));
  expect(JSON.stringify(error)).not.toMatch(/private/);
  await vi.advanceTimersByTimeAsync(100);
  expect(f.client.pendingCount + f.messages.size + f.disconnects.size + vi.getTimerCount()).toBe(0);
});
