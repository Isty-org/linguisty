# WI-037: Background lifetime during a bounded request

- Kind: `fix`
- Canon action: `none`

## Outcome

A long allowed batch is not lost because Firefox event page unloads; activity is retained only for the finite request and released on completion/cancel/dispose.

## Specs

- Governing: `spec://modules/platform/INFRA-001-extension#runtime`
- Governing: `spec://common/PROP-002-quality#resources`
- Constraint: `spec://modules/platform/INFRA-001-extension#recovery`

## Scope

- Assigned paths: `src/background/controller.ts`, `src/background/requestActivity.ts` if needed, `tests/background/**`, `tests/e2e/long-batch.test.mjs`, this WI; same implementer as WI-033.
- In: proven background unload during pending fetch, bounded activity only during requests, 40s late-headers/body Firefox regression, Chrome compatibility.
- Out: permanent polling/keepalive, permission expansion, physical prevention of browser crashes, canon/build/dependencies/BOARD/WAL.
- Related: WI-033; WI-034 completed, its recovery changes preserved.

## Acceptance

- [x] Original unload around30s and socket close with requestTimeout120s recorded.
- [x] 40s Firefox response passes on unmodified production package without substituting early headers for the original scenario.
- [x] Activity coalesced and bounded; no timer/listener/port after completion, abort, timeout, dispose, or with no requests.
- [x] Chrome compatibility and meaningful regression tests pass; coordinator checked built 0.4.9 on both platforms.

## Result

Original Firefox157.0.1 on package 0.4.8: background unload start30130ms, stop30131ms, socket close30132ms. Test requestTimeout120000 confirmed.

Before → after: Firefox event page unloaded during a permitted long request → `RequestActivity` combines active TRANSLATE_BATCH / TEST_CONNECTION / LIST_MODELS around one 20 s timer calling `runtime.getPlatformInfo()`. This is a parent-process API in Firefox that resets the idle timer; Chrome documents it for finite long operations. API response discarded; no storage/permissions/ports added. Parallel operations share the timer; next API call not created until previous call completes. Short operations do not invoke activity API at all.

Hard bound enforced by production `activeRequest`: helper receives only the result of existing `abortable(operation, controller, timeoutMs)`, not a raw provider Promise. Batch limit is `batchTimeoutMs` (up to 300 000 ms); UI provider action is `requestTimeoutMs` (up to 120 000 ms). Even a provider ignoring AbortSignal and remaining pending does not retain a lease after deadline. Abort synchronously frees listener/lease; settlement frees it in `finally`; dispose immediately removes all leases before storage cleanup. No timer with zero requests or after dispose. WI-034 recovery and callback-based onMessage preserved.

Source checks: `npx tsc --noEmit` PASS; eslint of changed sources/tests PASS; `npx vitest run tests/background --maxWorkers=2` — 8 files / 94 tests PASS, including 13 new lifecycle regression cases. Checked both browser designs, coalescing batch/UI/duplicate batch, completion, provider rejection, cancel/original/tab close/dispose, batch hard deadline, both UI deadlines, settings cancellation, hung/rejected activity API, no resumption on late response, abort listener removal. `node --check tests/e2e/long-batch.test.mjs` PASS.

Browser fixture preserves original 40 s without HTTP headers/body. Added checking that no background shutdown occurs before response and natural unloading occurs after completion, without polling extension API. Observation uses browser-owned lifecycle events/state only. Coordinator built 0.4.9 and ran `node --test tests/e2e/long-batch.test.mjs`: 2/2 PASS (Chrome 41 805 ms, Firefox 77 865 ms including idle wait). Firefox completed translation in 40 245 ms; the only request received full mock response at 40 052 ms and closed at 40 053 ms. No `shutdown-background-script` during request; Firefox independently stopped background at 70 402 ms, 30 236 ms after translation. Cleanup confirmed `pendingTimers=0`, `profileRemoved=true`, `remainingOwnedProcesses=0`, `ownedMemoryAfterBytes=0`. Log: `test-results/coordination-2026-10-12/long-batch-0.4.9.txt`.

Coordinator also reported: full suite 780 unit PASS, typecheck/lint PASS, native 15 PASS, both production builds and manifests PASS. Full Chrome/Firefox smoke still running with coordinator at the time of this record; its result is not claimed.

Resources after relevant tests: `.cache` 5 652 files / 203 426 930 B, unchanged since previous cleanup; free RAM 12 280 244 KiB. One `requestActivity.ts` and one `requestActivity.test.ts`; no temporary copies/own browser/watch processes created; others' cache not deleted.

Official basis for the mechanism: [Chrome — finite service worker lifetime extension](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers), [Firefox parent API calls reset idle](https://searchfox.org/firefox-main/source/toolkit/components/extensions/ExtensionParent.sys.mjs), [Firefox runtime.getPlatformInfo implementation](https://searchfox.org/firefox-main/source/toolkit/components/extensions/parent/ext-runtime.js). Browser run 0.4.9 above confirmed required behavior on Firefox 157.0.1.

Coordinator acceptance on 2026-10-13: full Chrome smoke 14/14, Firefox 14/14, mock ChatGPT Chrome PASS / Firefox 8 PASS; Astra closed A1–A3 and WI-037 without new findings. Final evidence: docs/QA-2026-10-13.md.
