# WI-034: Retry recovery after transient storage failures

- Kind: `fix`
- Canon action: `none`

## Outcome

Eliminate the WI-032 audit-confirmed permanently stuck session recovery after two browser storage errors.

## Specs

- Governing: `spec://modules/platform/INFRA-001-extension#recovery`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- Assigned paths: `src/background/controller.ts`, `src/background/sessions.ts`, `tests/background/**`, this WI.
- In: recovery on the next request after transient failures, deduplication of concurrent restore, bounded retry, and dispose.
- Out: storage modules, contracts, content/messaging, provider diagnostics, dependencies/build/docs/BOARD/WAL.

## Acceptance

- [x] Regression reproduces two failures followed by recovered storage.
- [x] Next valid request restores sessions without restarting extension.
- [x] Concurrent requests do not cause duplicate restore; no endless retry loop; dispose frees state.
- [x] Relevant tests pass; Result contains before → after and limitations.

## Result

Before → after:

- After the second failure, `recoverSessions()` left a rejected Promise in `recovery`; all subsequent page commands repeated the old `INTERNAL_ERROR` without reading now-healthy `storage.session` → failed attempt releases Promise after settlement. Next explicit page request starts a new attempt; successful recovery remains shared. `recoveryAttempts` removed.
- Concurrent requests during one attempt still await one restore. No background retry loop: on failure, code waits for a new request. Each attempt retains the previous 5-second deadline; cancellation and completion remove controller from resource set.
- After failed initial `ready`, tab-close handler permanently referenced the rejected initial Promise → after successful retry, uses current `recovery`, so tab removal saves an empty snapshot.
- Dispose cancels and awaits the current attempt; waiting request receives `CANCELLED`. A late response from old `storage.session.get` neither writes a snapshot nor creates a session.

Reproduction and checks:

- Before fix: `vitest run tests/background/controller.test.ts --maxWorkers 2 --no-file-parallelism -t 'retries on the next page request'` — test failed: after two failures, only 2 reads instead of the third.
- After fix: `vitest run tests/background --maxWorkers 2` — 7 files, 81 tests passed, including two failures → healthy storage → successful restored `GET_TAB_STATE`, concurrent coalescing, timeout/late result, dispose, and tab-close cleanup.
- `tsc --noEmit` — 0 errors. `eslint src/background/controller.ts src/background/sessions.ts tests/background` — 0 errors.
- Intermediate resource check: `node_modules` 184.6 MiB, `.wxt` 0 MiB, `.output` 20.8 MiB; available RAM about 14.1 GiB, 62 shared Node processes. Others' processes and cache unchanged. One `recoverSessions` and one `SessionRegistry.restore`; no duplicate implementation added.

Research before solution: [Reddit on cold MV3 workers](https://www.reddit.com/r/chrome_extensions/comments/1tjbrz7/whats_your_simplest_recovery_pattern_when_the_mv3/) and [Stack Overflow on asynchronous MV3 initialization](https://stackoverflow.com/questions/71255886/how-to-initialize-chrome-extension-storage-local-under-manifest-v3-service-wor) used as scenarios; behavior checked against [Chrome service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) and [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage).

Limitations: tests use mock WebExtensions API; real kill/browser smoke and shared production builds not run in this WI. `browser.storage.session.get` has no API-level cancellation: after timeout/dispose, late Promise may settle, but AbortSignal check in `SessionRegistry.restore` prevents the read result from changing sessions. Indefinitely pending `storage.session.set` behavior not checked in this pass; the fix adds no physical browser API cancellation. No changes outside Assigned paths required.
