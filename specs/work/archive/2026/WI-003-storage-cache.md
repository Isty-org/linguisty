# WI-003: Storage, secrets, and cache

- Kind: `implement`
- Canon action: `direct-edit`

## Outcome

Working settings, two key modes, and a bounded contextual IndexedDB cache are available to the background and pass their own tests.

## Specs

- Governing: `spec://modules/storage/INFRA-002-local-data#root`
- Affected: `spec://modules/storage/INFRA-002-local-data#cache.key`
- Constraint: `spec://common/PROP-001-contracts#modules`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- In/owned: `src/storage/**`, `src/cache/**`, `tests/storage/**`, `tests/cache/**`, this WI's Result.
- Out: shared/config/lock, UI, background, docs/BOARD/WAL, other implementers' tests.
- API: loadSettings(), saveSettings(settings); getApiKey(mode), setApiKey(key,mode), removeApiKey(), getSecretStatus(mode); getTranslationCache(); buildCacheKey(text,input,config).
- Additional helpers and a normalizer are allowed within owned paths; export normalizeSettings and normalizeBaseUrl for background validation.

## Dependencies

- Depends on: WI-002.

## Acceptance

- [x] Settings normalize/defaults/validation keep secrets out of public data.
- [x] Session/persistent, mode changes, and removal of both copies are tested.
- [x] The IDB cache key includes the entire context and excludes the key; TTL/LRU/limits/clear are tested.
- [x] Translation can proceed without cache when IDB is unavailable.
- [x] Own tests and available type/lint checks are completed; Result records facts and limitations.
- [x] There are no duplicate storage implementations or temporary/watch processes.

## Result

Implementation in owned paths is ready for integration acceptance by the coordinator. The implementer did not change BOARD/WAL/.me, canon, shared contracts, config/lock, UI/background, or others' sources and tests.

Before → after: there were no storage/cache modules → settings are saved through an allowed projection, the API key is separated from public data and migrated between local/session, and translations are stored in a bounded contextual IndexedDB cache. An empty/omitted key preserves the current key; removal is a separate operation.

Files and API:

- `src/storage/settings.ts`: `loadSettings()`, `saveSettings(settings)`; re-exports `normalizeSettings(value)`/`normalizeBaseUrl(value)` for the background. Load repairs corrupted fields independently, preserves valid values, and removes unknown fields; schema >1 is rejected without overwriting. Save does not access secret stores.
- `src/storage/normalization.ts`: pure validation without browser API. Enum/numeric limits, BCP 47 with source auto, target ru by default, model <=200, instructions <=4 000; HTTPS for remote addresses, HTTP only for localhost/127.0.0.1/[::1]. A nonempty raw HTTP(S) authority without `@` is required; credentials/query/hash and URL forms that WHATWG normalizes while losing empty userinfo are rejected. `containsControls` is available inside storage validation.
- `src/storage/areas.ts`: local/session capability check and `TRUSTED_CONTEXTS` when the method is available. Missing session API returns a safe Russian error without silent persistent fallback.
- `src/storage/secrets.ts`: `getApiKey(mode)`, `setApiKey(key: string | undefined, mode)`, `removeApiKey()`, `getSecretStatus(mode)`. A queue serializes changes and reads; key <=4 096, C0/DEL are forbidden. Migration writes the destination and removes the other copy; if removal fails, it rolls back the destination. Removal attempts both copies even if one fails. Status contains only hasKey/mode; raw storage errors are not exposed; memory is not used as a backup secret store.
- `src/cache/cacheKey.ts`: async `buildCacheKey(text,input,config)`. SHA-256 includes prompt version, exact text, languages/provider/canonical endpoint/model/style/instructions hash, pageContext, and all neighboring texts/groups in the batch. API-key, timeout, and transient IDs are excluded; the complete projection is captured before the first await. Engine already adds a separate group digest for identical text in different groups within one batch.
- `src/cache/translationCache.ts`: `getTranslationCache()` returns a singleton contract get/set/clear/stats/prune/dispose; `IndexedDbTranslationCache`/`TranslationCacheOptions` allow fake IDB/clock injection and only reductions to product caps in tests. TTL 30 days, 10 000 entries/50 MiB UTF-8 key+text. Metadata/indexes maintain atomic totals/TTL/LRU without getAll of the entire payload on every write; accessOrder resolves equal timestamps without invented times. The queue is limited to 128 optional operations/8 MiB queued payload, writes <=1 MiB. Open/transactions have timeouts; dispose closes DB, resets the singleton, frees the open timer, and leaves stateless late handlers.
- `tests/storage/{normalization,storage}.test.ts`, `tests/cache/{cacheKey,translationCache}.test.ts`: 4 owned files with `@spec`, contracts, and integration of the real cache implementation with a mock-provider engine.

Checks on 2026-10-07:

