# Linguisty — user-provided logo verification

Developed by Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI tools and actual checks are listed below. See [AUTHORS](../../AUTHORS.md).

Date: 2026-10-08, Europe/Moscow. Ownership: `spec://modules/interface/FEAT-003-controls#design`.

The latest clarification is a compact popup without an introductory banner; the result and current package sizes are listed below. The initial sections record logo verification before that clarification.

Before → after: a header with only a name and a toolbar with the Isty mark → a header with the Linguisty logo, monochrome on paper / brand colors on graphite, and PNG toolbar icons from the color Linguisty logo. Both provided SVGs were copied byte for byte without changing geometry or colors. Size: 64×64 px in options, 44×44 px in the popup. The mark beside the accessible text name is decorative for screen readers. The 42×24 px Isty footer and its 16 localized templates are preserved.

## Scope of the verified result

CLI mode WI-021 is being implemented concurrently in the shared folder by another chat. The shared typecheck/lint in this task's first run stopped on unfinished CLI ErrorCode entries and an unused ChatProvider import; 566 existing tests passed. These results are not called successful CLI acceptance.

Logo verification used a separate copy of the last verified version from `.output/linguisty-0.2.0-sources.zip`, timestamped 13:11:26. Only logos, Brand/CSS, the PNG generator, related documents, and browser assertions were applied to it. Dependencies were connected by a junction to the shared node_modules, without installing a second copy. CLI changes were not reverted; its `.output` and `.wxt` were not overwritten. The verified ZIPs are named `linguisty-0.2.0-logo-{chrome,firefox}.zip` and contain the API version with new logos, without the unfinished CLI mode. Brand/CSS files, the generator, and SVGs in the working project match the verified copy by SHA-256.

## Logo results before banner removal

| Check of the separate copy | Actual result |
|---|---|
| Typecheck / lint | PASS |
| Unit/contract/DOM | 566 PASS, 33 files, maximum 2 workers |
| Packaged Chromium / Firefox UI | 3 PASS; API connection/model/progress/cache with local mocks, auto/manual languages, RTL, themed logos |
| Localization / width | 16 UI locales in options at 320/390/1280 px; popup at 320/390 px without horizontal overflow |
| Production builds / resources | Chrome and Firefox PASS; 21 files and 17 referenced assets each; PNG 16/32/48/128 px |
| Chrome build / ZIP | 1 039 979 / 404 164 bytes |
| Firefox build / ZIP | 1 040 142 / 404 248 bytes |
| ZIP payload / duplicates / secrets | Matches production byte for byte; no duplicate entry names or resource/secret validation errors |
| Mozilla Add-ons Linter 10.13.0 | Firefox ZIP: 0 errors, 0 notices, 0 warnings |

Paper/graphite options and popup were reviewed visually. The UI requested no external resources; there were no page errors. Contrast of the checked text tokens is ≥4.5:1; this is not a full accessibility audit. The shared UI chunk of 568 216 bytes retains the existing Vite >500 kB warning (16 local dictionaries, TD-002); the warning is not hidden. Background 75 015 bytes and content script 30 526 bytes match the previous full Firefox smoke by SHA-256; full translation smoke was not repeated for this logo change. Browser UI checks translation with a local mock; no real paid provider was called.

## Resources and evidence

Intermediate and final hygiene: suspicious/source duplicates/hash skips 0, existing `.cache` 203 426 930 bytes / 5 652 files. Firefox owned working set approximately 1.02 GB before closure → 0, remainingOwnedProcesses=0, profile removed. Chromium profiles were closed; loopback mocks finished with activeRequests=0 and pendingTimers=0. Final measurement: free RAM 16 209 674 240 bytes, one physical node_modules of 193 592 370 bytes; the snapshot uses a junction to it. RAM/filesystem measurement does not prove the absence of every possible leak.

Automatic review rejected recursive cleanup of the task's own snapshot and a narrower attempt to remove only its dependency junction; both reasons were “blocked by policy”, with no further detail. Neither command was executed. `test-results/linguisty-rebrand/logo-snapshot/` retains 292 files / 7 689 994 bytes and a junction to the shared node_modules; packages and browser reports are already preserved separately. Other people's processes/cache were untouched. This is a test leftover, not a second physical dependency installation.

Evidence: `test-results/linguisty-rebrand/logo-snapshot-source.json`, `test-results/linguisty-rebrand/logos/{manifests-logo,amo-logo,archives-logo,cleanup-logo}.json`, `{unit-logo-snapshot,browser-logo,packaging-logo}.log`; browser reports and screenshots in `logos/linguisty-{rebrand,ui}/`. Hygiene before/during/after: `test-results/linguisty-rebrand/hygiene-{before,mid,after}-logo.json`.

Limitations: overall WI-021 acceptance remains with its assignee; this check does not replace it. Actual model language accuracy, native popup geometry, and signed installation are unverified.

## User clarification: compact popup

Before → after: a large introductory block between the header and languages → language selection and translation controls immediately. JSX `.popup-intro` and its unused CSS rules were removed. The large heading in options is preserved; Options.tsx was unchanged for this fix. Dictionaries, the localized Isty footer, logo variants, and translation logic are unchanged. Browser test readiness was switched from the removed heading to language controls.

The same separate API copy was used, without reinstalling dependencies or changing the CLI chat's shared `.output`/`.wxt`. Typecheck and lint PASS; existing Popup/Options tests: 37 PASS / 2 files. Packaged UI with local mocks and Firefox languages passed. The Chromium language test initially stopped on saving manual→browser: it expected browser mode/ru-RU but received the old manual/sr-Latn-RS. A repeat of only that scenario passed. Options production code in the copy was unchanged; the exact cause of the previously noted transient discrepancy remains unknown. The first failed log is preserved and is not counted as PASS.

Both production builds passed: Chrome 1 039 204 bytes, Firefox 1 039 367 bytes; 21 files and 17 referenced assets each. The current `.output/linguisty-0.2.0-logo-{chrome,firefox}.zip` replace the previous logo packages: 403 995 / 404 079 bytes. Each ZIP matches its corresponding production build byte for byte, with no duplicate entries. Manifest/secrets/assets PASS; Firefox AMO linter 0 errors/notices/warnings. Background/content SHA-256 matches the previous smoke. The shared UI chunk remains 568 216 bytes; the Vite warning remains.

The new popup was reviewed visually. At 390 px width in manual-target/idle/Russian UI, body screenshot height 608 → 461 px, saving 147 px; browser-target state has an additional auto row and the same banner saving. The Settings header was checked by existing browser assertions. This measures the content page; native toolbar geometry was not checked separately.

Hygiene after the change: source duplicates/suspicious/hash skips 0, `.cache` did not grow — 203 426 930 bytes / 5 652 files; free RAM 14 628 294 656 bytes. Owned Firefox processes after closure: 0, profile removed; mock activeRequests/pendingTimers: 0. Previously rejected snapshot cleanup was not repeated; the same temporary snapshot and dependency junction remain. No new temporary copy was created.

Evidence: `test-results/linguisty-rebrand/compact-popup/` — `{archives,geometry}.json`, `compact-popup-{unit,packaging,browser,language-repeat}.log`, `compact-popup-{manifests,amo}.json`, browser reports and screenshots; hygiene: `test-results/linguisty-rebrand/hygiene-{before,mid,after}-compact-popup.json`.
