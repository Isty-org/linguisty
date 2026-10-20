# WI-037: Жизнь фона во время ограниченного запроса

- Kind: `fix`
- Canon action: `none`

## Outcome

Долгий разрешённый batch не теряется из-за выгрузки Firefox event page; активность удерживается только на время конечного запроса и освобождается при completion/cancel/dispose.

## Specs

- Governing: `spec://modules/platform/INFRA-001-extension#runtime`
- Governing: `spec://common/PROP-002-quality#resources`
- Constraint: `spec://modules/platform/INFRA-001-extension#recovery`

## Scope

- Assigned paths: `src/background/controller.ts`, `src/background/requestActivity.ts` при необходимости, `tests/background/**`, `tests/e2e/long-batch.test.mjs`, этот WI; исполнитель тот же, что WI-033.
- In: доказанный background unload во время pending fetch, ограниченная активность только при запросах, 40s late-headers/body regression Firefox, совместимость Chrome.
- Out: постоянный polling/keepalive, расширение permissions, физическое предотвращение browser crash, canon/build/dependencies/BOARD/WAL.
- Related: WI-033; WI-034 завершён, его изменения recovery сохраняются.

## Acceptance

- [x] Зафиксирован исходный unload около30s и socket close при requestTimeout120s.
- [x] 40s Firefox response проходит на неизменённом production package без подмены early-headers вместо исходного сценария.
- [x] Активность coalesced и bounded; нет timer/listener/port после завершения, abort, timeout, dispose или отсутствия запросов.
- [x] Chrome совместимость и meaningful regression tests проходят; координатор проверил собранный 0.4.9 на обеих платформах.

## Result

Исходный Firefox157.0.1 на пакете 0.4.8: background unload start30130ms, stop30131ms, socket close30132ms. Тестовый requestTimeout120000 подтверждён.

Было → стало: Firefox event page выгружался во время допустимого долгого запроса → `RequestActivity` объединяет активные TRANSLATE_BATCH / TEST_CONNECTION / LIST_MODELS вокруг одного 20 s таймера, вызывающего `runtime.getPlatformInfo()`. Это parent-process API в Firefox, сбрасывающий idle timer; Chrome документирует его для конечных длительных операций. Ответ API отбрасывается, storage/permissions/ports не добавлены. Параллельные операции используют общий таймер; следующий вызов API не создаётся, пока предыдущий не завершился. Короткие операции не вызывают API активности вовсе.

Hard bound обеспечен production `activeRequest`: helper получает только результат существующего `abortable(operation, controller, timeoutMs)`, а не необработанный provider Promise. Предел batch — `batchTimeoutMs` (до 300 000 ms), UI provider action — `requestTimeoutMs` (до 120 000 ms). Даже provider, игнорирующий AbortSignal и остающийся pending, не удерживает lease после deadline. Abort синхронно освобождает listener/lease; settlement освобождает в `finally`; dispose немедленно снимает все leases до storage cleanup. Нет таймера при нуле запросов и после dispose. Recovery WI-034 и callback-based onMessage сохранены.

Проверки исходников: `npx tsc --noEmit` PASS; eslint изменённых исходников/тестов PASS; `npx vitest run tests/background --maxWorkers=2` — 8 файлов / 94 теста PASS, включая 13 новых lifecycle regression cases. Проверены обе схемы браузера, coalescing batch/UI/duplicate batch, completion, provider rejection, cancel/original/tab close/dispose, batch hard deadline, оба UI deadlines, settings cancellation, hung/rejected activity API, отсутствие возобновления при позднем ответе, снятие abort listener. `node --check tests/e2e/long-batch.test.mjs` PASS.

Browser fixture сохраняет исходные 40 s без HTTP headers/body. Добавлена проверка отсутствия background shutdown до ответа и естественной выгрузки после завершения без опроса через API расширения. Наблюдение использует только browser-owned lifecycle events/state. Координатор собрал 0.4.9 и выполнил `node --test tests/e2e/long-batch.test.mjs`: 2/2 PASS (Chrome 41 805 ms, Firefox 77 865 ms вместе с ожиданием idle). Firefox завершил перевод через 40 245 ms, единственный запрос получил полный mock ответ через 40 052 ms и закрылся на 40 053 ms. Во время запроса не было `shutdown-background-script`; Firefox самостоятельно остановил фон на 70 402 ms, через 30 236 ms после перевода. Cleanup подтвердил `pendingTimers=0`, `profileRemoved=true`, `remainingOwnedProcesses=0`, `ownedMemoryAfterBytes=0`. Журнал: `test-results/coordination-2026-10-12/long-batch-0.4.9.txt`.

Координатор также сообщил: полный suite 780 unit PASS, typecheck/lint PASS, native 15 PASS, обе production сборки и manifests PASS. Полный Chrome/Firefox smoke на момент этой записи ещё выполняется координатором; его результат не заявлен.

Ресурсы после профильных тестов: `.cache` 5 652 файла / 203 426 930 B, без изменения относительно предыдущего cleanup; свободная RAM 12 280 244 KiB. По одному `requestActivity.ts` и `requestActivity.test.ts`, временных копий/своих browser/watch процессов не создано; чужой кэш не удалялся.

Официальные основания механизма: [Chrome — finite service worker lifetime extension](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers), [Firefox parent API calls reset idle](https://searchfox.org/firefox-main/source/toolkit/components/extensions/ExtensionParent.sys.mjs), [Firefox runtime.getPlatformInfo implementation](https://searchfox.org/firefox-main/source/toolkit/components/extensions/parent/ext-runtime.js). Browser run 0.4.9 выше подтвердил требуемое поведение на Firefox 157.0.1.

Приёмка координатора 2026-10-13: полный Chrome smoke 14/14, Firefox 14/14, mock ChatGPT Chrome PASS / Firefox 8 PASS; Astra закрыла A1–A3 и WI-037 без новых замечаний. Финальное evidence: docs/QA-2026-10-13.md.
