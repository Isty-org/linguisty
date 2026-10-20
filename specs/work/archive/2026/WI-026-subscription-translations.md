# WI-026: Корректный перевод через подписку ChatGPT

- Kind: `fix`
- Canon action: `direct-edit`

## Outcome

Перевод через подписку запрашивает строгий JSON и читает финальный ответ Responses без промежуточных пояснений; отказ сообщает безопасную причину. Причина конкретного живого сбоя не объявляется установленной без исходного ответа.

## Specs

- Governing: `spec://modules/platform/INFRA-004-codex-connection#requests`
- Governing: `spec://modules/translation/FEAT-001-engine#validation`
- Governing: `spec://modules/platform/INFRA-001-extension#build`
- Affected: `spec://modules/platform/INFRA-004-codex-connection#requests`
- Constraint: `spec://modules/platform/INFRA-004-codex-connection#resources`
- Constraint: `spec://common/PROP-002-quality#checks`

## Scope

- In: Responses text.format, final_answer/commentary, SSE framing, безопасные коды отказа перевода, regression/lifecycle tests, Chrome/Firefox smoke, обе сборки и пакеты.
- Out: чтение пользовательских токенов/сырых ответов, изменение общего parser/cache, платные запросы, подмена выбранной модели.

## Acceptance

- [x] Тесты до исправления воспроизводят отсутствие schema и смешение commentary с правильным JSON.
- [x] Запрос содержит общую строгую schema в формате Responses; финальный ответ без phase совместим, commentary не смешивается с переводом.
- [x] Незавершённые/ошибочные/refusal/oversized ответы не принимаются и не попадают в кэш; причины ограничены фиксированным списком.
- [x] Typecheck/lint, осмысленные тесты, обе сборки, manifest/secret/resource checks и браузерный сценарий пройдены.
- [x] Готовы обновлённые пакеты; живой сценарий и доступность выбранной пользователем модели описаны по фактам.

## Dependencies

- Related: `WI-022`, `WI-025`

## Result

Было → стало: prompt-only запрос и склейка всех assistant messages → общая strict schema в Responses text.format и отделение commentary от final_answer; SSE только LF/CRLF → LF/CRLF/CR через произвольные chunks. Общая ошибка → allowlisted LGT-response/translation код, сохранённый через port, safeError, progress и локализацию, без provider body или исходного текста. Запрос сохраняет выбранную пользователем Luna 6. Parser/cache не изменены; malformed/partial/refusal/oversized ответы не становятся успехом.

Три регрессии до правки — FAIL, после — PASS. Проверки 2026-10-09: typecheck/lint, 702 Vitest tests / 47 files, 15 Native fixtures, 9 manifest/hygiene tests, production builds/ZIP обеих платформ, manifest/secret/resource checks. Mozilla linter: 0 errors/notices/warnings. Внутренние manifest версии ZIP отдельно подтверждены как 0.4.4; исправлен оставшийся manifest version override 0.4.3. Chrome/Firefox: 28 файлов, 1 141 227 / 1 141 390 bytes до сжатия, ZIP 440 489 / 440 574 bytes.

Chromium 152.0.7977.8 и Firefox 157.0.1: по 8 групп PASS на неизменённых пакетах; в каждом 1 340/1 340 узлов, 84 fixture запроса, ошибок 0; повтор 1 340 из кэша / 0 новых запросов. Незавершённый ответ отклонён с LGT-response-completion, исходный DOM и кэш сохранены, pending 0. Auth/callback, 16 языков, secret boundary и reuse вкладки также проверены.

Контроль ресурсов: .cache до/между/после 5 652 files / 203 426 930 bytes; новых source duplicates/suspicious=0. Firefox освободил 13 своих процессов / 1 276 989 440 bytes working set, profile removed=true, remainingOwnedProcesses=0; Chrome context/profile закрыты. Оставшихся QA/watch процессов 0. Чужие процессы/кэш сохранены, установка зависимостей не выполнялась. Общий UI chunk 608 946 bytes остаётся в TD-002. Свидетельства: test-results/linguisty-subscription-translation/{chrome,firefox,hygiene-final}.json и docs/QA-SUBSCRIPTION.md.

Реальный inference Luna 6 и исходный ответ 22 ошибок не получены: причина конкретного пользовательского сбоя остаётся неподтверждённой. Исправления доказаны отдельно; новая сборка и безопасная диагностика готовы к повторной пользовательской проверке. Подпись Firefox и публикация не выполнялись.
