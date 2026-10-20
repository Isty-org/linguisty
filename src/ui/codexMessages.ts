/** @spec spec://modules/platform/INFRA-004-codex-connection#settings */
import type { UiLocale } from './locales/meta';
import { SUBSCRIPTION_LABELS } from './subscriptionLabels';
const keys = ['connect', 'title', 'intro', 'step1', 'step2', 'step3', 'step4', 'keepOpen', 'limits',
  'signIn', 'differentAccount', 'cancel', 'disconnect', 'check', 'returnOptions', 'waiting', 'disconnected', 'authorized',
  'checked', 'revoked', 'localOnly', 'modelHelp', 'saved', 'batch', 'CODEX_NOT_CONNECTED', 'CODEX_AUTH_FAILED', 'CODEX_PLAN_REQUIRED'] as const;
export type CodexErrorCode = Extract<typeof keys[number], `CODEX_${string}`>;
export type CodexTexts = Record<typeof keys[number], string> & typeof SUBSCRIPTION_LABELS[UiLocale];
/** @spec spec://modules/interface/FEAT-003-controls#languages */
export function makeCodexText(locale: UiLocale, values: readonly string[]): CodexTexts {
  if (values.length !== keys.length) throw new Error('Incomplete ChatGPT dictionary');
  return { ...SUBSCRIPTION_LABELS[locale], ...Object.fromEntries(keys.map((key, index) => [key, values[index]!])) } as CodexTexts;
}
