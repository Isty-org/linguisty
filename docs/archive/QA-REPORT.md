# Linguisty — acceptance of local version 0.2.0

Developed by Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI tools and actual checks are listed below. See [AUTHORS](../../AUTHORS.md).

Current 0.4.9 pass of 2026-10-13: [QA-2026-10-13](QA-2026-10-13.md). Historical 0.2.0 evidence is preserved below; it does not replace checks of new packages.

Date: 2026-10-08, Europe/Moscow. Current build after WI-019/WI-020: Retro Orbit Editorial and browser language preferences; a focused user clarification moved Isty to the footer. The user's original documents are interpreted as a visual reference; the product remains Linguisty, Chrome/Firefox desktop, BYOK.

## Retro Orbit and languages

Before → after: Cloudline → violet/sage, graphite/paper, rectangular shapes, editorial headings, supplied SVG, and local Onest/JetBrains Mono with OFL. Settings gained section navigation; the popup retains a compact translation workflow.

Before → after: short list and fixed Russian default → 210 distinct translation languages/variants, manual Intl-compatible BCP 47 codes, and 16 independent UI languages. A new profile takes target from the browser's preferred languages and UI from the browser language; an old saved target migrates to manual. Key/model/source are not reset. The OS is not read directly. UI locales: en, ru, uk, de, fr, es, it, pt, pl, tr, ja, ko, zh-CN, zh-TW, ar, hi. Each pack now contains 207 keys with verified completeness and identical placeholders; native-speaker review of all languages was not performed.

Before → after following clarification: a large Isty mark in the header → a small 42×24 px mark in the popup/options footer, with “Разработано” (Russian for “Developed”)/“Powered by” and translations in all 16 locales. The header contains only Linguisty and the product caption. A complete template with {brand} determines phrase order (including JA/KO/HI); the logo has the accessible name Isty. No new resources, listeners, or translation services were added. Typecheck/lint and 566 unit tests were repeated; packaged Chrome/Firefox languages and the full UI run: 3 PASS. Footer screenshots were reviewed in paper/graphite, and the entire popup was reviewed visually. Mozilla linter on the final Firefox ZIP: 0 errors/notices/warnings. Background/content hashes match the previous full smoke; full translation smoke was not repeated after this visual change.

| Check | Actual result |
|---|---|
| Typecheck / lint | PASS |
| Unit/contract/DOM | 566 PASS, 33 files, maximum 2 workers |
| Manifest/hygiene contracts / fixtures | 8 PASS / 5 PASS |
| Production builds / runtime ZIP | Chrome and Firefox PASS, 19 files each; ZIP payload matches production |
| Chrome package / ZIP | 1 036 452 / 403 174 bytes |
| Firefox package / ZIP | 1 036 615 / 403 258 bytes |
| Manifest / secrets / assets | PASS, 15 referenced assets, local fonts/SVG, no keys/dev runtime |
| Chromium 152.0.7977.8 | Before footer: 13 pipeline scenarios, 14 PASS including parent, 0 FAIL |
| Firefox 157.0.1 / geckodriver 0.37.1 | Before footer: 14 PASS / 0 FAIL, package index identical before/after |
| Packaged UI / startup | UI PASS after footer; startup PASS before footer |
| Packaged languages Chrome + Firefox | 2 PASS; auto/manual, saving through form submit, reopening, independent UI/target, Arabic RTL |
| Mozilla Add-ons Linter 10.13.0 | Firefox ZIP: 0 errors, 0 notices, 0 warnings |

Chromium checked all 16 UI locales at 320/390/1280 px, no horizontal page overflow, 44 px targets, and actual loading of Onest/JetBrains Mono and the supplied SVG. Contrast of the checked normal/semantic text tokens in both themes is ≥5.68:1; this is not a full WCAG audit. Firefox with intl.accept_languages=uk-UA,en-US selected uk-UA, displayed Arabic RTL, saved sr-Latn-RS and English with the real form button, then returned to browser mode with uk-UA. Chromium additionally performed repeated manual/browser cycles together with UI locale switching. The UI has no external font/script/resource requests. No paid/provider requests were made in the language scenario.

