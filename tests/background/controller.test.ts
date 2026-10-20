/** @spec spec://modules/platform/INFRA-001-extension#runtime */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiResult, Settings, TabTranslationState, TranslationResult } from '../../src/shared/contracts';
import { DEFAULT_SETTINGS, createIdleState } from '../../src/shared/constants';
import { apiPermissionPattern, MAX_API_REQUESTS, registerBackgroundController } from '../../src/background/controller';
import type { BackgroundRegistration } from '../../src/background/controller';
import { SESSION_STORAGE_KEY } from '../../src/background/sessions';
import { batchTimeoutMs } from '../../src/translation/segments';
import { deferred, fakeBrowser, fakeDependencies } from './harness';

vi.mock('wxt/browser', () => ({ browser: {} }));

const active = new Set<BackgroundRegistration>();
afterEach(async () => {
  for (const registration of active) await registration.dispose();
  active.clear();
  vi.useRealTimers();
});

function success<T>(response: ApiResult): T {
  expect(response.ok).toBe(true);
  if (!response.ok) throw new Error(`Unexpected ${response.error.code}`);
  return response.data as T;
}

function setup(scheme?: string) {
  const fake = fakeBrowser(scheme);
  const store = fakeDependencies();
  const controller = registerBackgroundController({ api: fake.api, ...store.dependencies });
  active.add(controller);
  const ui = (message: Record<string, unknown>) => controller.handleMessage({ channel: 'linguisty', ...message }, fake.ui);
  const start = async (tabId = 1) => success<TabTranslationState>(await ui({ type: 'START_TRANSLATION', tabId }));
  const batch = (sessionId: string, batchId = 'batch', tabId = 1, text = 'Hello') => controller.handleMessage({
    channel: 'linguisty', type: 'TRANSLATE_BATCH', sessionId, batchId,
    nodes: [{ id: batchId, text }], pageContext: { title: 'Page title', domain: new URL(fake.tabData.get(tabId)!.url).hostname },
  }, fake.content(tabId));
  return { fake, store, controller, ui, start, batch };
}

