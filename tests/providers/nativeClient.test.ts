/** @spec spec://modules/platform/INFRA-003-local-cli#resources */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { browser } from 'wxt/browser';
import { NativeClient, type NativeRequest } from '../../src/providers/nativeClient';
vi.mock('wxt/browser', () => ({ browser: { runtime: {} } }));
const clients = new Set<NativeClient>();
beforeEach(() => vi.useFakeTimers());
afterEach(() => { for (const client of clients) client.dispose(); clients.clear(); vi.useRealTimers(); });
function setup() {
  const messages = new Set<(value: unknown) => void>();
  const disconnects = new Set<() => void>();
  const post = vi.fn<(value: Record<string, unknown>) => void>();
  const disconnect = vi.fn<() => void>();
  const port = {
    postMessage: post, disconnect,
    onMessage: { addListener: (f: (v: unknown) => void) => messages.add(f), removeListener: (f: (v: unknown) => void) => messages.delete(f) },
    onDisconnect: { addListener: (f: () => void) => disconnects.add(f), removeListener: (f: () => void) => disconnects.delete(f) },
  } as unknown as ReturnType<typeof browser.runtime.connectNative>;
  const connect = vi.fn(() => port);
  const client = new NativeClient(connect); clients.add(client);
  const receive = (value: unknown) => { for (const listener of messages) listener(value); };
  return { client, connect, post, disconnect, messages, disconnects, receive };
}
const request: NativeRequest = { type: 'status', providerId: 'codex-cli', model: 'default', timeoutMs: 1000 };

it('multiplexes independent replies over one port, ignores stale IDs and closes an idle connection', async () => {
  const f = setup();
  const a = f.client.request(request), b = f.client.request({ ...request, providerId: 'grok-build' });
  expect(f.connect).toHaveBeenCalledTimes(1);
  const one = f.post.mock.calls[0]![0], two = f.post.mock.calls[1]![0];
  expect(one.id).not.toBe(two.id);
  f.receive({ version: 1, id: two.id, ok: true, data: { available: true } });
  f.receive({ version: 1, id: one.id, ok: false, code: 'CLI_LOGIN_REQUIRED' });
  await expect(a).rejects.toMatchObject({ code: 'CLI_LOGIN_REQUIRED' });
  await expect(b).resolves.toEqual({ available: true });
  f.receive({ version: 1, id: one.id, ok: true, data: 'late' });
  expect(f.client.pendingCount).toBe(0);
  await vi.advanceTimersByTimeAsync(100);
  expect(f.disconnect).toHaveBeenCalledOnce();
  expect(f.messages.size + f.disconnects.size + vi.getTimerCount()).toBe(0);
});

it('sends cancellation and timeout to the host, detaches abort listeners and releases all timers', async () => {
  const f = setup(), signal = new AbortController();
  const abort = f.client.request(request, signal.signal);
  const timeout = f.client.request(request);
  const a = expect(abort).rejects.toMatchObject({ code: 'CANCELLED' });
  const b = expect(timeout).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
  signal.abort();
  await vi.advanceTimersByTimeAsync(1000);
  await Promise.all([a, b]);
  expect(f.post.mock.calls.filter(([message]) => message.type === 'cancel')).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(100);
  expect(f.client.pendingCount + f.messages.size + f.disconnects.size + vi.getTimerCount()).toBe(0);
});

it('missing host and malformed or unsafe errors reject pending requests without retaining raw diagnostics', async () => {
  const unavailable = new NativeClient(() => { throw new Error('private path and account'); });
  clients.add(unavailable);
  await expect(unavailable.request(request)).rejects.toMatchObject({ code: 'CLI_HOST_MISSING' });
  const f = setup(), a = f.client.request(request), b = f.client.request(request);
  f.receive({ version: 2, id: 'invalid', ok: true });
  await expect(a).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
  await expect(b).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
  expect(f.client.connected).toBe(false);
  const c = f.client.request(request);
  const id = f.post.mock.calls.at(-1)![0].id;
  f.receive({ version: 1, id, ok: false, code: 'SECRET_DIAGNOSTIC' });
  await expect(c).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
  f.client.dispose();
  expect(vi.getTimerCount()).toBe(0);
});

it('bounds pending requests and message bytes before sending source text', async () => {
  const f = setup();
  const pending = Array.from({ length: 16 }, () => f.client.request(request));
  const rejected = pending.map(p => expect(p).rejects.toMatchObject({ code: 'CLI_HOST_MISSING' }));
  await expect(f.client.request(request)).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  for (const listener of f.disconnects) listener();
  await Promise.all(rejected);
  await expect(f.client.request({ ...request, type: 'translate', messages: [
    { role: 'system', content: '' }, { role: 'user', content: 'я'.repeat(500_000) },
  ] })).rejects.toMatchObject({ code: 'CONTEXT_TOO_LARGE' });
  expect(f.post).toHaveBeenCalledTimes(16);
});

it('repeated connect/reply cycles do not accumulate port listeners, pending entries or timers', async () => {
  const f = setup();
  for (let i = 0; i < 30; i++) {
    const result = f.client.request(request);
    f.receive({ version: 1, id: f.post.mock.calls.at(-1)![0].id, ok: true, data: { available: true } });
    await result; await vi.advanceTimersByTimeAsync(100);
    expect(f.client.pendingCount + f.messages.size + f.disconnects.size + vi.getTimerCount()).toBe(0);
  }
  expect(f.disconnect).toHaveBeenCalledTimes(30);
});