The first full smoke in both browsers stopped on an old expectation of two streaming attempts. The current adaptive engine recovers a multi-node batch: the duplicate fixture finally fails after 6 attempts with full rollback; unknown/missing fixtures pass full validation of single-node responses after 7 attempts. The test was updated under the active FEAT-001; limits and cache atomicity are preserved. The Firefox refresh helper now waits for the ready React form before reading the checkbox. Repeated full runs passed.

The quick language harness initially showed a return to browser mode that had not been saved in Chromium; those runs are not called successful. The check now requires removal of the manual input after selecting auto (React commit), a completed form and feedback after saving, then checks actual storage values and repeated cycles. The final scenario passed without changing production UI; the exact cause of the initial transient discrepancy is unknown.

The shared UI JS chunk of 568 145 bytes triggers the standard Vite >500 kB warning: all 16 local packs load together. The warning is not disabled; the limitation is recorded in TD-002. Background 75 015 bytes imports only locale metadata, content script 30 526 bytes. Both fonts are packaged locally; no new dependencies were installed.

Hygiene: source duplicates/suspicious copies/hash skips 0; one node_modules of 193 588 893 bytes, .wxt 6 589 bytes. Old .cache stayed at 203 426 930 bytes/5 652 files; no new residual Firefox cache files relative to baseline. Available RAM and output/artifact sizes are recorded in hygiene-final.json; a snapshot does not prove that all leaks are absent. Full Firefox: owned working set approximately 1.11 GB before closure → 0 after, profile removed, remainingOwnedProcesses=0. Chrome profile removed and loopback server closed. Full mocks completed 200/206 requests, maximum 2 concurrent, activeRequests/pendingTimers=0; Firefox final cache empty. Two previous CUA helpers were left in place; other people's processes/cache and WI-011 were untouched.

Evidence: `test-results/linguisty-rebrand/observations.json`, `test-results/linguisty-rebrand/{manifests-credit,amo-credit,archives-credit,hygiene-after-credit}.json`, `test-results/linguisty-rebrand/firefox/observations.json`, screenshots in these folders; shared runtime reports: `test-results/linguisty-{smoke,firefox,ui,ui-startup}/`. Firefox package index of full smoke before footer: `02261dbf583fc49e9f016fc5e14f78d36bcc64238aa8c11bc779c11e6e1812ec`.

Real OpenRouter/model language accuracy, native-speaker QA of all UI packs, signed installation, minimum-browser versions, native clipboard/toolbar geometry, and updating the Firefox executable were not checked. Previous key-lifecycle evidence is preserved in the historical report; this separate time-intensive scenario was not repeated after the redesign. Publication was not performed.

## Historical 0.2.0 report before the redesign

Date: 2026-10-08, Europe/Moscow. WI-012/WI-013/WI-014: readability when changing writing systems, local API log, and progressive translation in complete validated phrases. WI-015/WI-016 fixes were preserved and rechecked.

### Checks

| Check | Actual result |
|---|---|
| Typecheck / lint | PASS |
| Unit/contract/DOM | 493 PASS, 28 suites, maximum 2 workers |
| Manifest/hygiene contracts / fixtures | 7 PASS / 5 PASS |
| Production builds | Chrome and Firefox PASS, 13 files each |
| Chrome package / ZIP | 374 001 / 123 097 bytes |
| Firefox package / ZIP | 374 164 / 123 181 bytes |
| Manifest / secrets / assets | PASS: stable Gecko ID, CSP, local assets, no keys/dev runtime |
| Chromium 152.0.7977.8 | 12 pipeline scenarios (13 PASS including parent), 0 FAIL |
| Firefox 157.0.1 / geckodriver 0.37.1 | 13 PASS, 0 FAIL; package index identical before/after |
| Packaged UI / startup faults | Both PASS; narrow layout, themes, full target checkbox, timeout/retry/unmount |
| Firefox key lifecycle | 2 PASS: real reload/update/exit/start in owned profiles |
| Mozilla Add-ons Linter 10.13.0 | Firefox ZIP: 0 errors, 0 notices, 0 warnings |

Before → after: CJK and Cyrillic had different visible heights at the same CSS size → bounded correction based on actual glyph metrics. JA→RU fixture: body 18→24 px, heading 30→40.5 px; hierarchy preserved, fixed overflow does not gain additional clipping, reverse CJK is not reduced. Toggles/external styles/node removal/dispose restore only owned size/line-height. Baseline and screenshots are in `test-results/linguisty-fonts/` and browser artifacts. This is a heuristic, not a guarantee for every site/font.