describe('background registration and UI handlers', () => {
  /** @spec spec://common/PROP-001-contracts#messages */
  it('forwards bounded progress to the current tab and stops it on cancellation', async () => {
    vi.useFakeTimers(); const f = setup(); const state = await f.start();
    const pending = deferred<TranslationResult>();
    f.store.dependencies.engine.translate.mockImplementation((_input, _config, _signal, progress) => {
      progress?.({ kind: 'segments', translations: [{ id: 'batch', text: 'Привет' }] });
      return pending.promise;
    });
    const batch = f.batch(state.sessionId!);
    await vi.advanceTimersByTimeAsync(120);
    const commands = () => f.fake.tabs.sendMessage.mock.calls.map(call => call[1].payload).filter(command => command.command === 'batch-progress');
    expect(commands()).toEqual([{ command: 'batch-progress', sessionId: state.sessionId, batchId: 'batch', sequence: 1,
      progress: { kind: 'segments', translations: [{ id: 'batch', text: 'Привет' }] } }]);
    await f.ui({ type: 'CANCEL_TRANSLATION', tabId: 1 });
    expect(await batch).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    pending.resolve({ translations: [{ id: 'batch', text: 'late' }], fromCache: 0 });
    await vi.advanceTimersByTimeAsync(1000); expect(commands()).toHaveLength(1);
    await f.controller.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
  /** @spec spec://common/PROP-001-contracts#messages */
  it('allows journal read/clear only from own extension pages and keeps diagnostics out of page status', async () => {
    const fake = fakeBrowser(); const store = fakeDependencies();
    const errorJournal = { list: vi.fn(async () => []), clear: vi.fn(async () => undefined), append: vi.fn(async () => undefined) };
    const controller = registerBackgroundController({ api: fake.api, ...store.dependencies, errorJournal }); active.add(controller);
    for (const type of ['GET_ERROR_LOG', 'CLEAR_ERROR_LOG']) {
      expect((await controller.handleMessage({ channel: 'linguisty', type }, fake.ui)).ok).toBe(true);
      expect(await controller.handleMessage({ channel: 'linguisty', type }, fake.content(1))).toMatchObject({ ok: false, error: { code: 'PERMISSION_REQUIRED' } });
    }
    expect(errorJournal.list).toHaveBeenCalledTimes(1); expect(errorJournal.clear).toHaveBeenCalledTimes(1);
  });

  /** @spec spec://modules/platform/INFRA-001-extension#recovery */
  it('keeps configuration available when snapshot restore fails and retries page recovery once', async () => {
    const fake = fakeBrowser('moz-extension');
    const store = fakeDependencies();
    fake.storage.get.mockRejectedValueOnce(new Error('unsafe snapshot error'));
    const controller = registerBackgroundController({ api: fake.api, ...store.dependencies });
    active.add(controller);
    await expect(controller.ready).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    const send = (type: string) => controller.handleMessage({ channel: 'linguisty', type }, fake.ui);
    expect(success(await send('GET_SETTINGS'))).toEqual(store.settings());
    expect(success(await send('GET_SECRET_STATUS'))).toEqual({ hasKey: true, mode: 'session' });
    expect(success(await send('GET_TAB_STATE'))).toEqual(createIdleState(1));
    expect(fake.storage.get).toHaveBeenCalledTimes(2);
  });

  /** @spec spec://modules/platform/INFRA-001-extension#recovery */
  it('retries on the next page request after two storage failures and coalesces concurrent restore', async () => {
    const fake = fakeBrowser('moz-extension');
    const store = fakeDependencies();
    fake.storage.get.mockRejectedValueOnce(new Error('first unsafe storage failure'));
    fake.storage.get.mockRejectedValueOnce(new Error('second unsafe storage failure'));
    const healthy = deferred<Record<string, unknown>>();
    fake.storage.get.mockReturnValueOnce(healthy.promise);
    const controller = registerBackgroundController({ api: fake.api, ...store.dependencies });
    active.add(controller);
    await expect(controller.ready).rejects.toMatchObject({ code: 'INTERNAL_ERROR', retryable: true });
    const getState = () => controller.handleMessage({ channel: 'linguisty', type: 'GET_TAB_STATE', tabId: 1 }, fake.ui);
    expect(await getState()).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR', retryable: true } });
    expect(fake.storage.get).toHaveBeenCalledTimes(2);
    expect(success(await controller.handleMessage({ channel: 'linguisty', type: 'GET_SETTINGS' }, fake.ui))).toEqual(store.settings());
    expect(fake.storage.get).toHaveBeenCalledTimes(2); // No automatic retry loop.

    fake.sessionData[SESSION_STORAGE_KEY] = { version: 1, sessions: [{
      tabId: 1, sessionId: 'after-recovery', settings: DEFAULT_SETTINGS,
      state: { ...createIdleState(1), sessionId: 'after-recovery', status: 'completed', discovered: 1, translated: 1 },
      updatedAt: Date.now(),
    }] };
    const first = getState();
    const second = getState();
    await vi.waitFor(() => expect(fake.storage.get).toHaveBeenCalledTimes(3));
    expect(controller.resources()).toMatchObject({ messages: 2, commands: 1 });
    healthy.resolve(structuredClone(fake.sessionData));
    expect(success<TabTranslationState>(await first)).toMatchObject({ sessionId: 'after-recovery', status: 'completed' });
    expect(success<TabTranslationState>(await second)).toMatchObject({ sessionId: 'after-recovery', status: 'completed' });
    expect(success<TabTranslationState>(await getState())).toMatchObject({ sessionId: 'after-recovery' });
    expect(fake.storage.get).toHaveBeenCalledTimes(3);
    expect(controller.resources()).toMatchObject({ messages: 0, commands: 0 });
    fake.tabData.delete(1);
    for (const listener of fake.tabs.onRemoved.listeners) listener(1, { windowId: 1, isWindowClosing: false });
    await vi.waitFor(() => expect(fake.sessionData[SESSION_STORAGE_KEY]).toEqual({ version: 1, sessions: [] }));
    expect(controller.resources().sessions).toBe(0);
  });

  /** @spec spec://modules/platform/INFRA-001-extension#recovery */
  it('bounds a stalled snapshot restore and discards the late result without blocking settings', async () => {
    vi.useFakeTimers();
    const fake = fakeBrowser();
    const store = fakeDependencies();
    const stalled = deferred<Record<string, unknown>>();
    fake.storage.get.mockReturnValueOnce(stalled.promise);
    const controller = registerBackgroundController({ api: fake.api, ...store.dependencies });
    active.add(controller);
    expect(success(await controller.handleMessage({ channel: 'linguisty', type: 'GET_SETTINGS' }, fake.ui))).toEqual(store.settings());
    const rejection = expect(controller.ready).rejects.toMatchObject({ code: 'INTERNAL_ERROR', retryable: true });
    await vi.advanceTimersByTimeAsync(5_000);
    await rejection;
    expect(controller.resources()).toMatchObject({ commands: 0, messages: 0 });
    expect(success(await controller.handleMessage({ channel: 'linguisty', type: 'GET_TAB_STATE', tabId: 1 }, fake.ui)))
      .toEqual(createIdleState(1));
    expect(fake.storage.get).toHaveBeenCalledTimes(2);
    expect(fake.storage.set).toHaveBeenCalledTimes(1);
    stalled.resolve({ [SESSION_STORAGE_KEY]: { version: 1, sessions: [{
      tabId: 1, sessionId: 'late-stale-session', settings: DEFAULT_SETTINGS,
      state: { ...createIdleState(1), sessionId: 'late-stale-session', status: 'completed' }, updatedAt: Date.now(),
    }] } });
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.storage.set).toHaveBeenCalledTimes(1);
    expect(success(await controller.handleMessage({ channel: 'linguisty', type: 'GET_TAB_STATE', tabId: 1 }, fake.ui)))
      .toEqual(createIdleState(1));
    await controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  /** @spec spec://modules/platform/INFRA-001-extension#recovery */
  it('aborts an in-progress retry on dispose and ignores its late storage result', async () => {
    vi.useFakeTimers();
    const fake = fakeBrowser();
    const store = fakeDependencies();
    fake.storage.get.mockRejectedValueOnce(new Error('initial storage failure'));
    const stalled = deferred<Record<string, unknown>>();
    fake.storage.get.mockReturnValueOnce(stalled.promise);
    const controller = registerBackgroundController({ api: fake.api, ...store.dependencies });
    active.add(controller);
    await expect(controller.ready).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    const pending = controller.handleMessage({ channel: 'linguisty', type: 'GET_TAB_STATE', tabId: 1 }, fake.ui);
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.storage.get).toHaveBeenCalledTimes(2);
    await controller.dispose();
    expect(await pending).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    expect(controller.resources()).toMatchObject({ sessions: 0, commands: 0, messages: 0 });
    expect(vi.getTimerCount()).toBe(0);
    stalled.resolve({ [SESSION_STORAGE_KEY]: { version: 1, sessions: [{
      tabId: 1, sessionId: 'late-stale-session', settings: DEFAULT_SETTINGS,
      state: { ...createIdleState(1), sessionId: 'late-stale-session', status: 'completed' }, updatedAt: Date.now(),
    }] } });
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.storage.set).not.toHaveBeenCalled();
    expect(controller.resources().sessions).toBe(0);
  });

  /** @spec spec://modules/storage/INFRA-002-local-data#secrets */
  it('preserves the current key mode under the save queue while accepting incidental settings changes', async () => {
    const { store, ui } = setup();
    const old = store.settings();
    success(await ui({ type: 'SAVE_SETTINGS', settings: { ...old, keyMode: 'persistent' } }));
    const saved = success<Settings>(await ui({ type: 'SAVE_SETTINGS', settings: { ...old, theme: 'dark' }, preserveKeyMode: true }));
    expect(saved).toMatchObject({ keyMode: 'persistent', theme: 'dark' });
    expect(store.keys.get('persistent')).toBe('fake-unit-test-key');
    expect(store.keys.has('session')).toBe(false);
    expect(await ui({ type: 'SAVE_SETTINGS', settings: old, preserveKeyMode: 'true' })).toMatchObject({ ok: false, error: { code: 'INVALID_SETTINGS' } });
  });

  /** @spec spec://common/PROP-001-contracts#messages */
  it('merges popup languages into the latest settings under the save queue without replacing provider, model or key', async () => {
    const { store, ui } = setup();
    const old = store.settings();
    const current = { ...old, providerId: 'codex' as const, model: 'gpt-6-luna', keyMode: 'persistent' as const,
      theme: 'dark' as const, customInstructions: 'Current instructions.', requestTimeoutMs: 120_000 };
    const newer = ui({ type: 'SAVE_SETTINGS', settings: current });
    const popup = ui({ type: 'SAVE_SETTINGS', settings: { ...old, sourceLanguage: 'en', targetLanguage: 'de', targetLanguageMode: 'manual' }, languagesOnly: true });
    const latest = success<Settings>(await newer);
    const saved = success<Settings>(await popup);
    expect(saved).toEqual({ ...latest, sourceLanguage: 'en', targetLanguage: 'de', targetLanguageMode: 'manual' });
    expect(store.keys.get('persistent')).toBe('fake-unit-test-key');
    expect(store.keys.has('session')).toBe(false);
  });

  /** @spec spec://common/PROP-001-contracts#messages */
  it('rejects malformed language-only saves and key replacement before changing settings', async () => {
    const { store, ui } = setup();
    const old = store.settings();
    for (const payload of [
      { languagesOnly: 'true' },
      { languagesOnly: true, apiKey: 'replacement-test-key' },
      { languagesOnly: true, settings: { ...old, targetLanguage: '' } },
    ]) {
      expect(await ui({ type: 'SAVE_SETTINGS', settings: old, ...payload })).toMatchObject({ ok: false, error: { code: 'INVALID_SETTINGS' } });
    }
    expect(store.settings()).toEqual(old);
    expect(store.keys.get('session')).toBe('fake-unit-test-key');
  });

  it('registers listeners synchronously, gates storage initialization and avoids duplicate registration', async () => {
    const fake = fakeBrowser();
    const store = fakeDependencies();
    const blocked = deferred<Record<string, unknown>>();
    fake.storage.get.mockReturnValueOnce(blocked.promise);
    const controller = registerBackgroundController({ api: fake.api, ...store.dependencies });
    active.add(controller);
    expect(fake.runtime.onMessage.listeners.size).toBe(1);
    expect(fake.tabs.onRemoved.listeners.size).toBe(1);
    expect(fake.tabs.onUpdated.listeners.size).toBe(1);
    expect(registerBackgroundController({ api: fake.api })).toBe(controller);
    const listener = [...fake.runtime.onMessage.listeners][0]!;
    const sendResponse = vi.fn();
    expect(listener({ channel: 'another', type: 'GET_SETTINGS' }, fake.ui, sendResponse)).toBeUndefined();
    expect(listener({ channel: 'linguisty', type: 'GET_TAB_STATE', tabId: 1 }, fake.ui, sendResponse)).toBe(true);
    expect(store.dependencies.loadSettings).not.toHaveBeenCalled();
    blocked.resolve({});
    await controller.ready;
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledOnce());
    expect(success(sendResponse.mock.calls[0]![0])).toEqual(createIdleState(1));
  });

  /** @spec spec://common/PROP-002-quality#resources */
  it('bounds messages waiting for worker initialization and settings mutations waiting for storage', async () => {
    const fake = fakeBrowser();
    const store = fakeDependencies();
    const initialization = deferred<Record<string, unknown>>();
    fake.storage.get.mockReturnValueOnce(initialization.promise);
    const controller = registerBackgroundController({ api: fake.api, ...store.dependencies });
    active.add(controller);
    const get = { channel: 'linguisty', type: 'GET_TAB_STATE', tabId: 1 };
    const waiting = Array.from({ length: 64 }, () => controller.handleMessage(get, fake.ui));
    expect(controller.resources().messages).toBe(64);
    expect(await controller.handleMessage(get, fake.ui)).toMatchObject({ ok: false, error: { code: 'RATE_LIMIT' } });
    initialization.resolve({});
    for (const result of await Promise.all(waiting)) success(result);
    expect(controller.resources().messages).toBe(0);
    const storage = deferred<Settings>();
    store.dependencies.loadSettings.mockReturnValueOnce(storage.promise);
    const save = { channel: 'linguisty', type: 'SAVE_SETTINGS', settings: store.settings() };
    const writes = Array.from({ length: 4 }, () => controller.handleMessage(save, fake.ui));
    await vi.waitFor(() => expect(controller.resources().mutations).toBe(4));
    expect(await controller.handleMessage(save, fake.ui)).toMatchObject({ ok: false, error: { code: 'RATE_LIMIT' } });
    storage.resolve(store.settings());
    for (const result of await Promise.all(writes)) success(result);
    expect(controller.resources()).toMatchObject({ mutations: 0, messages: 0 });
  });

  /** @spec spec://modules/storage/INFRA-002-local-data#secrets */
  it('reads only public settings/status/cache and migrates/removes a key without returning it', async () => {
    const { fake, store, ui } = setup('moz-extension');
    expect(success(await ui({ type: 'GET_SETTINGS' }))).toEqual(store.settings());
    expect(success(await ui({ type: 'GET_SECRET_STATUS' }))).toEqual({ hasKey: true, mode: 'session' });
    const settings = { ...store.settings(), keyMode: 'persistent', apiKey: 'not-public' };
    const saved = success<Settings>(await ui({ type: 'SAVE_SETTINGS', settings, apiKey: '' }));
    expect(saved).not.toHaveProperty('apiKey');
    expect(store.keys.has('session')).toBe(false);
    expect(store.keys.get('persistent')).toBe('fake-unit-test-key');
    expect(success(await ui({ type: 'GET_CACHE_STATS' }))).toEqual({ entries: 0, estimatedBytes: 0, hits: 0, misses: 0 });
    success(await ui({ type: 'CLEAR_CACHE' }));
    expect(store.dependencies.cache.clear).toHaveBeenCalledOnce();
    expect(success(await ui({ type: 'REMOVE_API_KEY' }))).toEqual({ hasKey: false, mode: 'persistent' });
    expect(store.keys.size).toBe(0);
    const output = JSON.stringify([saved, fake.runtime.sendMessage.mock.calls, fake.sessionData]);
    expect(output).not.toContain('fake-unit-test-key');
    expect(output).not.toContain('not-public');
  });

  it('rolls back keyMode migration and the original key when settings persistence fails', async () => {
    const { store, ui } = setup();
    store.dependencies.saveSettings.mockRejectedValueOnce(new Error('storage error includes secret'));
    const result = await ui({ type: 'SAVE_SETTINGS', settings: { ...store.settings(), keyMode: 'persistent' }, apiKey: 'replacement-test-key' });
    expect(result).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } });
    expect(store.settings().keyMode).toBe('session');
    expect(store.keys.get('session')).toBe('fake-unit-test-key');
    expect(store.keys.has('persistent')).toBe(false);
    expect(store.dependencies.setApiKey.mock.calls).toEqual([
      ['replacement-test-key', 'persistent'], ['fake-unit-test-key', 'session'],
    ]);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  /** @spec spec://modules/platform/INFRA-001-extension#permissions */
  it('checks only the chosen API host and allows a temporary UI key with empty model discovery', async () => {
    const { fake, store, ui } = setup();
    const settings = { ...store.settings(), providerId: 'openai-compatible', baseUrl: 'https://gateway.example:8443/v1', model: '' };
    const models = success(await ui({ type: 'LIST_MODELS', settings, apiKey: 'temporary-ui-key' }));
    expect(models).toEqual([{ id: 'test/model', name: 'Test model' }]);
    expect(fake.permissions.contains).toHaveBeenLastCalledWith({ origins: ['https://gateway.example/*'] });
    expect(store.dependencies.engine.listModels.mock.calls[0]![0]).toMatchObject({ apiKey: 'temporary-ui-key', baseUrl: 'https://gateway.example:8443/v1' });
    expect(store.dependencies.setApiKey).not.toHaveBeenCalled();
    expect(store.keys.get('session')).toBe('fake-unit-test-key');
    expect(success(await ui({ type: 'TEST_CONNECTION', settings, apiKey: 'temporary-ui-key' }))).toEqual({ success: true, message: 'Соединение установлено.' });
    fake.permissions.contains.mockResolvedValue(false);
    const before = store.dependencies.getApiKey.mock.calls.length;
    expect(await ui({ type: 'TEST_CONNECTION', settings })).toMatchObject({ ok: false, error: { code: 'PERMISSION_REQUIRED' } });
    expect(store.dependencies.getApiKey.mock.calls.length).toBe(before);
    expect(apiPermissionPattern('http://localhost:1234/v1')).toBe('http://localhost/*');
    expect(apiPermissionPattern('http://127.0.0.1:1234/v1')).toBe('http://127.0.0.1/*');
    expect(apiPermissionPattern('http://[::1]:1234/v1')).toBe('http://[::1]/*');
    expect(() => apiPermissionPattern('http://remote.example/v1')).toThrow();
    for (const baseUrl of ['http://remote.example/v1', 'https://name:password@gateway.example/v1', 'https://gateway.example/v1?key=test', 'https://gateway.example/v1#part']) {
      expect(await ui({ type: 'TEST_CONNECTION', settings: { ...settings, baseUrl } })).toMatchObject({ ok: false, error: { code: 'INVALID_SETTINGS' } });
    }
  });
});

