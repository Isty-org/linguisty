import { UI_LOCALES, type UiLocale } from '../ui/locales/meta';

export { UI_LOCALES, type UiLocale } from '../ui/locales/meta';

/**
 * ISO 639-1 identifiers plus commonly requested region/script variants. Names are
 * local data; no network request or model capability is implied by this catalogue.
 * @spec spec://modules/interface/FEAT-003-controls#languages
 */
export const LANGUAGES = [
  ['aa', 'Afaraf'], ['ab', 'Аҧсуа'], ['ae', 'Avesta'], ['af', 'Afrikaans'],
  ['ak', 'Akan'], ['am', 'አማርኛ'], ['an', 'Aragonés'], ['ar', 'العربية'],
  ['as', 'অসমীয়া'], ['av', 'Авар мацӀ'], ['ay', 'Aymar aru'], ['az', 'Azərbaycan dili'],
  ['ba', 'Башҡорт теле'], ['be', 'Беларуская'], ['bg', 'Български'], ['bh', 'बिहारी'],
  ['bi', 'Bislama'], ['bm', 'Bamanankan'], ['bn', 'বাংলা'], ['bo', 'བོད་ཡིག'],
  ['br', 'Brezhoneg'], ['bs', 'Bosanski'], ['ca', 'Català'], ['ce', 'Нохчийн мотт'],
  ['ch', 'Chamoru'], ['co', 'Corsu'], ['cr', 'ᓀᐦᐃᔭᐍᐏᐣ'], ['cs', 'Čeština'],
  ['cu', 'Словѣньскъ'], ['cv', 'Чӑваш чӗлхи'], ['cy', 'Cymraeg'], ['da', 'Dansk'],
  ['de', 'Deutsch'], ['dv', 'ދިވެހި'], ['dz', 'རྫོང་ཁ'], ['ee', 'Eʋegbe'],
  ['el', 'Ελληνικά'], ['en', 'English'], ['eo', 'Esperanto'], ['es', 'Español'],
  ['et', 'Eesti'], ['eu', 'Euskara'], ['fa', 'فارسی'], ['ff', 'Fulfulde'],
  ['fi', 'Suomi'], ['fj', 'Vosa Vakaviti'], ['fo', 'Føroyskt'], ['fr', 'Français'],
  ['fy', 'Frysk'], ['ga', 'Gaeilge'], ['gd', 'Gàidhlig'], ['gl', 'Galego'],
  ['gn', "Avañe'ẽ"], ['gu', 'ગુજરાતી'], ['gv', 'Gaelg'], ['ha', 'Hausa'],
  ['he', 'עברית'], ['hi', 'हिन्दी'], ['ho', 'Hiri Motu'], ['hr', 'Hrvatski'],
  ['ht', 'Kreyòl ayisyen'], ['hu', 'Magyar'], ['hy', 'Հայերեն'], ['hz', 'Otjiherero'],
  ['ia', 'Interlingua'], ['id', 'Bahasa Indonesia'], ['ie', 'Interlingue'], ['ig', 'Igbo'],
  ['ii', 'ꆈꌠ꒿'], ['ik', 'Iñupiaq'], ['io', 'Ido'], ['is', 'Íslenska'],
  ['it', 'Italiano'], ['iu', 'ᐃᓄᒃᑎᑐᑦ'], ['ja', '日本語'], ['jv', 'Basa Jawa'],
  ['ka', 'ქართული'], ['kg', 'Kikongo'], ['ki', 'Gĩkũyũ'], ['kj', 'Kuanyama'],
  ['kk', 'Қазақ тілі'], ['kl', 'Kalaallisut'], ['km', 'ខ្មែរ'], ['kn', 'ಕನ್ನಡ'],
  ['ko', '한국어'], ['kr', 'Kanuri'], ['ks', 'कॉशुर / کٲشُر'], ['ku', 'Kurdî'],
  ['kv', 'Коми кыв'], ['kw', 'Kernewek'], ['ky', 'Кыргызча'], ['la', 'Latina'],
  ['lb', 'Lëtzebuergesch'], ['lg', 'Luganda'], ['li', 'Limburgs'], ['ln', 'Lingála'],
  ['lo', 'ລາວ'], ['lt', 'Lietuvių'], ['lu', 'Tshiluba'], ['lv', 'Latviešu'],
  ['mg', 'Malagasy'], ['mh', 'Kajin M̧ajeļ'], ['mi', 'Te reo Māori'], ['mk', 'Македонски'],
  ['ml', 'മലയാളം'], ['mn', 'Монгол'], ['mr', 'मराठी'], ['ms', 'Bahasa Melayu'],
  ['mt', 'Malti'], ['my', 'မြန်မာဘာသာ'], ['na', 'Dorerin Naoero'], ['nb', 'Norsk bokmål'],
  ['nd', 'IsiNdebele'], ['ne', 'नेपाली'], ['ng', 'Oshiwambo'], ['nl', 'Nederlands'],
  ['nn', 'Norsk nynorsk'], ['no', 'Norsk'], ['nr', 'IsiNdebele'], ['nv', 'Diné bizaad'],
  ['ny', 'Chichewa'], ['oc', 'Occitan'], ['oj', 'ᐊᓂᔑᓈᐯᒧᐎᓐ'], ['om', 'Afaan Oromoo'],
  ['or', 'ଓଡ଼ିଆ'], ['os', 'Ирон æвзаг'], ['pa', 'ਪੰਜਾਬੀ'], ['pi', 'पालि'],
  ['pl', 'Polski'], ['ps', 'پښتو'], ['pt', 'Português'], ['qu', 'Runa simi'],
  ['rm', 'Rumantsch'], ['rn', 'Ikirundi'], ['ro', 'Română'], ['ru', 'Русский'],
  ['rw', 'Ikinyarwanda'], ['sa', 'संस्कृतम्'], ['sc', 'Sardu'], ['sd', 'سنڌي'],
  ['se', 'Davvisámegiella'], ['sg', 'Sängö'], ['si', 'සිංහල'],
  ['sk', 'Slovenčina'], ['sl', 'Slovenščina'], ['sm', "Gagana fa'a Samoa"], ['sn', 'ChiShona'],
  ['so', 'Soomaaliga'], ['sq', 'Shqip'], ['sr', 'Српски'], ['ss', 'SiSwati'],
  ['st', 'Sesotho'], ['su', 'Basa Sunda'], ['sv', 'Svenska'], ['sw', 'Kiswahili'],
  ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['tg', 'Тоҷикӣ'], ['th', 'ไทย'],
  ['ti', 'ትግርኛ'], ['tk', 'Türkmençe'], ['tl', 'Tagalog'], ['tn', 'Setswana'],
  ['to', 'Faka Tonga'], ['tr', 'Türkçe'], ['ts', 'XiTsonga'], ['tt', 'Татарча'],
  ['tw', 'Twi'], ['ty', 'Reo Tahiti'], ['ug', 'ئۇيغۇرچە'], ['uk', 'Українська'],
  ['ur', 'اردو'], ['uz', 'Oʻzbekcha'], ['ve', 'Tshivenḓa'], ['vi', 'Tiếng Việt'],
  ['vo', 'Volapük'], ['wa', 'Walon'], ['wo', 'Wolof'], ['xh', 'IsiXhosa'],
  ['yi', 'ייִדיש'], ['yo', 'Yorùbá'], ['za', 'Vahcuengh'], ['zh', '中文'], ['zu', 'IsiZulu'],
  ['en-US', 'English (United States)'], ['en-GB', 'English (United Kingdom)'],
  ['en-AU', 'English (Australia)'], ['en-CA', 'English (Canada)'],
  ['es-ES', 'Español (España)'], ['es-MX', 'Español (México)'], ['es-419', 'Español (Latinoamérica)'],
  ['pt-BR', 'Português (Brasil)'], ['pt-PT', 'Português (Portugal)'],
  ['fr-CA', 'Français (Canada)'], ['fr-CH', 'Français (Suisse)'],
  ['de-AT', 'Deutsch (Österreich)'], ['de-CH', 'Deutsch (Schweiz)'],
  ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['zh-HK', '中文（香港）'],
  ['sr-Latn', 'Srpski (latinica)'], ['sr-Cyrl', 'Српски (ћирилица)'],
  ['az-Latn', 'Azərbaycan dili (latın)'], ['az-Cyrl', 'Азәрбајҹан дили (кирил)'],
  ['uz-Latn', 'Oʻzbekcha (lotin)'], ['uz-Cyrl', 'Ўзбекча (кирилл)'],
  ['pa-Guru', 'ਪੰਜਾਬੀ (ਗੁਰਮੁਖੀ)'], ['pa-Arab', 'پنجابی (شاہ مکھی)'],
  ['fil', 'Filipino'], ['yue', '粵語'],
] as const satisfies readonly (readonly [string, string])[];