Before → after: a generic error hid the API cause → an independent settings section shows available sanitized message, HTTP/code/type/request ID, and attempt count. The allowlist journal is bounded to 100 entries, 4 KiB/entry, 256 KiB total, and 7 days. Translation/test/discovery, HTTP 401/402/403/429/503/200-error, network/timeout/malformed, redaction, and serialization are covered by tests. Browser checks confirmed three separate operations, one entry after 3 retry attempts, inert markup, both themes, and clearing without clearing cache. The test intercepts only the outgoing clipboard payload; the system clipboard was unchanged. Native OS paste was not checked.

Before → after: Text nodes waited for the full response → complete validated JSON items are temporarily displayed through SSE. Open strings are not displayed. Final validation atomically checks IDs/JSON before cache/commit; malformed/unknown/duplicate/missing, HTTP200 error, network drop, retry, and cancellation roll back preliminary text and its font. The background holds one cumulative snapshot, one sequential send, and a 100 ms timer. Buffer/model JSON ≤1 MiB, SSE events ≤16 384; consumer listeners/reader/retry timers are released. Transport choice does not change the cache key; dedup remaps transient IDs. Regular mode and explicit unsupported-stream fallback work.

Local mock with response completion after 2.5 s:

| Browser | First phrase, SSE | First phrase, regular request | Full SSE display |
|---|---|---|---|
| Chrome | 144 ms | 2513 ms | 2516 ms |
| Firefox | 136 ms | 2519 ms | 2527 ms |

Time was measured by a DOM MutationObserver from the local server's request start, not from the user's click. This measures the Linguisty pipeline, not actual OpenRouter speed. Mock checks in both browsers: ID faults, late error/drop, explicit fallback, cancel/original/resume, external source edit, navigation, tab close, no invalid cache, and no repeated request after committed toggle. UTF-8/SSE/JSON boundaries and limits were additionally checked by unit tests. SSE/schema compatibility of the user's specific model was not checked.

Each full browser run made 80 mock requests, maximum 2 concurrent; after completion activeRequests=0, pendingTimers=0. Chrome pageErrors=0. Firefox repeated lifecycle shows 0 timers/observers/session listeners after cancel; remainingOwnedProcesses=0 after cleanup. Successful profiles were removed, helpers/watch processes were not left running. Firefox working set before closure approximately 1.07 GB; after closure 0 owned processes. A size/RAM snapshot does not prove that all leaks are absent.

Evidence: `test-results/linguisty-{smoke,firefox}/observations.json`, focused fonts/journal/streaming reports, `test-results/linguisty-{ui,ui-startup,key-lifecycle}/`, `test-results/linguisty-0.2.0/{amo,hygiene,archives}.json`. Firefox package index: `ec4a586df53bcb6c91c73f471397f1da25d64b8b4a8f7cdf19a4892094edca09`; the archives report checks that the runtime ZIP matches these files and stores SHA-256. Previous 0.1.0/0.1.1 ZIPs are preserved.

Hygiene: source duplicates/suspicious copies 0, one node_modules of 193 588 509 bytes, .wxt 6390 bytes; old .cache of 203 426 930 bytes did not grow. Free RAM at snapshot 18.82 GB. Old WI-011 cleanup remains Blocked after the previous automatic approval rejection; those paths were not deleted and no new rejection was received. Other people's processes/cache were untouched.

The first focused Firefox streaming run passed streaming, but a sticky notice covered the onboarding click. The test helper now scrolls the real button to the center before WebDriver click; the full Firefox run passed. The first packaged UI run checked 44 px on the checkbox itself rather than its native label target; the check was corrected and separately confirms clicking label text on a narrow screen. The corrected run passed. Harness defects are not hidden, and failed runs are not called successful.

Real OpenRouter, language accuracy, native OS clipboard, signed installation, minimum-browser versions, physical toolbar/activeTab gesture, and updating the Firefox executable were not checked. No paid requests, dependency installation, or publication were performed.

## Historical 0.1.1 report

Date: 2026-10-08, Europe/Moscow. WI-015/WI-016: fixed loss of persistent key mode when saving from an old UI, separate key/settings writes, and interface stalls on background reads/cache.

## Checks for 0.1.1

