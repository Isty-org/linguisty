/** @spec spec://modules/interface/FEAT-003-controls#languages */
import { en, type Dictionary, type MessageKey } from './en';
import { ru } from './ru';
import { cli as enCli, codex as enCodex } from './extra/en';
import { cli as ruCli, codex as ruCodex } from './extra/ru';
import { makeCliText, type CliTexts } from '../cliMessages';
import { makeCodexText, type CodexTexts } from '../codexMessages';
import type { UiLocale } from './meta';

export { UI_LOCALES, type UiLocale } from './meta';
export type { MessageKey, Dictionary } from './en';

export type LocaleBundle = Readonly<{ dictionary: Dictionary; cli: CliTexts; codex: CodexTexts }>;
type Extra = Readonly<{ cli: readonly string[]; codex: readonly string[] }>;

function bundle(locale: UiLocale, dictionary: Dictionary, extra: Extra): LocaleBundle {
  return { dictionary, cli: makeCliText(extra.cli), codex: makeCodexText(locale, extra.codex) };
}

const english = bundle('en', en, { cli: enCli, codex: enCodex });
const russian = bundle('ru', ru, { cli: ruCli, codex: ruCodex });
const loaded = new Map<UiLocale, LocaleBundle>([['en', english], ['ru', russian]]);
const pending = new Map<UiLocale, Promise<LocaleBundle>>();
const listeners = new Set<() => void>();

// Literal imports let Vite emit one local pack per language. English is the
// safe fallback; Russian consists of source keys, so both stay synchronous.
const lazy: Partial<Record<UiLocale, () => Promise<LocaleBundle>>> = {
  uk: () => Promise.all([import('./uk'), import('./extra/uk')]).then(([core, extra]) => bundle('uk', core.uk, extra)),
  de: () => Promise.all([import('./de'), import('./extra/de')]).then(([core, extra]) => bundle('de', core.de, extra)),
  fr: () => Promise.all([import('./fr'), import('./extra/fr')]).then(([core, extra]) => bundle('fr', core.fr, extra)),
  es: () => Promise.all([import('./es'), import('./extra/es')]).then(([core, extra]) => bundle('es', core.es, extra)),
  it: () => Promise.all([import('./it'), import('./extra/it')]).then(([core, extra]) => bundle('it', core.it, extra)),
  pt: () => Promise.all([import('./pt'), import('./extra/pt')]).then(([core, extra]) => bundle('pt', core.pt, extra)),
  pl: () => Promise.all([import('./pl'), import('./extra/pl')]).then(([core, extra]) => bundle('pl', core.pl, extra)),
  tr: () => Promise.all([import('./tr'), import('./extra/tr')]).then(([core, extra]) => bundle('tr', core.tr, extra)),
  ja: () => Promise.all([import('./ja'), import('./extra/ja')]).then(([core, extra]) => bundle('ja', core.ja, extra)),
  ko: () => Promise.all([import('./ko'), import('./extra/ko')]).then(([core, extra]) => bundle('ko', core.ko, extra)),
  'zh-CN': () => Promise.all([import('./zh-CN'), import('./extra/zh-CN')]).then(([core, extra]) => bundle('zh-CN', core.zhCN, extra)),
  'zh-TW': () => Promise.all([import('./zh-TW'), import('./extra/zh-TW')]).then(([core, extra]) => bundle('zh-TW', core.zhTW, extra)),
  ar: () => Promise.all([import('./ar'), import('./extra/ar')]).then(([core, extra]) => bundle('ar', core.ar, extra)),
  hi: () => Promise.all([import('./hi'), import('./extra/hi')]).then(([core, extra]) => bundle('hi', core.hi, extra)),
};

/** Loaded and in-flight maps have at most the 16 advertised locale keys. */
export function loadUiLocale(locale: UiLocale): Promise<LocaleBundle> {
  const ready = loaded.get(locale);
  if (ready) return Promise.resolve(ready);
  const inFlight = pending.get(locale);
  if (inFlight) return inFlight;
  const loader = lazy[locale];
  if (!loader) return Promise.resolve(english);
  const task = loader().then(value => {
    loaded.set(locale, value);
    for (const listener of listeners) listener();
    return value;
  }).catch(() => english).finally(() => { pending.delete(locale); });
  pending.set(locale, task);
  return task;
}

export function hasUiLocale(locale: UiLocale): boolean { return loaded.has(locale); }
export function getUiLocaleBundle(locale: UiLocale): LocaleBundle { return loaded.get(locale) ?? english; }
export function isMessageKey(key: string): key is MessageKey { return Object.hasOwn(en, key); }
export function subscribeUiLocales(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
