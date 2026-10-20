# Linguisty — проверки подписки ChatGPT

Автор разработки: Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI-инструменты и фактические проверки указаны ниже. См. [AUTHORS](../AUTHORS.md).

## Завершённый текст SSE в 0.4.6 — 2026-10-09

Пользователь сообщил LGT-response-content. Доказан отдельный reader bug: final_answer из response.output_item.done терялся при пустом completed.response.output. Регрессия до изменения воспроизвела точный код; после изменения PASS. Реальный ответ пользователя не прочитан, поэтому совпадение причины не утверждается.

Было → стало: reader использовал только последний aggregate output → сохраняет только завершённый text по output_index и подтверждает успех response.completed/status=completed. Повторы и aggregate объединяются без дублей; противоречия отклоняются. Commentary, raw deltas, refusal, incomplete и failed не становятся переводом. Прежний parser/cache и выбранный gpt-6-luna сохранены. Дополнительные безопасные причины empty/commentary/output/message/phase/status/part/conflict проходят port, progress и 16 локализаций без provider body/claims/токенов/текста страницы.

Typecheck/lint и 739 Vitest tests / 47 files PASS; максимум 2 workers. По 28 production files / 24 referenced assets, 1 143 444 / 1 143 607 bytes до сжатия. Manifest/secret/resource checks и 9 manifest/hygiene tests PASS. Общий UI chunk 609 125 bytes — прежний открытый TD-002.

Chromium 152.0.7977.8 / Firefox 157.0.1: по 8 групп PASS на неизменённом production package. Новая fixture отправляет commentary, reasoning и final_answer как output_item.done, terminal output пустой. В каждом браузере 1 340/1 340 узлов / 84 запросa, ошибок 0; повтор 1 340 из кэша / 0 новых запросов. Незавершённый и пустой completed ответы отклонены с LGT-response-completion / LGT-response-empty, исходный DOM и cache entries сохранены, pending=0.

ZIP Chrome 441 258 bytes, Firefox 441 344 bytes; внутренний manifest=0.4.6, все 28 файлов каждого архива совпадают через SHA-256 с проверенной build directory. Mozilla: 0 errors/notices/warnings. Sources ZIP исключает кэш и временные test-results. Подпись/публикация не выполнялись.

.cache до/между/после: 5 652 files / 203 426 930 bytes; source duplicates/suspicious=0; оставшихся QA/watch процессов=0. Последний Firefox runtime: 13 собственных процессов / 1 368 829 952 bytes working set → 0, profileRemoved=true. Chrome context/profile закрыты; snapshot свободной RAM после проверок 14 264 799 232 bytes. Это наблюдение и lifecycle evidence, не обещание отсутствия всех возможных утечек. Чужой кэш/процессы и WI-011 сохранены.

Свидетельства: `test-results/linguisty-response-stream/{chrome,firefox,hygiene-middle,hygiene-final}.json`. Live ответ Luna 6 и причина конкретного пользовательского LGT-response-content остаются неподтверждёнными; исправленная потеря completed stream message доказана отдельным тестом. Chrome native host prompt/toolbar geometry и Firefox signed install отдельно не проверены.

## Повторная проверка в 0.4.5 — 2026-10-09

После замены кнопки настроек шестерёнкой и защиты модели от старой формы popup повторены оба subscription suites: по 8 групп PASS, 1 340/1 340 фрагментов и 84 fixture requests в каждом браузере, повтор полностью из кэша, незавершённый ответ отклонён без записи ошибки в кэш. Live Luna 6 остаётся непроверенной. Пакеты и расширенный regression smoke — [QA-POPUP](QA-POPUP.md); ниже сохранены результаты предыдущего исправления протокола.

## Перевод через подписку в 0.4.4 — 2026-10-09

Было: формат перевода задавался только prompt; Responses reader склеивал commentary и финальный JSON, не поддерживал CR-only SSE; общий отказ скрывал этап. Стало: запрос передаёт общую строгую schema через Responses text.format, reader исключает commentary и принимает финальный ответ после response.completed, поддерживает LF/CRLF/CR; popup сохраняет только фиксированный безопасный LGT-код. Выбранная Luna 6 не заменяется. Общие prompt/parser/cache не ослаблены.

До изменения три регрессии воспроизвели отсутствие schema, INVALID_MODEL_RESPONSE при commentary + правильном JSON и отказ CR-only потока; после изменения прошли. Существующие модели без phase совместимы; commentary-only, неизвестная phase, незавершённый message, refusal, неправильный JSON и превышение 1 MiB отклоняются. Диагностика не передаёт body, claims, токены или исходный текст.

Проверки:

- Typecheck и lint — PASS; Vitest — 702 PASS / 47 файлов, максимум 2 worker; Native fixture tests — 15 PASS; manifest/hygiene checker tests — 9 PASS.
- Обе production сборки и manifest/secret/resource checks — PASS. Версия внутри обоих ZIP отдельно проверена: 0.4.4. Chrome — 28 файлов / 1 141 227 bytes до сжатия, ZIP 440 489 bytes; Firefox — 28 / 1 141 390 bytes, ZIP 440 574 bytes. Mozilla Add-ons Linter — 0 errors/notices/warnings для пакета 0.4.4.
- Chromium 152.0.7977.8 и Firefox 157.0.1 — по 8 групп PASS на неизменённых пакетах: 16 языков, вход/callback/port, безопасный отказ, повторное использование вкладки и перевод. Responses fixture требует model=gpt-6-luna и строгую schema, возвращает промежуточное сообщение и final_answer.
- В каждом браузере: 1 340 из 1 340 узлов, 84 Responses fixture запроса, ошибок 0; повтор — 1 340 из кэша и 0 новых запросов. Отдельный незавершённый ответ: переводов 0, ошибка 1, pending 0, оригинал сохранён, кэш не изменён, сообщение заканчивается `[LGT-response-completion]`.

Свидетельства: `test-results/linguisty-subscription-translation/{chrome,firefox}.json`, screenshots и `hygiene-final.json`. Контроль до/между/после: `.cache` 5 652 files / 203 426 930 bytes; новых дублей и suspicious source artifacts нет; зависимости не устанавливались. После финального Firefox run освобождены 13 собственных процессов / 1 276 989 440 bytes working set, временный профиль удалён; оставшихся собственных QA/watch процессов 0. Chrome закрыл собственный context и удалил профиль. Снимки RAM не заменяют проверку lifecycle; тесты проверяют освобождение port/listener/timer/flight state. Предупреждение об общем UI chunk 608 946 bytes остаётся в TD-002.

Реальная Luna 6, подписка пользователя и исходный ответ его 22 ошибок не проверены: все inference ответы локально подставлены. Найденные ошибки реализации доказаны тестами, но не объявляются точной причиной живого сбоя без ответа провайдера. Следующий шаг пользователя: обновить расширение до 0.4.4, подключить ChatGPT заново и повторить перевод; при отказе сообщить LGT-код. Firefox ZIP не подписан, магазинная публикация не выполнялась.

## Название подписки и 16 языков в 0.4.1

Проверено 2026-10-08. Было: видимый сервис Codex и короткая страница возврата только на английском. Стало: локализованная «Подписка ChatGPT» (English: ChatGPT subscription), кнопка «Подключить ChatGPT», обновлённые заголовки/статусы/ошибки и локализованный возврат после входа. Внутренний provider ID и OAuth-контракт сохранены.

Название соответствует [официальному описанию использования плана ChatGPT в других приложениях](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites). Инструкция: [CODEX-CONNECTION](CODEX-CONNECTION.md).

Проверки:

- TypeScript и ESLint — PASS.
- Vitest — 661 PASS, 46 файлов, максимум 2 worker. Покрыты полнота всех 16 словарей и выбранный/автоматический язык callback, включая RTL и недоступность localStorage.
- Manifest/hygiene checker tests — 8 PASS; обе production сборки и ZIP — 0.4.1. В каждом пакете 28 файлов и 24 связанных ресурса; manifest/секреты/локальные assets — PASS.
- Mozilla Add-ons Linter 10.13.0 — 0 errors, 0 notices, 0 warnings; использован существующий linter, без установки зависимостей.
- Неизменённый пакет Chrome: 6 групп проверок. Все 16 языков в selector/guide/callback, четыре шага, отсутствие имени Codex в новом интерфейсе, ширина 360 px без горизонтального переполнения, Arabic RTL. Затем fixture вход, настоящий собственный callback redirect, проверка сеанса, повторное открытие без дубля, перевод реальных текстовых узлов, повтор из кэша и разделение по аккаунтам, отключение и закрытие вкладки.
- Неизменённый пакет Firefox: 5 групп, включая все 16 языков selector/guide/callback, RTL, отсутствие переполнения, реальные browser permission prompts, fixture вход/redirect, перевод страницы, возврат/повторное открытие и отключение.
- Визуально просмотрены русский и арабский варианты на ширине 360 px. Свидетельства: `test-results/linguisty-subscription/`; версии браузеров и конкретные результаты находятся в `chrome.json` и `firefox.json`.

Кэш и ресурсы проверены между этапами и после основной работы: защищённая `.cache` остаётся 5 652 files / 203 426 930 bytes; source duplicates и suspicious artifacts отсутствуют. Firefox cleanup: собственные процессы 13 → 0, рабочая память 1 445 388 288 → 0 bytes, собственный профиль удалён. Chrome закрыл собственный context и удалил свой временный профиль. Итоговый filesystem/RAM snapshot — `hygiene-final.json`; общий UI chunk 608 410 bytes и предупреждение размера учитываются в TD-002. Callback загружает только компактный shared chunk 11 492 bytes, без общих UI словарей.

OpenAI OAuth/JWKS/models/Responses заменены тестовыми ответами только в тестовой странице. Реальные вход, доступность плана, CORS OpenAI, качество и стоимость ответа, ревью переводов носителями, minimum-version browsers, signed/store install и публикация не проверялись. Ограничения исходного подключения сохранены в [QA-CODEX](QA-CODEX.md); его исторические результаты и снимки не переписаны.

## Исправление возврата Firefox в 0.4.2 — 2026-10-09

