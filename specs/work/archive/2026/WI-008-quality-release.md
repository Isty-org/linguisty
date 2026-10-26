# WI-008: Checks, browser smoke, and release assets

- Kind: `implement`
- Canon action: `none`

## Outcome

The project has independent fixture/manifest/resource checks, installation assets, and an honest integration readiness report.

## Specs

- Governing: `spec://common/PROP-002-quality#checks`
- Governing: `spec://modules/platform/INFRA-001-extension#acceptance`
- Constraint: `spec://common/PROP-000-product#acceptance`

## Scope

- In/owned: `scripts/**`, `tests/fixtures/**`, `tests/e2e/**`, `public/icon/**`, `docs/archive/QA-REPORT.md`, this WI's Result; exception: `scripts/firefox-smoke.mjs` and `tests/e2e/firefox-*.mjs` belong to WI-010.
- Out: production modules/shared/config/lock, others' tests, specs/BOARD/WAL/archive, root docs.
- scripts/check-manifests.mjs validates .output/chrome-mv3 and firefox-mv3, brand/permissions/CSP/background shape/entrypoint assets/no leaked secrets/no mandatory all_urls.
- scripts/check-hygiene.mjs gives bounded filesystem sizes/duplicate suspicious sources/cache artifacts. Do not delete others' files.
- Assets: create 16/32/48/128 PNG icons using supplied docs/design/assets/original-logo.png as visual reference or a clear code-native Linguisty mark. Do not show a different textual name. sharp available, no remote fonts.
- Browser smoke through an allowed CLI/tool if available, preferably Playwright bundled Chromium; local mock API HTTP localhost allowed, no user key needed. Do not use a regular Chrome profile. Do not write production files to simplify the test.

## Dependencies

- Depends on: WI-002; fixtures/assets/checks independent; final smoke requires WI-003…WI-007 and coordinator integration.

## Acceptance

- [x] Real estate/dynamic/table/forms/DOM edge case fixtures added.
- [x] Scripts validate both manifests and report real resource sizes; icons packaged correctly.
- [x] Integration commands and browser smoke completed after modules appeared; available checks marked separately from unavailable ones.
- [x] QA report lists commands/results/limitations, no fictitious real translation quality.
- [x] No unnecessary duplicate modules/cache/watch processes; resource cleanup checked.

## Result

Ready for coordinator review, 2026-10-07. QA implementer did not change acceptance/BOARD/WAL/archive; the coordinator accepts the WI and product version. The available QA pass is complete. Green snapshot350+9 applies to the version before the final URL/cache-counter changes; the coordinator performs the final repeat of shared checks/builds/full Chromium. A separate WI-010 supplements Firefox runtime.

