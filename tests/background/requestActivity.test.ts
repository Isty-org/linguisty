/** @spec spec://modules/platform/INFRA-001-extension#runtime */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerBackgroundController, type BackgroundRegistration } from '../../src/background/controller';
import { RequestActivity } from '../../src/background/requestActivity';
import type { TabTranslationState, TranslationResult } from '../../src/shared/contracts';
import { batchTimeoutMs } from '../../src/translation/segments';
import { deferred, fakeBrowser, fakeDependencies } from './harness';

vi.mock('wxt/browser', () => ({ browser: {} }));
const active = new Set<BackgroundRegistration>();
afterEach(async () => {
  for (const controller of active) await controller.dispose();
  active.clear();
  vi.useRealTimers();
});

async function setup(scheme = 'moz-extension') {
  vi.useFakeTimers();
  const fake = fakeBrowser(scheme);
  const store = fakeDependencies();
  store.dependencies.loadSettings.mockResolvedValue({ ...store.settings(), requestTimeoutMs: 120_000 });
  const controller = registerBackgroundController({ api: fake.api, ...store.dependencies });
  active.add(controller);
  await controller.ready;
  const ui = (type: string, extra = {}) => controller.handleMessage({ channel: 'linguisty', type, ...extra }, fake.ui);
  const started = await ui('START_TRANSLATION', { tabId: 1 });
  expect(started.ok).toBe(true);
  if (!started.ok) throw new Error('Session start failed');
  const state = started.data as TabTranslationState;
  const batch = () => controller.handleMessage({ channel: 'linguisty', type: 'TRANSLATE_BATCH',
    sessionId: state.sessionId, batchId: 'slow', nodes: [{ id: 'n', text: 'Hello' }],
    pageContext: { domain: 'example.org', title: 'Test' } }, fake.content());
  return { fake, store, controller, ui, batch };
}

