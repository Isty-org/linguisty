# WI-033: Align transport timeout with batch budget

- Kind: `fix`
- Canon action: `none`

## Outcome

Eliminate the WI-032 audit-confirmed premature TRANSLATE_BATCH timeout at 35 seconds with an allowed batch budget up to 300 seconds.

## Specs

- Governing: `spec://common/PROP-002-quality#resources`
- Governing: `spec://common/PROP-001-contracts#messages`
- Constraint: `spec://modules/page/FEAT-002-page-translation#root`

## Scope

- Assigned paths: `src/shared/messaging.ts`, `src/content/controller.ts`, `entrypoints/translate.ts`, `src/ui/Options.tsx`, `tests/ui/**`, `tests/content/**`, `tests/e2e/long-batch.test.mjs`, this WI.
- In: finite transport deadline aligned with batch budget; abort, stale replies, timers; real sendMessage regression in the content path.
- Out: contracts.ts, resource canon changes, other UI, background recovery, provider diagnostics, build/dependencies/docs/BOARD/WAL.

## Acceptance

- [x] Timeout after 35 seconds reproduced with a valid long batch.
- [x] Long successful batch completes; hanging batch has a finite aligned deadline.
- [x] Cancel/restore/dispose stop waiting and free timers/listeners; side effects not retried automatically.
- [x] Relevant regression tests pass; Result contains before → after and commands.
- [x] TEST_CONNECTION/LIST_MODELS and long-node part timeouts checked; targeted browser long-batch scenario passed on Chrome and Firefox without a paid API.

## Result

Before → after: real content `runtimeSendMessage(TRANSLATE_BATCH)` used 35 000 ms while allowed watchdog was `batchTimeoutMs(requestTimeoutMs)+5 000` (up to 305 000 ms) → each batch and every long-node part pass that same finite deadline and their job's AbortSignal to shared transport. Cancel, return to original, new start, navigation, and dispose abort the wait and clear transport timer; late response does not change DOM/state. Synchronous `entrypoints/translate.ts` path only calls bootstrap; fix applied to the production default transport it uses. Shared short read/command limits not expanded. TEST_CONNECTION and LIST_MODELS receive a timeout at least equal to the allowed provider budget plus 5 s, up to a hard limit of 305 s.

Before the change, new `tests/content/batch-transport.test.ts`, using real `createPageController` and `sendMessage` with only `wxt/browser` mocked, failed scenarios for successful response at 40 s, first long-node part, and timer cleanup after cancel/original/dispose: 5 failures / 6 tests. After the change, all 6 pass; expectation in one older test updated to match the requirement to abort unfinished work on return to original. Scenario `tests/e2e/long-batch.test.mjs` prepared for both platforms: Chrome uses isolated profile and delayed mock fetch in service worker; Firefox uses existing `firefox-runtime.mjs`, temporarily installed package in isolated profile, standard optional-host prompt, and a separate bounded loopback HTTP mock with a response after 40 s. Profile and mock server close even on test error. Neither variant requires a paid API or user login; shared `local-server.mjs` and runtime helpers unchanged.

Production change checks: `tsc --noEmit` PASS; eslint of assigned sources and tests PASS; `vitest run tests/content tests/ui/messaging.test.ts tests/ui/Options.test.tsx --maxWorkers=2` — 9 files / 114 tests PASS. Coordinator reported full suite 780 unit PASS, typecheck/lint PASS, native 15 PASS, both platform builds and manifest checks PASS on 0.4.9. Browser long-batch status below. Live OpenAI/OpenRouter and real sign-in not checked.

### Firefox follow-up — 2026-10-13

Clarification of previous browser check status: coordinator reported Chrome long-batch PASS on fresh 0.4.8 (41 255 ms). Per coordinator assignment, implementer ran only `node --test --test-name-pattern="built Firefox" tests/e2e/long-batch.test.mjs` on the same package. Firefox 157.0.1 FAIL: loopback request closes before response. Before → after in test diagnostics: only `Bonjour` after waiting → verification of saved settings, safe request counters/timings, and observation of browser lifecycle events. While waiting, the test does not call extension APIs that could reset the idle timer. HTTP headers and body still fully delayed for 40 s; no early headers introduced.

Latest reproducible result: `requestTimeoutMs=120000`, `streaming=false`, provider `openai-compatible`; one request began at 33 ms; Firefox event `background-script-suspend` at 30 130 ms, `shutdown-background-script` at 30 131 ms, HTTP close without response at 30 132 ms, new `background-script-started` at 30 149 ms. Final page state: `error`, `failed=1`, `inFlight=0`, `INTERNAL_ERROR`. This confirms Firefox event page unloading during a pending request. Production `entrypoints/background.ts` and fresh bundle contain no `onSuspend` call to `dispose`; such a local handler is not the cause. Previous run without lifecycle events also closed its only request at about 30 s. Test now ends immediately on premature request close, preserving reasons and timings.

Coordinator expanded the assignment with separate WI-037 (`specs/work/WI-037-active-request-lifetime.md`): production lifetime fix implemented and relevant source checks passed. On built 0.4.9, targeted `node --test tests/e2e/long-batch.test.mjs` passed 2/2: Chrome 41 805 ms; Firefox translated in 40 245 ms with mock response at 40 052 ms. Original Firefox FAIL on 0.4.8 retained as baseline. Detailed lifecycle and cleanup metrics in WI-037 and `test-results/coordination-2026-10-12/long-batch-0.4.9.txt`.

Diagnostic sources: [Mozilla background lifecycle implementation](https://searchfox.org/firefox-main/source/toolkit/components/extensions/parent/ext-backgroundPage.js), [MDN background scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts), [Mozilla Bug 1851373](https://bugzilla.mozilla.org/show_bug.cgi?id=1851373). The old bug alone is not used as proof of Firefox 157 behavior; current browser run events are the evidence.

Resources: during the latest diagnostic run `.cache` — 5 807 files / 266 489 616 B, free RAM — 11 095 780 KiB; after cleanup — 5 652 files / 203 426 930 B (matches cache size before browser follow-up), free RAM — 12 292 924 KiB. Runtime cleanup of each run checks absence of captured own Firefox/geckodriver PIDs and removal of its profile; both latest runs reached the original assertion error without cleanup failure. Others' Firefox processes and remaining foreign profile were not deleted. There is one long-batch file in e2e; no extra copies created.

Coordinator acceptance on 2026-10-13: full Chrome smoke 14/14, Firefox 14/14, mock ChatGPT Chrome PASS / Firefox 8 PASS; Astra closed A1–A3 and WI-037 without new findings. Final evidence: docs/QA-2026-10-13.md.
