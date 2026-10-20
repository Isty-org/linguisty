import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { PublicError } from '../../src/shared/contracts';
import { UI_LOCALES } from '../../src/shared/languages';
import { I18nProvider, UI_LANGUAGE_HINT_KEY, setI18nPreference, translate, translateError, useI18n } from '../../src/ui/i18n';
import { getUiLocaleBundle, loadUiLocale } from '../../src/ui/locales';

function Probe({ preference, id = 'locale' }: { preference?: string; id?: string }) {
  const { locale, t } = useI18n(preference);
  return <div><output data-testid={id}>{locale}</output><span>{t('Сохранить настройки')}</span></div>;
}

beforeEach(() => {
  localStorage.clear();
  setI18nPreference('auto');
  vi.stubGlobal('browser', { i18n: { getUILanguage: () => 'en-US' } });
  vi.stubGlobal('navigator', { languages: ['ru-RU'], language: 'ru-RU' });
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/** @spec spec://modules/interface/FEAT-003-controls#languages */
describe('UI localization', () => {
  it('resolves browser UI before preferred translation language and sets document attributes', async () => {
    vi.stubGlobal('browser', { i18n: { getUILanguage: () => 'de-DE' } });
    await loadUiLocale('de');
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('de');
    expect(document.documentElement.lang).toBe('de');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('updates automatic UI on languagechange and leaves a manual preference intact', async () => {
    await loadUiLocale('ar');
    let browserLanguage = 'en-US';
    vi.stubGlobal('browser', { i18n: { getUILanguage: () => browserLanguage } });
    render(<I18nProvider><Probe /></I18nProvider>);
    browserLanguage = 'ar-EG';
    act(() => window.dispatchEvent(new Event('languagechange')));
    expect(screen.getByTestId('locale').textContent).toBe('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    act(() => setI18nPreference('ru'));
    expect(screen.getByTestId('locale').textContent).toBe('ru');
    expect(screen.getByText('Сохранить настройки')).toBeTruthy();
    browserLanguage = 'ja-JP';
    act(() => window.dispatchEvent(new Event('languagechange')));
    expect(screen.getByTestId('locale').textContent).toBe('ru');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('keeps preview and a saved manual language on later renders and new mounts', async () => {
    await loadUiLocale('fr');
    const view = render(<I18nProvider><Probe /></I18nProvider>);
    act(() => setI18nPreference('fr'));
    expect(screen.getByTestId('locale').textContent).toBe('fr');
    expect(localStorage.getItem(UI_LANGUAGE_HINT_KEY)).toBe('fr');
    view.rerender(<I18nProvider><Probe /><Probe id="child" /></I18nProvider>);
    expect(screen.getByTestId('child').textContent).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    view.unmount();
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('fr');
  });

  it('keeps preview across consumers if writing a non-secret local hint fails', async () => {
    await loadUiLocale('ar');
    render(<I18nProvider><Probe /></I18nProvider>);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota reached', 'QuotaExceededError'); });
    act(() => setI18nPreference('ar'));
    expect(localStorage.getItem(UI_LANGUAGE_HINT_KEY)).toBe('auto');
    expect(screen.getByTestId('locale').textContent).toBe('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('makes the provider the only document owner and prevents passive standalone children from overriding a parent', async () => {
    await loadUiLocale('ar');
    const view = render(<I18nProvider preference="ru"><Probe preference="ar" /></I18nProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('ar');
    expect(document.documentElement.lang).toBe('ru');
    expect(document.documentElement.dir).toBe('ltr');
    view.unmount();
    render(<><Probe preference="ar" /><Probe id="passive" /></>);
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByTestId('passive').textContent).toBe('en');
  });

  it('uses English for an unsupported manual choice and ignores invalid persisted hints', () => {
    localStorage.setItem(UI_LANGUAGE_HINT_KEY, 'invalid_secret_like_value');
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(translate('Сохранить настройки', 'tlh')).toBe('Save settings');
    act(() => setI18nPreference('invalid_secret_like_value'));
    expect(localStorage.getItem(UI_LANGUAGE_HINT_KEY)).toBe('auto');
  });

  it('handles Chinese script and region when bootstrapping the document', async () => {
    await loadUiLocale('zh-TW');
    vi.stubGlobal('browser', { i18n: { getUILanguage: () => 'zh-Hant-HK' } });
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('zh-TW');
    expect(document.documentElement.lang).toBe('zh-TW');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('substitutes templates literally and keeps missing placeholders visible', () => {
    expect(translate('В работе: {inFlight} · из кэша: {fromCache}', 'en', { inFlight: 2, fromCache: 10 })).toBe('In progress: 2 · from cache: 10');
    expect(translate('Показано 40 из {count}. Уточните поиск.', 'en')).toContain('{count}');
    expect(translate('{count} / 4 000 символов.', 'en', { count: '$& <img src=x onerror=unsafe()>' })).toBe('$& <img src=x onerror=unsafe()> / 4,000 characters.');
  });

  it('uses one shared event subscription across all mounted consumers and releases it every time', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    for (let index = 0; index < 12; index++) {
      const view = render(<I18nProvider><Probe /><Probe id="second" /><Probe id="third" /></I18nProvider>);
      expect(add.mock.calls.filter(([event]) => event === 'languagechange')).toHaveLength(index + 1);
      expect(add.mock.calls.filter(([event]) => event === 'storage')).toHaveLength(index + 1);
      view.unmount();
      expect(remove.mock.calls.filter(([event]) => event === 'languagechange')).toHaveLength(index + 1);
      expect(remove.mock.calls.filter(([event]) => event === 'storage')).toHaveLength(index + 1);
    }
    const languageAdds = add.mock.calls.filter(([event]) => event === 'languagechange');
    const languageRemoves = remove.mock.calls.filter(([event]) => event === 'languagechange');
    expect(languageAdds.map(([, callback]) => callback)).toEqual(languageRemoves.map(([, callback]) => callback));
  });

  it('reacts to a validated hint from another UI page and falls back if it is cleared', async () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    localStorage.setItem(UI_LANGUAGE_HINT_KEY, 'uk');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: UI_LANGUAGE_HINT_KEY, newValue: 'uk' })));
    await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('uk'));
    localStorage.clear();
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('has full local dictionaries with the same template variables for every advertised locale', async () => {
    const english = getUiLocaleBundle('en').dictionary;
    const englishKeys = Object.keys(english).sort();
    for (const [locale] of UI_LOCALES) {
      const dictionary = (await loadUiLocale(locale)).dictionary;
      expect(dictionary, locale).toBeDefined();
      expect(Object.keys(dictionary ?? {}).sort(), locale).toEqual(englishKeys);
      for (const key of englishKeys) {
        const template = english[key as keyof typeof english];
        const translated = dictionary?.[key as keyof typeof english];
        expect(typeof translated, `${locale}: ${key}`).toBe('string');
        expect(translated?.trim().length, `${locale}: ${key}`).toBeGreaterThan(0);
        expect(translated?.match(/\{[A-Za-z][A-Za-z0-9_]*\}/g)?.sort() ?? [], `${locale}: ${key}`)
          .toEqual(template.match(/\{[A-Za-z][A-Za-z0-9_]*\}/g)?.sort() ?? []);
      }
    }
  });
});

/** @spec spec://modules/interface/FEAT-003-controls#errors */
describe('localized public errors', () => {
  /** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
  it('keeps fixed subscription translation references in every language without displaying surrounding provider text', async () => {
    for (const [locale] of UI_LOCALES) {
      await loadUiLocale(locale);
      for (const reference of ['LGT-response-completion', 'LGT-response-empty', 'LGT-response-phase', 'LGT-response-conflict']) {
        const error: PublicError = { code: 'INVALID_MODEL_RESPONSE', message: `private-source [${reference}]`, retryable: false };
        expect(translateError(error, locale)).toBe(translate('Модель вернула некорректный ответ.', locale) + ` [${reference}]`);
        expect(translateError({ ...error, message: 'private-source [LGT-private-token]' }, locale === 'ru' ? 'en' : locale)).not.toContain('private');
      }
    }
  });
  /** @spec spec://modules/platform/INFRA-004-codex-connection#settings */
  it('provides subscription labels, every connection step and safe errors in all advertised languages', async () => {
    const english = getUiLocaleBundle('en').codex;
    for (const [locale] of UI_LOCALES) {
      const dictionary = (await loadUiLocale(locale)).codex;
      expect(Object.keys(dictionary).sort(), locale).toEqual(Object.keys(english).sort());
      for (const [key, value] of Object.entries(dictionary)) {
        expect(typeof value, `${locale}: ${key}`).toBe('string');
        expect(value?.trim().length, `${locale}: ${key}`).toBeGreaterThan(0);
        expect(value, `${locale}: ${key}`).not.toMatch(/Codex|\bCLI\b/);
      }
      expect(translateError({ code: 'CODEX_NOT_CONNECTED', message: 'untrusted remote detail', retryable: false }, locale))
        .toBe(dictionary.CODEX_NOT_CONNECTED);
      expect(dictionary.name, locale).toContain('ChatGPT');
      if (locale !== 'en') expect(dictionary.returning, locale).not.toBe(english.returning);
    }
  });
  it('keeps detailed Russian errors, translates known details, and uses a safe error code for unknown foreign messages', () => {
    const error: PublicError = { code: 'NETWORK_ERROR', message: 'Специальная подробность безопасной ошибки.', retryable: true };
    expect(translateError(error, 'ru')).toBe(error.message);
    expect(translateError(error, 'en')).toBe('Unable to reach the service. Check your connection.');
    expect(translateError({ code: 'PERMISSION_REQUIRED', message: 'Доступ к сервису не разрешён. Настройки сервиса не сохранены.', retryable: false }, 'en'))
      .toBe('Access to the service was not allowed. Service settings were not saved.');
    expect(translateError({ ...error, code: 'not-a-code' as PublicError['code'] }, 'en'))
      .toBe(getUiLocaleBundle('en').dictionary['Не удалось выполнить действие. Попробуйте ещё раз.']);
  });
});