describe('sender isolation', () => {
  /** @spec spec://common/PROP-001-contracts#messages */
  it('rejects external/UI impostors and content attempts to use UI handlers or secret discovery', async () => {
    const { fake, controller, store } = setup();
    const get = { channel: 'linguisty', type: 'GET_SETTINGS' };
    for (const sender of [
      { ...fake.ui, id: 'another-extension' },
      { ...fake.ui, url: 'chrome-extension://linguisty-test.evil/options.html' },
      { ...fake.ui, url: 'https://linguisty-test/options.html' },
      { ...fake.ui, url: undefined },
    ]) expect(await controller.handleMessage(get, sender)).toMatchObject({ ok: false, error: { code: 'PERMISSION_REQUIRED' } });
    for (const message of [
      get, { type: 'GET_SECRET_STATUS' }, { type: 'REMOVE_API_KEY' }, { type: 'GET_CACHE_STATS' }, { type: 'CLEAR_CACHE' },
      { type: 'SAVE_SETTINGS', settings: store.settings(), apiKey: 'forged' },
      { type: 'TEST_CONNECTION' }, { type: 'LIST_MODELS' }, { type: 'START_TRANSLATION', tabId: 2 },
      { type: 'CANCEL_TRANSLATION' }, { type: 'SET_DISPLAY_MODE', mode: 'translated' }, { type: 'GET_TAB_STATE' },
    ]) expect(await controller.handleMessage({ channel: 'linguisty', ...message }, fake.content())).toMatchObject({ ok: false, error: { code: 'PERMISSION_REQUIRED' } });
    expect(store.dependencies.getApiKey).not.toHaveBeenCalled();
    expect(store.dependencies.setApiKey).not.toHaveBeenCalled();
    expect(store.dependencies.engine.listModels).not.toHaveBeenCalled();
  });

  it('binds batch/progress to sender tab, top frame, document, domain and current session', async () => {
    const { fake, store, controller, start, batch } = setup();
    const state = await start();
    const message = { channel: 'linguisty', type: 'TRANSLATE_BATCH', sessionId: state.sessionId, batchId: 'b', nodes: [{ id: 'n', text: 'Hello' }], pageContext: { title: '', domain: 'example.org' } };
    for (const sender of [
      { ...fake.content(), frameId: 1 }, { ...fake.content(), tab: undefined },
      { ...fake.content(), documentId: 'other-document' }, { ...fake.content(), id: 'another' }, fake.ui,
    ]) expect((await controller.handleMessage(message, sender)).ok).toBe(false);
    expect(await batch(state.sessionId!, 'b', 2)).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    expect(await controller.handleMessage({ ...message, pageContext: { title: '', domain: 'other.example' } }, fake.content())).toMatchObject({ ok: false, error: { code: 'PERMISSION_REQUIRED' } });
    const foreign = { ...state, tabId: 2 };
    expect(await controller.handleMessage({ channel: 'linguisty', type: 'PAGE_PROGRESS', sessionId: state.sessionId, state: foreign }, fake.content())).toMatchObject({ ok: false, error: { code: 'PERMISSION_REQUIRED' } });
    expect(store.dependencies.engine.translate).not.toHaveBeenCalled();
  });
});

