# Linguisty — приёмка локальной версии 0.2.0

Автор разработки: Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI-инструменты и фактические проверки указаны ниже. См. [AUTHORS](../AUTHORS.md).

Актуальный проход 0.4.9 от 2026-10-13: [QA-2026-10-13](QA-2026-10-13.md). Ниже сохранено историческое evidence 0.2.0; оно не заменяет проверку новых пакетов.

Дата: 2026-10-08, Europe/Moscow. Актуальная сборка после WI-019/WI-020: Retro Orbit Editorial и языковые настройки браузера; узкое уточнение пользователя перенесло Isty в footer. Исходные документы пользователя трактуются как визуальный референс; продукт остаётся Linguisty, Chrome/Firefox desktop, BYOK.

## Retro Orbit и языки

Было → стало: Cloudline → violet/sage, graphite/paper, прямоугольные формы, editorial headings, supplied SVG и локальные Onest/JetBrains Mono с OFL. Настройки получили навигацию по разделам; popup сохраняет компактный сценарий перевода.

Было → стало: короткий список и фиксированный русский default → 210 различных языков/вариантов перевода, ручные Intl-compatible BCP 47 codes и 16 независимых языков UI. Новый профиль берёт target из предпочитаемых языков браузера, UI из языка браузера; старый сохранённый target мигрирует в manual. Ключ/model/source не сбрасываются. ОС напрямую не читается. UI locales: en, ru, uk, de, fr, es, it, pt, pl, tr, ja, ko, zh-CN, zh-TW, ar, hi. Каждый pack теперь содержит 207 ключей с проверенной полнотой и одинаковыми placeholders; ревью носителями всех языков не проводилось.

Было → стало после уточнения: большой знак Isty в шапке → маленький знак 42×24 px в footer popup/options, с «Разработано»/«Powered by» и переводами всех 16 locales. В шапке только Linguisty и product caption. Полный шаблон с {brand} определяет порядок фразы (в том числе JA/KO/HI); логотип имеет accessible name Isty. Новых ресурсов, listeners или переводческих сервисов не добавлено. Typecheck/lint и 566 unit tests повторены; packaged Chrome/Firefox languages и полный UI run — 3 PASS. Footer screenshots просмотрены в paper/graphite, popup — визуально целиком. Mozilla linter финального Firefox ZIP: 0 errors/notices/warnings. Background/content hashes совпадают с предыдущим full smoke; полный translation smoke после этой визуальной правки не повторялся.

| Проверка | Фактический результат |
|---|---|
| Typecheck / lint | PASS |
| Unit/contract/DOM | 566 PASS, 33 files, максимум 2 workers |
| Manifest/hygiene contracts / fixtures | 8 PASS / 5 PASS |
| Production builds / runtime ZIP | Chrome и Firefox PASS, по 19 файлов; ZIP payload совпадает с production |
| Chrome package / ZIP | 1 036 452 / 403 174 bytes |
| Firefox package / ZIP | 1 036 615 / 403 258 bytes |
| Manifest / secrets / assets | PASS, 15 referenced assets, local fonts/SVG, без ключей/dev runtime |
| Chromium 152.0.7977.8 | До footer: 13 pipeline scenarios, 14 PASS с parent, 0 FAIL |
| Firefox 157.0.1 / geckodriver 0.37.1 | До footer: 14 PASS / 0 FAIL, package index до/после одинаков |
| Packaged UI / startup | UI PASS после footer; startup PASS до footer |
| Packaged языки Chrome + Firefox | 2 PASS; auto/manual, сохранение через form submit, reopen, независимый UI/target, Arabic RTL |
| Mozilla Add-ons Linter 10.13.0 | Firefox ZIP: 0 errors, 0 notices, 0 warnings |

