# WI-035: Исключить фрагменты страницы из постоянной API диагностики

- Kind: `fix`
- Canon action: `none`

## Outcome

Устранить подтверждённое аудитом WI-032 сохранение короткого фрагмента страницы в linguisty.apiErrors через provider message.

## Specs

- Governing: `spec://modules/translation/FEAT-001-engine#errors`
- Governing: `spec://modules/storage/INFRA-002-local-data#contracts`
- Constraint: `spec://common/PROP-000-product#invariants`

## Scope

- Assigned paths: `src/providers/diagnostics.ts`, `src/providers/request.ts`, `src/providers/stream.ts`, `tests/providers/diagnostics.test.ts`, `tests/providers/contract.test.ts`, `tests/providers/stream.test.ts`, `src/storage/errorLog.ts`, `tests/storage/errorLog.test.ts`, `tests/e2e/journal-scenario.mjs`, `tests/e2e/local-server.mjs`, этот WI.
- In: безопасная диагностика partial echoes/encoded echoes, сквозная проверка до persisted journal, bounded processing.
- Out: contracts.ts, background, content, UI, прочие storage modules, dependencies/build/docs/BOARD/WAL.

## Acceptance

- [x] Регрессия воспроизводит сохранение синтетического имени/короткого фрагмента до исправления.
- [x] Короткие partial/encoded echoes, ключи и текст запроса не сохраняются в journal.
- [x] Сохраняются полезные безопасные codes/status/attempts; нельзя обещать исчерпывающую защиту эвристикой длины.
- [x] Сквозные tests до ErrorJournal/read storage проходят; лимиты памяти/длины сохраняются.
- [x] Result содержит было → стало, команды и все ограничения.

## Result

Было → стало: provider `message`, `metadata.raw.error.message`, request ID и произвольная model попадали в диагностическую запись; тест до исправления у обоих API-провайдеров сохранил `John-Smith / 250 EUR`, `John%20Smith` и `John.Smith-250` в `linguisty.apiErrors` (2 новых теста падали, 19 прежних проходили). Теперь provider передаёт только источник, HTTP status и code/type из конечного словаря машинных значений; модель берётся только из собственного нормализованного ProviderConfig после проверки формата и отсутствия ключа. Storage повторно очищает запись при append/list, в том числе прежние свободные поля, и перезаписывает legacy-данные перед выдачей UI/clipboard. PublicError не менялся.

Проверки: `vitest run tests/providers/diagnostics.test.ts tests/providers/contract.test.ts tests/providers/stream.test.ts tests/storage/errorLog.test.ts --maxWorkers=2` — 158/158; `tsc --noEmit` — успешно; целевой `eslint` — успешно; `node --check` для обоих изменённых e2e файлов — успешно. Loopback-мок `journal-echo` проверен локальным HTTP-запросом: HTTP 400, короткий фрагмент страницы и URL-кодированная форма в ответе, активных запросов после ответа 0. Обновлён браузерный сценарий: GET_ERROR_LOG, UI и clipboard проверяют отсутствие короткого/кодированного эха, суммы и ключа; его запуск на свежей сборке выполняет координатор.

Ограничения: старые байты в `browser.storage.local` удаляются при следующем `list` или `append`, не до обращения к журналу. Синтаксическая проверка legacy model не доказывает её происхождение; новые API-записи получают model только из настроек запроса. Реальный OpenRouter/платный запрос и браузерный запуск в этом проходе не выполнялись. Изменение канона выполнено координатором отдельно в WI-036; этот WI меняет реализацию и тесты.
