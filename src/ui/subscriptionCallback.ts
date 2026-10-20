/** @spec spec://modules/interface/FEAT-003-controls#languages */
import { normalizeUiLanguage, resolveUiLocale } from '../shared/languages';
import { SUBSCRIPTION_LABELS } from './subscriptionLabels';

export function localizeSubscriptionCallback() {
  let preference = 'auto';
  try { preference = normalizeUiLanguage(localStorage.getItem('linguisty.uiLanguage')) ?? 'auto'; }
  catch { /* Browser-language fallback also works if the non-secret UI hint is unavailable. */ }
  const locale = resolveUiLocale(preference);
  const text = SUBSCRIPTION_LABELS[locale];
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  document.title = `${text.name} — Linguisty`;
  for (const element of document.querySelectorAll('[data-subscription-name]')) element.textContent = `Linguisty · ${text.name}`;
  const status = document.getElementById('status');
  if (status) status.textContent = text.returning;
}