Chromium проверил все 16 UI locales при 320/390/1280 px, отсутствие горизонтального overflow страницы, 44 px targets, реальную загрузку Onest/JetBrains Mono и supplied SVG. Контраст проверенных обычных/семантических текстовых токенов в обеих темах ≥5.68:1; это не полный WCAG audit. Firefox с intl.accept_languages=uk-UA,en-US выбрал uk-UA, показал Arabic RTL, сохранил sr-Latn-RS и English настоящей кнопкой формы, затем вернулся в browser mode с uk-UA. Chromium дополнительно выполнил повторные manual/browser циклы вместе с переключением UI locale. В UI нет внешних font/script/resource requests. Paid/provider requests в языковом сценарии не выполнялись.

Первый full smoke обоих браузеров остановился на старом ожидании двух попыток стриминга. Актуальный adaptive engine восстанавливает multi-node batch: duplicate fixture окончательно падает после 6 попыток с полным rollback; unknown/missing fixtures проходят полную валидацию одноузловых ответов после 7 попыток. Test обновлён по действующей FEAT-001, лимиты и cache atomicity сохранены. Firefox refresh helper теперь ждёт готовую React form перед checkbox read. Повторные полные прогоны прошли.

Быстрый языковой harness сначала показал несохранённый возврат в browser mode в Chromium; эти прогоны не объявлены успешными. Проверка теперь требует удаления ручного input после выбора auto (React commit), завершённой формы и feedback после save, затем проверяет реальные storage values и повторные циклы. Окончательный сценарий прошёл без изменения production UI; точная причина исходного transient расхождения не установлена.

Общий UI JS chunk 568 145 bytes вызывает стандартное предупреждение Vite >500 kB: все 16 локальных packs загружаются вместе. Warning не отключён; ограничение записано в TD-002. Background 75 015 bytes импортирует только locale metadata, content script 30 526 bytes. Оба шрифта упакованы локально; новые зависимости не установлены.

Hygiene: source duplicates/suspicious copies/hash skips 0; одна node_modules 193 588 893 bytes, .wxt 6 589 bytes. Старый .cache остался 203 426 930 bytes/5 652 files; новых остаточных Firefox cache files относительно baseline нет. Доступная RAM и размеры output/artifacts записаны в hygiene-final.json; snapshot не доказывает отсутствие всех утечек. Full Firefox: собственные working set около 1.11 GB до закрытия → 0 после, профиль удалён, remainingOwnedProcesses=0. Chrome profile удалён и loopback server закрыт. Full mocks завершили 200/206 requests, максимум 2 одновременно, activeRequests/pendingTimers=0; Firefox final cache пуст. Два прежних CUA helpers оставлены; чужие процессы/кэш и WI-011 не затронуты.

Evidence: `test-results/linguisty-rebrand/observations.json`, `test-results/linguisty-rebrand/{manifests-credit,amo-credit,archives-credit,hygiene-after-credit}.json`, `test-results/linguisty-rebrand/firefox/observations.json`, screenshots в этих папках; общие runtime reports — `test-results/linguisty-{smoke,firefox,ui,ui-startup}/`. Firefox package index полного smoke до footer: `02261dbf583fc49e9f016fc5e14f78d36bcc64238aa8c11bc779c11e6e1812ec`.

Реальный OpenRouter/языковая точность модели, native-speaker QA всех UI packs, подписанная установка, minimum-browser versions, native clipboard/toolbar geometry и обновление Firefox executable не проверены. Предыдущий key-lifecycle evidence сохранён в историческом отчёте; этот отдельный дорогой по времени сценарий после редизайна не повторялся. Публикация не выполнялась.

## Исторический отчёт 0.2.0 перед редизайном

Дата: 2026-10-08, Europe/Moscow. WI-012/WI-013/WI-014: читаемость при смене системы письма, локальный журнал API и постепенный перевод целыми проверенными фразами. Исправления WI-015/WI-016 сохранены и повторно проверены.

### Проверки

