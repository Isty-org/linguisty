# WI-006: Background, permissions, and sessions

- Kind: `implement`
- Canon action: `none`

## Outcome

UI and injected page interact with a safe background controller in Chrome and Firefox; state recovers after the background stops.

## Specs

- Governing: `spec://modules/platform/INFRA-001-extension#root`
- Constraint: `spec://common/PROP-001-contracts#messages`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- In/owned: `src/background/**`, `entrypoints/background.ts`, `tests/background/**`, this WI's Result.
- Out: shared/config/lock, storage/cache/providers/DOM/UI implementations, docs/BOARD/WAL.
- API: registerBackgroundController(); listener sync in defineBackground. Use browser from wxt/browser.
- Dependency exports: storage loadSettings/saveSettings/normalizeSettings/normalizeBaseUrl; secrets getApiKey(mode)/setApiKey(key,mode)/removeApiKey()/getSecretStatus(mode); cache getTranslationCache(); TranslationEngine(cache,{fetchImpl?}).translate/testConnection/listModels.
- Runtime message source of truth src/shared/contracts.ts. Sender tabId authoritative; injection file translate.js; top frame only. CONTENT_COMMAND payload responds ApiResult<TabTranslationState>.

## Dependencies

- Depends on: WI-002; integration WI-003, WI-004, WI-005.

## Acceptance

- [x] GET/SAVE/TEST/MODELS/CACHE, start/cancel/toggle/status, and content batch/progress/session reset handlers implemented.
- [x] Runtime validation and sender isolation reject content access to keys/settings writes and other sessions.
- [x] Only chosen API origin, protected pages, stale batch/abort/tab close/restart tested.
- [x] Safe session snapshot without texts/keys, bounded in-flight/concurrency, cleanup.
- [x] Own tests and available checks are completed; Result includes integration limitations.

## Result

Implementation is ready for coordinator review. Canon action: none; the implementer did not change BOARD/WAL/.me, canon, shared contracts, build settings, dependencies, or others' modules.

Before → after: background entrypoint was a stub → synchronously registers one controller with runtime/tab listeners; UI and top-frame content interact through validated ApiResult and their own sessions. The coordinator performs acceptance and archiving.

Changed files and exports:

- `src/background/controller.ts`: `registerBackgroundController(options?)`, `apiPermissionPattern`, `MAX_API_REQUESTS`; registration returns ready/handleMessage/resources/dispose for controlled checks. Lazy single cache/engine instance. All incoming RuntimeMessage implemented; CONTENT_COMMAND/TAB_STATE_CHANGED used only as outgoing.
- `src/background/validation.ts`: runtime projection of Settings/TabTranslationState, payload/limit/ID uniqueness checks, safe fixed PublicError, and each browser's protected page restrictions. Key maximum 4096 characters, no control characters; unknown settings/state fields are not returned.
- `src/background/sessions.ts`: bounded registry, storage.session snapshot under `linguisty.tabSessions.v1`, restoration/TTL/coalesced writes/abort/cleanup. Snapshot contains only tab/session/settings/safe progress/documentId/timestamp; no page texts or ProviderConfig/apiKey/promise/controller/batches.
- `entrypoints/background.ts`: registerBackgroundController is called synchronously inside defineBackground.
- `tests/background/{controller.test,validation.test,sessions.test,harness}.ts`: sender/payload/security, origin/permission/key, session/restart/SPA/cancellation, and resource regressions.

Behavior and integration shapes:

- UI sender: runtime.id + own extension URL. Only UI receives settings/secret boolean/cache and performs save/remove/test/models/start/cancel/display/status. Content: runtime.id, sender.tab.id, frameId=0, session/documentId; only its own batches/progress/BEGIN_PAGE_SESSION allowed; domain checked against sender URL. Foreign tab/session/frame/document and spoofed tabId rejected before engine.
- Injection `/translate.js` matches WXT ScriptPublicPath; target only frameIds:[0]. Existing page listener checked with get-state; repeated start does not multiply injection/listeners. CONTENT_COMMAND response expected as ApiResult<TabTranslationState>; BEGIN_PAGE_SESSION returns `{sessionId, settings}`. TranslationResult preserves optional cacheHitIds and excludes extra engine fields.
- API permission checked before start/test/models and each batch for chosen scheme/host. HTTP only localhost/127.0.0.1/[::1], credentials/query/hash forbidden. Match pattern without port compatible with Firefox; fetch config preserves exact origin/port. Background does not request permissions itself. OpenRouter baseUrl fixed.
- Settings fixed at start; UI test/models can use an entered key without saving. Save migrates key before settings; if settings write fails, previous key/mode are restored. Key/mode changes and removal stop active requests.
- Original aborts pending/in-flight batches, preserves session and ready progress; translated allows new batches in the same session. Cancel also works during preflight before injection. Late replies/cancelled/stale IDs are not returned as successful translation. Tab close/new document free state and snapshot.
- SPA: onUpdated.url does not remove the session; loading checks documentId (fallback: own page get-state), so same-document navigation survives until BEGIN_PAGE_SESSION. A new document is cleared; late complete does not interrupt a batch of the new SPA session. After worker restart, settings recover before the first batch; lost inFlight is reset with a safe error, without an endless spinner.
- Limits: 32 snapshots, TTL 8 hours refreshed by progress; up to 4 API operations globally and configured concurrency 1–4 per session; up to 64 active runtime messages and 4 serial settings mutations. Batch IDs deduplicated only in-flight for identical payload; changed payload with the same ID rejected. Background deadlines free job/timer/listeners even with a mock provider ignoring abort. Progress writes coalesced; a delayed write does not resurrect a deleted session. dispose removes listeners/state, aborts requests, and closes cache.

Actual checks on 2026-10-07:

- `node node_modules/vitest/vitest.mjs run tests/background --maxWorkers 2`: **56/56 PASS**, 3 suites; latest run 11:09 MSK. Includes 4096/4097 key boundary, exact cacheHitIds forwarding/redaction, original→abort→translated resume, key migration rollback, storage-before-first-batch recovery, SPA URL/loading/complete, full reload/tab close/preflight cancel, bounds/dedup/expiry/coalescing/dispose.
- `node node_modules/eslint/bin/eslint.js src/background entrypoints/background.ts tests/background`: exit 0, no errors.
- `node node_modules/typescript/bin/tsc --noEmit --pretty false`: overall typecheck exit 0 on the current shared tree.
- Existing QA `test-results/linguisty-smoke/observations.json` (10:59 MSK) read: Chromium **9/9 PASS**, including SPA and observed worker stop → same session → new batch translated; provider maximum 2 concurrent, activeRequests/pendingTimers=0, pageErrors=0, isolated profile/server closed. The implementer did not create a new browser script or run this smoke. Latest 4096/cacheHitIds changes require a coordinated final rerun by the coordinator.
- `node scripts/check-hygiene.mjs`: exit 0; hash skipped=0, no suspicious/duplicate sources found. node_modules 193585485 B (~184.62 MiB), .wxt 6390 B, .output 685293 B (~0.65 MiB), test-results 1820913 B, others' .cache 5855605 B; free RAM at check 15910846464 B (~14.82 GiB). No own server/helper/watch processes created; all own checks finished with exit 0. Others' files/cache/processes were not deleted. These filesystem/RAM measurements do not prove no heap leaks; release of own runtime maps/timers/listeners is covered by separate lifecycle tests.

Limitations and specific handoff:

- Shared/storage/cache/engine/page imports already exist and pass overall typecheck; WI-006 has no outstanding requests to change others' modules.
- The coordinator performs final overall tests, both browser builds, manifest/secret/resource inspection, and browser rerun after the latest shared contract changes. The implementer does not substitute for this final gate.
- Native Firefox runtime and real OpenRouter/semantic accuracy were not checked by this WI. No paid requests; browser QA used a loopback mock and isolated profile. Native approval/activeTab gesture are not proven by this automated smoke.


Accepted by the coordinator on 2026-10-07: overall typecheck/lint PASS, 384 unit tests PASS, both production builds/manifest checks PASS, 9 Chromium scenarios PASS after the latest contract changes. Firefox runtime is supplemented by WI-010; real language accuracy was not tested.
