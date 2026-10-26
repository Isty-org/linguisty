# WI-030: Local data recovery and limits

- Kind: `fix`
- Canon action: `none`

## Outcome

Check TD-001, recovery of two secret areas, and bounded cache; fix reproducible violations of active canon without promising a shared transaction unavailable in browser API.

## Specs

- Governing: `spec://modules/storage/INFRA-002-local-data#secrets`
- Governing: `spec://modules/storage/INFRA-002-local-data#cache.data`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- Assigned paths: `src/storage/**`, `src/cache/**`, `tests/storage/**`, `tests/cache/**`, this WI.
- In: recovery after partial operations, secret mode, TTL/LRU/clear/dispose, verifiable fixes.
- Out: shared contracts, background, canon, dependencies, BOARD/WAL/TECHDEBT.

## Acceptance

- [x] Interrupted migration and committed mode checked; secrets do not enter public/cache/log.
- [x] Cache lifecycle, limits, storage failure, and duplicate concurrent requests checked.
- [x] Found violations fixed with regression tests; fundamental limitations listed separately.
- [x] Result contains executed commands, before → after, required integration changes.

## Result

Before → after:

- Delayed repair of old settings could write previous `keyMode` after successful `saveConfiguration` → `loadSettings`, `saveSettings`, and configuration commit use one queue in the background instance. Regression reproduced overwriting before the fix.
- If `storage.local.set` or `storage.session.set/remove` changed data and then rejected its Promise, recovery skipped the already changed area → rollback restores every area where a write was started; if restoration also fails, the error truthfully reports an incomplete result. Regressions reproduced key loss and an extra copy before the fix. This is best-effort for observable failure, not protection against process crashes.
- With committed `keyMode=session` and missing session key, saving an empty field resurrected residual local key into session; symmetrically for persistent → when committed mode is known, only its area is the source. Cross-area fallback retained only for legacy state without committed mode. Both regressions failed before the fix.
- Direct `setApiKey` after partially performed failed migration could leave an extra copy or remove the original → rollback now attempts to restore both affected areas.
- Cache required no changes: tests confirmed TTL, LRU, UTF-8/entry/queue bounds, clear/dispose, IndexedDB failure, and deduplication of concurrent identical translations with in-flight state release. Settings/cache/journal/public validation checks found no test secret in public responses, cache key/data, or journal.

Checks:

- Before fixes: `vitest run tests/storage/storage.test.ts --maxWorkers 2 --no-file-parallelism` — first 3 expected failures for race/partial failure, then 2 expected failures for resurrected stale key.
- After fixes: `vitest run tests/storage tests/cache --maxWorkers 2` — 5 files, 138 tests passed.
- `vitest run tests/background/controller.test.ts tests/background/validation.test.ts --maxWorkers 2` — 2 files, 64 tests passed.
- `tsc --noEmit` — 0 errors; `eslint src/storage tests/storage src/cache tests/cache` — 0 errors.
- Intermediate and final check of own additions: one queue helper, no second cache/secret helper implementation created; `node_modules` 184.6 MiB, `.wxt` 0 MiB, `.output` 19.9 MiB. Available RAM about 11.5 GiB; total shared Node processes changed 94 → 82; others' processes/cache untouched.

Research before solution: scenarios from [Stack Overflow on IndexedDB commit](https://stackoverflow.com/questions/48863444/what-happens-when-a-database-operation-in-indexeddb-is-successful-but-the-trans) and [Reddit on local/session for keys](https://www.reddit.com/r/chrome_extensions/comments/1sge1hh/best_practice_for_storing_a_userprovided_api_key/); API checked against [Chrome Storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [MDN StorageArea.set](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageArea/set), and [MDN IDBTransaction.complete](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event).

Limitations: two browser storage areas do not form a physical transaction. Browser termination between session preparation and local commit can leave a temporary copy; reads and subsequent saves follow committed mode and clear residue. Tests use storage mock/fake IndexedDB, so real browser kill, disk durability, production builds, and browser smoke not confirmed by this WI. No required changes in others' assigned files; global builds and smoke remain with the coordinator.
