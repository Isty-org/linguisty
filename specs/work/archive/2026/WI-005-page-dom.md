# WI-005: DOM translation, dynamic content, and restoration

- Kind: `implement`
- Canon action: `none`

## Outcome

The injected script translates a page through shared messages, preserves DOM/originals, handles dynamic content, and cleans up its resources.

## Specs

- Governing: `spec://modules/page/FEAT-002-page-translation#root`
- Constraint: `spec://common/PROP-001-contracts#messages`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- In/owned: `src/content/**`, `entrypoints/translate.ts`, `tests/content/**`, this WI's Result.
- Out: shared/config/lock, providers/storage/background/UI, docs/BOARD/WAL.
- API: createPageController(options?) => PageController (start/cancel/setDisplayMode/getState/dispose). Testability through injected document/sendMessage/observers/time source inside its own module. Default uses shared sendMessage. The translate.js injection path is established.
- BEGIN_PAGE_SESSION allows an SPA to receive new sessionId/settings from the background; PAGE_PROGRESS reports state; TRANSLATE_BATCH returns TranslationResult.

## Dependencies

- Depends on: WI-002; browser integration requires WI-006.

## Acceptance

- [x] Filtering/layout visibility/whitespace/URLs/editable and the 5 000-node cap tested.
- [x] Only Text.data changes; event handlers and form input are preserved; restore/toggle without API.
- [x] Viewport priority/concurrency/batch limits/text-level dedup do not become one request per node.
- [x] Mutation observer does not loop; dynamic text/SPA/stale response/external writes tested.
- [x] Cancel and dispose free the queue/timers/listeners/registry; detached prune tested.
- [x] Own tests and available checks are completed; Result includes limitations.

## Result

The module is ready for integration review (2026-10-07). Version acceptance/archiving belongs to the coordinator and WI-008; overall browser acceptance is not declared complete.

### Before → after and API

- Before: unlisted `translate.ts` was only a stub; no DOM pipeline. After: `src/content/scanner.ts`, `registry.ts`, `renderer.ts`, `batcher.ts`, `controller.ts`, `bootstrap.ts`, and connected `entrypoints/translate.ts`. Public entry `createPageController(options?) => PageController` uses shared start/cancel/setDisplayMode/getState/dispose; `bootstrapPageRuntime()` registers exactly one callback listener and marker per document and removes them on pagehide. Build output is `translate.js`. Default transport is shared sendMessage, which unwraps ApiResult; CONTENT_COMMAND responds with ApiResult via sendResponse/return true for Chrome 120 and Firefox.
- TreeWalker skips excluded/editable/hidden/inert/aria-hidden/translate=no areas, invisible layout, empty/punctuation-only strings, and pure URL/email/hash. Numbers within semantic phrases are preserved. Priority viewport → near → rest, nearest semantic container grouping, node/char/concurrency bounds. Each DOM reference has a separate ID; shared engine handles text dedup/cache and ID remapping. Repeated START issues new node IDs and stable group labels for an identical document.
- Only Text.data, exact leading/trailing whitespace, intact DOM objects/handlers/form values. Ready original/translated content switches without network. Original pauses new batches/dynamic translation; CANCELLED from background abort returns unfinished entries to pending. Abort-before-original-command does not start a retry loop. External text becomes the new original; old batch/session/revision/owned-value responses are not applied. Eligibility is rechecked before apply; text that has become an editor and editable values are not overwritten. Total response text is limited to 1 MiB before apply.
- MutationObserver with 400 ms debounce handles dirty subtrees/characterData and relevant attribute changes; own writes disconnect observation after processing takeRecords, so pending external mutations are not lost and no translation loop occurs. Dirty roots bounded at 128 with coalesced fallback scan; registry/queue ≤5 000. IntersectionObserver releases its previous target when a node moves; detached entries are also removed from pending job snapshots.
- SPA URL/popstate/hashchange/body replacement clear the old queue and registry, restore the saved shell source, negotiate new context/settings/session through BEGIN_PAGE_SESSION, and preserve display mode. Cancel releases unfinished/detached entries, jobs, queue, timers, observers, and navigation listeners; ready originals/translations remain bounded for offline toggle after cancellation. Dispose frees the entire registry/listeners/timers and restores source still owned by us, preventing translation-of-translation after BFCache.

### Actual checks

