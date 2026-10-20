// @vitest-environment node
/** @spec spec://modules/platform/INFRA-004-codex-connection#auth */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { authorize, callbackRule } from '../../src/codex/browserAuth';
import { CODEX_CALLBACK_CHANNEL, CODEX_CALLBACK_URL } from '../../src/codex/protocol';
const f = vi.hoisted(() => ({ messages: new Set<(...args: unknown[]) => unknown>(), removed: new Set<(id: number) => void>(),
  create: vi.fn(), update: vi.fn(), remove: vi.fn(), rules: vi.fn(), getURL: (path: string) => `chrome-extension://own/${path.replace(/^\//, '')}` }));
vi.mock('wxt/browser', () => ({ browser: { runtime: { id: 'own', getURL: f.getURL,
  onMessage: { addListener: (value: (...args: unknown[]) => unknown) => f.messages.add(value), removeListener: (value: (...args: unknown[]) => unknown) => f.messages.delete(value) } },
  tabs: { getCurrent: async () => ({ id: 7 }), create: f.create, update: f.update, remove: f.remove,
    onRemoved: { addListener: (value: (id: number) => void) => f.removed.add(value), removeListener: (value: (id: number) => void) => f.removed.delete(value) } },
  declarativeNetRequest: { updateSessionRules: f.rules },
} }));
beforeEach(() => {
  f.messages.clear(); f.removed.clear(); f.create.mockReset().mockResolvedValue({ id: 42 }); f.update.mockReset().mockResolvedValue({});
  f.remove.mockReset().mockResolvedValue(undefined); f.rules.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());
it('restricts the callback rule to the exact own auth tab/state and never localhost or other sign-ins', () => {
  const rule = callbackRule({ state: 'unique-state', nonce: '', verifier: '', url: '' }, 42);
  expect(rule.condition.tabIds).toEqual([42]); const regex = new RegExp(rule.condition.regexFilter);
  expect(regex.test(`${CODEX_CALLBACK_URL}?code=a&state=unique-state&client_id=b`)).toBe(true);
  expect(regex.test(`${CODEX_CALLBACK_URL}?state=unique-state&code=a`)).toBe(true);
  expect(regex.test(`${CODEX_CALLBACK_URL}?state=other&code=a`)).toBe(false);
  expect(regex.test('http://localhost:1455/auth/callback?state=unique-state')).toBe(false);
  expect(rule.action.redirect.regexSubstitution).toBe('chrome-extension://own/codex-callback.html#\\0');
});
it('ignores a foreign sender and tab, then releases only its own callback rule/tab/listeners', async () => {
  f.update.mockImplementation(async (_id, properties) => {
    const state = new URL(properties.url).searchParams.get('state'); const callback = `${CODEX_CALLBACK_URL}?state=${state}&code=own-code&client_id=own-client`;
    const message = { channel: CODEX_CALLBACK_CHANNEL, callback };
    for (const listener of f.messages) {
      expect(listener(message, { id: 'other', url: f.getURL('/codex-callback.html'), tab: { id: 42 } }, vi.fn())).toBeUndefined();
      expect(listener(message, { id: 'own', url: f.getURL('/codex-callback.html'), tab: { id: 99 } }, vi.fn())).toBeUndefined();
      listener(message, { id: 'own', url: f.getURL('/codex-callback.html'), tab: { id: 42 } }, vi.fn());
    }
    return {};
  });
  const result = await authorize({ hostId: 'unit-host' }, new AbortController().signal);
  expect(result.callback).toContain('own-code');
  expect(f.rules.mock.calls[0]![0].addRules[0].condition.tabIds).toEqual([42]);
  expect(f.rules.mock.calls.at(-1)![0]).toEqual({ removeRuleIds: [f.rules.mock.calls[0]![0].addRules[0].id] });
  expect(f.rules.mock.calls[0]![0].addRules[0].condition.excludedTabIds).toEqual([7]);
  expect(f.remove).toHaveBeenCalledExactlyOnceWith(42); expect(f.messages.size + f.removed.size).toBe(0);
});
it('cleans up cancellation and failed rule registration and leaves no timers', async () => {
  vi.useFakeTimers(); const controller = new AbortController();
  const pending = authorize({ hostId: 'unit-host' }, controller.signal); const rejected = expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
  await vi.waitFor(() => expect(f.update).toHaveBeenCalled()); controller.abort(); await rejected;
  expect(f.messages.size + f.removed.size + vi.getTimerCount()).toBe(0);
  f.rules.mockRejectedValueOnce(new Error('Rule rejected'));
  await expect(authorize({ hostId: 'unit-host' }, new AbortController().signal)).rejects.toThrow('Rule rejected');
  expect(f.messages.size + f.removed.size + vi.getTimerCount()).toBe(0);
});