describe('page commands, sessions and resource lifecycle', () => {
  it('injects translate.js into only the top frame once per document and freezes session settings', async () => {
    const { fake, store, ui, start, batch } = setup();
    const first = await start();
    expect(fake.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 1, frameIds: [0] }, files: ['/translate.js'] });
    success(await ui({ type: 'SAVE_SETTINGS', settings: { ...store.settings(), targetLanguage: 'fr', model: 'new/model' } }));
    success(await batch(first.sessionId!));
    expect(store.dependencies.engine.translate.mock.calls[0]![0].targetLanguage).toBe(DEFAULT_SETTINGS.targetLanguage);
    expect(store.dependencies.engine.translate.mock.calls[0]![1].model).toBe('test/model');
    const second = await start();
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(fake.scripting.executeScript).toHaveBeenCalledOnce();
    expect(await batch(first.sessionId!, 'old')).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    expect(success(await ui({ type: 'GET_TAB_STATE', tabId: 1 }))).toEqual(second);
    expect(JSON.stringify(fake.tabs.sendMessage.mock.calls)).not.toContain('fake-unit-test-key');
  });

  it.each(['chrome://settings', 'about:blank', 'chrome-extension://linguisty-test/options.html', 'https://chromewebstore.google.com/item', 'https://example.org/document.pdf'])('rejects protected page %s before injection/key access', async (url) => {
    const { fake, store, ui } = setup();
    fake.tabData.set(1, { id: 1, url });
    expect(await ui({ type: 'START_TRANSLATION', tabId: 1 })).toMatchObject({ ok: false, error: { code: 'RESTRICTED_PAGE' } });
    expect(fake.scripting.executeScript).not.toHaveBeenCalled();
    expect(store.dependencies.getApiKey).not.toHaveBeenCalled();
  });

  it('reports denied injection and missing/closed tabs with safe errors', async () => {
    const { fake, controller, ui } = setup();
    fake.scripting.executeScript.mockRejectedValueOnce(new Error('browser restriction contains fake-secret'));
    const rejected = await ui({ type: 'START_TRANSLATION' });
    expect(rejected).toMatchObject({ ok: false, error: { code: 'RESTRICTED_PAGE' } });
    expect(JSON.stringify(rejected)).not.toContain('fake-secret');
    expect(success<TabTranslationState>(await ui({ type: 'GET_TAB_STATE' })).status).toBe('error');
    fake.tabData.delete(1);
    fake.tabs.query.mockResolvedValue([]);
    expect(await ui({ type: 'START_TRANSLATION' })).toMatchObject({ ok: false, error: { code: 'RESTRICTED_PAGE' } });
    expect(await ui({ type: 'GET_TAB_STATE', tabId: 1 })).toMatchObject({ ok: false, error: { code: 'RESTRICTED_PAGE' } });
    expect(controller.resources().sessions).toBe(0);
  });

  it('cancels a start still awaiting settings, before injection or creation of a session', async () => {
    const { fake, store, controller, ui } = setup();
    const blocked = deferred<Settings>();
    store.dependencies.loadSettings.mockReturnValueOnce(blocked.promise);
    const pending = ui({ type: 'START_TRANSLATION', tabId: 1 });
    await vi.waitFor(() => expect(store.dependencies.loadSettings).toHaveBeenCalledOnce());
    expect(success<TabTranslationState>(await ui({ type: 'CANCEL_TRANSLATION', tabId: 1 })).status).toBe('idle');
    expect(await pending).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    blocked.resolve(store.settings());
    expect(fake.scripting.executeScript).not.toHaveBeenCalled();
    expect(store.dependencies.getApiKey).not.toHaveBeenCalled();
    expect(controller.resources().sessions).toBe(0);
  });

  it('navigation cancels a preflight start even when the reload keeps the same URL', async () => {
    const { fake, store, controller, ui } = setup();
    const blocked = deferred<Settings>();
    store.dependencies.loadSettings.mockReturnValueOnce(blocked.promise);
    const pending = ui({ type: 'START_TRANSLATION', tabId: 1 });
    await vi.waitFor(() => expect(store.dependencies.loadSettings).toHaveBeenCalledOnce());
    for (const listener of fake.tabs.onUpdated.listeners) listener(1, { status: 'loading' }, { id: 1 } as Parameters<typeof listener>[2]);
    expect(await pending).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    blocked.resolve(store.settings());
    expect(fake.scripting.executeScript).not.toHaveBeenCalled();
    expect(controller.resources()).toMatchObject({ sessions: 0, requests: 0, commands: 0, starts: 0 });
  });

  /** @spec spec://common/PROP-002-quality#resources */
  it('deduplicates in-flight batch IDs, rejects ID reuse with changed text, enforces concurrency and releases on cancellation', async () => {
    const { store, controller, start, batch, ui } = setup();
    const state = await start();
    const blocked = deferred<TranslationResult>();
    store.dependencies.engine.translate.mockImplementation(() => blocked.promise);
    const first = batch(state.sessionId!, 'same');
    const duplicate = batch(state.sessionId!, 'same');
    await vi.waitFor(() => expect(store.dependencies.engine.translate).toHaveBeenCalledOnce());
    expect(await batch(state.sessionId!, 'same', 1, 'Different')).toMatchObject({ ok: false, error: { code: 'INVALID_SETTINGS' } });
    const second = batch(state.sessionId!, 'second');
    await vi.waitFor(() => expect(store.dependencies.engine.translate).toHaveBeenCalledTimes(2));
    expect(await batch(state.sessionId!, 'over-limit')).toMatchObject({ ok: false, error: { code: 'RATE_LIMIT' } });
    const signal = store.dependencies.engine.translate.mock.calls[0]![2]!;
    success(await ui({ type: 'CANCEL_TRANSLATION' }));
    expect(signal.aborted).toBe(true);
    for (const response of await Promise.all([first, duplicate, second])) expect(response).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    blocked.resolve({ translations: [{ id: 'same', text: 'Late reply' }], fromCache: 0 });
    expect(controller.resources()).toMatchObject({ requests: 0, batches: 0, messages: 0 });
    expect(await batch(state.sessionId!, 'after-cancel')).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
  });

  it('bounds requests globally across multiple tabs', async () => {
    const { store, controller, start, batch, ui } = setup();
    const one = await start(1);
    const two = await start(2);
    const blocked = deferred<TranslationResult>();
    store.dependencies.engine.translate.mockImplementation(() => blocked.promise);
    const pending = [batch(one.sessionId!, 'one'), batch(one.sessionId!, 'two'), batch(two.sessionId!, 'three', 2), batch(two.sessionId!, 'four', 2)];
    await vi.waitFor(() => expect(controller.resources().requests).toBe(MAX_API_REQUESTS));
    expect(await ui({ type: 'LIST_MODELS' })).toMatchObject({ ok: false, error: { code: 'RATE_LIMIT' } });
    success(await ui({ type: 'CANCEL_TRANSLATION', tabId: 1 }));
    success(await ui({ type: 'CANCEL_TRANSLATION', tabId: 2 }));
    await Promise.all(pending);
    expect(controller.resources().requests).toBe(0);
  });

  /** @spec spec://modules/platform/INFRA-001-extension#permissions */
  it('rechecks the chosen permission and key for every batch after start', async () => {
    const { fake, store, controller, start, batch } = setup();
    const initial = await start();
    const reads = store.dependencies.getApiKey.mock.calls.length;
    fake.permissions.contains.mockResolvedValueOnce(false);
    expect(await batch(initial.sessionId!, 'permission-revoked')).toMatchObject({ ok: false, error: { code: 'PERMISSION_REQUIRED' } });
    expect(store.dependencies.getApiKey.mock.calls.length).toBe(reads);
    expect(store.dependencies.engine.translate).not.toHaveBeenCalled();
    store.keys.clear();
    expect(await batch(initial.sessionId!, 'key-removed')).toMatchObject({ ok: false, error: { code: 'INVALID_API_KEY' } });
    expect(store.dependencies.engine.translate).not.toHaveBeenCalled();
    expect(controller.resources()).toMatchObject({ batches: 0, requests: 0 });
  });

  it('preserves exact cache-hit IDs while excluding extra engine fields at the content boundary', async () => {
    const { store, start, batch } = setup();
    const initial = await start();
    const result: TranslationResult = { translations: [{ id: 'cached', text: 'Готовый перевод' }], fromCache: 1, cacheHitIds: ['cached'] };
    store.dependencies.engine.translate.mockResolvedValueOnce({ ...result, apiKey: 'not-public' } as TranslationResult);
    const response = success<TranslationResult>(await batch(initial.sessionId!, 'cached'));
    expect(response).toEqual(result);
    expect(response.cacheHitIds).not.toBe(result.cacheHitIds);
    expect(JSON.stringify(response)).not.toContain('not-public');
  });

  /** @spec spec://modules/page/FEAT-002-page-translation#render */
  it('original aborts in-flight batches but preserves completed progress and allows remaining batch after translated', async () => {
    const { fake, store, controller, start, batch, ui } = setup();
    const initial = await start();
    const completed: TabTranslationState = { ...initial, status: 'completed', discovered: 2, translated: 1 };
    fake.pageStates.set(1, completed);
    success(await controller.handleMessage({ channel: 'linguisty', type: 'PAGE_PROGRESS', sessionId: initial.sessionId, state: completed }, fake.content()));
    const blocked = deferred<TranslationResult>();
    store.dependencies.engine.translate.mockImplementationOnce(() => blocked.promise);
    const pending = batch(initial.sessionId!, 'remaining');
    await vi.waitFor(() => expect(store.dependencies.engine.translate).toHaveBeenCalledOnce());
    const signal = store.dependencies.engine.translate.mock.calls[0]![2]!;
    const original = success<TabTranslationState>(await ui({ type: 'SET_DISPLAY_MODE', mode: 'original' }));
    expect(original).toMatchObject({ sessionId: initial.sessionId, status: 'completed', displayMode: 'original', translated: 1, inFlight: 0 });
    expect(signal.aborted).toBe(true);
    expect(await pending).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    expect(await batch(initial.sessionId!, 'while-original')).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    const translated = success<TabTranslationState>(await ui({ type: 'SET_DISPLAY_MODE', mode: 'translated' }));
    expect(translated.sessionId).toBe(initial.sessionId);
    expect(translated.translated).toBe(1);
    expect(success<TranslationResult>(await batch(initial.sessionId!, 'remaining')).translations).toHaveLength(1);
    blocked.resolve({ translations: [{ id: 'remaining', text: 'Stale original-mode reply' }], fromCache: 0 });
    expect(controller.resources()).toMatchObject({ requests: 0, batches: 0 });
  });

  /** @spec spec://modules/platform/INFRA-001-extension#recovery */
  it('restores frozen session settings before handling the first content batch after worker restart', async () => {
    const fake = fakeBrowser();
    const store = fakeDependencies();
    fake.sessionData[SESSION_STORAGE_KEY] = { version: 1, sessions: [{
      tabId: 1, sessionId: 'before-restart', settings: { ...DEFAULT_SETTINGS, model: 'frozen/model', targetLanguage: 'de' },
      state: { ...createIdleState(1), sessionId: 'before-restart', status: 'translating', displayMode: 'translated', discovered: 1, inFlight: 1 },
      updatedAt: Date.now(), documentId: 'doc-1',
    }] };
    const blocked = deferred<Record<string, unknown>>();
    fake.storage.get.mockReturnValueOnce(blocked.promise);
    const controller = registerBackgroundController({ api: fake.api, ...store.dependencies });
    active.add(controller);
    const response = controller.handleMessage({ channel: 'linguisty', type: 'TRANSLATE_BATCH', sessionId: 'before-restart', batchId: 'wake', nodes: [{ id: 'n', text: 'Hello' }], pageContext: { title: '', domain: 'example.org' } }, fake.content());
    expect(store.dependencies.engine.translate).not.toHaveBeenCalled();
    blocked.resolve(structuredClone(fake.sessionData));
    success(await response);
    expect(store.dependencies.engine.translate.mock.calls[0]![0].targetLanguage).toBe('de');
    expect(store.dependencies.engine.translate.mock.calls[0]![1].model).toBe('frozen/model');
    const state = success<TabTranslationState>(await controller.handleMessage({ channel: 'linguisty', type: 'GET_TAB_STATE', tabId: 1 }, fake.ui));
    expect(state).toMatchObject({ inFlight: 0, status: 'error', error: { code: 'REQUEST_TIMEOUT' } });
  });

  /** @spec spec://modules/page/FEAT-002-page-translation#sessions */
  it('SPA reset returns a new ID with frozen settings and discards old requests', async () => {
    const { fake, store, controller, start, batch } = setup();
    const initial = await start();
    const blocked = deferred<TranslationResult>();
    store.dependencies.engine.translate.mockImplementationOnce(() => blocked.promise);
    const old = batch(initial.sessionId!);
    await vi.waitFor(() => expect(store.dependencies.engine.translate).toHaveBeenCalledOnce());
    const next = success<{ sessionId: string; settings: Settings }>(await controller.handleMessage({ channel: 'linguisty', type: 'BEGIN_PAGE_SESSION', previousSessionId: initial.sessionId, pageContext: { title: 'New route', domain: 'example.org' } }, fake.content()));
    expect(next.sessionId).not.toBe(initial.sessionId);
    expect(next.settings).toEqual(store.settings());
    expect(await old).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    expect(await batch(initial.sessionId!, 'old-again')).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    success(await batch(next.sessionId, 'new'));
    expect(JSON.stringify(fake.sessionData)).not.toContain('New route');
  });

  it.each(['url-only', 'loading-same-document'])('preserves the SPA session through onUpdated %s until BEGIN_PAGE_SESSION', async (event) => {
    const { fake, store, controller, start, batch } = setup();
    const initial = await start();
    const url = 'https://example.org/article?route=2';
    fake.tabData.set(1, { id: 1, url });
    for (const listener of fake.tabs.onUpdated.listeners) {
      listener(1, { url, ...(event === 'loading-same-document' ? { status: 'loading' as const } : {}) }, { id: 1, url } as Parameters<typeof listener>[2]);
    }
    await vi.waitFor(() => expect(controller.resources().navigationChecks).toBe(0));
    expect(controller.resources().sessions).toBe(1);
    const next = success<{ sessionId: string; settings: Settings }>(await controller.handleMessage({
      channel: 'linguisty', type: 'BEGIN_PAGE_SESSION', previousSessionId: initial.sessionId,
      pageContext: { title: 'New SPA page', domain: 'example.org' },
    }, fake.content()));
    expect(next.sessionId).not.toBe(initial.sessionId);
    expect(next.settings).toEqual(store.settings());
    success(await batch(next.sessionId, 'new-spa-batch'));
    expect(store.dependencies.engine.translate.mock.calls[0]![0].pageContext.domain).toBe('example.org');
    expect(await batch(initial.sessionId!, 'stale')).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
  });

  it('a late SPA complete event does not abort the new route batch', async () => {
    const { fake, store, controller, start, batch } = setup();
    const initial = await start();
    for (const listener of fake.tabs.onUpdated.listeners) listener(1, { status: 'loading' }, { id: 1 } as Parameters<typeof listener>[2]);
    await vi.waitFor(() => expect(controller.resources().navigationChecks).toBe(0));
    const next = success<{ sessionId: string; settings: Settings }>(await controller.handleMessage({ channel: 'linguisty', type: 'BEGIN_PAGE_SESSION', previousSessionId: initial.sessionId, pageContext: { title: 'Route', domain: 'example.org' } }, fake.content()));
    const blocked = deferred<TranslationResult>();
    store.dependencies.engine.translate.mockImplementationOnce(() => blocked.promise);
    const pending = batch(next.sessionId, 'new-route');
    await vi.waitFor(() => expect(store.dependencies.engine.translate).toHaveBeenCalledOnce());
    const signal = store.dependencies.engine.translate.mock.calls[0]![2]!;
    for (const listener of fake.tabs.onUpdated.listeners) listener(1, { status: 'complete' }, { id: 1 } as Parameters<typeof listener>[2]);
    expect(signal.aborted).toBe(false);
    blocked.resolve({ translations: [{ id: 'new-route', text: 'Перевод' }], fromCache: 0 });
    success(await pending);
  });

  it.each(['close', 'navigation'])('cleans up on tab %s without snapshot resurrection', async (reason) => {
    const { fake, store, controller, start, batch } = setup();
    const initial = await start();
    const blocked = deferred<TranslationResult>();
    store.dependencies.engine.translate.mockImplementationOnce(() => blocked.promise);
    const pending = batch(initial.sessionId!);
    await vi.waitFor(() => expect(store.dependencies.engine.translate).toHaveBeenCalledOnce());
    if (reason === 'close') {
      fake.tabData.delete(1);
      for (const listener of fake.tabs.onRemoved.listeners) listener(1, { windowId: 1, isWindowClosing: false });
    } else {
      fake.documentIds.set(1, 'new-document');
      for (const listener of fake.tabs.onUpdated.listeners) listener(1, { status: 'loading' }, { id: 1 } as Parameters<typeof listener>[2]);
    }
    expect(await pending).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    await vi.waitFor(() => expect(fake.sessionData[SESSION_STORAGE_KEY]).toEqual({ version: 1, sessions: [] }));
    expect(controller.resources()).toMatchObject({ sessions: 0, batches: 0, requests: 0 });
  });

  it('times out a provider that ignores abort and frees timers/listeners/cache on dispose', async () => {
    const { fake, store, controller, ui, start, batch } = setup();
    success(await ui({ type: 'SAVE_SETTINGS', settings: { ...store.settings(), requestTimeoutMs: 1_000 } }));
    const initial = await start();
    vi.useFakeTimers();
    const blocked = deferred<TranslationResult>();
    store.dependencies.engine.translate.mockImplementationOnce(() => blocked.promise);
    const pending = batch(initial.sessionId!);
    await vi.advanceTimersByTimeAsync(batchTimeoutMs(1_000) + 1);
    expect(await pending).toMatchObject({ ok: false, error: { code: 'REQUEST_TIMEOUT' } });
    expect(vi.getTimerCount()).toBe(0);
    await controller.dispose();
    expect(fake.runtime.onMessage.listeners.size).toBe(0);
    expect(fake.tabs.onRemoved.listeners.size).toBe(0);
    expect(fake.tabs.onUpdated.listeners.size).toBe(0);
    expect(store.dependencies.cache.dispose).toHaveBeenCalledOnce();
    expect(controller.resources()).toEqual({ sessions: 0, batches: 0, requests: 0, messages: 0, mutations: 0, commands: 0, starts: 0, navigationChecks: 0 });
    expect(fake.sessionData).not.toHaveProperty(SESSION_STORAGE_KEY);
    expect(await ui({ type: 'GET_SETTINGS' })).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
  });
});
