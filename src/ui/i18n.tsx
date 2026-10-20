import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { ErrorCode, PublicError } from '../shared/contracts';
import { isErrorCode } from '../shared/errors';
import { UI_LOCALES, normalizeUiLanguage, resolveUiLocale, type UiLocale } from '../shared/languages';
import { getUiLocaleBundle, hasUiLocale, isMessageKey, loadUiLocale, subscribeUiLocales, type MessageKey } from './locales';
import type { CliErrorCode } from './cliMessages';
import type { CodexErrorCode } from './codexMessages';
import { translationErrorMessageReference } from '../codex/translationError';

export type { MessageKey, UiLocale } from './locales';

export const UI_LANGUAGE_HINT_KEY = 'linguisty.uiLanguage';
type Variables = Record<string, string | number>;
const LocaleContext = createContext<UiLocale | undefined>(undefined);
const knownLocales = new Set<string>(UI_LOCALES.map(([code]) => code));
const subscribers = new Set<() => void>();
let stopLocaleSubscription: (() => void) | undefined;
let revision = 0;
let fallbackPreference: string = 'auto';
let volatilePreference: string | undefined;

function readPreference(): string {
  if (volatilePreference !== undefined) return volatilePreference;
  try {
    return normalizeUiLanguage(localStorage.getItem(UI_LANGUAGE_HINT_KEY)) ?? 'auto';
  } catch {
    return fallbackPreference;
  }
}

function changed(): void {
  revision += 1;
  for (const callback of subscribers) callback();
}

function languageHintChanged(event: StorageEvent): void {
  if (event.key === UI_LANGUAGE_HINT_KEY || event.key === null) {
    volatilePreference = undefined;
    changed();
  }
}

function subscribe(callback: () => void): () => void {
  if (subscribers.size === 0) {
    stopLocaleSubscription = subscribeUiLocales(changed);
    if (typeof window !== 'undefined') {
      window.addEventListener('languagechange', changed);
      window.addEventListener('storage', languageHintChanged);
    }
  }
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0) {
      stopLocaleSubscription?.();
      stopLocaleSubscription = undefined;
      if (typeof window !== 'undefined') {
        window.removeEventListener('languagechange', changed);
        window.removeEventListener('storage', languageHintChanged);
      }
    }
  };
}

function snapshot(): number { return revision; }

/**
 * A validated, non-secret hint supports immediate preview and the next UI paint.
 * Canonical preferences remain in extension settings, loaded by Options/Popup.
 * @spec spec://modules/interface/FEAT-003-controls#languages
 */
export function setI18nPreference(preference: string): void {
  const normalized = normalizeUiLanguage(preference) ?? 'auto';
  const previous = readPreference();
  fallbackPreference = normalized;
  try {
    localStorage.setItem(UI_LANGUAGE_HINT_KEY, normalized);
    volatilePreference = undefined;
  } catch {
    // A readable but full/restricted storage area may retain an obsolete hint.
    volatilePreference = normalized;
  }
  if (previous !== normalized) changed();
}

/** @spec spec://modules/interface/FEAT-003-controls#languages */
export function translate(key: MessageKey, locale?: string, vars?: Variables): string {
  const resolved = locale && knownLocales.has(locale) ? locale as UiLocale : resolveUiLocale(locale ?? readPreference());
  const template = getUiLocaleBundle(resolved).dictionary[key];
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (placeholder, name: string) => {
    return vars && Object.hasOwn(vars, name) ? String(vars[name]) : placeholder;
  });
}

const ERROR_MESSAGES: Record<Exclude<ErrorCode, CliErrorCode | CodexErrorCode>, MessageKey> = {
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

/** @spec spec://modules/interface/FEAT-003-controls#errors */
export function translateError(error: PublicError, locale?: string): string {
  const resolved = locale && knownLocales.has(locale) ? locale as UiLocale : resolveUiLocale(locale ?? readPreference());
  const bundle = getUiLocaleBundle(resolved);
  if (Object.hasOwn(bundle.cli, error.code)) return bundle.cli[error.code as CliErrorCode];
  if (Object.hasOwn(bundle.codex, error.code)) return bundle.codex[error.code as CodexErrorCode];
  const reference = error.code === 'INVALID_MODEL_RESPONSE' ? translationErrorMessageReference(error.message) : undefined;
  if (reference) return `${translate(ERROR_MESSAGES.INVALID_MODEL_RESPONSE, resolved)} [${reference}]`;
  if (resolved === 'ru') return error.message;
  // Translate known detailed errors; unknown messages use only the safe code.
  if (isMessageKey(error.message)) return translate(error.message, resolved);
  return translate(ERROR_MESSAGES[(isErrorCode(error.code) ? error.code : 'INTERNAL_ERROR') as Exclude<ErrorCode, CliErrorCode | CodexErrorCode>], resolved);
}

function useDocumentLanguage(locale: UiLocale, enabled: boolean): void {
  useLayoutEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale, enabled]);
}

/** @spec spec://modules/interface/FEAT-003-controls#languages */
export function I18nProvider({ children, preference }: { children: ReactNode; preference?: string }) {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const requested = resolveUiLocale(preference ?? readPreference());
  useEffect(() => { void loadUiLocale(requested); }, [requested]);
  const locale = hasUiLocale(requested) ? requested : 'en';
  useDocumentLanguage(locale, true);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Standalone renders also subscribe and clean up without a bootstrap provider.
 * @spec spec://modules/interface/FEAT-003-controls#languages
 */
export function useI18n(preference?: string) {
  const providedLocale = useContext(LocaleContext);
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const requested = resolveUiLocale(preference ?? readPreference());
  useEffect(() => { void loadUiLocale(requested); }, [requested]);
  const locale = preference === undefined && providedLocale
    ? providedLocale : hasUiLocale(requested) ? requested : 'en';
  useDocumentLanguage(locale, providedLocale === undefined && preference !== undefined);
  const t = useCallback((key: MessageKey, vars?: Variables) => translate(key, locale, vars), [locale]);
  const localizeError = useCallback((error: PublicError) => translateError(error, locale), [locale]);
  return { locale, t, localizeError };
}