export interface LanguageOption {
  code: string;
  label: string;
  nativeName: string;
}

let optionCache: { locale: string; options: readonly LanguageOption[] } | undefined;

/** @spec spec://modules/interface/FEAT-003-controls#languages */
export function normalizeLanguageTag(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const tag = value.trim();
  if (!tag || tag.length > 64 || !/^[A-Za-z0-9-]+$/.test(tag) || tag.toLowerCase() === 'auto') return undefined;
  try {
    return Intl.getCanonicalLocales(tag)[0];
  } catch {
    return undefined;
  }
}

/** @spec spec://modules/interface/FEAT-003-controls#languages */
export function getLanguageOptions(locale = 'en'): readonly LanguageOption[] {
  const canonical = normalizeLanguageTag(locale) ?? 'en';
  if (optionCache?.locale === canonical) return optionCache.options;
  let names: Intl.DisplayNames | undefined;
  try {
    names = new Intl.DisplayNames([canonical, 'en'], { type: 'language', fallback: 'none' });
  } catch {
    // Native names still make every choice readable on a limited Intl runtime.
  }
  const options = LANGUAGES.map(([code, nativeName]) => {
    let localized: string | undefined;
    try { localized = names?.of(code); } catch { /* Keep the native fallback. */ }
    const label = localized && localized.toLocaleLowerCase(canonical) !== nativeName.toLocaleLowerCase(canonical)
      ? `${localized} — ${nativeName}` : nativeName;
    return Object.freeze({ code, nativeName, label });
  });
  // Only one localized list survives locale changes; native names stay static.
  optionCache = { locale: canonical, options: Object.freeze(options) };
  return optionCache.options;
}

