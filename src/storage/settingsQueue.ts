let settingsQueue: Promise<void> = Promise.resolve();

/** Serialize settings repair and configuration commits in the background instance.
 * @spec spec://modules/storage/INFRA-002-local-data#secrets
 */
export function withSettingsQueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = settingsQueue.then(operation);
  settingsQueue = result.then(() => undefined, () => undefined);
  return result;
}
