import type { KeyMode, SecretStatus, Settings } from '../shared/contracts';
import { LinguistyError } from '../shared/errors';
import { getStorageArea, hasSessionStorage } from './areas';
import { containsControls, normalizeSettings } from './normalization';
import { SETTINGS_STORAGE_KEY } from './settings';
import { withSettingsQueue } from './settingsQueue';

export const API_KEY_STORAGE_KEY = 'linguisty.apiKey';
let secretQueue: Promise<void> = Promise.resolve();

function validateMode(mode: KeyMode): 'local' | 'session' {
  if (mode === 'persistent') return 'local';
  if (mode === 'session') return 'session';
  throw new LinguistyError('INVALID_SETTINGS', 'Недопустимый режим хранения API-ключа.');
}

function keyValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 4_096 && !containsControls(value) && value.trim()
    ? value.trim() : undefined;
}

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = secretQueue.then(async () => {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof LinguistyError) throw error;
      // Storage errors may include keys or stored values. Never expose their raw messages.
      throw new LinguistyError('INTERNAL_ERROR', 'Не удалось обновить или прочитать сохранённый API-ключ.');
    }
  });
  secretQueue = result.then(() => undefined, () => undefined);
  return result;
}

/** Background-only helper. @spec spec://modules/storage/INFRA-002-local-data#secrets */
export function getApiKey(mode: KeyMode): Promise<string | undefined> {
  return serialized(async () => {
    const area = await getStorageArea(validateMode(mode));
    return keyValue((await area.get(API_KEY_STORAGE_KEY))[API_KEY_STORAGE_KEY]);
  });
}

/**
 * An empty/omitted key preserves the existing key and migrates it into mode.
 * Call before saving keyMode in settings. Deletion is a separate action.
 * @spec spec://modules/storage/INFRA-002-local-data#secrets
 */
export function setApiKey(key: string | undefined, mode: KeyMode): Promise<void> {
  return serialized(async () => {
    const areaName = validateMode(mode);
    if (key !== undefined && (typeof key !== 'string' || key.length > 4_096 || containsControls(key))) {
      throw new LinguistyError('INVALID_API_KEY');
    }
    const target = await getStorageArea(areaName);
    const otherName = areaName === 'local' ? 'session' : 'local';
    const other = otherName === 'session' && !hasSessionStorage() ? undefined : await getStorageArea(otherName);
    const previous = (await target.get(API_KEY_STORAGE_KEY))[API_KEY_STORAGE_KEY] as unknown;
    const otherPrevious = other ? (await other.get(API_KEY_STORAGE_KEY))[API_KEY_STORAGE_KEY] as unknown : undefined;
    const otherKey = keyValue(otherPrevious);
    const nextKey = keyValue(key) ?? keyValue(previous) ?? otherKey;
    let attemptedTarget = false;
    let attemptedOther = false;
    try {
      attemptedTarget = true;
      if (nextKey) await target.set({ [API_KEY_STORAGE_KEY]: nextKey });
      else await target.remove(API_KEY_STORAGE_KEY);
      if (other) {
        attemptedOther = true;
        await other.remove(API_KEY_STORAGE_KEY);
      }
    } catch {
      // A rejected call may have changed its area. Restore every attempted write.
      const rollback = await Promise.allSettled([
        ...(attemptedTarget ? [previous === undefined
          ? target.remove(API_KEY_STORAGE_KEY)
          : target.set({ [API_KEY_STORAGE_KEY]: previous })] : []),
        ...(attemptedOther && other ? [otherPrevious === undefined
          ? other.remove(API_KEY_STORAGE_KEY)
          : other.set({ [API_KEY_STORAGE_KEY]: otherPrevious })] : []),
      ]);
      throw new LinguistyError('INTERNAL_ERROR', rollback.some((result) => result.status === 'rejected')
        ? 'Не удалось перенести API-ключ и полностью восстановить прежнее состояние. Проверьте настройки.'
        : 'Не удалось перенести API-ключ. Прежний режим хранения сохранён.');
    }
  });
}

/**
 * Keep a durable key and its mode in the same local write, including during an update.
 * A session destination is prepared before clearing the durable source value.
 * @spec spec://modules/storage/INFRA-002-local-data#secrets
 */
