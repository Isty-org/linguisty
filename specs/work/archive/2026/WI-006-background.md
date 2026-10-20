# WI-006: Фон, permissions и сессии

- Kind: `implement`
- Canon action: `none`

## Outcome

UI и injected page взаимодействуют с безопасным background controller в Chrome и Firefox, state восстанавливается после остановки фона.

## Specs

- Governing: `spec://modules/platform/INFRA-001-extension#root`
- Constraint: `spec://common/PROP-001-contracts#messages`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- In/owned: `src/background/**`, `entrypoints/background.ts`, `tests/background/**`, Result этого WI.
- Out: shared/config/lock, storage/cache/providers/DOM/UI implementations, docs/BOARD/WAL.
- API: registerBackgroundController(); listener sync in defineBackground. Use browser from wxt/browser.
- Dependencies exports: storage loadSettings/saveSettings/normalizeSettings/normalizeBaseUrl; secrets getApiKey(mode)/setApiKey(key,mode)/removeApiKey()/getSecretStatus(mode); cache getTranslationCache(); TranslationEngine(cache,{fetchImpl?}).translate/testConnection/listModels.
- Runtime message source of truth src/shared/contracts.ts. Sender tabId authoritative; injection file translate.js; top frame only. CONTENT_COMMAND payload responds ApiResult<TabTranslationState>.

## Dependencies

- Depends on: WI-002; integration WI-003, WI-004, WI-005.

## Acceptance

- [x] GET/SAVE/TEST/MODELS/CACHE, start/cancel/toggle/status и content batch/progress/session reset handlers implemented.
- [x] Runtime validation и sender isolation отвергают content access к ключам/settings writes и чужим сессиям.
- [x] Only chosen API origin, protected pages, stale batch/abort/tab close/restart tested.
- [x] Safe session snapshot без текстов/ключей, bounded in-flight/concurrency, cleanup.
- [x] Own tests и доступные checks выполнены; Result включает интеграционные ограничения.

## Result

Реализация готова к проверке координатором. Canon action: none; BOARD/WAL/.me, канон, shared contracts, настройки сборки, зависимости и чужие модули исполнитель не менял.

Было → стало: background entrypoint был заглушкой → синхронно регистрирует один controller с runtime/tab listeners; UI и top-frame content взаимодействуют через валидируемые ApiResult и собственные сессии. Приёмку и архивирование выполняет координатор.

Изменённые файлы и экспорты:

- `src/background/controller.ts`: `registerBackgroundController(options?)`, `apiPermissionPattern`, `MAX_API_REQUESTS`; регистрация возвращает ready/handleMessage/resources/dispose для управляемых проверок. Ленивая единичная cache/engine instance. Реализованы все входящие RuntimeMessage; CONTENT_COMMAND/TAB_STATE_CHANGED используются только как исходящие.
- `src/background/validation.ts`: runtime-проекция Settings/TabTranslationState, проверка payload/лимитов/уникальности IDs, безопасные фиксированные PublicError и ограничения защищённых страниц каждого браузера. Ключ максимум 4096 символов, без управляющих символов; неизвестные поля settings/state не возвращаются.
- `src/background/sessions.ts`: bounded registry, storage.session snapshot под `linguisty.tabSessions.v1`, restoration/TTL/coalesced writes/abort/cleanup. Snapshot содержит только tab/session/settings/безопасный progress/documentId/timestamp; ни текстов страницы, ни ProviderConfig/apiKey/promise/controller/batches.
- `entrypoints/background.ts`: registerBackgroundController вызывается синхронно внутри defineBackground.
- `tests/background/{controller.test,validation.test,sessions.test,harness}.ts`: sender/payload/security, origin/permission/key, session/restart/SPA/cancellation и resource regressions.

Поведение и интеграционные формы:

