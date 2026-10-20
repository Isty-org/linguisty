---
status: active
---

# INFRA-001: Платформы и фоновая координация {#root}

Одна кодовая база выпускает самостоятельные сборки Linguisty для Chrome и Firefox. Фон принимает команды, защищает ключи и координирует вкладки.

## Управление и границы {#governing}

`spec://common/PROP-000-product#scope.in`, `spec://common/PROP-001-contracts#messages`, `spec://common/PROP-002-quality#resources`. Входит packaging, MV3, messaging, permissions, tab/session lifecycle. Магазинная публикация и подпись Firefox вне этого прохода.

## Окружения и сборка {#build}

Node 22+, WXT 0.21.x, React, TypeScript. WXT browser-specific manifest: Chrome service_worker; Firefox background scripts/event page. Минимум Firefox 142/Chrome 120. Built-in data consent доступен с Firefox desktop 140/Android 142; общий gecko floor 142 устраняет предупреждение Mozilla linter без gecko_android и без заявления поддержки Android. Firefox 140–141 больше не входят в диапазон установки. Required websiteContent, browsingActivity и authenticationInfo отражают отправку текста, ограниченного доменного контекста и API-ключа только выбранному пользователем сервису. Флаг none был бы неверным: отсутствие нашего backend/telemetry не означает отсутствие передачи данных провайдеру. Popup и options без inline исполняемых скриптов; CSP только self. Отдельные `.output/chrome-mv3`, `.output/firefox-mv3` и zip. Firefox gecko ID — `linguisty@isty.local`; это локальный технический идентификатор, не адрес поддержки.

UI использует React nodes и текстовые children. Production-сборка отключает два unused raw-HTML setter React DOM (обычный/custom element): ненулевой dangerouslySetInnerHTML вызывает явную ошибку вместо разбора HTML. Никакого динамического HTML sanitizer или альтернативного HTML parser для этого не добавляется. Build guard проверяет ожидаемую форму upstream кода и останавливает сборку при изменении; исходная dependency на диске не модифицируется. Константное создание инертного script element внутри React сохраняется. Обновление React требует проверки guard и браузерного smoke.

## Разрешения {#permissions}

Для CLI объявлен optional nativeMessaging. Только пользовательское действие options/popup запрашивает его; перед вызовом CLI фон проверяет grant. Content не имеет прямого native канала. Одноразовая регистрация системного host закреплена в spec://modules/platform/INFRA-003-local-cli#acceptance.

Обязательные activeTab, scripting, storage и declarativeNetRequestWithHostAccess для собственного Codex callback. DNR не получает host access автоматически: доступ остаётся optional и запрашивается кликом только для OpenAI/loopback по INFRA-004. Нет обязательного `<all_urls>` или постоянного content script. `entrypoints/translate.ts` — unlisted script, injected по пользовательской команде. API origins запрашиваются как optional host permissions из options при пользовательском жесте. Произвольные HTTPS endpoints разрешены; HTTP разрешён только localhost/127.0.0.1/[::1] для локального gateway. URL с credentials/query/hash отклоняется. Запрос никогда не следует внешнему redirect с Authorization: redirect error.

## Runtime {#runtime}

Listener регистрируется синхронно. UI sender проверяется по runtime.id и собственной extension URL; content — runtime.id, tabId, frameId=0, sessionId. GET_SETTINGS возвращает только настройки; secret status — boolean/mode. START injects translate.js один раз и sends CONTENT_COMMAND.start. GET_TAB_STATE после закрытия popup восстанавливает прогресс. URL chrome://, about:, extension pages и закрытые вкладки возвращают RESTRICTED_PAGE/безопасную ошибку. Провайдерный origin проверяется перед запросом. Tab close/nav отменяет очередь и удаляет snapshot; page script отдельно отслеживает SPA и изменившийся DOM.

Фоновый deadline TRANSLATE_BATCH охватывает ограниченные retries и адаптивное дробление по PROP-002. Per-attempt timeout провайдера не обрывает весь batch раньше восстановления. При общем deadline освобождаются batch, preview и abort listeners; UI-команды сохраняют отдельные короткие deadlines.

## Состояние и восстановление {#recovery}

Background пересылает cumulative preview текущей batch через CONTENT_COMMAND.batch-progress. Один pending snapshot и один cancelable 100 ms timer на batch; отправка последовательна, без неограниченной очереди frames. После settlement, abort, tab close или dispose pending data очищаются. Preview не хранится в session snapshots; восстановленная сессия повторяет только незавершённую batch.

В browser.storage.session лежат bounded snapshots settings/sessionId/tabId и safe progress. Ключ хранится отдельным секретным storage helper. После остановки worker фон восстанавливает session settings перед обработкой content batch; in-flight запрос при остановке может быть потерян, но UI не висит бессрочно и страницу можно повторно перевести. Snapshot не содержит HTML/тексты. Откат — удалить unpacked/temp install; настройки не мигрируются разрушительно.

Настройки, ключи и кэш не ждут восстановления tab snapshots. Отказ session read/write не блокирует конфигурацию; page/session команды получают безопасную ошибку восстановления и могут повторить его при следующем запросе. Snapshot restore ограничен временем; поздний результат отменённой попытки не заменяет актуальные sessions. Нет бесконечного списка ожидающих сообщений.

## Ошибки и наблюдаемость {#errors}

Проверка типов payload, permissions denial, injection unavailable, API key missing, invalid settings, background wake/restart, stale session. Логи не содержат secrets/provider body. Никакой телеметрии. Проверяемые ошибки возвращаются ApiResult.

Background подключает provider reporter к protected локальному журналу. Один финальный сетевой сбой создаёт одну запись даже при нескольких engine consumers. GET_ERROR_LOG/CLEAR_ERROR_LOG проверяют собственную extension URL отправителя и не зависят от session recovery. Диагностика не попадает в tab state, snapshots или content replies.

## Трассировка и готовность {#acceptance}

`@spec` на background controller, entrypoint и manifest config. Оба production manifest валидны; UI→фон→контент→фон работает; key читает только фон; закрытие вкладки очищает состояние; Chrome SW и Firefox event page не смешаны; сборки не содержат development server.

## Связи и история {#changelog}

- 2026-10-08: возврат Codex OAuth через временное правило собственной вкладки; declarativeNetRequestWithHostAccess требуется при установке, host-доступ запрашивается кнопкой.

- 2026-10-08: optional nativeMessaging и keyless CLI branch в фоновом controller.
Related: `spec://modules/storage/INFRA-002-local-data#secrets`, `spec://modules/page/FEAT-002-page-translation#sessions`.
- 2026-10-07: обе платформы первой версии и security/runtime boundary.
- 2026-10-07: уточнён Firefox минимум 140 и фактическая provider data transmission по Mozilla built-in consent documentation.
- 2026-10-07: WI-011 — общий Firefox floor 142 без Android support и production guard неиспользуемых React raw-HTML setters для чистой Mozilla validation.
- 2026-10-08: конфигурация независима от восстановления snapshots, восстановление ограничено и допускает повторную попытку.
- 2026-10-08: provider reporter и UI-only локальный журнал diagnostics.
- 2026-10-08: ограниченная последовательная пересылка preview и освобождение данных при завершении batch.
- 2026-10-08: общий bounded deadline batch учитывает provider retries и последовательное recovery.

