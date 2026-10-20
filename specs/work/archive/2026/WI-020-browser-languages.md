# WI-020: Языки и автоматические настройки браузера

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Linguisty предлагает расширенный каталог языков перевода и локализованный интерфейс; автоматически выбирает язык браузера, сохраняя явно выбранные языки и прежние настройки/ключи.

## Specs

- Governing: `spec://modules/interface/FEAT-003-controls#languages`, `spec://modules/storage/INFRA-002-local-data#settings`
- Affected: `spec://modules/interface/FEAT-003-controls#languages`, `spec://modules/storage/INFRA-002-local-data#settings`, `spec://common/PROP-001-contracts#types`
- Constraint: `spec://common/PROP-002-quality#resources`, `spec://common/PROP-000-product#invariants`

## Scope

- In: language catalogue, BCP 47 resolution/fallback, automatic/manual target preference, uiLanguage setting, migration, local dictionaries, RTL/document lang, UI integration, meaningful regression checks.
- Out: гарантии качества любой модели на любом языке, доступ к настройкам ОС вне browser APIs, external localization service.
- Assigned language executor: `src/shared/languages.ts`, `src/ui/i18n.tsx`, `src/storage/settings.ts`, `src/storage/normalization.ts`, `tests/storage/normalization.test.ts`, `tests/storage/storage.test.ts`, новые `tests/ui/i18n.test.tsx`, `tests/shared/languages.test.ts`.
- Assigned dictionary executor: только `src/ui/locales/**`; обновление Result WI через сообщение координатору.
- Root owns shared Settings/defaults, канон, README, исследования, wiring/quality checks и финальную приёмку.

## Dependencies

- Related: `WI-019`

## Acceptance

- [x] Каталог содержит все ISO 639-1 языки и полезные региональные варианты без дублей; ручные BCP 47 codes, распознаваемые Intl.getCanonicalLocales, сохраняются.
- [x] Новый пользователь получает target из browser preferred languages; режим browser обновляет target при смене предпочтений, ручной выбор не перезаписывается.
- [x] Прежние source/target/keyMode/key/model сохраняются; старый явно записанный target остаётся manual.
- [x] UI имеет полноценные локальные словари заявленных языков, auto/manual выбор, fallback, lang/dir и cleanup.
- [x] Интеграция UI, обе production builds, typecheck/lint/tests/manifest/browser проверки пройдены.
- [x] Проверены ресурсы и дубли; качество перевода реальной модели без paid testing не заявлено.

## Result

Было → стало: короткий язык-каталог и ru default → 210 уникальных языков/вариантов перевода (184 базовых ISO 639-1 и 26 дополнительных), Intl-compatible manual tags, targetLanguageMode=browser/manual и независимый uiLanguage=auto/locale. Preferred browser target разрешается при чтении без постоянной записи resolved value; legacy saved target сохраняется как manual. UI язык сначала следует browser UI locale; unsupported UI locale получает English. Regional/script Chinese matching и Arabic RTL поддержаны; прямого чтения языка ОС нет.

16 полных локальных packs: en/ru/uk/de/fr/es/it/pt/pl/tr/ja/ko/zh-CN/zh-TW/ar/hi, 206 ключей каждый. Locale metadata вынесены отдельно для lightweight background. i18n provider владеет document lang/dir; languagechange/storage subscriptions освобождаются после unmount, language option cache держит только последний locale. Safe error-code localization не изменяет journal raw diagnostics; недоступный localStorage hint получает memory fallback. Все видимые настройки/валидация/bootstrap/popup/journal подключены к словарям.

Проверки: typecheck/lint PASS, 566 tests /33 files (включая полный pack/placeholder parity, normalization/migration/key preservation, locale/script/fallback и listeners), 8 manifest/hygiene tests, 5 fixtures; обе production builds/ZIP. Chromium full smoke 14 PASS с parent, Firefox 14 PASS, packaged UI/startup 2 PASS. Rebrand/language scenarios 2 PASS: actual browser default, все 16 UI previews/320/390/1280, manual sr-Latn-RS save/reopen, независимый UI, повторные return-auto через настоящую форму; Firefox uk-UA, RTL, manual и return-auto также через submit. Требование React commit перед browser save зафиксировано в harness; первичные неуспешные прогоны и пределы доказательств описаны в QA report.

Evidence: docs/QA-REPORT.md и test-results/linguisty-rebrand/. Словари структурно полны; native-speaker QA всех 16 languages и реальные способности модели на 210 choices не проверены. Paid calls/dependency install не выполнялись. Bounded caches/lifecycle tests прошли, source duplicates/suspicious copies 0; старый .cache 203 426 930 bytes без новых остатков, собственные профили/processes освобождены. Все UI packs пока загружаются вместе: TD-002 фиксирует Vite chunk warning без его скрытия.