| Check | Actual result |
|---|---|
| Typecheck / lint | PASS. Generated `.cache`/`output` excluded from lint; old files were not deleted |
| Unit/contract/DOM | 417 PASS, 20 suites, maximum 2 workers |
| Manifest/hygiene contract tests | 7 PASS |
| Fixture checks | 5 PASS |
| Production builds / ZIP | Chrome and Firefox PASS, 13 files each, ZIPs match directories byte for byte |
| Chrome package | 349 757 bytes; ZIP 115 362 bytes |
| Firefox package | 349 920 bytes; ZIP 115 445 bytes |
| Manifest / secrets / resources | PASS: stable Gecko ID, CSP, packaged assets, no keys/dev runtime |
| Chromium 152.0.7977.8 | 9 pipeline scenarios + UI + startup faults; Node counts 12 PASS including parent test |
| Firefox 157.0.1 / geckodriver 0.37.1 | 10 PASS/0 FAIL; production hash identical before/after |
| Firefox key lifecycle | 2 PASS: normal isolated profile and a profile with documented preservation preferences |
| Mozilla Add-ons Linter 10.13.0 | Firefox ZIP: 0 errors, 0 notices, 0 warnings |

Before → after: stale popup/options could return a persistent key to session → incidental save preserves the current mode under the background queue. Persistent key and mode were written separately → one local write contains both. After an interrupted update, a residual copy does not override the key from the committed mode. Source cleanup failure rolls back the previous configuration, and explicit deletion clears both areas.

Before → after: the interface waited for all cache/config reads and session restoration → cache stats are independent of the form, configuration independent of snapshots. Reads are bounded to 5 s; read transport failure permits one retry, commands with side effects are not repeated. After timeout, an error and retry are shown; unmount releases waits/timers. Bootstrap HTML and the React boundary leave a safe reload message instead of an empty window. New browser tests inject only transport faults into the test page, without modifying production files.

The key survived a real AddonManager reload and replacement with a higher-version package using the same Gecko ID. After actual Firefox exit/start, the temporary add-on disappeared; reloading into the same Firefox 157.0.1 profile preserved the local key with both preservation preferences and preferences disabled. The initial expectation that default temporary removal would necessarily delete the key was not confirmed; the final test records observed browser behavior. A guarantee for signed permanent installation and updating the Firefox executable was not checked. Temporary installation remains temporary; documentation and options explain its limitations, and user preferences are unchanged.

Evidence: `test-results/linguisty-firefox/observations.json`, `test-results/linguisty-key-lifecycle/{observations,packages}.json`, `test-results/linguisty-ui-startup/observations.json`, standard Chromium/UI observations. Successful QA profiles removed, remainingOwnedProcesses=0, mock activeRequests/pendingTimers=0, UI pageErrors=0. Size/RAM snapshot is in `test-results/linguisty-key-lifecycle/hygiene.json`; it alone does not prove that leaks are absent. Lifecycle checks additionally check release of observers/listeners/timers and session snapshots. Old WI-011 cache/checkpoint preserved unchanged.

ZIP SHA-256: Chrome `f37f1d524f4316ca499b20c76fd48bcc6e18b111245582781ae38c4016cebcdf`; Firefox `9f336af82a187a43546437dbd019c66388cdb08e5a9928dba010634dc07c4223`.

Real OpenRouter/user key, language accuracy, signed installation, installing/updating Firefox itself, and minimum supported browser versions were not checked. No dependency installation was performed; the lockfile changed only in the project's own package version.

## Historical 0.1.0 report

Date: 2026-10-07, Europe/Moscow. After WI-011, **398 unit/contract/DOM tests, 9 Chromium scenarios, a separate packaged UI run, and 10 Firefox groups passed.** Both production builds and ZIPs are ready. Mozilla Add-ons Linter checked the Firefox ZIP: 0 errors and warnings. Real OpenRouter and language accuracy are unverified without the user's key. Cleanup of the temporary tool/leftovers from the first Firefox launch awaits the user's decision after automatic approval rejection.

## Final checks

