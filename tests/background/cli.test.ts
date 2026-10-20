/** @spec spec://modules/platform/INFRA-003-local-cli#protocol */
import { afterEach, expect, it, vi } from 'vitest';
import { registerBackgroundController, type BackgroundRegistration } from '../../src/background/controller';
import { DEFAULT_SETTINGS } from '../../src/shared/constants';
import { CLI_BASE_URL } from '../../src/shared/providers';
import { fakeBrowser, fakeDependencies } from './harness';
vi.mock('wxt/browser', () => ({ browser: {} }));
const controllers = new Set<BackgroundRegistration>();
afterEach(async () => { for (const controller of controllers) await controller.dispose(); controllers.clear(); });
function setup() {
  const fake = fakeBrowser(), store = fakeDependencies();
  const settings = { ...DEFAULT_SETTINGS, providerId: 'codex-cli' as const, model: '', baseUrl: '', concurrency: 1, streaming: false };
  store.dependencies.loadSettings.mockResolvedValue(settings);
  store.keys.clear();
  const controller = registerBackgroundController({ api: fake.api, ...store.dependencies });
  controllers.add(controller);
  const ui = (message: Record<string, unknown>) => controller.handleMessage({ channel: 'linguisty', ...message }, fake.ui);
  return { fake, store, settings, controller, ui };
}
it('starts CLI translation with the default model and checks native permission without reading an API key', async () => {
  const f = setup();
  const result = await f.ui({ type: 'START_TRANSLATION', tabId: 1 });
  expect(result).toMatchObject({ ok: true });
  expect(f.fake.permissions.contains).toHaveBeenCalledWith({ permissions: ['nativeMessaging'] });
  expect(f.store.dependencies.getApiKey).not.toHaveBeenCalled();
  if (!result.ok) throw new Error('Unexpected start failure');
  const sessionId = (result.data as { sessionId: string }).sessionId;
  const translated = await f.controller.handleMessage({ channel: 'linguisty', type: 'TRANSLATE_BATCH', sessionId, batchId: 'batch',
    nodes: [{ id: 'n1', text: 'Hello' }], pageContext: { title: 'Page', domain: 'example.org' },
  }, f.fake.content());
  expect(translated.ok).toBe(true);
  expect(f.store.dependencies.engine.translate.mock.calls[0]![1]).toMatchObject({
    providerId: 'codex-cli', apiKey: '', model: 'default', baseUrl: CLI_BASE_URL, streaming: false,
  });
});
it('requires optional native permission and preserves the honest presence-test result', async () => {
  const f = setup();
  f.fake.permissions.contains.mockResolvedValue(false);
  expect(await f.ui({ type: 'START_TRANSLATION', tabId: 1 })).toMatchObject({ ok: false, error: { code: 'PERMISSION_REQUIRED' } });
  f.fake.permissions.contains.mockResolvedValue(true);
  f.store.dependencies.engine.testConnection.mockResolvedValue({ success: true, message: 'CLI exists; account and model not tested.' });
  expect(await f.ui({ type: 'TEST_CONNECTION', settings: f.settings, apiKey: 'ignored-private-key' })).toMatchObject({
    ok: true, data: { success: true, message: 'CLI exists; account and model not tested.' },
  });
  expect(f.store.dependencies.getApiKey).not.toHaveBeenCalled();
});

it('CLI saves ignore a supplied API key and retain the prior API credential for switching back', async () => {
  const f = setup();
  f.store.keys.set('session', 'prior-private-unit-key');
  const result = await f.ui({ type: 'SAVE_SETTINGS', settings: f.settings, apiKey: 'must-not-replace-prior-key' });
  expect(result.ok).toBe(true);
  expect(f.store.dependencies.saveConfiguration.mock.calls[0]![1]).toBeUndefined();
  expect(f.store.keys.get('session')).toBe('prior-private-unit-key');
});
