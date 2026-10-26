# Linguisty 0.4.5 — popup and regressions

Developed by Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI tools and actual checks are listed below. See [AUTHORS](../../AUTHORS.md).

Date: 2026-10-09. Work: WI-027. Packages tested in Chromium 152.0.7977.8 and Firefox 157.0.1.

## Before → after

- The header text “Настройки / Settings” → a gear icon with a fixed 44×44 px hit area, localized accessible name and tooltip; the SVG is decorative.
- The popup saved the entire loaded configuration when changing the language → the background applies only sourceLanguage/targetLanguage/targetLanguageMode to the latest configuration under the existing queue. New model/provider/theme/keyMode/instructions are preserved. apiKey is rejected when languagesOnly=true.

Regression of the old form before the fix: FAIL — gpt-6-luna/codex was expected, but vendor/model/openrouter and the old preferences were returned. After the fix: PASS. The user's selected Luna 6 is not replaced.

## Checks performed

Typecheck and lint: PASS. Vitest: 705 tests / 47 files, maximum 2 workers. Native fixtures: 15 PASS; real models were not launched. Manifest/hygiene tests: 9 PASS. Production builds Chrome/Firefox: PASS; manifests/resources/secrets: PASS. 28 files and 24 referenced assets each; 1 142 113 / 1 142 276 bytes before compression. The shared UI chunk of 608 946 bytes remains the known TD-002.

Chrome: 13 full smoke groups PASS, including progressive streaming/rollback, CJK/large pages, DOM/forms, mutations and SPA, cache/model isolation, service worker termination, 401/429/incorrect IDs, cancellation/late responses, and themes. Firefox: 14 groups PASS, additionally covering standard denied/granted permissions, a repeatable lifecycle with zero timers/observers, and an unchanged production package.

Gear icon on both platforms: 16 localized accessible names, tooltip, decorative SVG, 44×44 px, Paper/Graphite, RTL, Shift+Tab/focus-visible, and Enter open settings. Chrome was checked at 320/390 px; Firefox used the popup page's own 390 px width in an isolated tab. A real stale Chrome popup preserved the new model/theme/instructions after changing target; the actual Firefox background was checked with the same merge contract. In the first Chrome check, the API hid the URL of the active tab owned by the test: the test was corrected to compare known tab IDs with explicit popup → options switching; extension permissions were not expanded.

Subscription: 8 groups PASS in each browser. Each translated 1 340/1 340 fragments, made 84 fixture Responses requests, and had 0 errors; repeat: 1 340 from cache / 0 new requests. An incomplete response was rejected with LGT-response-completion, the original DOM and cache were preserved, pending=0. The selected gpt-6-luna and strict schema were confirmed by the fixture; this is not live inference.

Chrome ZIP: 440 832 bytes; Firefox: 440 918 bytes. Both manifest=0.4.5; all 28 files in each ZIP match the tested build directory byte for byte via SHA-256. Mozilla addons-linter: errors=0, notices=0, warnings=0. The Firefox ZIP is unsigned.

## Resources and evidence

.cache before, between, and after browser runs: 5 652 files / 203 426 930 bytes; dependencies were not installed, other people's processes/cache and WI-011 were untouched. Source duplicates=0, suspicious=0. Last Firefox subscription runtime: 12 owned processes / 1 379 880 960 bytes working set → 0, profileRemoved=true; the other Firefox runs also have remainingOwnedProcesses=0. Chrome contexts and owned profiles were closed. Remaining QA/watch processes=0. Free RAM snapshots and directory sizes are observations, not proof that every possible leak is absent.

Evidence: `test-results/linguisty-smoke/observations.json`, `test-results/linguisty-firefox/observations.json`, `test-results/linguisty-rebrand/{observations.json,firefox/observations.json}`, `test-results/linguisty-subscription-translation/{chrome,firefox}.json`, `test-results/linguisty-popup-regression/{hygiene-before-pack,hygiene-final}.json`. Screenshots: `test-results/linguisty-rebrand/popup-light.png`, `popup-gear-en-light.png`, `popup-gear-ar-light.png`, and Firefox counterparts.

## Limitations

Local API and subscription responses check the protocol and extension behavior; live Luna 6, real ChatGPT sign-in/plan, and language accuracy were not checked. The Chrome native host permission dialog and exact geometry of the popup opened with the toolbar button remain separate manual checks. The Firefox package is unsigned; publication and store installation were not performed. No claim is made that all possible bugs or memory leaks are absent.
