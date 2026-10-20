/** @spec spec://modules/interface/FEAT-003-controls#languages */
/** Metadata stays independent of dictionaries so background code loads no UI text. */
export const UI_LOCALES = [
  ["en", "English"],
  ["ru", "Русский"],
  ["uk", "Українська"],
  ["de", "Deutsch"],
  ["fr", "Français"],
  ["es", "Español"],
  ["it", "Italiano"],
  ["pt", "Português"],
  ["pl", "Polski"],
  ["tr", "Türkçe"],
  ["ja", "日本語"],
  ["ko", "한국어"],
  ["zh-CN", "简体中文"],
  ["zh-TW", "繁體中文"],
  ["ar", "العربية"],
  ["hi", "हिन्दी"],
] as const;

export type UiLocale = (typeof UI_LOCALES)[number][0];