| Check | Result |
|---|---|
| npm run typecheck | PASS after final code and packaging-configuration changes |
| npm run lint | PASS, 0 errors |
| npm test | PASS: 398 tests, 18 suites, maximum 2 workers |
| node --test --test-concurrency=2 scripts/check-manifests.test.mjs | PASS: 7 independent manifest/hygiene tests |
| node scripts/check-fixtures.mjs | PASS: 5 fixture pages, structure and owned handlers; separate from runtime |
| npm run zip:chrome / npm run zip:firefox | PASS: production build and packaging of both platforms |
| node scripts/check-manifests.mjs --json | PASS: name, MV3, permissions, CSP, assets, icons, and browser-specific background |
| Chromium smoke | PASS: 9 scenarios, Node counts 10 tests including parent; 0 failed/skipped |
| Packaged Chromium UI | PASS: connection/models/themes/layout/progress/cache; together with smoke, Node counts 11 tests |
| node scripts/firefox-smoke.mjs | PASS: 10 groups, 0 failed; Firefox 157.0.1 / geckodriver 0.37.1 |
| Mozilla Add-ons Linter 10.13.0 | Before 0 errors/3 warnings; after 0 errors/0 notices/0 warnings in the directory and Firefox ZIP |
| ZIP byte comparison | PASS: 13 files each match production; source ZIP without generated artifacts |
| npm audit --json | Initial WI-009 acceptance: 0 vulnerabilities found; dependencies/lockfile did not change in WI-011, audit was not repeated |
| node scripts/check-hygiene.mjs --json | No suspicious source copies or exact duplicates; final sizes and RAM in evidence |

Chrome package: 13 files / **343 499 bytes**, ZIP 112 952 bytes. Firefox: 13 files / **343 662 bytes**, ZIP 113 037 bytes. Builds use one codebase; required permissions are only activeTab, scripting, storage. API host is requested separately on user action. Chrome uses a service worker; Firefox uses background scripts and a declaration of data transmitted to the selected API. Firefox floor 140 → 142: installation on 140–141 is excluded; gecko_android absent.

Both dynamic innerHTML warnings came from unused React DOM 19.3.0 setters. A build pre-transform disables the raw-HTML path for normal/custom elements with an explicit error. Production runtime tests reproduce the original HTML parsing, check its prohibition, preservation of literal text children/updates/unmount, and failure if upstream setters change. The dependency on disk is not edited; neither a sanitizer nor an HTML-parser replacement is added.

Known credential-pattern scanning is heuristic. It does not prove that an arbitrary secret is absent; UI/content/runtime tests separately check key boundaries.

## What was checked in browsers

In both browsers: configuration of a local compatible service and manual model; popup → background → content → mock; viewport first; preservation of DOM references, links, gallery, form, and entered values; exact original/translation without another API request; insertions/removals/external text; SPA with a new session and context; editable/hidden/code/URL exclusions; model HTML as literal text; cache and model switching; safe 401/429/invalid JSON/ID; cancellation and late responses; tab closure; light/dark/system theme and individual keyboard/labels checks.

Chromium additionally: observed service worker termination, session snapshot restoration, and a new translated batch. Firefox: denying/granting a real optional-host prompt, key migration between session/persistent, one copy after normal migration, removal from both areas, prohibition on content reading settings/secret status, and three measured lifecycle cycles.

Chromium 152.0.7977.8 was explicitly selected from previously installed Playwright revision1237. Installed Playwright 1.63.0 defaults to the missing revision1243; a match with the pinned browser is not claimed. Firefox uses the installed runtime in a temporary profile, not the user's profile. All API responses are local mocks; test-service requests were not forwarded externally.

## Reproduction and evidence

Chromium: set LINGUISTY_CHROMIUM_EXECUTABLE for the current process to C:/Users/Nik/AppData/Local/ms-playwright/chromium-1237/chrome-win64/chrome.exe and run node --test --test-concurrency=1 tests/ui/browser-ui.test.mjs tests/e2e/chromium-smoke.test.mjs.

Firefox: node scripts/firefox-smoke.mjs. Driver preparation and method: [FIREFOX-QA](FIREFOX-QA.md). Smoke does not perform external browser/npm installations.

Evidence and screenshots are saved in ignored test-results/linguisty-smoke/, linguisty-firefox/, linguisty-ui/. Final Firefox run: 22:42:25–22:43:06 MSK; package SHA-256 index identical before/after: **26f637d572b1e90b7f729b6d72783352fb34fd5a2dab7f409a2d6a3761bdd66f**. The JSON contains individual file hashes. ZIPs match these production files byte for byte. test-results/linguisty-amo/ contains before.json, after-build.json, after-zip.json, archives.json, and hygiene snapshots.