- Before → after: no independent package/resource checks, installation icons, or fixtures → manifest/hygiene checker,6 regression tests, PNG16/32/48/128 code-native Linguisty “L”,5 HTML fixtures with bounded interaction helpers, loopback mock, isolated browser harness, and factual QA report.
- Owned files/exports: `scripts/check-manifests.mjs` (`inspectBuild`, `checkManifests`), `check-hygiene.mjs` (`checkHygiene`), `check-manifests.test.mjs`, `generate-icons.mjs`, `check-fixtures.mjs`, `browser-preflight.mjs`, `scripts/assets/linguisty-mark.svg`; `public/icon/{16,32,48,128}.png`; `tests/fixtures/{real-estate,dynamic,table,forms,dom-edge-cases}.html`, `fixture.css`, `fixture.js`; `tests/e2e/local-server.mjs` (`startLocalServer`, `translatedText`, `MOCK_KEY`), `browser-runtime.mjs` (`launchIsolatedChromium`), `chromium-smoke.test.mjs`; `docs/archive/QA-REPORT.md`. Firefox-owned files unchanged.
- Independent checks: icons PASS; node manifest/hygiene tests6/6 PASS; fixtures5/5 PASS (jsdom structure/interactions, not extension translation). Passed global snapshot before final changes: typecheck PASS, lint PASS,350 unit tests/17 suites PASS; maxWorkers2, no watch.
- Both builds/package checks PASS: Chrome341937 bytes, Firefox342100 bytes, each13 files/12 referenced assets. MV3/brand/permission/CSP/platform background/minimum versions/data consent/assets/known secrets/dev markers checked; heuristic does not prove absence of arbitrary secrets. `.output` total684037 bytes.
- Full real Chromium extension smoke PASS for the checked package before final changes:9 scenarios + parent =10 Node tests, no skipped/failed, `observations.json.ok:true,fullSmoke:true`. Chromium152.0.7977.8 (cached bundled revision1237) with Playwright1.63.0 and explicit executable. Isolated profile/unmodified production build/local-only provider, no real key/paid requests. Tested UI→background→content pipeline, viewport order, forms/gallery/links/DOM identity/whitespace, toggle/resume/reopen, exclusions/placeholder tokens/text-only HTML, dynamic/external mutation/SPA, cache/model isolation, real worker stop/recovery/new batch,401/429/malformed/unknown IDs/retry/redaction,cancel/late reply/tab close,light/dark/system/labels/focus/reduced-motion preference/restricted page.
- Found defects were passed to specific owners through report/Result: SPA loading event removed same-document session; malformed raw authority `https://@example.com/v1`; early WXT path/lint/hoisting defects. Fixed by production owners; targeted/full checks rerun after new changes; final SPA/unit checks PASS. QA did not change production/shared/config/lock/others' tests.
- Evidence: `test-results/linguisty-smoke/observations.json` + translated fixture/options theme screenshots (5 files877597 bytes). Latest mock52 requests/max concurrent2/active0/timers0/page errors0. Temporary browser/server/CDP/listeners clean in finally. Post-run process/profile check: own Node0, isolated Chromium0, temporary profiles0.
- Final hygiene PASS: node_modules193585466 bytes/.wxt6390/.output684037; source snapshot86 files505412 bytes/duplicates0/suspicious0/hashSkipped0. RAM total34282012672/free16774664192; inspectorRSS64217088/heap8835024. This is a snapshot, not proof of leak absence. Temporary local cache is in the removable test profile; others' cache/processes/artifacts were not deleted.
- Limitations: installed driver's default Chromium1243 is absent, so cached1237 was set explicitly; the coordinator installs a matching runtime if needed. Native toolbar activeTab + native permission approve/deny not tested: loopback access configured through isolated developerPrivate + permissions.request, popup inactive tab. Firefox build PASS does not equal Firefox runtime PASS; WI-010 owns a separate Firefox harness/report. Real OpenRouter/semantic translation/latency/cost not tested without a key and separate assignment. Full UI state/mobile/contrast matrix is not claimed as checked.
- Integration notes: no additional dependencies/config required for own QA; npm install not run. Coordinator's release runner must explicitly invoke independent node tests and Chromium smoke (intentionally outside Vitest); commands/results/limitations are in the QA report. After WI-010's result, the overall QA report can be supplemented with a link to `docs/archive/FIREFOX-QA.md`, without duplicating the Firefox harness. Coordinator performs final shared checks/zip and accepts results.
- Final handoff: root review added URL one/no-slash+userinfo boundary and exact mixed-batch cache counter after DOM node changes/removal. Optional `cacheHitIds` already in shared contract/PROP-001; storage/engine/content owners implement fixes/regressions. QA does not declare new changes verified or repeat tests/builds/smoke in parallel with the coordinator. Root performs the final run after these changes.
- Handoff hygiene PASS: duplicates/suspicious/hashSkipped0; node_modules193585452/.wxt6390/.output685293/shared test-results1820913 bytes; source87 files527467 bytes. `.cache`3 files5855605 bytes now contains the WI-010 Firefox driver and was not deleted by QA. RAM free16252194816, inspectorRSS64143360/heap8968792. This is a separate resource snapshot, not confirmation of new builds/runtime.


Accepted by the coordinator on 2026-10-07: overall typecheck/lint PASS, 384 unit tests PASS, both production builds/manifest checks PASS, 9 Chromium scenarios PASS after the latest contract changes. Firefox runtime is supplemented by WI-010; real language accuracy was not tested.
