# WI-011: Устранить предупреждения Mozilla в Firefox package

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Firefox production package проходит Mozilla Add-ons Linter без предупреждений Android minimum и dynamic innerHTML; popup/options и перевод сохраняют рабочее поведение.

## Specs

- Governing: `spec://modules/platform/INFRA-001-extension#build`
- Governing: `spec://modules/interface/FEAT-003-controls#errors`
- Constraint: `spec://common/PROP-000-product#scope.in`
- Constraint: `spec://common/PROP-002-quality#checks`
- Constraint: `spec://common/PROP-002-quality#hygiene`
- Affected: `spec://modules/platform/INFRA-001-extension#build`

## Scope

- In: Firefox floor 142 без gecko_android; явное отключение unused React raw-HTML renderer на сборке; contract/regression checks; сборки, браузерные проверки, ZIP и evidence.
- Assigned paths: `wxt.config.ts`, `scripts/**`, `tests/build/**`, `docs/RESEARCH.md`, `docs/QA-REPORT.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/FIREFOX-QA.md`, `README.md`, `specs/modules/platform/INFRA-001-extension.md`, этот WI и его строка BOARD/WAL.
- Out: Android support, смена UI framework, реальные платные API-запросы, публикация/подпись AMO.

## Acceptance

- [x] Исходные три предупреждения воспроизведены Mozilla Add-ons Linter.
- [x] Firefox minimum 142 и отсутствие Android support проверены manifest contract test.
- [x] Оба React raw-HTML пути отклоняют HTML; text children сохраняют буквальный текст. Изменившийся upstream renderer останавливает сборку.
- [x] Typecheck, lint, unit/contract tests, Chrome/Firefox build и manifest/resource checks проходят.
- [x] Доступные браузерные UI/translation smoke проходят на новых packages; ограничения явно записаны.
- [x] Финальный Firefox ZIP проходит Mozilla Add-ons Linter без ошибок и предупреждений; ZIP соответствует проверенным production files.
- [ ] Кэш, дубли, RAM и собственные helper processes проверены; временный cache linter удалён.

## Dependencies

- Related: `WI-009`, `WI-010`.

## Result

2026-10-12: пользователь явно разрешил удаление четырёх перечисленных временных путей. Повторная команда с проверкой абсолютных границ `.cache`, reparse points и использующих пути процессов отклонена до выполнения: `blocked by policy`. Ограничение теперь внешняя политика, а не отсутствие согласия. Файлы сохранены; обход отказа не выполнялся. Начальный общий `.cache`: 203426930 bytes; связанных с Linguisty node/firefox/chrome/geckodriver процессов на начальном снимке не было.

Основное исправление и проверки завершены. Было: gecko floor 140 и два dynamic innerHTML setter React DOM 19.3.0, Mozilla выдавал 3 warnings. Стало: floor 142 без gecko_android, оба raw-HTML пути вызывают явную ошибку; обычные React text children/DOM nodes работают. Dependency на диске и package-lock не менялись. Mozilla Add-ons Linter 10.13.0 проверил каталог и Firefox ZIP: 0 errors, 0 notices, 0 warnings.

Проверки: typecheck/lint PASS; 398 tests/18 suites (Vitest max 2 workers); 7 manifest/hygiene contract tests; 5 fixtures; обе production build/ZIP; Chromium152 pipeline (9 scenarios) и отдельный packaged UI; Firefox157.0.1/geckodriver0.37.1 (10 groups). Chrome — 13 files/343499 bytes; Firefox — 13/343662. Оба ZIP побайтно совпадают с production; source ZIP не содержит generated artifacts. Firefox package hash до/после runtime: `26f637d572b1e90b7f729b6d72783352fb34fd5a2dab7f409a2d6a3761bdd66f`. Evidence: `test-results/linguisty-amo/`, стандартные runtime artifacts. Реальный API, языковая точность, signed install и minimum-version runtime не проверены.

Первый Firefox launch завершился до установки расширения; повторный полный запуск прошёл. Повторный run закрыл 12 собственных процессов, удалил свой профиль, обнулил mock requests/timers. Два оставшихся процесса первого запуска (27160/33360) идентифицированы по точному `profile-MaLnaU` и завершены адресно; чужие процессы не закрывались.

Hygiene PASS: точных дублей/suspicious source copies нет; node_modules 193587680 bytes (+2096 bytes test cache), .wxt 6390, .output 1251308 на измерении; RAM free 16125992960 bytes. Временный npm cache linter и остатки первого Firefox launch ещё находятся в `.cache` (203425397 bytes вместе с прежним geckodriver cache): recursive removal отклонён automatic approval review с `blocked by policy`, подробная причина не сообщена. Пользователю задан вопрос об удалении только этих временных файлов. Завершение operational WI ожидает решения по cleanup.