export function saveConfiguration(value: Settings, key?: string): Promise<void> {
  const settings = normalizeSettings(value);
  return serialized(() => withSettingsQueue(async () => {
    if (key !== undefined && (typeof key !== 'string' || key.length > 4_096 || containsControls(key))) {
      throw new LinguistyError('INVALID_API_KEY');
    }
    const local = await getStorageArea('local');
    const session = hasSessionStorage() ? await getStorageArea('session') : undefined;
    if (settings.keyMode === 'session' && !session) await getStorageArea('session');
    const beforeLocal = await local.get([SETTINGS_STORAGE_KEY, API_KEY_STORAGE_KEY]);
    const beforeSession = session ? (await session.get(API_KEY_STORAGE_KEY))[API_KEY_STORAGE_KEY] : undefined;
    const localKey = keyValue(beforeLocal[API_KEY_STORAGE_KEY]);
    const sessionKey = keyValue(beforeSession);
    const previousSettings = beforeLocal[SETTINGS_STORAGE_KEY] as Partial<Settings> | undefined;
    const committedMode = previousSettings?.keyMode;
    const hasCommittedMode = committedMode === 'persistent' || committedMode === 'session';
    const currentKey = committedMode === 'persistent' ? localKey : committedMode === 'session' ? sessionKey : undefined;
    // A missing key in the committed area stays missing. The other area may contain a stale copy.
    const nextKey = keyValue(key) ?? (hasCommittedMode
      ? currentKey
      : settings.keyMode === 'persistent' ? localKey ?? sessionKey : sessionKey ?? localKey);
    let attemptedSession = false;
    let attemptedLocal = false;

    async function restoreLocal() {
      await local.set({
        [SETTINGS_STORAGE_KEY]: beforeLocal[SETTINGS_STORAGE_KEY] ?? null,
        [API_KEY_STORAGE_KEY]: beforeLocal[API_KEY_STORAGE_KEY] ?? null,
      });
      const absent = [SETTINGS_STORAGE_KEY, API_KEY_STORAGE_KEY].filter((name) => beforeLocal[name] === undefined);
      if (absent.length) await local.remove(absent);
    }
    async function restoreSession() {
      if (!session) return;
      if (beforeSession === undefined) await session.remove(API_KEY_STORAGE_KEY);
      else await session.set({ [API_KEY_STORAGE_KEY]: beforeSession });
    }

    try {
      if (settings.keyMode === 'session') {
        attemptedSession = true;
        if (nextKey) await session!.set({ [API_KEY_STORAGE_KEY]: nextKey });
        else await session!.remove(API_KEY_STORAGE_KEY);
      }
      // null clears the secret value in the same write as keyMode; remove only tidies the tombstone.
      attemptedLocal = true;
      await local.set({ [SETTINGS_STORAGE_KEY]: settings, [API_KEY_STORAGE_KEY]: settings.keyMode === 'persistent' ? nextKey ?? null : null });
      if (settings.keyMode === 'persistent' && session) {
        attemptedSession = true;
        await session.remove(API_KEY_STORAGE_KEY);
      }
    } catch {
      const rollback = await Promise.allSettled([
        ...(attemptedLocal ? [restoreLocal()] : []),
        ...(attemptedSession ? [restoreSession()] : []),
      ]);
      throw new LinguistyError('INTERNAL_ERROR', rollback.some((result) => result.status === 'rejected')
        ? 'Не удалось сохранить настройки и полностью восстановить прежнее состояние ключа. Проверьте настройки.'
        : 'Не удалось сохранить настройки. Прежний ключ и режим хранения сохранены.');
    }
    if (settings.keyMode === 'session' || !nextKey) {
      await local.remove(API_KEY_STORAGE_KEY).catch(() => undefined);
    }
  }));
}

/** @spec spec://modules/storage/INFRA-002-local-data#secrets */
export function removeApiKey(): Promise<void> {
  return serialized(async () => {
    const names = hasSessionStorage() ? ['local', 'session'] as const : ['local'] as const;
    const results = await Promise.allSettled(names.map(async (name) => {
      const area = await getStorageArea(name);
      await area.remove(API_KEY_STORAGE_KEY);
    }));
    if (results.some((result) => result.status === 'rejected')) {
      throw new LinguistyError('INTERNAL_ERROR', 'Не удалось удалить все копии API-ключа. Повторите удаление.');
    }
  });
}

/** @spec spec://modules/storage/INFRA-002-local-data#secrets */
export async function getSecretStatus(mode: KeyMode): Promise<SecretStatus> {
  return { hasKey: Boolean(await getApiKey(mode)), mode };
}
