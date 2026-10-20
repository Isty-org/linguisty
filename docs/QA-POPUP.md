# Linguisty 0.4.5 — popup и регрессии

Автор разработки: Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI-инструменты и фактические проверки указаны ниже. См. [AUTHORS](../AUTHORS.md).

Дата: 2026-10-09. Работа: WI-027. Пакеты проверены в Chromium 152.0.7977.8 и Firefox 157.0.1.

## Было → стало

- Текст «Настройки / Settings» в шапке → шестерёнка с постоянной областью нажатия 44×44 px, локализованными accessible name и tooltip; SVG декоративен.
- Popup сохранял всю загруженную конфигурацию при смене языка → фон применяет только sourceLanguage/targetLanguage/targetLanguageMode к последней конфигурации под существующей очередью. Новые model/provider/theme/keyMode/инструкции сохраняются. apiKey при languagesOnly=true отклоняется.

Регрессия старой формы до исправления: FAIL — ожидалась gpt-6-luna/codex, возвращались vendor/model/openrouter и прежние предпочтения. После исправления: PASS. Выбранная пользователем Luna 6 не заменяется.

## Выполненные проверки

Typecheck и lint: PASS. Vitest: 705 tests / 47 files, максимум 2 workers. Native fixtures: 15 PASS, реальные модели не запускаются. Manifest/hygiene tests: 9 PASS. Production builds Chrome/Firefox: PASS; manifest/ресурсы/секреты: PASS. По 28 файлов и 24 referenced assets; 1 142 113 / 1 142 276 bytes до сжатия. Общий UI chunk 608 946 bytes остаётся известным TD-002.

Chrome: 13 групп полного smoke PASS, включая progressive streaming/rollback, CJK/большие страницы, DOM/формы, изменения и SPA, cache/model isolation, завершение service worker, 401/429/неправильные IDs, отмену/поздние ответы и темы. Firefox: 14 групп PASS, дополнительно штатные denied/granted permissions, повторяемый lifecycle с нулевыми timers/observers и неизменность production package.

Шестерёнка в обеих платформах: 16 локализованных доступных имён, tooltip, декоративный SVG, 44×44 px, Paper/Graphite, RTL, Shift+Tab/focus-visible и Enter открывают настройки. Chrome проверен на 320/390 px; Firefox — собственная 390 px ширина страницы popup в изолированной вкладке. Реальный устаревший popup Chrome сохранил новый model/theme/instructions после смены target; actual background Firefox проверен тем же merge-контрактом. В первой проверке Chrome URL активной собственной вкладки оказался скрыт API: тест исправлен на сравнение известных tab IDs с явным переключением popup → options; права расширения не расширены.

Подписка: по 8 групп PASS в каждом браузере. В каждом 1 340/1 340 фрагментов, 84 fixture Responses requests, ошибок 0; повтор 1 340 из кэша / 0 новых запросов. Незавершённый ответ отклонён с LGT-response-completion, исходный DOM и кэш сохранены, pending=0. Выбранный gpt-6-luna и strict schema подтверждены fixture; это не live inference.

ZIP Chrome — 440 832 bytes, Firefox — 440 918 bytes. Оба manifest=0.4.5; все 28 файлов каждого ZIP побайтно через SHA-256 совпадают с проверенной build directory. Mozilla addons-linter: errors=0, notices=0, warnings=0. Firefox ZIP не подписан.

## Ресурсы и свидетельства

.cache до, между и после браузерных прогонов: 5 652 files / 203 426 930 bytes; установка зависимостей не выполнялась, чужие процессы/кэш и WI-011 не затронуты. Source duplicates=0, suspicious=0. Последний Firefox subscription runtime: 12 собственных процессов / 1 379 880 960 bytes working set → 0, profileRemoved=true; остальные Firefox прогоны также имеют remainingOwnedProcesses=0. Chrome contexts и собственные profiles закрыты. Оставшихся QA/watch процессов=0. Снимки свободной RAM и размеров каталогов — наблюдение, не доказательство отсутствия любых утечек.

Свидетельства: `test-results/linguisty-smoke/observations.json`, `test-results/linguisty-firefox/observations.json`, `test-results/linguisty-rebrand/{observations.json,firefox/observations.json}`, `test-results/linguisty-subscription-translation/{chrome,firefox}.json`, `test-results/linguisty-popup-regression/{hygiene-before-pack,hygiene-final}.json`. Снимки: `test-results/linguisty-rebrand/popup-light.png`, `popup-gear-en-light.png`, `popup-gear-ar-light.png` и Firefox counterparts.

## Ограничения

Локальные ответы API и подписки проверяют протокол и работу расширения; live Luna 6, реальный вход/план ChatGPT и языковая точность не проверяются. Chrome native host permission dialog и точная геометрия popup, открытого кнопкой toolbar, остаются отдельными ручными проверками. Firefox пакет не подписан; публикация и установка из магазина не выполнялись. Нет утверждения об отсутствии всех возможных багов или утечек памяти.
