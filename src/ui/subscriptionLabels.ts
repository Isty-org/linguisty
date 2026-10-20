/** @spec spec://modules/platform/INFRA-004-codex-connection#settings */
import type { UiLocale } from './locales/meta';

// Kept small so the OAuth return page never loads the full UI dictionaries.
export const SUBSCRIPTION_LABELS: Record<UiLocale, { name: string; returning: string }> = {
  en: { name: 'ChatGPT subscription', returning: 'Returning to Linguisty…' },
  ru: { name: 'Подписка ChatGPT', returning: 'Возвращаемся в Linguisty…' },
  uk: { name: 'Підписка ChatGPT', returning: 'Повертаємося до Linguisty…' },
  de: { name: 'ChatGPT-Abonnement', returning: 'Zurück zu Linguisty…' },
  fr: { name: 'Abonnement ChatGPT', returning: 'Retour à Linguisty…' },
  es: { name: 'Suscripción de ChatGPT', returning: 'Volviendo a Linguisty…' },
  it: { name: 'Abbonamento ChatGPT', returning: 'Ritorno a Linguisty…' },
  pt: { name: 'Assinatura ChatGPT', returning: 'Voltando ao Linguisty…' },
  pl: { name: 'Subskrypcja ChatGPT', returning: 'Powrót do Linguisty…' },
  tr: { name: 'ChatGPT aboneliği', returning: 'Linguisty’ye dönülüyor…' },
  ja: { name: 'ChatGPT サブスクリプション', returning: 'Linguisty に戻っています…' },
  ko: { name: 'ChatGPT 구독', returning: 'Linguisty로 돌아가는 중…' },
  'zh-CN': { name: 'ChatGPT 订阅', returning: '正在返回 Linguisty…' },
  'zh-TW': { name: 'ChatGPT 訂閱', returning: '正在返回 Linguisty…' },
  ar: { name: 'اشتراك ChatGPT', returning: 'جارٍ العودة إلى Linguisty…' },
  hi: { name: 'ChatGPT सदस्यता', returning: 'Linguisty पर वापस जा रहे हैं…' },
};
