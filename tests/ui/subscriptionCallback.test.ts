/** @spec spec://modules/interface/FEAT-003-controls#languages */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UI_LOCALES } from '../../src/shared/languages';
import { localizeSubscriptionCallback } from '../../src/ui/subscriptionCallback';
import { SUBSCRIPTION_LABELS } from '../../src/ui/subscriptionLabels';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('browser', { i18n: { getUILanguage: () => 'en-US' } });
  document.body.innerHTML = '<h1 data-subscription-name></h1><p id="status"></p><a data-subscription-name></a>';
});
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

it.each(UI_LOCALES)('uses the selected %s language on the OAuth return page', locale => {
  localStorage.setItem('linguisty.uiLanguage', locale);
  localizeSubscriptionCallback();
  expect(document.documentElement.lang).toBe(locale);
  expect(document.documentElement.dir).toBe(locale === 'ar' ? 'rtl' : 'ltr');
  expect(document.title).toBe(`${SUBSCRIPTION_LABELS[locale].name} — Linguisty`);
  expect(document.getElementById('status')?.textContent).toBe(SUBSCRIPTION_LABELS[locale].returning);
  expect(document.querySelector('a')?.textContent).toContain(SUBSCRIPTION_LABELS[locale].name);
});

it('uses browser language if the non-secret language hint is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
  vi.stubGlobal('browser', { i18n: { getUILanguage: () => 'zh-Hant-HK' } });
  localizeSubscriptionCallback();
  expect(document.documentElement.lang).toBe('zh-TW');
  expect(document.getElementById('status')?.textContent).toBe('正在返回 Linguisty…');
});