| Проверка | Фактический результат |
|---|---|
| Typecheck / lint | PASS |
| Unit/contract/DOM | 493 PASS, 28 suites, максимум 2 workers |
| Manifest/hygiene contracts / fixtures | 7 PASS / 5 PASS |
| Production builds | Chrome и Firefox PASS, по 13 файлов |
| Chrome package / ZIP | 374 001 / 123 097 bytes |
| Firefox package / ZIP | 374 164 / 123 181 bytes |
| Manifest / secrets / assets | PASS: stable Gecko ID, CSP, local assets, без ключей/dev runtime |
| Chromium 152.0.7977.8 | 12 сценариев pipeline (13 PASS с parent), 0 FAIL |
| Firefox 157.0.1 / geckodriver 0.37.1 | 13 PASS, 0 FAIL; package index до/после одинаков |
| Packaged UI / startup faults | Оба PASS; narrow layout, темы, полный target checkbox, timeout/retry/unmount |
| Firefox key lifecycle | 2 PASS: реальный reload/update/exit/start в собственных профилях |
| Mozilla Add-ons Linter 10.13.0 | Firefox ZIP: 0 errors, 0 notices, 0 warnings |

Было → стало: CJK и кириллица при одинаковом CSS размере имели разную видимую высоту → ограниченная коррекция по фактическим glyph metrics. Fixture JA→RU: body 18→24 px, heading 30→40.5 px; иерархия сохраняется, fixed overflow не получает добавленного clipping, reverse CJK не уменьшается. Переключения/внешние стили/удаление узла/dispose восстанавливают только принадлежащие size/line-height. Baseline и screenshots находятся в `test-results/linguisty-fonts/` и browser artifacts. Это эвристика, не гарантия всех сайтов/шрифтов.

Было → стало: общая ошибка скрывала причину API → независимый раздел настроек показывает очищенные доступные message, HTTP/code/type/request ID и число попыток. Allowlist journal ограничен 100 записями, 4 KiB/запись, 256 KiB суммарно и 7 днями. Translation/test/discovery, HTTP 401/402/403/429/503/200-error, network/timeout/malformed, redaction и сериализация покрыты тестами. Browser checks подтвердили три отдельные операции, одну запись после 3 retry attempts, inert markup, обе темы, clear без очистки cache. Тест перехватывает только исходящий clipboard payload; системный clipboard не менялся. Native OS paste не проверен.

Было → стало: Text nodes ждали полного ответа → целые проверенные JSON items временно показываются по SSE. Открытые строки не отображаются. Final validation атомарно проверяет IDs/JSON перед cache/commit; malformed/unknown/duplicate/missing, HTTP200 error, network drop, retry и отмена откатывают предварительный текст и его шрифт. Background держит один cumulative snapshot, одну последовательную отправку и timer 100 ms. Buffer/model JSON ≤1 MiB, SSE events ≤16 384; consumer listeners/reader/retry timers освобождаются. Transport choice не меняет cache key; dedup remaps transient IDs. Обычный режим и явный unsupported-stream fallback работают.

Локальный mock с окончанием ответа через 2.5 s:

| Браузер | Первая фраза, SSE | Первая фраза, обычный запрос | Полный показ SSE |
|---|---|---|---|
| Chrome | 144 ms | 2513 ms | 2516 ms |
| Firefox | 136 ms | 2519 ms | 2527 ms |

Время измерено DOM MutationObserver от начала запроса локального сервера, не от клика пользователя. Это измерение pipeline Linguisty, не реальной скорости OpenRouter. Mock checks обоих браузеров: ID faults, late error/drop, explicit fallback, cancel/original/resume, external source edit, navigation, tab close, no invalid cache и отсутствие повторного запроса после committed toggle. UTF-8/SSE/JSON boundaries и limits дополнительно проверены unit tests. Совместимость SSE/schema конкретной пользовательской модели не проверена.

Каждый полный browser run выполнил 80 mock requests, максимум 2 одновременно; после завершения activeRequests=0, pendingTimers=0. Chrome pageErrors=0. Firefox repeated lifecycle показывает 0 timers/observers/session listeners после cancel; remainingOwnedProcesses=0 после cleanup. Успешные профили удалены, helpers/watch не оставлены. Firefox working set до закрытия около 1.07 GB; после закрытия собственных процессов 0. Размер/RAM snapshot не доказывает отсутствие всех утечек.

