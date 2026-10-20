/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
import { afterEach, expect, it, vi } from 'vitest';
import { registerBackgroundController, type BackgroundRegistration } from '../../src/background/controller';
import { codexPageOpener } from '../../src/background/codexPage';
import { CODEX_BASE_URL } from '../../src/shared/providers';
import { DEFAULT_SETTINGS } from '../../src/shared/constants';
import { fakeBrowser, fakeDependencies } from './harness';
vi.mock('wxt/browser', () => ({ browser: {} }));
const registrations = new Set<BackgroundRegistration>();
afterEach(async () => { for (const value of registrations) await value.dispose(); registrations.clear(); });
it('does not read or transmit an API key and gives cache a verified account scope', async () => {
  const fake = fakeBrowser(), store = fakeDependencies(), accountScope = 'a'.repeat(64);
  const settings = { ...DEFAULT_SETTINGS, providerId: 'codex' as const, model: 'default' };
  store.dependencies.loadSettings.mockResolvedValue(settings);
  const request = vi.fn(async () => ({ connected: true, accountScope }));
  const controller = registerBackgroundController({ api: fake.api, ...store.dependencies, codexRequest: request }); registrations.add(controller);
  const start = await controller.handleMessage({ channel: 'linguisty', type: 'START_TRANSLATION', tabId: 1 }, fake.ui);
  expect(start.ok).toBe(true); if (!start.ok) throw new Error('Start failed');
  await controller.handleMessage({ channel: 'linguisty', type: 'TRANSLATE_BATCH', sessionId: (start.data as { sessionId: string }).sessionId,
    batchId: 'b', nodes: [{ id: 'n1', text: 'Hello' }], pageContext: { title: 'Page', domain: 'example.org' } }, fake.content());
  expect(store.dependencies.engine.translate.mock.calls[0]![1]).toMatchObject({ providerId: 'codex', apiKey: '', accountScope, baseUrl: CODEX_BASE_URL });
  expect(store.dependencies.getApiKey).not.toHaveBeenCalled(); expect(fake.permissions.contains).not.toHaveBeenCalledWith({ permissions: ['nativeMessaging'] });
  await controller.handleMessage({ channel: 'linguisty', type: 'SAVE_SETTINGS', settings, apiKey: 'ignored-unit-key' }, fake.ui);
  expect(store.dependencies.saveConfiguration.mock.calls[0]![1]).toBeUndefined();
});
it('rejects a page sender asking to open connection and a connection with no verified account', async () => {
  const fake = fakeBrowser(), store = fakeDependencies(); store.dependencies.loadSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, providerId: 'codex' });
  const controller = registerBackgroundController({ api: fake.api, ...store.dependencies, codexRequest: async () => ({ connected: false }) }); registrations.add(controller);
  expect(await controller.handleMessage({ channel: 'linguisty', type: 'OPEN_CODEX_CONNECTION' }, fake.content())).toMatchObject({ ok: false, error: { code: 'PERMISSION_REQUIRED' } });
  expect(await controller.handleMessage({ channel: 'linguisty', type: 'START_TRANSLATION', tabId: 1 }, fake.ui)).toMatchObject({ ok: false, error: { code: 'CODEX_NOT_CONNECTED' } });
});
it('serializes guide creation and focuses the existing tab rather than creating duplicates', async () => {
  const fake = fakeBrowser(); const create = vi.fn(async () => ({ id: 42 })), update = vi.fn(async () => ({})), focus = vi.fn(async () => ({}));
  Object.assign(fake.api.tabs, { create, update }); Object.assign(fake.api, { windows: { update: focus } });
  fake.tabs.query.mockResolvedValue([]);
  const open = codexPageOpener(fake.api); expect(await Promise.all([open(), open(), open()])).toEqual([{ tabId: 42 }, { tabId: 42 }, { tabId: 42 }]);
  expect(create).toHaveBeenCalledOnce();
  fake.tabs.query.mockResolvedValue([{ id: 42, windowId: 3, url: fake.runtime.getURL('/codex.html') } as never]);
  expect(await open()).toEqual({ tabId: 42 }); expect(create).toHaveBeenCalledOnce(); expect(update).toHaveBeenCalledWith(42, { active: true });
  expect(focus).toHaveBeenCalledWith(3, { focused: true });
});
/** @spec spec://modules/platform/INFRA-004-codex-connection#settings */
it('reuses a Chrome guide after worker restart even when tab URLs are hidden', async () => {
  const fake = fakeBrowser(), url = fake.runtime.getURL('codex.html');
  const create = vi.fn(), update = vi.fn(async () => ({})), focus = vi.fn(async () => ({}));
  const getContexts = vi.fn(async () => [{ documentUrl: url, tabId: 42, windowId: 3 }]);
  Object.assign(fake.api.runtime, { getContexts });
  Object.assign(fake.api.tabs, { create, update }); Object.assign(fake.api, { windows: { update: focus } });
  fake.tabs.query.mockResolvedValue([]);
  expect(await codexPageOpener(fake.api)()).toEqual({ tabId: 42 });
  expect(await codexPageOpener(fake.api)()).toEqual({ tabId: 42 });
  expect(getContexts).toHaveBeenCalledWith({ contextTypes: ['TAB'], documentUrls: [url] });
  expect(create).not.toHaveBeenCalled(); expect(fake.tabs.query).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledWith(42, { active: true }); expect(focus).toHaveBeenCalledWith(3, { focused: true });
});