- UI sender: runtime.id + собственный extension URL. Только UI получает settings/secret boolean/cache и выполняет save/remove/test/models/start/cancel/display/status. Content: runtime.id, sender.tab.id, frameId=0, session/documentId; допускаются только собственные batches/progress/BEGIN_PAGE_SESSION, domain сверяется с sender URL. Чужой tab/session/frame/document и поддельный tabId отклоняются до engine.
- Injection `/translate.js` соответствует WXT ScriptPublicPath; target только frameIds:[0]. Существующий page listener проверяется get-state, повторный start не умножает injection/listeners. Ответ CONTENT_COMMAND ожидается как ApiResult<TabTranslationState>; BEGIN_PAGE_SESSION отдаёт `{sessionId, settings}`. TranslationResult сохраняет optional cacheHitIds и исключает дополнительные поля engine.
- API permission проверяется перед start/test/models и каждым batch для выбранных scheme/host. HTTP только localhost/127.0.0.1/[::1], credentials/query/hash запрещены. Match pattern без порта совместим с Firefox; fetch config сохраняет точный origin/port. Background не запрашивает permissions сам. OpenRouter baseUrl фиксирован.
- Settings фиксируются на start; UI test/models могут использовать введённый ключ без сохранения. Save мигрирует ключ перед settings; если settings write отказал, восстанавливаются прежний key/mode. Изменение ключа/mode и удаление прекращают действующие запросы.
- Original aborts pending/in-flight batches, сохраняет session и готовый progress; translated разрешает новые batch той же сессии. Cancel действует и во время preflight до injection. Late replies/cancelled/stale IDs не возвращаются как успешный перевод. Tab close/new document освобождают state и snapshot.
- SPA: onUpdated.url не удаляет session; loading сверяет documentId (fallback — собственный page get-state), поэтому same-document переход сохраняется до BEGIN_PAGE_SESSION. Новый document очищается; поздний complete не прерывает batch новой SPA-сессии. После worker restart settings восстанавливаются до первого batch; потерянный inFlight обнуляется с безопасной ошибкой, без вечного spinner.
- Пределы: 32 snapshots, TTL 8 часов с обновлением по progress; до 4 API операций глобально и настроенная concurrency 1–4 на сессию; до 64 активных runtime сообщений и 4 serial settings mutations. Batch IDs дедуплицируются только in-flight при одинаковом payload; изменённый payload с тем же ID отклоняется. Background deadlines освобождают job/timer/listeners даже при mock provider, игнорирующем abort. Progress writes coalesced; задержанная запись не воскрешает удалённую сессию. dispose удаляет listeners/state, aborts requests и закрывает cache.

Фактические проверки 2026-10-07:

- `node node_modules/vitest/vitest.mjs run tests/background --maxWorkers 2`: **56/56 PASS**, 3 suites; последний запуск 11:09 МСК. Включены 4096/4097 key boundary, exact cacheHitIds forwarding/redaction, original→abort→translated resume, rollback key migration, storage-before-first-batch recovery, SPA URL/loading/complete, полный reload/tab close/preflight cancel, bounds/dedup/expiry/coalescing/dispose.
- `node node_modules/eslint/bin/eslint.js src/background entrypoints/background.ts tests/background`: exit 0, без ошибок.
- `node node_modules/typescript/bin/tsc --noEmit --pretty false`: общий typecheck exit 0 на текущем общем дереве.
- Существующий `test-results/linguisty-smoke/observations.json` QA (10:59 МСК) прочитан: Chromium **9/9 PASS**, включая SPA и observed worker stop → same session → new batch translated; provider максимум 2 concurrent, activeRequests/pendingTimers=0, pageErrors=0, isolated profile/server закрыты. Сам исполнитель новый browser script не создавал и этот smoke не запускал. Последние изменения 4096/cacheHitIds требуют согласованного финального rerun координатора.
- `node scripts/check-hygiene.mjs`: exit 0; hash skipped=0, подозрительных/дублирующих исходников не обнаружено. node_modules 193585485 B (~184.62 MiB), .wxt 6390 B, .output 685293 B (~0.65 MiB), test-results 1820913 B, чужой .cache 5855605 B; свободная RAM при проверке 15910846464 B (~14.82 GiB). Своих server/helper/watch процессов не создавал; все собственные checks завершились exit 0. Чужие файлы/кэш/процессы не удалял. Эти filesystem/RAM измерения не доказывают отсутствие heap leaks; освобождение своих runtime maps/timers/listeners проверено отдельными lifecycle tests.

Ограничения и конкретный handoff:

- Shared/storage/cache/engine/page imports уже существуют и проходят общий typecheck; незакрытых запросов на изменение чужих модулей от WI-006 нет.
- Координатор выполняет финальные общие tests, сборки обоих браузеров, manifest/secret/resource inspection и browser rerun после последних общих контрактных правок. Исполнитель не подменяет этот финальный gate.
- Native Firefox runtime и реальный OpenRouter/смысловая точность этим WI не проверены. Платных запросов не выполнял; browser QA использовал loopback mock и изолированный профиль. Native approval/activeTab gesture не доказываются этим автоматическим smoke.


Принято координатором 2026-10-07: общий typecheck/lint PASS, 384 unit tests PASS, обе production builds/manifest checks PASS, 9 Chromium scenarios PASS после последних контрактных правок. Firefox runtime дополняет WI-010; реальная языковая точность не проверена.