Было: callback page разрешала только origin 127.0.0.1, прежняя fixture инициировала переход через API расширения и пропускала проверку web initiator. Стало: добавлен точный https://auth.openai.com/*; Firefox проверяется навигацией с content principal OpenAI, Chrome — отправкой формы с локально подставленной страницы этого origin. OAuth state/tab/PKCE/nonce и границы хранения токенов не менялись.

До изменения manifest Firefox 157.0.1 воспроизвёл отказ: callback=0, token=0, вход не завершился. После изменения тот же сценарий прошёл. Firefox также подтвердил, что чужой домен, поддельный суффикс и HTTP OpenAI не имеют доступа; codex.html/options.html остаются закрыты для сайта OpenAI. Обе неизменённые сборки прошли подключение, port/перевод, очистку правил и отключение; Chrome дополнительно повторил вход другим аккаунтом и проверил разделение кэша. В обоих браузерах проверены 16 языков. Текущие результаты: `test-results/linguisty-subscription/{chrome,firefox}.json`.

Typecheck и lint — PASS; Vitest — 661 тест / 46 файлов; manifest/hygiene tests — 9 PASS; Chrome/Firefox builds и manifest/secret/resource checks — PASS. Сохранено прежнее предупреждение об общем UI chunk 608 410 bytes (TD-002). Firefox освободил 13 собственных процессов и 1 447 309 312 bytes working set; временный профиль удалён. Это контроль завершения теста, не самостоятельное доказательство отсутствия утечек. Кэш до/между проверками остался 5 652 files / 203 426 930 bytes; дубли исходников не найдены.

Mozilla Add-ons Linter: 0 errors, 0 notices, 0 warnings. Собран Firefox ZIP 0.4.2; 28 файлов / 1 137 648 bytes до сжатия. Проверка оставшихся QA browser/watch command lines — 0 процессов. После проверки свободно 17 130 971 136 из 34 282 012 672 bytes RAM; зависимости не устанавливались, чужие кэш/процессы не изменялись.

Настоящий вход в аккаунт пользователя, доступность его подписки, живой token exchange/CORS и ответы модели не проверены. Регрессия проверяет браузерный механизм возврата, а не весь сервис OpenAI.

## Проверка подтверждения и коды отказа в 0.4.3 — 2026-10-09

Было: подписанный ID token с `aud: [clientId]` без `azp` отвергался, хотя такой формат допустим; разные причины сводились к общему сообщению. Стало: единственный audience принимается строкой или массивом, несколько audiences требуют подходящий `azp`, явно чужой `azp` отклоняется. Проверки RS256/JWKS, issuer, nonce, state, времени и subject сохранены. Перед исправлением новый regression test воспроизвёл отказ; после исправления прошёл.

Ошибки собственной страницы показывают фиксированный код `LGT-<этап>-<причина>[-HTTP]`. Коды различают callback/token/discovery/identity/JWKS/refresh/models, не включают provider body, exception text, значения claims, callback URL или credentials. Shared port/PublicError и persistent журнал этими данными не расширены. HTTP error body отменяется без чтения.

Typecheck/lint — PASS; Vitest — 685 тестов / 47 файлов; manifest/hygiene tests — 9 PASS; обе production builds и manifest/secret/resource checks — PASS. Mozilla Add-ons Linter: 0 errors/notices/warnings. Firefox package: 28 файлов / 1 139 383 bytes; Chrome: 28 / 1 139 220 bytes до сжатия. Предупреждение общего UI chunk 608 410 bytes осталось прежним (TD-002).

Неизменённые пакеты прошли по 7 групп проверок в Firefox 157.0.1 и Chromium 152.0.7977.8. В обоих браузерах подписанная fixture теперь использует `aud: [clientId]`. После входа/перевода/отключения Firefox проверяет отказ token HTTP 401 с `[LGT-token-http-401]`, Chrome — неверный nonce с `[LGT-identity-nonce]`. Проверены отсутствие секретов в сообщении, очистка callback rules, неподключённый статус после отказа, 16 языков и повторное использование вкладки. Просмотрены ошибка в тёмной теме Firefox и светлый вариант Chrome 360 px без переполнения. Свидетельства: `test-results/linguisty-subscription/{chrome,firefox}.json`, `*-guide-safe-error.png`.

Промежуточная и финальная проверки: `.cache` 5 652 files / 203 426 930 bytes; дубли исходников отсутствуют. Firefox cleanup освободил 12 собственных процессов / 1 387 491 328 bytes working set, временный профиль удалён; Chrome закрыл собственный context/profile. Зависимости не устанавливались. Итог: QA/watch-процессов 0, свободно 17 973 329 920 из 34 282 012 672 bytes RAM. Финальный контроль ресурсов записан в `hygiene-final.json`; эти снимки не заменяют lifecycle tests и не доказывают отсутствие любых утечек.

Причина именно сообщения пользователя без кода LGT не установлена. Исправленный audience-баг подтверждён отдельно. Настоящие OAuth/token exchange, CORS, доступность аккаунта и ответы модели остаются непроверенными; пользователю нужно повторить вход в 0.4.3 и при отказе сообщить только сообщение с безопасным кодом.