Evidence: `test-results/linguisty-{smoke,firefox}/observations.json`, focused fonts/journal/streaming reports, `test-results/linguisty-{ui,ui-startup,key-lifecycle}/`, `test-results/linguisty-0.2.0/{amo,hygiene,archives}.json`. Firefox package index: `ec4a586df53bcb6c91c73f471397f1da25d64b8b4a8f7cdf19a4892094edca09`; archives report проверяет совпадение runtime ZIP с этими файлами и хранит SHA-256. Предыдущие ZIP 0.1.0/0.1.1 сохранены.

Hygiene: source duplicates/suspicious copies 0, одна node_modules 193 588 509 bytes, .wxt 6390 bytes; старый .cache 203 426 930 bytes не вырос. RAM free на snapshot 18.82 GB. Старый cleanup WI-011 остаётся Blocked после прежнего automatic approval rejection; эти пути не удалялись и новый отказ не получен. Чужие процессы/кэши не затронуты.

Первый focused Firefox streaming run прошёл поток, но onboarding click был перекрыт sticky notice. Test helper теперь прокручивает реальную кнопку в центр перед WebDriver click; полный Firefox run прошёл. Первый packaged UI run проверял 44 px у самого checkbox вместо его нативного label target; проверка исправлена и отдельно подтверждает клик по тексту label на узком экране. Исправленный run прошёл. Дефекты harness не скрыты и failed runs не объявлены успешными.

Реальный OpenRouter, языковая точность, native OS clipboard, подписанная установка, minimum-browser versions, физический toolbar/activeTab gesture и обновление Firefox executable не проверены. Платные запросы, install dependencies и публикация не выполнялись.

## Исторический отчёт 0.1.1

Дата: 2026-10-08, Europe/Moscow. WI-015/WI-016: исправлены потеря постоянного режима ключа при сохранении из старого UI, раздельная запись ключа/настроек и зависание интерфейса на фоновых чтениях/кэше.

## Проверки 0.1.1

| Проверка | Фактический результат |
|---|---|
| Typecheck / lint | PASS. Производные `.cache`/`output` исключены из lint; старые файлы не удалялись |
| Unit/contract/DOM | 417 PASS, 20 suites, максимум 2 workers |
| Manifest/hygiene contract tests | 7 PASS |
| Fixture checks | 5 PASS |
| Production builds / ZIP | Chrome и Firefox PASS, по 13 файлов, ZIP побайтно совпадают с каталогами |
| Chrome package | 349 757 bytes; ZIP 115 362 bytes |
| Firefox package | 349 920 bytes; ZIP 115 445 bytes |
| Manifest / secrets / resources | PASS: stable Gecko ID, CSP, packaged assets, без ключей/dev runtime |
| Chromium 152.0.7977.8 | 9 pipeline scenarios + UI + startup faults; Node считает 12 PASS с parent test |
| Firefox 157.0.1 / geckodriver 0.37.1 | 10 PASS/0 FAIL; production hash до/после одинаков |
| Firefox key lifecycle | 2 PASS: обычный изолированный профиль и профиль с documented preservation preferences |
| Mozilla Add-ons Linter 10.13.0 | Firefox ZIP: 0 errors, 0 notices, 0 warnings |

Было → стало: устаревший popup/options мог вернуть persistent ключ в session → incidental save сохраняет актуальный режим под очередью фона. Persistent ключ и режим писались отдельно → одна local запись содержит оба. При прерванном обновлении остаточная копия не подменяет ключ из committed режима. Source cleanup failure откатывает прежнюю конфигурацию, а отдельное удаление очищает обе области.

Было → стало: интерфейс ждал всех cache/config reads и восстановления sessions → cache stats независимы от формы, конфигурация независима от snapshots. Reads ограничены 5 s; транспортный отказ чтения допускает один retry, side-effect команды не повторяются. После timeout показываются ошибка и retry; unmount освобождает ожидание/таймеры. Bootstrap HTML и React boundary оставляют безопасное сообщение с перезагрузкой вместо пустого окна. Новые браузерные tests инжектируют только transport faults тестовой страницы, production-файлы не изменяют.

