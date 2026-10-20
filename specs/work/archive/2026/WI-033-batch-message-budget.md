# WI-033: Согласовать transport timeout с бюджетом batch

- Kind: `fix`
- Canon action: `none`

## Outcome

Устранить подтверждённый аудитом WI-032 преждевременный timeout TRANSLATE_BATCH через 35 секунд при допустимом batch budget до 300 секунд.

## Specs

- Governing: `spec://common/PROP-002-quality#resources`
- Governing: `spec://common/PROP-001-contracts#messages`
- Constraint: `spec://modules/page/FEAT-002-page-translation#root`

## Scope

- Assigned paths: `src/shared/messaging.ts`, `src/content/controller.ts`, `entrypoints/translate.ts`, `src/ui/Options.tsx`, `tests/ui/**`, `tests/content/**`, `tests/e2e/long-batch.test.mjs`, этот WI.
- In: конечный transport deadline, согласованный с batch budget; abort, stale replies, timers; regression реального sendMessage в content path.
- Out: contracts.ts, изменение resource canon, прочий UI, background recovery, provider diagnostics, build/dependencies/docs/BOARD/WAL.

## Acceptance

- [x] Воспроизведён timeout после 35 секунд с допустимым долгим batch.
- [x] Долгий успешный batch завершается; зависший batch имеет конечный согласованный deadline.
- [x] Cancel/restore/dispose прекращают ожидание и освобождают timers/listeners; side effects не retry автоматически.
- [x] Профильные regression tests проходят; Result содержит было → стало и команды.
- [x] Проверены таймауты TEST_CONNECTION/LIST_MODELS и long-node parts; targeted browser long-batch сценарий пройден на Chrome и Firefox без платного API.

## Result

Было → стало: реальный content `runtimeSendMessage(TRANSLATE_BATCH)` использовал 35 000 ms при допустимом watchdog `batchTimeoutMs(requestTimeoutMs)+5 000` (до 305 000 ms) → каждый batch и каждая часть длинного узла передают в shared transport тот же конечный deadline и AbortSignal своей работы. При cancel, возврате оригинала, новом запуске, навигации и dispose сигнал прерывает ожидание и очищает transport timer; поздний ответ не меняет DOM/state. Синхронный путь `entrypoints/translate.ts` только вызывает bootstrap, исправление внесено в используемый им production default transport. Общие короткие лимиты чтения/команд не расширены. TEST_CONNECTION и LIST_MODELS получают timeout не меньше разрешённого provider budget плюс 5 s, до жёсткого предела 305 s.

До изменения новый `tests/content/batch-transport.test.ts` на настоящих `createPageController` и `sendMessage`, с mock только `wxt/browser`, провалил сценарии успешного ответа на 40 s, первой части длинного узла и очистки таймера после cancel/original/dispose: 5 failures / 6 tests. После изменения все 6 проходят; ожидание одного прежнего теста обновлено согласно требованию прерывать unfinished work при возврате оригинала. Сценарий `tests/e2e/long-batch.test.mjs` подготовлен для обеих платформ: Chrome использует изолированный профиль и задержанный mock fetch в service worker; Firefox использует существующий `firefox-runtime.mjs`, временно установленный пакет в изолированном профиле, штатный optional-host prompt и отдельный ограниченный loopback HTTP mock с ответом через 40 s. Профиль и mock server закрываются и при ошибке проверки. Оба варианта обходятся без платного API и пользовательского входа; общий `local-server.mjs` и runtime helpers не изменялись.

Проверки production-правок: `tsc --noEmit` PASS; eslint назначенных исходников и тестов PASS; `vitest run tests/content tests/ui/messaging.test.ts tests/ui/Options.test.tsx --maxWorkers=2` — 9 файлов / 114 тестов PASS. Координатор сообщил о полном suite 780 unit PASS, typecheck/lint PASS, native 15 PASS, сборках обеих платформ и manifest checks PASS на 0.4.9. Статус browser long-batch приведён ниже. Live OpenAI/OpenRouter и реальный вход не проверялись.

### Firefox follow-up — 2026-10-13

Уточнение прежнего статуса браузерных проверок: координатор сообщил Chrome long-batch PASS на свежем 0.4.8 (41 255 ms). По его поручению исполнитель запускал только `node --test --test-name-pattern="built Firefox" tests/e2e/long-batch.test.mjs` на том же пакете. Firefox 157.0.1 FAIL: loopback-запрос закрывается до ответа. Было → стало в диагностике теста: только `Bonjour` после ожидания → проверка сохранённых настроек, безопасные счётчики/тайминги запроса и наблюдение браузерных lifecycle events. Во время ожидания тест не вызывает API расширения, способный сбросить idle timer. HTTP-заголовки и тело по-прежнему полностью задержаны на 40 s; ранние заголовки не вводились.

Последний воспроизводимый результат: `requestTimeoutMs=120000`, `streaming=false`, provider `openai-compatible`; один запрос начался на 33 ms; событие Firefox `background-script-suspend` на 30 130 ms, `shutdown-background-script` на 30 131 ms, HTTP close без ответа на 30 132 ms, новый `background-script-started` на 30 149 ms. Итог страницы: `error`, `failed=1`, `inFlight=0`, `INTERNAL_ERROR`. Это подтверждённая выгрузка Firefox event page во время ожидающего запроса. В production `entrypoints/background.ts` и свежем bundle отсутствует `onSuspend`-вызов `dispose`; причина не в таком локальном обработчике. Предыдущий прогон без lifecycle events также закрывал единственный запрос примерно на 30 s. Тест теперь завершается сразу при преждевременном закрытии запроса, сохраняя причины и тайминги.

Координатор расширил назначение отдельным WI-037 (`specs/work/WI-037-active-request-lifetime.md`): production-исправление lifetime внесено и профильные проверки исходников пройдены. На собранном 0.4.9 targeted `node --test tests/e2e/long-batch.test.mjs` прошёл 2/2: Chrome 41 805 ms; Firefox перевёл за 40 245 ms при mock ответе на 40 052 ms. Исходный Firefox FAIL на 0.4.8 сохраняется как baseline. Подробные lifecycle и cleanup показатели находятся в WI-037 и `test-results/coordination-2026-10-12/long-batch-0.4.9.txt`.

Источники диагностики: [Mozilla background lifecycle implementation](https://searchfox.org/firefox-main/source/toolkit/components/extensions/parent/ext-backgroundPage.js), [MDN background scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts), [Mozilla Bug 1851373](https://bugzilla.mozilla.org/show_bug.cgi?id=1851373). Старый bug сам по себе не используется как доказательство поведения Firefox 157; доказательство — события текущего браузерного прогона.

Ресурсы: в ходе последнего диагностического прогона `.cache` — 5 807 файлов / 266 489 616 B, свободная RAM — 11 095 780 KiB; после cleanup — 5 652 файла / 203 426 930 B (совпадает с исходным размером кэша до browser follow-up), свободная RAM — 12 292 924 KiB. Runtime cleanup каждого прогона проверяет отсутствие захваченных собственных Firefox/geckodriver PID и удаление своего профиля; оба последних прогона дошли до исходной assertion ошибки без cleanup failure. Чужие Firefox-процессы и оставшийся чужой профиль не удалялись. Файл long-batch в e2e один, дополнительных копий не создавалось.

Приёмка координатора 2026-10-13: полный Chrome smoke 14/14, Firefox 14/14, mock ChatGPT Chrome PASS / Firefox 8 PASS; Astra закрыла A1–A3 и WI-037 без новых замечаний. Финальное evidence: docs/QA-2026-10-13.md.
