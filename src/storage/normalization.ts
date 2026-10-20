import type { Settings } from '../shared/contracts';
import { DEFAULT_SETTINGS } from '../shared/constants';
import { LinguistyError } from '../shared/errors';
import { normalizeLanguageTag, normalizeUiLanguage } from '../shared/languages';
import { CLI_BASE_URL, CODEX_BASE_URL, isCliProvider, isKeylessProvider, PROVIDER_IDS } from '../shared/providers';

export function containsControls(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function invalid(message: string): never {
  throw new LinguistyError('INVALID_SETTINGS', message);
}

function record(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) return invalid('Настройки должны быть объектом.');
  return value as Record<string, unknown>;
}

function field(data: Record<string, unknown>, key: keyof Settings): unknown {
  return Object.hasOwn(data, key) && data[key] !== undefined ? data[key] : DEFAULT_SETTINGS[key];
}

function text(value: unknown, label: string, maxLength: number, emptyAllowed = false): string {
  if (typeof value !== 'string') return invalid(`${label}: требуется текст.`);
  const normalized = value.trim();
  if ((!emptyAllowed && !normalized) || normalized.length > maxLength || containsControls(normalized)) {
    return invalid(`${label}: проверьте значение и длину (до ${maxLength} символов).`);
  }
  return normalized;
}

function choice<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) return invalid(`${label}: недопустимое значение.`);
  return value as T;
}

function integer(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return invalid(`${label}: требуется целое число от ${min} до ${max}.`);
  }
  return value;
}

function language(value: unknown, source = false): string {
  const tag = text(value, source ? 'Исходный язык' : 'Язык перевода', 64);
  if (tag.toLowerCase() === 'auto') {
    if (source) return 'auto';
    return invalid('Выберите язык перевода вместо автоматического определения.');
  }
  const canonical = normalizeLanguageTag(tag);
  if (canonical) return canonical;
  return invalid('Язык должен быть корректным BCP 47 кодом, например ru или zh-CN.');
}

/** @spec spec://modules/storage/INFRA-002-local-data#settings */
export function normalizeBaseUrl(value: unknown): string {
  const endpoint = text(value, 'Адрес сервиса', 2_048);
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return invalid('Адрес сервиса должен быть корректным HTTP(S) URL.');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const authority = /^https?:\/\/([^/?#\\]*)/i.exec(endpoint)?.[1];
  if (!['http:', 'https:'].includes(url.protocol) || (url.protocol === 'http:' && !loopback)
    || !authority || authority.includes('@') || !url.hostname || url.username || url.password
    || endpoint.includes('?') || endpoint.includes('#')) {
    return invalid('Адрес сервиса должен использовать HTTPS без логина, пароля, query и fragment. HTTP разрешён только для localhost, 127.0.0.1 и [::1].');
  }
  return url.href.replace(/\/+$/, '');
}

/** @spec spec://modules/storage/INFRA-002-local-data#settings */
export function normalizeSettings(value: unknown): Settings {
  const data = record(value);
  if (field(data, 'schemaVersion') !== 1) return invalid('Версия настроек не поддерживается.');
  const instructions = field(data, 'customInstructions');
  if (typeof instructions !== 'string' || instructions.length > 4_000 || instructions.includes('\0')) {
    return invalid('Дополнительные инструкции должны содержать не более 4 000 символов.');
  }
  const streaming = field(data, 'streaming');
  if (typeof streaming !== 'boolean') return invalid('Постепенный перевод: требуется логическое значение.');
  const targetLanguage = language(field(data, 'targetLanguage'));
  const legacyTarget = Object.hasOwn(data, 'targetLanguage') && data.targetLanguage !== undefined;
  const targetLanguageMode = choice(
    Object.hasOwn(data, 'targetLanguageMode') && data.targetLanguageMode !== undefined
      ? data.targetLanguageMode : legacyTarget ? 'manual' : DEFAULT_SETTINGS.targetLanguageMode,
    ['browser', 'manual'], 'Выбор языка перевода',
  );
  const uiLanguage = normalizeUiLanguage(field(data, 'uiLanguage'));
  if (!uiLanguage) return invalid('Язык интерфейса: выберите доступный язык или auto.');
  const providerId = choice(field(data, 'providerId'), PROVIDER_IDS, 'Сервис');
  const cli = isCliProvider(providerId);
  const keyless = isKeylessProvider(providerId);
  const model = text(field(data, 'model'), 'ID модели', 200, true);
  const concurrency = integer(field(data, 'concurrency'), 1, 4, 'Параллельные запросы');
  return {
    schemaVersion: 1,
    providerId,
    baseUrl: providerId === 'codex' ? CODEX_BASE_URL : cli ? CLI_BASE_URL : normalizeBaseUrl(field(data, 'baseUrl')),
    model: model || (keyless ? 'default' : ''),
    sourceLanguage: language(field(data, 'sourceLanguage'), true),
    targetLanguage,
    targetLanguageMode,
    uiLanguage,
    style: choice(field(data, 'style'), ['natural', 'accurate', 'literal'], 'Стиль'),
    customInstructions: instructions,
    theme: choice(field(data, 'theme'), ['system', 'light', 'dark'], 'Тема'),
    keyMode: choice(field(data, 'keyMode'), ['session', 'persistent'], 'Хранение ключа'),
    concurrency: keyless ? 1 : concurrency,
    maxNodesPerBatch: integer(field(data, 'maxNodesPerBatch'), 1, 40, 'Узлы в пакете'),
    maxCharsPerBatch: integer(field(data, 'maxCharsPerBatch'), 1, 10_000, 'Символы в пакете'),
    requestTimeoutMs: integer(field(data, 'requestTimeoutMs'), 1_000, 120_000, 'Таймаут запроса'),
    streaming: keyless ? false : streaming,
  };
}