- Final own run `vitest run tests/storage tests/cache --maxWorkers=2`: **107 tests / 4 files PASS**, exit 0, repeated after the shared `cacheHitIds` contract update. Includes exact regressions `https://@example.com/v1`, `https:/@example.com/v1`, `https:@example.com/v1`, and other malformed authority forms.
- Historical full run by the implementer before the shared `cacheHitIds` contract update: **364 tests / 17 files PASS**, exit 0. It does not confirm the current overall suite after the coordinator's changes; Root performs final overall acceptance.
- `tsc --noEmit`: **PASS**, exit 0. Early errors in other owners' paths were fixed by their owners; the latest run has no errors.
- `eslint src/storage src/cache tests/storage tests/cache`: **PASS**, exit 0.
- Tested defaults/field repair/no-secret public data, session/persistent migration both ways, absence of API/session/accessLevel, rollback and retry after storage failure, removal of secret keys only, and no duplicates under concurrency. Secret-module restart was tested with mock browser.storage; this does not confirm an actual browser background restart.
- Tested cache context invalidation and stability with new IDs/key, TTL at the boundary and on write/startup, LRU with equal times, Unicode byte accounting, overwrites, multiple concurrent IDB connections, real clear, corrupt rows, quota/open/transaction failures, late opening, versionchange/dispose, and queue release. Engine with the actual cache implementation and mock fetch continues translating on IDB failure, reuses translations after a new instance is created, preserves group distinctions, and requests translation again after clear; its flight/request/pending counters return to 0.
- `node scripts/check-hygiene.mjs --json`: **PASS**, suspicious=[], duplicates=[], hashSkipped=0. Latest snapshot after the cacheHitIds follow-up: node_modules 193 585 452 B, .wxt 6 390 B, .output 686 597 B, .cache 4 075 491 B; free RAM 16 624 111 616 / total 34 282 012 672 B. Other owners' generated caches/test artifacts/processes were not deleted. All own test/lint/type/hygiene commands finished; no watch/server/helper was started. A RAM snapshot is not proof of no leaks; lifecycle is confirmed by the listed tests.

Shared contract follow-up: Root reported **383 PASS / 1 FAIL** in the overall suite of 384 tests; the only failure was an outdated strict expected value in the cache integration test. Before → after: expected checked only translations/fromCache → per the current `PROP-001#modules`, added exact `cacheHitIds: ['a-new','b-new']`, meaning caller IDs after remap, and a separate `@spec` on this contract test. `toEqual` is retained; translations, fromCache, and ID comparison have not been weakened. Storage/cache production code and shared/others' paths were not changed. Repeated the own 107 tests, `tsc --noEmit`, and `eslint tests/cache/translationCache.test.ts`: **PASS**, exit 0. The implementer did not rerun the overall suite after this targeted fix.

Limitations and integration requests:

- When IDB is unavailable, get returns a miss; set/prune do not interrupt translation. stats/clear return a safe error instead of invented zeros/successful clearing. No memory-cache fallback.
- Local/session have no shared transaction: ordinary failures are covered by rollback, but a browser crash between writing destination and removing source has no atomic guarantee. The next setApiKey removes the other copy.
- Calling `setApiKey(message.apiKey, next.keyMode)` before `saveSettings(next)` is the background's responsibility; the current controller already does this. In `src/background/controller.ts`, check the previousKey read via `readKey(previous.keyMode)` in SAVE_SETTINGS: when session API is missing, this read may block persistent mode explicitly selected by the user; a default session → explicit persistent scenario is needed in this environment, without attempting to read a missing store.
- `src/background/validation.ts`: at the latest reading, model was still limited to 256; align it with the normalization/provider/UI limit of 200. Background API-key validation is already updated to 4 096/C0/DEL.
- `src/ui/settingsForm.ts`: key limit is already 4 096; synchronize rejection of all C0/DEL and raw authority with pure storage/provider validation so the local form does not accept a value the background rejects. Pure `src/storage/normalization.ts` imports no browser/secret stores and is available to align validation.
- The implementer did not run Chrome/Firefox production builds, packaged manifest/secret checks, or browser smoke; these are the coordinator's integration acceptance. No paid requests or real keys were used; the real provider's semantic accuracy remains unverified.

Research before implementation: Reddit/Stack Overflow discussions were checked as starting points; API decisions were verified against [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [MDN storage.session](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/session), [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), and [MDN SHA-256 digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest).


Accepted by the coordinator on 2026-10-07: overall suite 391 unit tests PASS; final production packages passed 9 Chromium scenarios and 10 Firefox groups. All runtime tests use a loopback mock; real language accuracy was not tested. UI raw authority/C0/DEL and background model200 issues were fixed and checked by the coordinator; absence of storage.session outside the supported desktop versions is not accepted as a target runtime. The two-area crash migration limitation is recorded as TD-001.
