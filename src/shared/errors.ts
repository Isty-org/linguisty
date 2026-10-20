/** @spec spec://common/PROP-001-contracts#errors */
import type { ApiDiagnostic, ErrorCode, PublicError } from './contracts';

const messages: Record<ErrorCode, string> = {
  CODEX_NOT_CONNECTED: 'Подключите ChatGPT в настройках и оставьте страницу подключения открытой.',
  CODEX_AUTH_FAILED: 'Не удалось подтвердить вход в ChatGPT. Подключите ChatGPT заново.',
  CODEX_PLAN_REQUIRED: 'ChatGPT не разрешил использовать план для перевода. Проверьте доступ и разрешение Linguisty в аккаунте.',
  CLI_HOST_MISSING: 'Соединитель CLI не найден. Установите соединитель Linguisty и перезапустите браузер.',
  CLI_NOT_FOUND: 'Выбранный CLI не найден. Установите его и повторите установку соединителя.',
  CLI_LOGIN_REQUIRED: 'Войдите в аккаунт выбранного CLI, затем повторите перевод.',
  CLI_EXECUTION_FAILED: 'CLI не завершил перевод. Проверьте его версию, вход в аккаунт и ID модели.',
  INVALID_API_KEY: 'Проверьте API-ключ в настройках.',
  PERMISSION_REQUIRED: 'Разрешите доступ к выбранному сервису в настройках.',
  RATE_LIMIT: 'Сервис ограничил частоту запросов. Повторите позже.',
  PROVIDER_UNAVAILABLE: 'Сервис временно недоступен.',
  MODEL_NOT_FOUND: 'Модель недоступна. Проверьте её ID в настройках.',
  REQUEST_TIMEOUT: 'Сервис не ответил вовремя.',
  INVALID_MODEL_RESPONSE: 'Модель вернула некорректный ответ.',
  NETWORK_ERROR: 'Не удалось связаться с сервисом. Проверьте подключение.',
  CONTEXT_TOO_LARGE: 'Текст превышает допустимый размер запроса.',
  CANCELLED: 'Перевод отменён.',
  INVALID_SETTINGS: 'Проверьте заполнение настроек.',
  RESTRICTED_PAGE: 'Браузер не разрешает перевод этой страницы.',
  INTERNAL_ERROR: 'Не удалось выполнить действие. Попробуйте ещё раз.',
};

export class LinguistyError extends Error {
  /** Sanitized, background-only; deliberately excluded from toPublicError. */
  diagnostic?: ApiDiagnostic;
  readonly code: ErrorCode;
  readonly retryable: boolean;
  constructor(code: ErrorCode, message = messages[code], retryable = false) {
    super(message);
    this.name = 'LinguistyError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(messages, value);
}

export function toPublicError(error: unknown): PublicError {
  if (error instanceof LinguistyError) return { code: error.code, message: error.message, retryable: error.retryable };
  if (error instanceof DOMException && error.name === 'AbortError') return { code: 'CANCELLED', message: messages.CANCELLED, retryable: false };
  return { code: 'INTERNAL_ERROR', message: messages.INTERNAL_ERROR, retryable: false };
}