Ключ пережил реальный AddonManager reload и замену дополнения пакетом большей версии с тем же Gecko ID. После реального завершения/старта Firefox временное дополнение исчезло; повторная загрузка в тот же профиль Firefox 157.0.1 сохранила local ключ как с preservation preferences, так и с выключенными preferences. Первоначальное ожидание, что default temporary removal обязательно удалит ключ, не подтвердилось; конечный тест фиксирует наблюдаемое поведение браузера. Гарантия для подписанного permanent install и обновления Firefox executable не проверялась. Temporary install остаётся временным; документация и options объясняют его ограничения, preferences пользователя не изменяются.

Evidence: `test-results/linguisty-firefox/observations.json`, `test-results/linguisty-key-lifecycle/{observations,packages}.json`, `test-results/linguisty-ui-startup/observations.json`, стандартные Chromium/UI observations. Успешные QA-профили удалены, remainingOwnedProcesses=0, mock activeRequests/pendingTimers=0, UI pageErrors=0. Snapshot размеров/RAM находится в `test-results/linguisty-key-lifecycle/hygiene.json`; он сам по себе не доказывает отсутствие утечек. Lifecycle checks дополнительно проверяют освобождение observers/listeners/timers и session snapshots. Старый cache/checkpoint WI-011 сохранён без изменения.

ZIP SHA-256: Chrome `f37f1d524f4316ca499b20c76fd48bcc6e18b111245582781ae38c4016cebcdf`; Firefox `9f336af82a187a43546437dbd019c66388cdb08e5a9928dba010634dc07c4223`.

Реальный OpenRouter/ключ пользователя, языковая точность, signed install, установка/обновление самого Firefox и минимум поддерживаемых версий не проверены. Dependency install не выполнялся; lockfile изменился только в version собственного пакета.

## Исторический отчёт 0.1.0

Дата: 2026-10-07, Europe/Moscow. После WI-011 **398 unit/contract/DOM тестов, 9 сценариев Chromium, отдельный packaged UI run и 10 групп Firefox прошли.** Обе production-сборки и ZIP готовы. Mozilla Add-ons Linter проверил Firefox ZIP: 0 ошибок и предупреждений. Реальный OpenRouter и языковая точность без пользовательского ключа не проверены. Очистка временного инструмента/остатков первого Firefox launch ожидает решения пользователя после automatic approval rejection.

## Окончательные проверки

| Проверка | Результат |
|---|---|
| npm run typecheck | PASS после заключительных изменений кода и конфигурации упаковки |
| npm run lint | PASS, 0 errors |
| npm test | PASS: 398 tests, 18 suites, максимум 2 workers |
| node --test --test-concurrency=2 scripts/check-manifests.test.mjs | PASS: 7 независимых тестов manifest/hygiene |
| node scripts/check-fixtures.mjs | PASS: 5 fixture pages, структура и собственные обработчики; отдельно от runtime |
| npm run zip:chrome / npm run zip:firefox | PASS: production build и упаковка обеих платформ |
| node scripts/check-manifests.mjs --json | PASS: имя, MV3, permissions, CSP, assets, icons и browser-specific background |
| Chromium smoke | PASS: 9 scenarios, Node считает 10 tests вместе с parent; 0 failed/skipped |
| Packaged Chromium UI | PASS: connection/models/themes/layout/progress/cache; вместе со smoke Node считает 11 tests |
| node scripts/firefox-smoke.mjs | PASS: 10 groups, 0 failed; Firefox 157.0.1 / geckodriver 0.37.1 |
| Mozilla Add-ons Linter 10.13.0 | Было 0 errors/3 warnings; стало 0 errors/0 notices/0 warnings в каталоге и Firefox ZIP |
| ZIP byte comparison | PASS: по 13 файлов совпадают с production; source ZIP без generated artifacts |
| npm audit --json | Первичная приёмка WI-009: 0 выявленных уязвимостей; dependencies/lockfile в WI-011 не менялись, audit не повторялся |
| node scripts/check-hygiene.mjs --json | Нет suspicious source copies и точных дублей; конечные размеры и RAM в evidence |

