# WI-023: Название подписки ChatGPT и локализация возврата

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Пользователь выбирает «Подписка ChatGPT»; кнопки, инструкция и сообщения используют это понятное название. Страница подключения и возврат после входа поддерживают все 16 языков интерфейса.

## Specs

- Governing: `spec://modules/platform/INFRA-004-codex-connection#settings`
- Governing: `spec://modules/interface/FEAT-003-controls#languages`
- Constraint: `spec://common/PROP-002-quality#checks`, `spec://common/PROP-002-quality#hygiene`
- Affected: `spec://modules/platform/INFRA-004-codex-connection#settings`, `spec://modules/interface/FEAT-003-controls#options`

## Scope

- In: локализованные названия сервиса, кнопок и сообщений; язык callback; актуальная инструкция; сборки и проверка Chrome/Firefox.
- Out: изменение OAuth, provider ID, совместимости CLI, платные запросы, публикация.

## Acceptance

- [x] Все 16 языков содержат название, шаги, статусы и ошибки; новый пользовательский интерфейс не называет сервис Codex.
- [x] Возврат после входа использует выбранный язык и RTL; очистка OAuth-кода сохраняется.
- [x] Typecheck, lint, осмысленные tests, обе сборки, manifest/hygiene и браузерный сценарий выполнены; реальные вход и модель явно остаются непроверенными.
- [x] Проверены кэш, дубли, память и отсутствие оставленных собственных процессов.

## Result

Linguisty 0.4.1: локализованная «Подписка ChatGPT» в selector/options/popup/guide, подключение и отключение ChatGPT, все статусы и ошибки; callback поддерживает выбранный язык и RTL без загрузки полного UI словаря. Внутренний provider ID `codex`, имена entrypoints и протокол не менялись. Канон и инструкция актуализированы; историческая QA-0.4.0 сохранена.

TypeScript/ESLint PASS; 661 Vitest / 46 files / max 2 workers; 8 checker tests; production builds/ZIP двух платформ; manifest/hygiene PASS; Mozilla linter 0 errors/notices/warnings. Chrome — 6 групп, Firefox — 5, включая все 16 языков и fixture вход/перевод. Русский/арабский мобильные снимки просмотрены. Фактические live OAuth/eligibility/model и ревью носителями не объявлены проверенными. Evidence и ограничения: docs/QA-SUBSCRIPTION.md, test-results/linguisty-subscription/.

Промежуточные и финальные hygiene snapshots без подозрительных файлов и дублей; защищённая .cache неизменна. Firefox собственные процессы 13 → 0; Chrome собственный context закрыт, созданные профили удалены. Размер общего UI chunk 608 410 bytes и callback shared chunk 11 492 bytes записаны в TD-002.
