// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LANGUAGES, UI_LOCALES, getLanguageOptions, normalizeLanguageTag, normalizeUiLanguage,
  resolveBrowserTargetLanguage, resolveUiLocale,
} from '../../src/shared/languages';

afterEach(() => vi.unstubAllGlobals());

/** @spec spec://modules/interface/FEAT-003-controls#languages */
describe('translation language catalogue', () => {
  it('includes every ISO 639-1 code and useful variants with no duplicate identifiers', () => {
    const isoCodes = 'aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu'.split(' ');
    const codes = LANGUAGES.map(([code]) => code);
    expect(isoCodes).toHaveLength(184);
    expect(codes.filter(code => code.length === 2).sort()).toEqual(isoCodes);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(expect.arrayContaining(['zh-CN', 'zh-TW', 'pt-BR', 'pt-PT', 'en-GB', 'es-419', 'sr-Latn', 'fil']));
    expect(LANGUAGES.every(([, name]) => name.trim().length > 0)).toBe(true);
  });

  it('provides localized and native labels and keeps only the most recent immutable list', () => {
    const english = getLanguageOptions('en');
    expect(english.find(({ code }) => code === 'fr')).toMatchObject({ nativeName: 'Français', label: 'French — Français' });
    expect(getLanguageOptions('en')).toBe(english);
    const russian = getLanguageOptions('ru');
    expect(russian.find(({ code }) => code === 'fr')?.label).toMatch(/французский.*Français/i);
    expect(russian).toHaveLength(LANGUAGES.length);
    expect(Object.isFrozen(russian)).toBe(true);
    expect(Object.isFrozen(russian[0])).toBe(true);
    expect(getLanguageOptions('en')).not.toBe(english);
  });

  it('keeps readable native labels when Intl display-name data is unavailable', () => {
    vi.spyOn(Intl, 'DisplayNames').mockImplementation(() => { throw new Error('Unavailable'); });
    expect(getLanguageOptions('de-AT').find(({ code }) => code === 'fr')?.label).toBe('Français');
    expect(getLanguageOptions('de-AT')).toHaveLength(LANGUAGES.length);
  });

  it('canonicalizes Unicode-compatible BCP 47 tags beyond the catalogue and rejects malformed tags', () => {
    expect(normalizeLanguageTag('  tlh-Latn  ')).toBe('tlh-Latn');
    expect(normalizeLanguageTag('fr-ca-u-nu-latn')).toBe('fr-CA-u-nu-latn');
    expect(normalizeLanguageTag('zh-hant-tw')).toBe('zh-Hant-TW');
    for (const invalid of ['auto', 'en_US', 'ru\u0001en', '', 'a'.repeat(65), 1, undefined]) {
      expect(normalizeLanguageTag(invalid)).toBeUndefined();
    }
  });
});

/** @spec spec://modules/interface/FEAT-003-controls#languages */
describe('browser language resolution', () => {
  it('uses preferred languages for translation and browser UI language for UI', () => {
    const browser = { preferredLanguages: ['uk-UA', 'fr-FR'], uiLanguage: 'de-DE', language: 'ja-JP' };
    expect(resolveBrowserTargetLanguage(browser)).toBe('uk-UA');
    expect(resolveUiLocale('auto', browser)).toBe('de');
    expect(resolveUiLocale('fr', browser)).toBe('fr');
  });

  it('skips malformed preferences and follows bounded fallback order', () => {
    expect(resolveBrowserTargetLanguage({ preferredLanguages: ['not_a_tag', '', 'und'], uiLanguage: 'pt-BR', language: 'ru' })).toBe('pt-BR');
    expect(resolveBrowserTargetLanguage({ preferredLanguages: [], language: 'ja-JP' })).toBe('ja-JP');
    expect(resolveBrowserTargetLanguage({})).toBe('en');
    expect(resolveUiLocale('auto', { uiLanguage: 'tlh', preferredLanguages: ['invalid_tag', 'pl-PL'], language: 'ru' })).toBe('pl');
    expect(resolveUiLocale('auto', { uiLanguage: 'tlh', preferredLanguages: ['eo'], language: 'la' })).toBe('en');
    expect(resolveUiLocale('unsupported', { uiLanguage: 'ru' })).toBe('en');
  });

  it.each([
    ['zh-TW', 'zh-TW'], ['zh-HK', 'zh-TW'], ['zh-MO', 'zh-TW'], ['zh-Hant', 'zh-TW'],
    ['zh-Hans', 'zh-CN'], ['zh-CN', 'zh-CN'], ['zh-SG', 'zh-CN'], ['zh', 'zh-CN'],
    ['zh-Hant-CN', 'zh-TW'], ['zh-Hans-TW', 'zh-CN'],
  ])('matches Chinese writing system and region for %s', (tag, expected) => {
    expect(resolveUiLocale('auto', { uiLanguage: tag })).toBe(expected);
    expect(resolveBrowserTargetLanguage({ preferredLanguages: [tag] })).toBe(expected);
    expect(normalizeLanguageTag(tag)).toBe(tag);
  });

  it('reads extension browser UI language without depending on full UI dictionaries', () => {
    vi.stubGlobal('browser', { i18n: { getUILanguage: () => 'ar-EG' } });
    vi.stubGlobal('navigator', { languages: ['fr-CA'], language: 'ru' });
    expect(resolveBrowserTargetLanguage()).toBe('fr-CA');
    expect(resolveUiLocale()).toBe('ar');
    vi.stubGlobal('browser', { i18n: { getUILanguage: () => { throw new Error('Unavailable'); } } });
    expect(resolveUiLocale()).toBe('fr');
  });

  it('permits only exact supported persisted UI choices, independently of target BCP 47 codes', () => {
    for (const [locale] of UI_LOCALES) expect(normalizeUiLanguage(locale)).toBe(locale);
    expect(normalizeUiLanguage('auto')).toBe('auto');
    expect(normalizeUiLanguage('zh-cn')).toBe('zh-CN');
    expect(normalizeUiLanguage('zh-Hant')).toBeUndefined();
    expect(normalizeUiLanguage('tlh')).toBeUndefined();
    expect(normalizeUiLanguage('en-US')).toBeUndefined();
  });
});