Chrome package: 13 файлов / **343 499 bytes**, ZIP 112 952 bytes. Firefox: 13 файлов / **343 662 bytes**, ZIP 113 037 bytes. Сборки из одной кодовой базы; обязательные разрешения только activeTab, scripting, storage. API host запрашивается отдельно при действии пользователя. Chrome использует service worker; Firefox — background scripts и объявление передаваемых выбранному API данных. Firefox floor 140 → 142: установка на 140–141 исключена; gecko_android отсутствует.

Оба предупреждения dynamic innerHTML происходили из unused React DOM 19.3.0 setters. Build pre-transform отключает raw-HTML путь обычных/custom elements с явной ошибкой. Production runtime tests воспроизводят исходный разбор HTML, проверяют его запрет, сохранение буквальных text children/updates/unmount и остановку при изменении upstream setters. Dependency на диске не редактируется; sanitizer или замена HTML parser не добавляются.

Проверка известных credential patterns эвристическая. Она не доказывает отсутствие произвольного секрета; UI/content/runtime tests отдельно проверяют границы ключа.

## Что проверено в браузерах

В обоих браузерах: настройка локального совместимого сервиса и ручной модели; popup → background → content → mock; viewport сначала; сохранность DOM references, ссылок, галереи, формы и введённых значений; точный оригинал/перевод без повторного API; вставки/удаления/внешний текст; SPA с новой сессией и контекстом; исключения editable/hidden/code/URL; HTML модели как буквальный текст; кэш и смена модели; безопасные 401/429/неверный JSON/ID; отмена и поздние ответы; закрытие вкладки; светлая/тёмная/системная тема и отдельные keyboard/labels checks.

Chromium дополнительно: наблюдавшаяся остановка service worker, восстановление session snapshot и новый переведённый batch. Firefox: отказ/разрешение настоящего optional-host prompt, миграция ключа между session/persistent, одна копия после обычной миграции, удаление обеих, запрет content на чтение настроек/статуса секрета и три измеренных lifecycle цикла.

Chromium 152.0.7977.8 явно выбран из ранее установленного Playwright revision1237. Установленный Playwright 1.63.0 по умолчанию ожидает отсутствующий revision1243; совпадение с pinned browser не заявляется. Firefox использует установленный runtime во временном профиле, не профиль пользователя. Все API ответы — локальный mock; наружу запросы тестовых сервисов не пересылались.

## Воспроизведение и evidence

Chromium: установить для текущего процесса LINGUISTY_CHROMIUM_EXECUTABLE в C:/Users/Nik/AppData/Local/ms-playwright/chromium-1237/chrome-win64/chrome.exe и выполнить node --test --test-concurrency=1 tests/ui/browser-ui.test.mjs tests/e2e/chromium-smoke.test.mjs.

Firefox: node scripts/firefox-smoke.mjs. Подготовка драйвера и метод: [FIREFOX-QA](FIREFOX-QA.md). Внешние browser/npm installations smoke не выполняет.

Evidence и screenshots сохраняются в ignored test-results/linguisty-smoke/, linguisty-firefox/, linguisty-ui/. Итоговый Firefox run: 22:42:25–22:43:06 МСК; package SHA-256 index до/после одинаков: **26f637d572b1e90b7f729b6d72783352fb34fd5a2dab7f409a2d6a3761bdd66f**. JSON содержит отдельные file hashes. ZIP побайтно совпадают с этими production files. test-results/linguisty-amo/ содержит before.json, after-build.json, after-zip.json, archives.json и hygiene snapshots.

## Ресурсы и очистка

Каждый полный pipeline browser run выполнил 52 mock requests, максимум 2 одновременно. После закрытия: activeRequests=0, pendingTimers=0; Chromium pageErrors=0; профили успешных runs удалены, серверы закрыты. Firefox cleanup показывает remainingOwnedProcesses=0. Первый Firefox launch до установки расширения завершился с `Process unexpectedly closed with status 0`; успешный полный run получен при повторе. Два оставшихся процесса первого профиля идентифицированы по точному пути и завершены адресно. Сам профиль и его временные файлы ещё не удалены: recursive cleanup отклонён automatic approval review.

