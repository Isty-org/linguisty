/** @spec spec://common/PROP-001-contracts#messages */
import { browser } from 'wxt/browser';
import type { ApiResult, RuntimeMessage } from './contracts';
import { LinguistyError } from './errors';

const READ_TYPES = new Set<RuntimeMessage['type']>(['GET_SETTINGS', 'GET_SECRET_STATUS', 'GET_TAB_STATE', 'GET_CACHE_STATS', 'GET_ERROR_LOG']);
export const READ_TIMEOUT_MS = 5_000;
const COMMAND_TIMEOUT_MS = 35_000;
const MAX_MESSAGE_TIMEOUT_MS = 305_000;
const STARTUP_RETRY_MS = 150;

interface WaitOptions { signal?: AbortSignal; timeoutMs?: number }

/** @spec spec://common/PROP-002-quality#resources */
function messageTimeoutMs(message: RuntimeMessage, override?: number): number {
  const rawProviderBudget = (message.type === 'TEST_CONNECTION' || message.type === 'LIST_MODELS')
    ? message.settings?.requestTimeoutMs : undefined;
  const providerBudget = rawProviderBudget !== undefined && Number.isFinite(rawProviderBudget)
    ? Math.min(120_000, Math.max(1_000, rawProviderBudget)) : undefined;
  const normal = READ_TYPES.has(message.type) ? READ_TIMEOUT_MS
    : providerBudget === undefined ? COMMAND_TIMEOUT_MS : Math.max(COMMAND_TIMEOUT_MS, providerBudget + 5_000);
  const requested = override ?? normal;
  return Number.isFinite(requested) ? Math.min(MAX_MESSAGE_TIMEOUT_MS, Math.max(1, requested)) : normal;
}

/** @spec spec://modules/interface/FEAT-003-controls#errors */
export function waitForBrowser<T>(operation: () => Promise<T>, { signal, timeoutMs = READ_TIMEOUT_MS }: WaitOptions = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new LinguistyError('CANCELLED')); return; }
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      action();
    };
    const abort = () => finish(() => reject(new LinguistyError('CANCELLED')));
    const timer = setTimeout(() => finish(() => reject(new LinguistyError('REQUEST_TIMEOUT', 'Расширение не ответило вовремя. Повторите загрузку.', true))), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(operation).then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
  });
}

/** @spec spec://common/PROP-001-contracts#messages */
export function sendMessage<T>(message: RuntimeMessage, { signal, timeoutMs }: WaitOptions = {}): Promise<T> {
  const read = READ_TYPES.has(message.type);
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new LinguistyError('CANCELLED')); return; }
    let settled = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(retryTimer);
      signal?.removeEventListener('abort', abort);
      action();
    };
    const abort = () => finish(() => reject(new LinguistyError('CANCELLED')));
    const timer = setTimeout(() => finish(() => reject(new LinguistyError('REQUEST_TIMEOUT', 'Расширение не ответило вовремя. Повторите действие.', true))), messageTimeoutMs(message, timeoutMs));
    signal?.addEventListener('abort', abort, { once: true });

    function transportFailure() {
      if (settled) return;
      // Reads are idempotent. A failed save/start/delete may already have run and must not be repeated.
      if (read && attempts < 2) retryTimer = setTimeout(attempt, STARTUP_RETRY_MS);
      else finish(() => reject(new LinguistyError('INTERNAL_ERROR', 'Не удалось связаться с Linguisty. Повторите загрузку.', true)));
    }
    function attempt() {
      if (settled) return;
      attempts += 1;
      Promise.resolve().then(() => browser.runtime.sendMessage(message)).then((value: unknown) => {
        if (settled) return;
        const response = value as ApiResult<T> | undefined;
        if (!response || typeof response !== 'object' || typeof response.ok !== 'boolean') { transportFailure(); return; }
        if (response.ok) finish(() => resolve(response.data));
        else if (response.error && typeof response.error.code === 'string' && typeof response.error.message === 'string') {
          finish(() => reject(new LinguistyError(response.error.code, response.error.message, response.error.retryable)));
        } else transportFailure();
      }, transportFailure);
    }
    attempt();
  });
}

