# WI-020: Languages and automatic browser settings

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Linguisty offers an expanded translation language catalog and localized interface; automatically selects the browser language while preserving explicitly selected languages and previous settings/keys.

## Specs

- Governing: `spec://modules/interface/FEAT-003-controls#languages`, `spec://modules/storage/INFRA-002-local-data#settings`
- Affected: `spec://modules/interface/FEAT-003-controls#languages`, `spec://modules/storage/INFRA-002-local-data#settings`, `spec://common/PROP-001-contracts#types`
- Constraint: `spec://common/PROP-002-quality#resources`, `spec://common/PROP-000-product#invariants`

## Scope

- In: language catalogue, BCP 47 resolution/fallback, automatic/manual target preference, uiLanguage setting, migration, local dictionaries, RTL/document lang, UI integration, meaningful regression checks.
- Out: guarantees of any model's quality in any language, access to OS settings beyond browser APIs, external localization service.
- Assigned language executor: `src/shared/languages.ts`, `src/ui/i18n.tsx`, `src/storage/settings.ts`, `src/storage/normalization.ts`, `tests/storage/normalization.test.ts`, `tests/storage/storage.test.ts`, new `tests/ui/i18n.test.tsx`, `tests/shared/languages.test.ts`.
- Assigned dictionary executor: only `src/ui/locales/**`; update WI Result through a message to the coordinator.
- Root owns shared Settings/defaults, canon, README, research, wiring/quality checks, and final acceptance.

## Dependencies

- Related: `WI-019`

## Acceptance

- [x] Catalog includes all ISO 639-1 languages and useful regional variants without duplicates; manual BCP 47 codes recognized by Intl.getCanonicalLocales preserved.
- [x] New user receives target from browser preferred languages; browser mode updates target when preferences change; manual selection is not overwritten.
- [x] Previous source/target/keyMode/key/model preserved; old explicitly saved target remains manual.
- [x] UI has complete local dictionaries for declared languages, auto/manual selection, fallback, lang/dir, and cleanup.
- [x] UI integration, both production builds, typecheck/lint/tests/manifest/browser checks passed.
- [x] Resources and duplicates checked; real model translation quality not claimed without paid testing.

## Result

Before → after: short language catalog and ru default → 210 unique translation languages/variants (184 base ISO 639-1 and 26 additional), Intl-compatible manual tags, targetLanguageMode=browser/manual, and independent uiLanguage=auto/locale. Preferred browser target resolved on read without persistently writing the resolved value; legacy saved target preserved as manual. UI language initially follows browser UI locale; unsupported UI locale receives English. Regional/script Chinese matching and Arabic RTL supported; no direct OS language reading.

16 complete local packs: en/ru/uk/de/fr/es/it/pt/pl/tr/ja/ko/zh-CN/zh-TW/ar/hi, 206 keys each. Locale metadata separated for lightweight background. i18n provider owns document lang/dir; languagechange/storage subscriptions released after unmount; language option cache holds only the last locale. Safe error-code localization does not change journal raw diagnostics; unavailable localStorage hint gets memory fallback. All visible settings/validation/bootstrap/popup/journal connected to dictionaries.

Checks: typecheck/lint PASS, 566 tests /33 files (including full pack/placeholder parity, normalization/migration/key preservation, locale/script/fallback, and listeners), 8 manifest/hygiene tests, 5 fixtures; both production builds/ZIP. Chromium full smoke 14 PASS with parent, Firefox 14 PASS, packaged UI/startup 2 PASS. Rebrand/language scenarios 2 PASS: actual browser default, all 16 UI previews/320/390/1280, manual sr-Latn-RS save/reopen, independent UI, repeated return-auto through the real form; Firefox uk-UA, RTL, manual, and return-auto also through submit. React commit requirement before browser save recorded in the harness; initial unsuccessful runs and evidence limitations described in QA report.

Evidence: docs/archive/QA-REPORT.md and test-results/linguisty-rebrand/. Dictionaries structurally complete; native-speaker QA of all 16 languages and real model capabilities across 210 choices not checked. No paid calls/dependency install. Bounded caches/lifecycle tests passed, source duplicates/suspicious copies 0; old .cache 203 426 930 bytes without new residue, own profiles/processes freed. All UI packs still load together: TD-002 records the Vite chunk warning without hiding it.
