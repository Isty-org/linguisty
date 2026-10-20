// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/shared/constants';

const { api, makeArea } = vi.hoisted(() => {
  function makeArea() {
    const data: Record<string, unknown> = {};
    return {
      data,
      get: vi.fn(async (keys: string | string[]) => Object.fromEntries([keys].flat().filter(key => Object.hasOwn(data, key)).map(key => [key, structuredClone(data[key])]))),
      set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(data, structuredClone(items)); }),
      remove: vi.fn(async (keys: string | string[]) => { for (const key of [keys].flat()) delete data[key]; }),
      setAccessLevel: vi.fn(async (_options: { accessLevel: string }) => undefined),
    };
  }
  return {
    makeArea,
    api: { storage: { local: makeArea(), session: makeArea() as ReturnType<typeof makeArea> | undefined } },
  };
});

vi.mock('wxt/browser', () => ({ browser: api }));

beforeEach(() => {
  vi.resetModules();
  api.storage.local = makeArea();
  api.storage.session = makeArea();
  vi.stubGlobal('navigator', { languages: ['en'], language: 'en' });
});
afterEach(() => vi.unstubAllGlobals());

/** @spec spec://modules/storage/INFRA-002-local-data#settings */
describe('settings store', () => {
  it('resolves fresh preferred languages dynamically without writing settings or touching secrets', async () => {
    const settings = await import('../../src/storage/settings');
    vi.stubGlobal('navigator', { languages: ['fr-CA', 'ru'], language: 'de' });
    expect(await settings.loadSettings()).toEqual({ ...DEFAULT_SETTINGS, targetLanguage: 'fr-CA' });
    vi.stubGlobal('navigator', { languages: ['zh-Hant-HK'], language: 'de' });
    expect(await settings.loadSettings()).toEqual({ ...DEFAULT_SETTINGS, targetLanguage: 'zh-TW' });
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect(api.storage.session!.get).not.toHaveBeenCalled();
  });

  it('re-resolves a stored browser choice without rewriting it on every preferred language change', async () => {
    const settings = await import('../../src/storage/settings');
    api.storage.local.data[settings.SETTINGS_STORAGE_KEY] = { ...DEFAULT_SETTINGS, model: 'saved/model', keyMode: 'persistent' };
    vi.stubGlobal('navigator', { languages: ['uk-UA'], language: 'uk-UA' });
    expect(await settings.loadSettings()).toMatchObject({ targetLanguage: 'uk-UA', targetLanguageMode: 'browser', model: 'saved/model', keyMode: 'persistent' });
    vi.stubGlobal('navigator', { languages: ['ja-JP'], language: 'ja-JP' });
    expect(await settings.loadSettings()).toMatchObject({ targetLanguage: 'ja-JP', targetLanguageMode: 'browser' });
    expect(api.storage.local.data[settings.SETTINGS_STORAGE_KEY]).toEqual({ ...DEFAULT_SETTINGS, model: 'saved/model', keyMode: 'persistent' });
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });

  it('keeps a valid legacy target manual and preserves source, model, key mode and separate key', async () => {
    const settings = await import('../../src/storage/settings');
    const secrets = await import('../../src/storage/secrets');
    const legacy = { ...DEFAULT_SETTINGS, targetLanguageMode: undefined, uiLanguage: undefined,
      sourceLanguage: 'de-DE', targetLanguage: 'tlh-Latn', model: 'saved/model', keyMode: 'persistent' };
    api.storage.local.data[settings.SETTINGS_STORAGE_KEY] = legacy;
    api.storage.local.data[secrets.API_KEY_STORAGE_KEY] = 'existing-private-test-value';
    vi.stubGlobal('navigator', { languages: ['fr-CA'], language: 'fr-CA' });
    const expected = { ...legacy, targetLanguageMode: 'manual', uiLanguage: 'auto' };
    expect(await settings.loadSettings()).toEqual(expected);
    vi.stubGlobal('navigator', { languages: ['ar'], language: 'ar' });
    expect(await settings.loadSettings()).toEqual(expected);
    expect(api.storage.local.set).toHaveBeenCalledTimes(1);
    expect(await secrets.getApiKey('persistent')).toBe('existing-private-test-value');
    expect(api.storage.session!.set).not.toHaveBeenCalled();
  });

  it('repairs damaged language preferences independently without inventing a manual target', async () => {
    const settings = await import('../../src/storage/settings');
    vi.stubGlobal('navigator', { languages: ['it-IT'], language: 'it-IT' });
    api.storage.local.data[settings.SETTINGS_STORAGE_KEY] = { sourceLanguage: 'fr-CA', targetLanguage: 'bad_tag',
      uiLanguage: 'unknown', model: 'saved/model', keyMode: 'persistent' };
    expect(await settings.loadSettings()).toMatchObject({ sourceLanguage: 'fr-CA', targetLanguage: 'it-IT',
      targetLanguageMode: 'browser', uiLanguage: 'auto', model: 'saved/model', keyMode: 'persistent' });
    api.storage.local.data[settings.SETTINGS_STORAGE_KEY] = { ...DEFAULT_SETTINGS, targetLanguageMode: 'invalid', targetLanguage: 'tlh' };
    expect(await settings.loadSettings()).toMatchObject({ targetLanguage: 'it-IT', targetLanguageMode: 'browser' });
    api.storage.local.data[settings.SETTINGS_STORAGE_KEY] = { targetLanguage: undefined };
    expect(await settings.loadSettings()).toMatchObject({ targetLanguage: 'it-IT', targetLanguageMode: 'browser' });
  });

  it('upgrades stored settings missing streaming without touching the persistent key', async () => {
    const settings = await import('../../src/storage/settings'); const secrets = await import('../../src/storage/secrets');
    api.storage.local.data[settings.SETTINGS_STORAGE_KEY] = { ...DEFAULT_SETTINGS, keyMode: 'persistent', streaming: undefined };
    api.storage.local.data[secrets.API_KEY_STORAGE_KEY] = 'existing-private-test-value';
    expect(await settings.loadSettings()).toMatchObject({ keyMode: 'persistent', streaming: true });
    expect(api.storage.local.data[secrets.API_KEY_STORAGE_KEY]).toBe('existing-private-test-value');
    expect(api.storage.local.set).toHaveBeenCalledTimes(1);
    expect(api.storage.local.set.mock.calls[0]![0]).not.toHaveProperty(secrets.API_KEY_STORAGE_KEY);
    expect(api.storage.session!.set).not.toHaveBeenCalled();
  });
  it('loads fresh defaults without touching either secret store', async () => {
    const settings = await import('../../src/storage/settings');
    expect(await settings.loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(api.storage.session!.get).not.toHaveBeenCalled();
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });

  it('saves only normalized allowed fields without erasing a separate API key', async () => {
    const settings = await import('../../src/storage/settings');
    const secrets = await import('../../src/storage/secrets');
    api.storage.local.data[secrets.API_KEY_STORAGE_KEY] = 'existing-private-test-value';
    const unsafe = { ...DEFAULT_SETTINGS, model: ' model/id ', apiKey: 'do-not-persist', extras: { token: 'nested' } };
    await settings.saveSettings(unsafe);
    expect(api.storage.local.data[settings.SETTINGS_STORAGE_KEY]).toEqual({ ...DEFAULT_SETTINGS, model: 'model/id' });
    expect(await secrets.getApiKey('persistent')).toBe('existing-private-test-value');
    expect(JSON.stringify(await settings.loadSettings())).not.toContain('private-test-value');
    expect(api.storage.local.setAccessLevel).toHaveBeenCalledTimes(1);
    expect(api.storage.local.setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
  });

  it('repairs damaged and old stored fields, preserves valid fields and separate keys', async () => {
    const settings = await import('../../src/storage/settings');
    const secrets = await import('../../src/storage/secrets');
    api.storage.local.data[settings.SETTINGS_STORAGE_KEY] = {
      schemaVersion: 0, model: 'valid-model', concurrency: 99, targetLanguage: 'PT-br',
      customInstructions: 'x'.repeat(4_001), theme: 'dark', apiKey: 'misplaced-secret',
    };
    api.storage.local.data[secrets.API_KEY_STORAGE_KEY] = 'separate-private-test-value';
    const loaded = await settings.loadSettings();
    expect(loaded).toEqual({ ...DEFAULT_SETTINGS, model: 'valid-model', targetLanguage: 'pt-BR', targetLanguageMode: 'manual', theme: 'dark' });
    expect(api.storage.local.data[settings.SETTINGS_STORAGE_KEY]).toEqual(loaded);
    expect(await secrets.getApiKey('persistent')).toBe('separate-private-test-value');
  });

  it('rejects invalid saves before changing storage and keeps the operation queue usable', async () => {
    const settings = await import('../../src/storage/settings');
    await expect(settings.saveSettings({ ...DEFAULT_SETTINGS, concurrency: 5 })).rejects.toMatchObject({ code: 'INVALID_SETTINGS' });
    expect(api.storage.local.set).not.toHaveBeenCalled();
    await settings.saveSettings({ ...DEFAULT_SETTINGS, theme: 'dark' });
    expect((await settings.loadSettings()).theme).toBe('dark');
  });

  it('rejects a future schema without rewriting unknown future data', async () => {
    const settings = await import('../../src/storage/settings');
    const stored = { schemaVersion: 2, futureOption: 'preserve', model: 'new-model' };
    api.storage.local.data[settings.SETTINGS_STORAGE_KEY] = stored;
    await expect(settings.loadSettings()).rejects.toMatchObject({ code: 'INVALID_SETTINGS' });
    expect(api.storage.local.data[settings.SETTINGS_STORAGE_KEY]).toEqual(stored);
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });

  it('serializes writes and does not expose raw storage errors', async () => {
    const settings = await import('../../src/storage/settings');
    api.storage.local.set.mockRejectedValueOnce(new Error('unsafe-private-test-value'));
    await expect(settings.saveSettings(DEFAULT_SETTINGS)).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    await Promise.all([
      settings.saveSettings({ ...DEFAULT_SETTINGS, theme: 'dark' }),
      settings.saveSettings({ ...DEFAULT_SETTINGS, theme: 'light' }),
    ]);
    expect((await settings.loadSettings()).theme).toBe('light');
    api.storage.local.get.mockRejectedValueOnce(new Error('unsafe-private-test-value'));
    await expect(settings.loadSettings()).rejects.not.toThrow('unsafe-private-test-value');
  });

  /** @spec spec://modules/storage/INFRA-002-local-data#secrets */
  it('does not let a pending settings repair overwrite a newer committed key mode', async () => {
    const settings = await import('../../src/storage/settings');
    const secrets = await import('../../src/storage/secrets');
    const old = { ...DEFAULT_SETTINGS, keyMode: 'session' as const, streaming: undefined };
    api.storage.local.data[settings.SETTINGS_STORAGE_KEY] = old;
    api.storage.session!.data[secrets.API_KEY_STORAGE_KEY] = 'old-private-test-value';
    let releaseRepair!: () => void;
    let repairStarted!: () => void;
    const started = new Promise<void>(resolve => { repairStarted = resolve; });
    const originalSet = api.storage.local.set.getMockImplementation()!;
    api.storage.local.set.mockImplementationOnce(async (items) => {
      repairStarted();
      await new Promise<void>(resolve => { releaseRepair = resolve; });
      await originalSet(items);
    });
    const loading = settings.loadSettings();
    await started;
    const next = { ...DEFAULT_SETTINGS, keyMode: 'persistent' as const, model: 'new/model' };
    const saving = secrets.saveConfiguration(next, 'new-private-test-value');
    await new Promise(resolve => setTimeout(resolve, 20));
    releaseRepair();
    await Promise.all([loading, saving]);
    expect(await settings.loadSettings()).toEqual(next);
    expect(await secrets.getApiKey('persistent')).toBe('new-private-test-value');
    expect(await secrets.getApiKey('session')).toBeUndefined();
  });
});

/** @spec spec://modules/storage/INFRA-002-local-data#secrets */
describe('secret modes and privacy', () => {
  it('uses the committed mode as the source when an interrupted update left a stale copy in the other store', async () => {
    const secrets = await import('../../src/storage/secrets');
    await secrets.saveConfiguration({ ...DEFAULT_SETTINGS, keyMode: 'persistent' }, 'current-private-test-value');
    api.storage.session!.data[secrets.API_KEY_STORAGE_KEY] = 'stale-private-test-value';
    await secrets.saveConfiguration(DEFAULT_SETTINGS);
    expect(await secrets.getApiKey('session')).toBe('current-private-test-value');
    expect(await secrets.getApiKey('persistent')).toBeUndefined();
  });

  it('does not resurrect a stale local key after the committed session key expires', async () => {
    const secrets = await import('../../src/storage/secrets');
    const settings = await import('../../src/storage/settings');
    await secrets.saveConfiguration(DEFAULT_SETTINGS, 'current-private-test-value');
    api.storage.session = makeArea(); // A new browser session has no session key.
    api.storage.local.data[secrets.API_KEY_STORAGE_KEY] = 'stale-private-test-value';
    await secrets.saveConfiguration({ ...DEFAULT_SETTINGS, model: 'saved/model' });
    expect(await settings.loadSettings()).toMatchObject({ keyMode: 'session', model: 'saved/model' });
    expect(await secrets.getApiKey('session')).toBeUndefined();
    expect(await secrets.getApiKey('persistent')).toBeUndefined();
  });

  it('does not resurrect a stale session key when the committed persistent key is absent', async () => {
    const secrets = await import('../../src/storage/secrets');
    const settings = await import('../../src/storage/settings');
    await secrets.saveConfiguration({ ...DEFAULT_SETTINGS, keyMode: 'persistent' }, 'current-private-test-value');
    delete api.storage.local.data[secrets.API_KEY_STORAGE_KEY];
    api.storage.session!.data[secrets.API_KEY_STORAGE_KEY] = 'stale-private-test-value';
    await secrets.saveConfiguration({ ...DEFAULT_SETTINGS, keyMode: 'persistent', model: 'saved/model' });
    expect(await settings.loadSettings()).toMatchObject({ keyMode: 'persistent', model: 'saved/model' });
    expect(await secrets.getApiKey('persistent')).toBeUndefined();
    expect(await secrets.getApiKey('session')).toBeUndefined();
  });

  it('commits the persistent key and mode together before source cleanup, surviving a restarted module/session', async () => {
    const secrets = await import('../../src/storage/secrets');
    const settings = await import('../../src/storage/settings');
    await secrets.setApiKey('durable-private-test-value', 'session');
    let finishCleanup!: () => void;
    api.storage.session!.remove.mockReturnValueOnce(new Promise<void>(resolve => { finishCleanup = resolve; }));
    const saving = secrets.saveConfiguration({ ...DEFAULT_SETTINGS, keyMode: 'persistent', model: 'saved/model' });
    await vi.waitFor(() => expect(api.storage.local.data[settings.SETTINGS_STORAGE_KEY]).toMatchObject({ keyMode: 'persistent' }));
    expect(api.storage.local.set).toHaveBeenCalledExactlyOnceWith({
      [settings.SETTINGS_STORAGE_KEY]: { ...DEFAULT_SETTINGS, keyMode: 'persistent', model: 'saved/model' },
      [secrets.API_KEY_STORAGE_KEY]: 'durable-private-test-value',
    });
    api.storage.session = makeArea();
    vi.resetModules();
    const restartedSettings = await import('../../src/storage/settings');
    const restartedSecrets = await import('../../src/storage/secrets');
    const loaded = await restartedSettings.loadSettings();
    expect(loaded.keyMode).toBe('persistent');
    expect(await restartedSecrets.getApiKey(loaded.keyMode)).toBe('durable-private-test-value');
    expect(JSON.stringify(loaded)).not.toContain('private-test-value');
    finishCleanup();
    await saving;
  });

  it('prepares a session key and clears the persistent value in the same write as the new mode', async () => {
    const secrets = await import('../../src/storage/secrets');
    const { SETTINGS_STORAGE_KEY } = await import('../../src/storage/settings');
    await secrets.saveConfiguration({ ...DEFAULT_SETTINGS, keyMode: 'persistent' }, 'private-test-value');
    api.storage.local.set.mockClear();
    await secrets.saveConfiguration({ ...DEFAULT_SETTINGS, keyMode: 'session' });
    expect(api.storage.local.set).toHaveBeenCalledExactlyOnceWith({ [SETTINGS_STORAGE_KEY]: DEFAULT_SETTINGS, [secrets.API_KEY_STORAGE_KEY]: null });
    expect(await secrets.getApiKey('session')).toBe('private-test-value');
    expect(api.storage.local.data).not.toHaveProperty(secrets.API_KEY_STORAGE_KEY);
  });

  it('preserves the old local configuration and removes a prepared session copy on a failed commit', async () => {
    const secrets = await import('../../src/storage/secrets');
    const settings = await import('../../src/storage/settings');
    const original = { ...DEFAULT_SETTINGS, keyMode: 'persistent' as const, model: 'original/model' };
    await secrets.saveConfiguration(original, 'original-private-test-value');
    api.storage.local.set.mockRejectedValueOnce(new Error('unsafe-private-test-value'));
    await expect(secrets.saveConfiguration(DEFAULT_SETTINGS, 'replacement-private-test-value')).rejects.not.toThrow('unsafe-private-test-value');
    expect(await settings.loadSettings()).toEqual(original);
    expect(await secrets.getApiKey('persistent')).toBe('original-private-test-value');
    expect(await secrets.getApiKey('session')).toBeUndefined();
  });

  it('restores both areas when a rejected local write has already changed stored values', async () => {
    const secrets = await import('../../src/storage/secrets');
    const settings = await import('../../src/storage/settings');
    const original = { ...DEFAULT_SETTINGS, keyMode: 'persistent' as const, model: 'original/model' };
    await secrets.saveConfiguration(original, 'original-private-test-value');
    api.storage.local.set.mockImplementationOnce(async (items) => {
      Object.assign(api.storage.local.data, structuredClone(items));
      throw new Error('unsafe-private-test-value');
    });
    await expect(secrets.saveConfiguration(DEFAULT_SETTINGS, 'replacement-private-test-value'))
      .rejects.not.toThrow('unsafe-private-test-value');
    expect(await settings.loadSettings()).toEqual(original);
    expect(await secrets.getApiKey('persistent')).toBe('original-private-test-value');
    expect(await secrets.getApiKey('session')).toBeUndefined();
  });

  it('removes a prepared session copy when its write changes storage before rejecting', async () => {
    const secrets = await import('../../src/storage/secrets');
    const settings = await import('../../src/storage/settings');
    const original = { ...DEFAULT_SETTINGS, keyMode: 'persistent' as const };
    await secrets.saveConfiguration(original, 'original-private-test-value');
    api.storage.session!.set.mockImplementationOnce(async (items) => {
      Object.assign(api.storage.session!.data, structuredClone(items));
      throw new Error('unsafe-private-test-value');
    });
    await expect(secrets.saveConfiguration(DEFAULT_SETTINGS, 'replacement-private-test-value'))
      .rejects.not.toThrow('unsafe-private-test-value');
    expect(await settings.loadSettings()).toEqual(original);
    expect(await secrets.getApiKey('persistent')).toBe('original-private-test-value');
    expect(await secrets.getApiKey('session')).toBeUndefined();
  });

  it('restores the committed session mode when source cleanup changes storage before rejecting', async () => {
    const secrets = await import('../../src/storage/secrets');
    const settings = await import('../../src/storage/settings');
    await secrets.saveConfiguration(DEFAULT_SETTINGS, 'original-private-test-value');
    api.storage.session!.remove.mockImplementationOnce(async (keys) => {
      for (const name of [keys].flat()) delete api.storage.session!.data[name];
      throw new Error('unsafe-private-test-value');
    });
    await expect(secrets.saveConfiguration({ ...DEFAULT_SETTINGS, keyMode: 'persistent' }))
      .rejects.not.toThrow('unsafe-private-test-value');
    expect(await settings.loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await secrets.getApiKey('session')).toBe('original-private-test-value');
    expect(await secrets.getApiKey('persistent')).toBeUndefined();
  });

  it('rolls back both local fields when the session source cannot be removed', async () => {
    const secrets = await import('../../src/storage/secrets');
    const settings = await import('../../src/storage/settings');
    await settings.saveSettings(DEFAULT_SETTINGS);
    await secrets.setApiKey('original-private-test-value', 'session');
    api.storage.session!.remove.mockRejectedValueOnce(new Error('unsafe-private-test-value'));
    await expect(secrets.saveConfiguration({ ...DEFAULT_SETTINGS, keyMode: 'persistent' })).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(await settings.loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await secrets.getApiKey('session')).toBe('original-private-test-value');
    expect(api.storage.local.data).not.toHaveProperty(secrets.API_KEY_STORAGE_KEY);
  });

  it('uses session storage, survives a background module restart and exposes only status', async () => {
    let secrets = await import('../../src/storage/secrets');
    await secrets.setApiKey(' session-private-test-value ', 'session');
    expect(api.storage.session!.data[secrets.API_KEY_STORAGE_KEY]).toBe('session-private-test-value');
    expect(api.storage.local.data).not.toHaveProperty(secrets.API_KEY_STORAGE_KEY);
    expect(await secrets.getSecretStatus('session')).toEqual({ hasKey: true, mode: 'session' });
    expect(await secrets.getSecretStatus('persistent')).toEqual({ hasKey: false, mode: 'persistent' });
    vi.resetModules();
    secrets = await import('../../src/storage/secrets');
    expect(await secrets.getApiKey('session')).toBe('session-private-test-value');
  });

  it('moves the existing key in both directions for empty/omitted input and removes the previous copy', async () => {
    const secrets = await import('../../src/storage/secrets');
    await secrets.setApiKey('private-test-value', 'persistent');
    await secrets.setApiKey('', 'session');
    expect(await secrets.getApiKey('session')).toBe('private-test-value');
    expect(await secrets.getApiKey('persistent')).toBeUndefined();
    await secrets.setApiKey(undefined, 'persistent');
    expect(await secrets.getApiKey('persistent')).toBe('private-test-value');
    expect(await secrets.getApiKey('session')).toBeUndefined();
    expect(api.storage.local.setAccessLevel).toHaveBeenCalledTimes(1);
    expect(api.storage.session!.setAccessLevel).toHaveBeenCalledTimes(1);
  });

  it('replaces the key and removes a stale copy without keeping an in-memory key cache', async () => {
    const secrets = await import('../../src/storage/secrets');
    api.storage.local.data[secrets.API_KEY_STORAGE_KEY] = 'old-local-test-value';
    api.storage.session!.data[secrets.API_KEY_STORAGE_KEY] = 'old-session-test-value';
    await secrets.setApiKey('new-private-test-value', 'persistent');
    expect(await secrets.getApiKey('persistent')).toBe('new-private-test-value');
    expect(api.storage.session!.data).not.toHaveProperty(secrets.API_KEY_STORAGE_KEY);
    delete api.storage.local.data[secrets.API_KEY_STORAGE_KEY];
    expect(await secrets.getSecretStatus('persistent')).toEqual({ hasKey: false, mode: 'persistent' });
  });

  it('does not persist a session key when session API is absent; explicit persistent mode still works', async () => {
    const secrets = await import('../../src/storage/secrets');
    api.storage.session = undefined;
    await expect(secrets.setApiKey('private-test-value', 'session')).rejects.toMatchObject({ code: 'INVALID_SETTINGS' });
    expect(api.storage.local.set).not.toHaveBeenCalled();
    await expect(secrets.getSecretStatus('session')).rejects.toThrow('Этот браузер не поддерживает');
    await secrets.setApiKey('private-test-value', 'persistent');
    expect(await secrets.getApiKey('persistent')).toBe('private-test-value');
    await secrets.removeApiKey();
    expect(await secrets.getApiKey('persistent')).toBeUndefined();
  });

  it('supports browsers without setAccessLevel and fails closed when present protection fails', async () => {
    const secrets = await import('../../src/storage/secrets');
    delete (api.storage.local as Partial<ReturnType<typeof makeArea>>).setAccessLevel;
    delete (api.storage.session! as Partial<ReturnType<typeof makeArea>>).setAccessLevel;
    await secrets.setApiKey('private-test-value', 'session');
    expect(await secrets.getApiKey('session')).toBe('private-test-value');
    api.storage.local = makeArea();
    api.storage.local.setAccessLevel.mockRejectedValueOnce(new Error('private-test-value'));
    await expect(secrets.setApiKey('replacement', 'persistent')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect(await secrets.getApiKey('session')).toBe('private-test-value');
    await secrets.setApiKey('', 'persistent');
    expect(await secrets.getApiKey('persistent')).toBe('private-test-value');
  });

  it('rolls back the destination when removing the old copy fails', async () => {
    const secrets = await import('../../src/storage/secrets');
    await secrets.setApiKey('private-test-value', 'persistent');
    api.storage.local.remove.mockRejectedValueOnce(new Error('private-test-value'));
    await expect(secrets.setApiKey('', 'session')).rejects.not.toThrow('private-test-value');
    expect(await secrets.getApiKey('persistent')).toBe('private-test-value');
    expect(await secrets.getApiKey('session')).toBeUndefined();
    await secrets.setApiKey('', 'session');
    expect(await secrets.getApiKey('session')).toBe('private-test-value');
    expect(await secrets.getApiKey('persistent')).toBeUndefined();
  });

  it('preserves the source if saving the destination fails', async () => {
    const secrets = await import('../../src/storage/secrets');
    await secrets.setApiKey('private-test-value', 'persistent');
    api.storage.session!.set.mockRejectedValueOnce(new Error('unsafe-private-test-value'));
    await expect(secrets.setApiKey('', 'session')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(await secrets.getApiKey('persistent')).toBe('private-test-value');
    expect(await secrets.getApiKey('session')).toBeUndefined();
  });

  it('restores a direct key migration when a destination write changes storage before rejecting', async () => {
    const secrets = await import('../../src/storage/secrets');
    await secrets.setApiKey('original-private-test-value', 'persistent');
    api.storage.session!.set.mockImplementationOnce(async (items) => {
      Object.assign(api.storage.session!.data, structuredClone(items));
      throw new Error('unsafe-private-test-value');
    });
    await expect(secrets.setApiKey('replacement-private-test-value', 'session'))
      .rejects.not.toThrow('unsafe-private-test-value');
    expect(await secrets.getApiKey('persistent')).toBe('original-private-test-value');
    expect(await secrets.getApiKey('session')).toBeUndefined();
  });

  it('restores a direct key migration when source removal changes storage before rejecting', async () => {
    const secrets = await import('../../src/storage/secrets');
    await secrets.setApiKey('original-private-test-value', 'persistent');
    api.storage.local.remove.mockImplementationOnce(async (keys) => {
      for (const name of [keys].flat()) delete api.storage.local.data[name];
      throw new Error('unsafe-private-test-value');
    });
    await expect(secrets.setApiKey(undefined, 'session')).rejects.not.toThrow('unsafe-private-test-value');
    expect(await secrets.getApiKey('persistent')).toBe('original-private-test-value');
    expect(await secrets.getApiKey('session')).toBeUndefined();
  });

  it('attempts deletion from both stores even when one fails, and allows a retry', async () => {
    const secrets = await import('../../src/storage/secrets');
    api.storage.local.data[secrets.API_KEY_STORAGE_KEY] = 'local-private-test-value';
    api.storage.session!.data[secrets.API_KEY_STORAGE_KEY] = 'session-private-test-value';
    api.storage.local.remove.mockRejectedValueOnce(new Error('unsafe-private-test-value'));
    await expect(secrets.removeApiKey()).rejects.toThrow('Не удалось удалить все копии');
    expect(api.storage.session!.data).not.toHaveProperty(secrets.API_KEY_STORAGE_KEY);
    await secrets.removeApiKey();
    expect(await secrets.getSecretStatus('persistent')).toEqual({ hasKey: false, mode: 'persistent' });
    expect(await secrets.getSecretStatus('session')).toEqual({ hasKey: false, mode: 'session' });
  });

  it('serializes concurrent mode changes and deletion without duplicate copies', async () => {
    const secrets = await import('../../src/storage/secrets');
    await Promise.all([
      secrets.setApiKey('private-test-value', 'persistent'),
      secrets.setApiKey(undefined, 'session'),
      secrets.setApiKey(undefined, 'persistent'),
      secrets.removeApiKey(),
    ]);
    expect(await secrets.getApiKey('persistent')).toBeUndefined();
    expect(await secrets.getApiKey('session')).toBeUndefined();
  });

  it('deletes only the secret keys, retaining settings and safe background snapshots', async () => {
    const secrets = await import('../../src/storage/secrets');
    api.storage.local.data.settings = { theme: 'dark' };
    api.storage.session!.data.snapshots = [{ sessionId: 'safe-session' }];
    await secrets.setApiKey('private-test-value', 'persistent');
    await secrets.removeApiKey();
    expect(api.storage.local.data).toEqual({ settings: { theme: 'dark' } });
    expect(api.storage.session!.data).toEqual({ snapshots: [{ sessionId: 'safe-session' }] });
  });

  it('does not expose or migrate malformed persisted key values', async () => {
    const secrets = await import('../../src/storage/secrets');
    for (const value of ['key\u0001value', 'x'.repeat(4_097), { token: 'private-test-value' }]) {
      api.storage.local.data[secrets.API_KEY_STORAGE_KEY] = value;
      expect(await secrets.getApiKey('persistent')).toBeUndefined();
      expect(await secrets.getSecretStatus('persistent')).toEqual({ hasKey: false, mode: 'persistent' });
      await secrets.setApiKey('', 'session');
      expect(api.storage.local.data).not.toHaveProperty(secrets.API_KEY_STORAGE_KEY);
      expect(api.storage.session!.data).not.toHaveProperty(secrets.API_KEY_STORAGE_KEY);
    }
  });

  it.each(['x'.repeat(4_097), 'key\r\nheader', 'key\0value', 'key\tvalue', 'key\u007fvalue'])('rejects unsafe key input without touching stores', async (key) => {
    const secrets = await import('../../src/storage/secrets');
    await expect(secrets.setApiKey(key, 'persistent')).rejects.toMatchObject({ code: 'INVALID_API_KEY' });
    expect(api.storage.local.get).not.toHaveBeenCalled();
    expect(api.storage.session!.get).not.toHaveBeenCalled();
  });
});