- `node node_modules/vitest/vitest.mjs run tests/content --maxWorkers=2`: **45 PASS**, 3 suites after the cacheHitIds follow-up; `tests/content/{scanner,controller,bootstrap}.test.ts`, shared fixture helper only in `tests/content/helpers.ts`. Tested filtering/5 000 cap, priority/grouping/node/char/concurrency bounds, whitespace/event handlers/input values/literal HTML text, ready toggle, own-loop guard, dynamic insert/show/hide, external/stale source, undelivered mutation preservation, original pending abort/resume, abort-before-command, stable group context/new IDs, SPA/history-only/body reset, late returned session cancellation, cancel/dispose/repeated cycles/detached prune/moving observer target, malformed/oversized result/watchdog/safe snapshot/envelope. New 12 regressions: exact mixed cache progress after removal/external changes to cached and uncached nodes, the same changes before a pending response, exact count preservation during toggle/cancel and cleanup in dispose, atomic rejection of foreign/repeated/non-string/non-array/null cache-hit IDs and count mismatch.
- `node node_modules/typescript/bin/tsc --noEmit`: **PASS** on the final snapshot. `node node_modules/eslint/bin/eslint.js src/content entrypoints/translate.ts tests/content`: **PASS**. Overall lint/unit release gate belongs to root/WI-008.
- `npm run build:chrome`, `npm run build:firefox`: **PASS before the cacheHitIds follow-up**. Checked Chrome package 342 394 bytes / Firefox 342 689 bytes, 13 files each; translate.js 18 716 bytes in each build. `node scripts/check-manifests.mjs --json`: **PASS** for both previous builds, including packaged resources/CSP/name/platform background/heuristic credential check. Rebuilding after cacheHitIds is the overall root/WI-008 gate.
- Existing `node --test --test-concurrency=1 tests/e2e/chromium-smoke.test.mjs`, explicitly selected Chromium 152.0.7977.8 (`chromium-1237`), isolated temporary profile + loopback mock: latest own run **9/9 scenarios PASS before the cacheHitIds follow-up**, Node reports 10 tests PASS including the parent. Tested real extension UI→background→page, layout priority, forms/gallery/references/whitespace/restore/resume/dynamic/external/SPA/cache/cancel/errors, and service-worker restart. Its evidence: ok=true, 52 mock provider requests, maximumActiveRequests=2, activeRequests=0, pendingTimers=0, pageErrors=0, isolatedProfileRemoved=true, localServerClosed=true. No duplicate browser harness was created; per coordinator instruction, smoke was not independently run after cacheHitIds. New overall browser acceptance/retest belongs to root/WI-008; the previous PASS does not prove the new fix.

### Integration and limitations

- Confirmed initial SPA FAIL: Chromium reports tabs.onUpdated `{status:'loading',url:'...dynamic.html?quartier=2'}` during pushState; previous background cleanup removed the session before BEGIN_PAGE_SESSION, and content received CANCELLED. WI-006's owner fixed documentId checking without content bypass; the latest existing Chromium smoke passed SPA with new Nantes context. Content retains session/revision guards. Others' production paths were not changed.
- The inaccurate cache counter limitation was eliminated under the updated shared contract. Before: aggregate lower bound after invalidation in a mixed batch. After: controller validates cacheHitIds (array, unique string requested caller IDs, length=fromCache) before applying the entire batch; registry stores per-node cacheHit only for an accepted current translation. External write/remove reset this flag; recount counts exactly the remaining live cached translations; uncached changes do not decrease hits. Engine/background already pass the list, confirmed by reading their current exports; others' paths were not changed. Zero-cache without the list is allowed; a safe fallback is retained for legacy test mocks, which production engine does not use under canon. There is no longer an open shared contract request.
- Firefox package checked; real Firefox extension runtime not run. Chromium 152 does not confirm operation on minimum Chrome 120 (callback bridge checked by a contract test and official documentation). Native optional permission prompt/toolbar activeTab gesture were not automated; smoke supplied a loopback origin in an isolated profile. Mock does not verify OpenRouter access/real semantic language accuracy. No paid requests or reading of user secrets.

### Resources, duplicates, and research

- Intermediate and final `node scripts/check-hygiene.mjs --json`: **PASS**, suspicious/duplicates empty. Final snapshot after cacheHitIds: node_modules 193 585 485 bytes, .wxt 6 390, .output 685 293, test-results 1 820 913, .cache 5 855 605; RAM free 16 290 045 952 / total 34 282 012 672 bytes. Exact cache metadata is one boolean on bounded NodeEntry, without an additional long-lived set of DOM references. .cache was created by neighboring QA actions; it was not deleted. No own long-running node/watch/helper processes found after checks; browser/server were not started in this follow-up. A RAM snapshot does not prove no leaks: separate repeated lifecycle, detached, moving-node observer, exact cache invalidation/cancel/dispose, and own-loop tests check release of runtime references/resources. Others' caches, files, and processes were not deleted.
- Before choosing the solution, studied [Stack Overflow: MutationObserver loop](https://stackoverflow.com/questions/65484575/mutationobserver-create-infinite-loop-when-i-replace-a-string-with-span-tag) and [Reddit: SPA injection](https://www.reddit.com/r/webdev/comments/1rx76ux/chrome_extension_only_works_on_hard_refresh/). APIs checked against [MDN disconnect/takeRecords](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect), [MDN popstate](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event), [MDN TreeWalker](https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker), [MDN runtime.onMessage](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage), [WXT unlisted entrypoints](https://wxt.dev/guide/essentials/entrypoints).
- Before the cacheHitIds follow-up, studied [Stack Overflow: per-key cache statistics](https://stackoverflow.com/questions/2007385/ehcache-statistics-by-key) and [Reddit: invalidation by entity IDs](https://www.reddit.com/r/ExperiencedDevs/comments/18b4dby). List and uniqueness checks verified against [MDN Array.isArray](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray) and [MDN Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set).

Accepted by the coordinator on 2026-10-07: overall typecheck/lint PASS, 384 unit tests PASS, both production builds/manifest checks PASS, 9 Chromium scenarios PASS after the latest contract changes. Firefox runtime is supplemented by WI-010; real language accuracy was not tested.