В каждом из трёх Firefox lifecycle циклов сначала наблюдалась активность, после cancel timers=0, MutationObserver=0, IntersectionObserver=0, session navigation listeners=0. Bootstrap pagehide listener существует до закрытия документа. Повторный inject не добавил наблюдателей. Закрытые вкладки удалены из snapshot. Unit tests проверяют очередь, consumer cancellation, detached nodes, TTL/LRU/50 MiB bounds, отказ IndexedDB, cacheHitIds и cleanup.

Одна node_modules — 193 587 680 bytes (+2096 bytes Vitest cache); .wxt — 6390 bytes; .output — 1 251 308 bytes на финальном измерении. RAM free — 16 125 992 960 bytes. Дубли/suspicious source copies отсутствуют. Прежний geckodriver/source cache — 4 075 491 bytes; временный npm cache linter и остатки первого Firefox profile увеличили общий .cache до 203 425 397 bytes. Recursive removal отклонён с `blocked by policy`, более подробная причина не предоставлена; пользователю задан вопрос об удалении только созданных этим проходом файлов. Скриншоты и evidence сохранены вне source ZIP. Чужие кэши и процессы не удалялись.

RAM snapshots не доказывают отсутствие всех heap leaks. Пределы и освобождение собственных runtime ресурсов проверены повторяемыми сценариями, а не только размером working set.

## Исправленные интеграционные дефекты

- SPA loading event удалял same-document session → сравнение documentId/fallback content state сохраняет корректный переход и очищает новый документ.
- WHATWG URL убирал пустой userinfo delimiter → storage/provider/UI отклоняют raw invalid authority до нормализации/permission.
- Aggregate cache counter занижался при удалении/изменении mixed batch → cacheHitIds и per-node metadata обеспечивают точный progress.
- Несогласованные границы ключа/модели → key 4096/C0/DEL и model200; UI использует чистую общую нормализацию адреса без secret store.
- Ранние path/type/lint/hoisting ошибки устранены; их прежние FAIL не являются текущими blockers.
- WXT source ZIP включал test-results → явные исключения производных папок; архив проверяется отдельно.

## Практические границы

- Реальный provider access, смысл перевода, цены/latency и устойчивость настоящей модели к prompt injection не измерены.
- Chrome native toolbar/activeTab-only и native permission approve/deny не проверены: harness выдаёт loopback host в отдельном профиле.
- Firefox настоящий prompt показан и обработан его кнопкой через test driver chrome context; физическое нажатие, toolbar/activeTab-only на внешнем сайте и native popup geometry не подтверждены.
- Signed install/AMO и installation-time data consent, полный WCAG/contrast audit, minimum-version browser runtime и browser restart/session-key lifetime не проверены. Успешный runtime относится к Chromium152 и Firefox157.
- Миграция двух key stores не имеет общей crash-atomic транзакции; обычный rollback проверен, ограничение записано в [TD-001](../specs/TECHDEBT.md).

## Источники метода

CLI версия 0.3.0 проверена отдельно: [QA-CLI](QA-CLI.md). Этот документ сохраняет исторический API baseline; новые пакеты, native permission и явные пределы CLI проверки находятся в дополнении.

Перед реализацией изучены [Stack Overflow](https://stackoverflow.com/questions/76499601/how-to-load-extension-in-playwright-python) и [Reddit](https://www.reddit.com/r/QualityAssurance/comments/1fq5st9). Решения сверены по [Playwright extensions](https://playwright.dev/docs/chrome-extensions), [Chrome E2E](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing), [MDN background](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background), [Mozilla geckodriver](https://firefox-source-docs.mozilla.org/testing/geckodriver/Profiles.html) и [WXT packaging](https://wxt.dev/guide/essentials/publishing.html). Дополнительные исследовательские ссылки: [RESEARCH](RESEARCH.md), [FIREFOX-QA](FIREFOX-QA.md).