## Resources and cleanup

Each full pipeline browser run made 52 mock requests, maximum 2 concurrent. After closure: activeRequests=0, pendingTimers=0; Chromium pageErrors=0; successful-run profiles removed, servers closed. Firefox cleanup shows remainingOwnedProcesses=0. The first Firefox launch before extension installation ended with `Process unexpectedly closed with status 0`; the repeat produced a successful full run. Two remaining processes from the first profile were identified by exact path and terminated individually. The profile itself and its temporary files have not yet been deleted: recursive cleanup was rejected by automatic approval review.

In each of three Firefox lifecycle cycles, activity was observed first; after cancel, timers=0, MutationObserver=0, IntersectionObserver=0, session navigation listeners=0. The bootstrap pagehide listener exists until document closure. Reinjection did not add observers. Closed tabs were removed from snapshots. Unit tests check queue, consumer cancellation, detached nodes, TTL/LRU/50 MiB bounds, IndexedDB failure, cacheHitIds, and cleanup.

One node_modules: 193 587 680 bytes (+2096 bytes Vitest cache); .wxt: 6390 bytes; .output: 1 251 308 bytes at final measurement. Free RAM: 16 125 992 960 bytes. No duplicates/suspicious source copies. Existing geckodriver/source cache: 4 075 491 bytes; temporary linter npm cache and leftovers from the first Firefox profile increased total .cache to 203 425 397 bytes. Recursive removal was rejected with `blocked by policy`, with no more detailed reason; the user was asked about deleting only files created by this pass. Screenshots and evidence are preserved outside the source ZIP. Other people's caches and processes were not deleted.

RAM snapshots do not prove the absence of all heap leaks. Bounds and release of owned runtime resources were checked by repeatable scenarios, not only working-set size.

## Fixed integration defects

- SPA loading events deleted same-document sessions → documentId/fallback content-state comparison preserves the correct transition and clears a new document.
- WHATWG URL removed an empty userinfo delimiter → storage/provider/UI reject raw invalid authority before normalization/permission.
- Aggregate cache counter was too low on mixed-batch removal/change → cacheHitIds and per-node metadata provide accurate progress.
- Inconsistent key/model boundaries → key 4096/C0/DEL and model200; UI uses clean shared URL normalization without the secret store.
- Early path/type/lint/hoisting errors were fixed; their earlier failures are not current blockers.
- WXT source ZIP included test-results → explicit generated-folder exclusions; the archive is checked separately.

## Practical boundaries

- Real provider access, translation meaning, prices/latency, and a real model's resistance to prompt injection were not measured.
- Chrome native toolbar/activeTab-only and native permission approve/deny were not checked: the harness grants the loopback host in a separate profile.
- Firefox's real prompt was shown and handled with its button through the test driver's chrome context; physical clicking, toolbar/activeTab-only on an external site, and native popup geometry are not established.
- Signed install/AMO and installation-time data consent, full WCAG/contrast audit, minimum-version browser runtime, and browser restart/session-key lifetime were not checked. Successful runtime applies to Chromium152 and Firefox157.
- Migration between two key stores has no shared crash-atomic transaction; normal rollback was checked, and the limitation is recorded in [TD-001](../../specs/TECHDEBT.md).

## Method sources

CLI version 0.3.0 was checked separately: [QA-CLI](QA-CLI.md). This document preserves the historical API baseline; new packages, native permission, and explicit CLI test boundaries are in the supplement.

Before implementation, [Stack Overflow](https://stackoverflow.com/questions/76499601/how-to-load-extension-in-playwright-python) and [Reddit](https://www.reddit.com/r/QualityAssurance/comments/1fq5st9) were reviewed. Solutions were checked against [Playwright extensions](https://playwright.dev/docs/chrome-extensions), [Chrome E2E](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing), [MDN background](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background), [Mozilla geckodriver](https://firefox-source-docs.mozilla.org/testing/geckodriver/Profiles.html), and [WXT packaging](https://wxt.dev/guide/essentials/publishing.html). Additional research links: [RESEARCH](../RESEARCH.md), [FIREFOX-QA](FIREFOX-QA.md).
