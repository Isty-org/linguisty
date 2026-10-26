# WI-010: Testing the extension in Firefox

- Kind: `research`
- Canon action: `none`

## Outcome

Actual compatibility of the production package with installed Firefox is checked in a separate temporary profile; results and test boundaries are reproducible.

## Specs

- Governing: `spec://common/PROP-002-quality#checks`
- Constraint: `spec://modules/platform/INFRA-001-extension#root`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- In: Firefox temporary add-on/runtime, local mock, service configuration, translation/original/cancellation/dynamic content/SPA, release evidence, and cleanup.
- Owned: `scripts/firefox-smoke.mjs`, `tests/e2e/firefox-*.mjs`, `docs/archive/FIREFOX-QA.md`, own Result. Evidence in `test-results/linguisty-firefox/`; temporary driver only in `.cache/firefox-qa/`.
- Read-only: production package, existing fixtures, and `tests/e2e/local-server.mjs`.
- Out: others' production/scripts, user profile, browser installation, paid APIs, publication, shared/config/lock/BOARD/WAL changes.

## Dependencies

- Depends on: WI-006 and Firefox production build.
- Related: WI-008, WI-009.

## Acceptance

- [x] Existing approaches and official Mozilla documentation researched before harness implementation.
- [x] Unmodified production Firefox package checked; runtime version, commands, and results saved.
- [x] Available scenarios checked; found defects passed to coordinator; unperformed checks explicitly marked.
- [x] No own unclosed server/driver/profile; runtime requests/timers and RAM/cache checked.
- [x] If automation unavailable, a specific reproduced limitation is recorded and available checks performed; no fictitious PASS.

## Result

- Before → after: Firefox runtime had only an unverified production package; now there is reproducible smoke, a factual report, and screenshots of the unmodified package in Firefox 157.0. Production/shared/config/lock/BOARD/WAL and others' QA files unchanged; `Canon action: none`.
- Created owned `scripts/firefox-smoke.mjs`, `tests/e2e/firefox-runtime.mjs`, `tests/e2e/firefox-smoke.mjs`, `docs/archive/FIREFOX-QA.md`. Reused shared local-server and fixtures; npm dependencies and browser were not installed. Before the harness, researched Reddit/Stack Overflow and verified Mozilla geckodriver/Marionette/temporary installation/MDN docs; links and method are in FIREFOX-QA.
- Production package snapshot after the coordinator's message checked with `node scripts/firefox-smoke.mjs` on 2026-10-07 11:17:52–11:18:33 MSK: **10 PASS, 0 FAIL**, exit code 0. Runtime Firefox **157.0**, geckodriver **0.37.1**, temporary isolated headless profile. Package index hash before/after **78dbc619cdfa64dd39ce225a719dfd34277edf407aa54518dd24363f1b55ba26**, 13 files / 343 380 bytes; an additional comparison of current file SHA-256 immediately after the run matched. Manifest/CSP/permissions/source files were not patched by the implementer.
- Passed: onboarding; denial and approval of a real Firefox optional-host prompt from production options; saving local service/manual model; mock connection/model discovery; production popup→background→content→mock; exact original/translated and dynamic resume; form/gallery/listener/reference/whitespace preservation; own-mutation no-loop; external text/dynamic insert/delete; SPA new sessionId/title context; repeat-cache without network and exact fully cached fromCache counter; model isolation/clear; DOM exclusions/placeholders/HTML-as-text; light/dark/system, labels, targeted Tab focus, and aria-live.
- Errors checked separately: 401→INVALID_API_KEY, 429→RATE_LIMIT, malformed/unknown IDs→INVALID_MODEL_RESPONSE, about:config→RESTRICTED_PAGE. Public UI/content boundaries and errors contain no mock credential or raw provider response; session↔persistent migration leaves one copy, removal clears both. No paid/external provider requests: gateway loopback, 52 mock requests, maximumActiveRequests=2.
- Resource probe observed nonzero activity before cleanup: 4 timers, 1 MutationObserver, 1 IntersectionObserver, one of each page listener. Repeated inject added no observers/listeners. After each of three cancellations: timers=0, observers=0, session listeners=0 (bootstrap pagehide remains until document closes), active mock requests=0, pending mock timers=0; snapshots of closed tabs removed. Finally: 0 own Firefox/geckodriver processes, profileRemoved=true, mockAfterClose activeRequests=0/pendingTimers=0.
- RAM snapshots saved in evidence: own Firefox/driver working set 769→1006→1019 MiB at installation/pipeline/three lifecycle cycles, 0 after closing; Node RSS 64→72→74 MiB at the same stages. These are observations, not a claim of no leaks. Final cache clear: entries=0 / estimatedBytes=0. QA cache contains only `driver/geckodriver.exe` (4 075 136 bytes) and `driver-source.json` (355 bytes); duplicate downloaded zip and all own profiles removed. Downloaded archive SHA-256 matched the official release digest.
- Syntax `node --check` for all three mjs and targeted ESLint **PASS**. Overall typecheck/lint/unit/build/release checks belong to the coordinator/WI-008 and are not presented here as performed by this chat.
- Evidence: `test-results/linguisty-firefox/observations.json`, `geckodriver.log`, screenshots real-estate/SPA/options light-dark-system/popup-system; method, commands, researched sources, and limitations in `docs/archive/FIREFOX-QA.md`. No production defects found in the measured scope. Initial harness errors fixed: chrome/content window handles, incorrect interpretation of ApiResult.error, observer probe Xray subclass, and locating the restricted tab by hidden URL.
- Not checked: signed/AMO and installation-time data consent; physical native permission click and toolbar/activeTab-only gesture; native popup geometry; real OpenRouter/semantic accuracy; full WCAG/contrast/reduced-motion audit; browser restart/session-key lifetime; cache TTL/LRU/eviction/IDB failure in runtime smoke. Native optional prompt approved using its real button programmatically through test driver chrome scope after delay; manifest and production security were not weakened.
- Handoff after the completed run: coordinator reported later source changes to UI raw-authority/C0/DEL validation and background model limit 200. They are outside the stated package snapshot. Per coordinator assignment, no additional full smoke was run; coordinator will independently rebuild production and run the reproducible command. Old PASS was not transferred to new source/package. WI-010 contains the ready harness and actually measured evidence; acceptance/archiving remain with the coordinator.

Accepted by the coordinator on 2026-10-07: overall suite 391 unit tests PASS; final production packages passed 9 Chromium scenarios and 10 Firefox groups. All runtime tests use a loopback mock; real language accuracy was not tested. UI raw authority/C0/DEL and background model200 issues were fixed and checked by the coordinator; absence of storage.session outside supported desktop versions is not accepted as a target runtime. Two-area crash migration limitation recorded as TD-001.