export interface BrowserLanguagePreferences {
  preferredLanguages?: readonly unknown[];
  uiLanguage?: unknown;
  language?: unknown;
}

function browserPreferences(): BrowserLanguagePreferences {
  let uiLanguage: unknown;
  const scope = globalThis as typeof globalThis & {
    browser?: { i18n?: { getUILanguage?: () => string } };
    chrome?: { i18n?: { getUILanguage?: () => string } };
  };
  try {
    const i18n = scope.browser?.i18n ?? scope.chrome?.i18n;
    uiLanguage = i18n?.getUILanguage?.();
  } catch { /* Browser UI API absence does not prevent language resolution. */ }
  return {
    uiLanguage,
    preferredLanguages: typeof navigator === 'undefined' ? [] : navigator.languages,
    language: typeof navigator === 'undefined' ? undefined : navigator.language,
  };
}

function chineseLocale(tag: string): 'zh-CN' | 'zh-TW' | undefined {
  const locale = new Intl.Locale(tag);
  if (locale.language !== 'zh') return undefined;
  // An explicit writing system takes precedence over a possibly conflicting region.
  if (locale.script === 'Hant') return 'zh-TW';
  if (locale.script === 'Hans') return 'zh-CN';
  return ['TW', 'HK', 'MO'].includes(locale.region ?? '') ? 'zh-TW' : 'zh-CN';
}

/** @spec spec://modules/interface/FEAT-003-controls#languages */
export function resolveBrowserTargetLanguage(preferences = browserPreferences()): string {
  for (const value of [...(preferences.preferredLanguages ?? []), preferences.uiLanguage, preferences.language]) {
    const tag = normalizeLanguageTag(value);
    if (tag && !['und', 'zxx', 'mul'].includes(tag.split('-')[0]!)) return chineseLocale(tag) ?? tag;
  }
  return 'en';
}

function supportedUiLocale(value: unknown): UiLocale | undefined {
  const tag = normalizeLanguageTag(value);
  if (!tag) return undefined;
  const chinese = chineseLocale(tag);
  if (chinese) return chinese;
  const language = new Intl.Locale(tag).language;
  return UI_LOCALES.find(([code]) => code === language)?.[0];
}

/** @spec spec://modules/interface/FEAT-003-controls#languages */
export function resolveUiLocale(preference = 'auto', preferences?: BrowserLanguagePreferences): UiLocale {
  if (preference !== 'auto') return supportedUiLocale(preference) ?? 'en';
  const available = preferences ?? browserPreferences();
  for (const value of [available.uiLanguage, ...(available.preferredLanguages ?? []), available.language]) {
    const locale = supportedUiLocale(value);
    if (locale) return locale;
  }
  return 'en';
}

/** Validate persisted UI choices without substituting an unrelated supported language.
 * @spec spec://modules/storage/INFRA-002-local-data#settings
 */
export function normalizeUiLanguage(value: unknown): 'auto' | UiLocale | undefined {
  if (value === 'auto') return 'auto';
  const canonical = normalizeLanguageTag(value);
  return UI_LOCALES.find(([code]) => code === canonical)?.[0];
}