describe('activity of deadline-bounded provider requests', () => {
  it.each(['moz-extension', 'chrome-extension'])('coalesces concurrent work and releases on completion in %s', async scheme => {
    const f = await setup(scheme);
    await vi.advanceTimersByTimeAsync(60_000);
    await f.ui('GET_SETTINGS');
    expect(f.fake.runtime.getPlatformInfo).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    const pending = deferred<TranslationResult>();
    const connection = deferred<{ success: boolean; message: string }>();
    f.store.dependencies.engine.translate.mockReturnValue(pending.promise);
    f.store.dependencies.engine.testConnection.mockReturnValue(connection.promise);
    const first = f.batch();
    const duplicate = f.batch();
    const uiRequest = f.ui('TEST_CONNECTION');
    await vi.advanceTimersByTimeAsync(40_000);
    expect(f.fake.runtime.getPlatformInfo).toHaveBeenCalledTimes(2);
    expect(f.store.dependencies.engine.translate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(3); // Two deadlines, one shared activity timer.
    pending.resolve({ translations: [{ id: 'n', text: 'Bonjour' }], fromCache: 0 });
    expect((await first).ok).toBe(true);
    expect((await duplicate).ok).toBe(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(f.fake.runtime.getPlatformInfo).toHaveBeenCalledTimes(3);
    connection.resolve({ success: true, message: 'done' });
    expect((await uiRequest).ok).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.fake.runtime.getPlatformInfo).toHaveBeenCalledTimes(3);
  });

  /** @spec spec://common/PROP-002-quality#resources */
  it.each(['cancel', 'original', 'tab-close', 'dispose'])('releases batch activity after %s even when the provider ignores abort', async action => {
    const f = await setup();
    const pending = deferred<TranslationResult>();
    f.store.dependencies.engine.translate.mockReturnValue(pending.promise);
    const reply = f.batch();
    await vi.advanceTimersByTimeAsync(20_000);
    const signal = f.store.dependencies.engine.translate.mock.calls[0]![2]!;
    if (action === 'cancel') await f.ui('CANCEL_TRANSLATION', { tabId: 1 });
    if (action === 'original') await f.ui('SET_DISPLAY_MODE', { tabId: 1, mode: 'original' });
    if (action === 'tab-close') for (const listener of f.fake.tabs.onRemoved.listeners) listener(1, { windowId: 1, isWindowClosing: false });
    if (action === 'dispose') await f.controller.dispose();
    expect(await reply).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    pending.resolve({ translations: [{ id: 'n', text: 'late' }], fromCache: 0 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.fake.runtime.getPlatformInfo).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases a hung batch at its total deadline', async () => {
    const f = await setup();
    f.store.dependencies.engine.translate.mockReturnValue(new Promise(() => undefined));
    const reply = f.batch();
    await vi.advanceTimersByTimeAsync(batchTimeoutMs(120_000));
    expect(await reply).toMatchObject({ ok: false, error: { code: 'REQUEST_TIMEOUT' } });
    expect(vi.getTimerCount()).toBe(0);
    const calls = f.fake.runtime.getPlatformInfo.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.fake.runtime.getPlatformInfo).toHaveBeenCalledTimes(calls);
  });

  it.each(['TEST_CONNECTION', 'LIST_MODELS'])('bounds and clears %s activity at provider timeout', async type => {
    const f = await setup();
    f.store.dependencies.engine.testConnection.mockReturnValue(new Promise(() => undefined));
    f.store.dependencies.engine.listModels.mockReturnValue(new Promise(() => undefined));
    const reply = f.ui(type);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await reply).toMatchObject({ ok: false, error: { code: 'REQUEST_TIMEOUT' } });
    expect(vi.getTimerCount()).toBe(0);
    const calls = f.fake.runtime.getPlatformInfo.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.fake.runtime.getPlatformInfo).toHaveBeenCalledTimes(calls);
  });

  it('releases UI activity when settings cancellation aborts the request', async () => {
    const f = await setup();
    f.store.dependencies.engine.listModels.mockReturnValue(new Promise(() => undefined));
    const reply = f.ui('LIST_MODELS');
    await vi.advanceTimersByTimeAsync(20_000);
    await f.ui('REMOVE_API_KEY');
    expect(await reply).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not overlap a stalled browser API or revive activity after its late reply', async () => {
    const f = await setup();
    const touch = deferred<{ os: string; arch: string }>();
    f.fake.runtime.getPlatformInfo.mockReturnValue(touch.promise);
    f.store.dependencies.engine.listModels.mockReturnValue(new Promise(() => undefined));
    const reply = f.ui('LIST_MODELS');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.fake.runtime.getPlatformInfo).toHaveBeenCalledTimes(1);
    await f.controller.dispose();
    expect(await reply).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    expect(vi.getTimerCount()).toBe(0);
    touch.resolve({ os: 'win', arch: 'x86-64' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.fake.runtime.getPlatformInfo).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('contains activity API failures and releases activity on provider rejection', async () => {
    const f = await setup();
    f.fake.runtime.getPlatformInfo.mockRejectedValueOnce(new Error('runtime unavailable'));
    const pending = deferred<TranslationResult>();
    f.store.dependencies.engine.translate.mockReturnValue(pending.promise);
    const reply = f.batch();
    await vi.advanceTimersByTimeAsync(40_000);
    expect(f.fake.runtime.getPlatformInfo).toHaveBeenCalledTimes(2);
    pending.reject(new Error('provider failed'));
    expect((await reply).ok).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('removes its abort listener after settlement and never starts for an aborted operation', async () => {
    vi.useFakeTimers();
    const signal = new AbortController();
    const add = vi.spyOn(signal.signal, 'addEventListener');
    const remove = vi.spyOn(signal.signal, 'removeEventListener');
    const touch = vi.fn(async () => undefined);
    const activity = new RequestActivity(touch);
    await activity.track(Promise.resolve(), signal.signal);
    expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0]![1]);
    signal.abort();
    await activity.track(Promise.resolve(), signal.signal);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(add).toHaveBeenCalledTimes(1);
    expect(touch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    activity.dispose();
  });
});
