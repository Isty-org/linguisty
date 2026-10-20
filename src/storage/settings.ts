import type { Settings } from '../shared/contracts';
import { DEFAULT_SETTINGS } from '../shared/constants';
import { LinguistyError } from '../shared/errors';
import { resolveBrowserTargetLanguage } from '../shared/languages';
import { getStorageArea } from './areas';
import { normalizeSettings } from './normalization';
import { withSettingsQueue } from './settingsQueue';

export { normalizeSettings, normalizeBaseUrl } from './normalization';

export const SETTINGS_STORAGE_KEY = 'linguisty.settings';

function repairStoredSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ...DEFAULT_SETTINGS };
  const source = value as Record<string, unknown>;
  if (typeof source.schemaVersion === 'number' && source.schemaVersion > 1) {
    throw new LinguistyError('INVALID_SETTINGS', 'Сохранённые настройки созданы более новой версией расширения.');
  }
  const repaired: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (key === 'schemaVersion' || !Object.hasOwn(source, key)) continue;
    try {
      repaired[key] = normalizeSettings({ [key]: source[key] })[key];
    } catch {
      // A damaged field falls back independently; valid settings and separate secrets survive.
    }
  }
  if (!Object.hasOwn(source, 'targetLanguageMode') || source.targetLanguageMode === undefined) {
    // Only a successfully repaired, explicitly stored legacy target is a manual choice.
    repaired.targetLanguageMode = source.targetLanguage !== undefined && Object.hasOwn(repaired, 'targetLanguage')
      ? 'manual' : 'browser';
  } else if (!Object.hasOwn(repaired, 'targetLanguageMode')) {
    repaired.targetLanguageMode = DEFAULT_SETTINGS.targetLanguageMode;
  }
  return normalizeSettings(repaired);
}

/** @spec spec://modules/storage/INFRA-002-local-data#settings */
export function loadSettings(): Promise<Settings> {
  return withSettingsQueue(async () => {
    try {
      const area = await getStorageArea('local');
      const stored = (await area.get(SETTINGS_STORAGE_KEY))[SETTINGS_STORAGE_KEY] as unknown;
      const settings = repairStoredSettings(stored);
      if (stored !== undefined && JSON.stringify(stored) !== JSON.stringify(settings)) {
        await area.set({ [SETTINGS_STORAGE_KEY]: settings });
      }
      return settings.targetLanguageMode === 'browser'
        ? { ...settings, targetLanguage: resolveBrowserTargetLanguage() } : settings;
    } catch (error) {
      if (error instanceof LinguistyError) throw error;
      throw new LinguistyError('INTERNAL_ERROR', 'Не удалось прочитать локальные настройки.');
    }
  });
}

/** @spec spec://modules/storage/INFRA-002-local-data#settings */
export async function saveSettings(value: Settings): Promise<void> {
  // Validate before entering the queue and capture a fresh, secret-free object.
  const settings = normalizeSettings(value);
  return withSettingsQueue(async () => {
    try {
      const area = await getStorageArea('local');
      await area.set({ [SETTINGS_STORAGE_KEY]: settings });
    } catch (error) {
      if (error instanceof LinguistyError) throw error;
      throw new LinguistyError('INTERNAL_ERROR', 'Не удалось сохранить локальные настройки.');
    }
  });
}
