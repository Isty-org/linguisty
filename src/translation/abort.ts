import { LinguistyError } from '../shared/errors';

export function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new LinguistyError('CANCELLED');
}

/** @spec spec://modules/translation/FEAT-001-engine#errors */
export function withSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    void promise.catch(() => undefined);
    return Promise.reject(new LinguistyError('CANCELLED'));
  }
  return new Promise<T>((resolve, reject) => {
    const abort = () => { cleanup(); reject(new LinguistyError('CANCELLED')); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

/** @spec spec://modules/translation/FEAT-001-engine#errors */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfCancelled(signal);
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); cleanup(); reject(new LinguistyError('CANCELLED')); };
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
