import { browser } from 'wxt/browser';
import { LinguistyError } from '../shared/errors';

type StorageArea = Pick<typeof browser.storage.local, 'get' | 'set' | 'remove'> & {
  setAccessLevel?: (options: { accessLevel: 'TRUSTED_CONTEXTS' }) => Promise<void>;
};

const protectedAreas = new WeakMap<StorageArea, Promise<void>>();

/** @spec spec://modules/storage/INFRA-002-local-data#secrets */
export async function getStorageArea(name: 'local' | 'session'): Promise<StorageArea> {
  const area = browser.storage?.[name] as StorageArea | undefined;
  if (!area) {
    throw new LinguistyError('INVALID_SETTINGS', name === 'session'
      ? 'Этот браузер не поддерживает хранение на время сессии. Обновите браузер до поддерживаемой версии.'
      : 'Локальное хранилище расширения недоступно.');
  }

  if (area.setAccessLevel) {
    let protection = protectedAreas.get(area);
    if (!protection) {
      protection = area.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
      protectedAreas.set(area, protection);
    }
    try {
      await protection;
    } catch {
      protectedAreas.delete(area);
      throw new LinguistyError('INTERNAL_ERROR', 'Не удалось ограничить доступ к локальным данным расширения.');
    }
  }
  return area;
}

export function hasSessionStorage(): boolean {
  return Boolean(browser.storage?.session);
}
