/** @spec spec://modules/interface/FEAT-003-controls#options */
import { browser } from 'wxt/browser';
import { OPENROUTER_BASE_URL } from '../shared/constants';
import type { Settings } from '../shared/contracts';
import { LinguistyError } from '../shared/errors';
import { containsControls, normalizeBaseUrl } from '../storage/normalization';
import { normalizeLanguageTag, resolveBrowserTargetLanguage } from '../shared/languages';
import { translate, translateError } from './i18n';
import { CLI_BASE_URL, CODEX_BASE_URL, isCliProvider, isKeylessProvider } from '../shared/providers';

export const API_KEY_INPUT_MAX_LENGTH = 4_096;

export type FormErrors = Partial<Record<'baseUrl' | 'model' | 'sourceLanguage' | 'targetLanguage' | 'customInstructions' | 'apiKey', string>>;

export function providerUrl(settings: Settings): URL {
  const endpoint = settings.providerId === 'codex' ? CODEX_BASE_URL : settings.providerId === 'openrouter' ? OPENROUTER_BASE_URL : settings.baseUrl.trim();
  return new URL(normalizeBaseUrl(endpoint));
}

export function normalizedForm(settings: Settings): Settings {
  return {
    ...settings,
    baseUrl: isCliProvider(settings.providerId) ? CLI_BASE_URL : providerUrl(settings).href.replace(/\/+$/, ''),
    model: settings.model.trim() || (isKeylessProvider(settings.providerId) ? 'default' : ''),
    ...(isKeylessProvider(settings.providerId) ? { streaming: false, concurrency: 1 } : {}),
    sourceLanguage: settings.sourceLanguage.trim(),
    targetLanguage: settings.targetLanguageMode === 'browser' ? resolveBrowserTargetLanguage() : settings.targetLanguage.trim(),
  };
}

export function validateForm(settings: Settings, apiKey: string, needsModel = true, needsKey = false, locale?: string): FormErrors {
  const errors: FormErrors = {};
  try { if (!isCliProvider(settings.providerId)) providerUrl(settings); } catch (error) { errors.baseUrl = error instanceof LinguistyError
    ? translateError({ code: error.code, message: error.message, retryable: error.retryable }, locale) : translate('Проверьте адрес API.', locale); }
  if (needsModel && !isKeylessProvider(settings.providerId) && !settings.model.trim()) errors.model = translate('Укажите ID модели вручную или выберите её из списка.', locale);
  if (settings.model.length > 200) errors.model = translate('ID модели слишком длинный (максимум 200 символов).', locale);
  function language(value: string, source = false): boolean {
    const tag = value.trim();
    if (tag === 'auto') return source;
    return !!normalizeLanguageTag(tag);
  }
  if (!language(settings.sourceLanguage, true)) errors.sourceLanguage = translate('Укажите код языка или auto.', locale);
  if (!language(settings.targetLanguage)) errors.targetLanguage = translate('Укажите код языка, например ru или en.', locale);
  if (settings.customInstructions.length > 4_000) errors.customInstructions = translate('Инструкции не должны превышать 4 000 символов.', locale);
  if (needsKey && !isKeylessProvider(settings.providerId) && !apiKey.trim()) errors.apiKey = translate('Введите свой API-ключ.', locale);
  if (apiKey.length > API_KEY_INPUT_MAX_LENGTH || containsControls(apiKey)) errors.apiKey = translate('Проверьте API-ключ: он должен быть одной строкой до 4 096 символов.', locale);
  return errors;
}

/** Call directly from a click/submit handler, before awaiting anything. */
export function requestProviderPermission(settings: Settings): Promise<void> {
  if (isCliProvider(settings.providerId)) {
    return browser.permissions.request({ permissions: ['nativeMessaging'] }).then(granted => {
      if (!granted) throw new LinguistyError('PERMISSION_REQUIRED');
    });
  }
  const url = providerUrl(settings);
  // Match patterns use the host without a port; browsers grant origin access for all its ports.
  const requesting = browser.permissions.request({ origins: [`${url.protocol}//${url.hostname}/*`] });
  return requesting.then((granted) => {
    if (!granted) throw new LinguistyError('PERMISSION_REQUIRED', 'Доступ к сервису не разрешён. Настройки сервиса не сохранены.');
  });
}
