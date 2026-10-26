# Firefox runtime QA — WI-010

Developed by Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI tools and actual checks are listed below. See [AUTHORS](../../AUTHORS.md).

After the focused Isty footer change, the packaged language/form scenario was repeated: PASS; Mozilla validation of the Firefox ZIP: 0 errors/notices/warnings. Full translation smoke below was performed before the footer; background/content hashes did not change. Current sizes and screenshots are in [QA-REPORT](QA-REPORT.md).

Current version **0.2.0 after Retro Orbit**, 2026-10-08: Firefox 157.0.1 / geckodriver 0.37.1 — **14 PASS / 0 FAIL**, including font, log, SSE, and large/inline DOM. Package index before/after: `02261dbf583fc49e9f016fc5e14f78d36bcc64238aa8c11bc779c11e6e1812ec`. A separate packaged language scenario passed browser default uk-UA, Arabic RTL, manual sr-Latn-RS/English save/reopen, and return-auto through the real form. Mock active requests/timers and remainingOwnedProcesses after cleanup were 0, profiles removed. Firefox ZIP: Mozilla Add-ons Linter 10.13.0 — 0 errors/warnings. This is not an evaluation of the real API or native-speaker review of all languages. Final sizes/limitations and evidence: [QA-REPORT](QA-REPORT.md).

Before the redesign, the same version 0.2.0: 13 PASS / 0 FAIL; first local mock translation 136 ms, full 2527 ms, regular 2519 ms. Package index `ec4a586df53bcb6c91c73f471397f1da25d64b8b4a8f7cdf19a4892094edca09`. Key lifecycle: 2 PASS, both profiles removed; a separate lifecycle run was not repeated after the redesign.

Previous version 0.1.1 (WI-015/WI-016), 2026-10-08: Firefox 157.0.1 — 10 PASS/0 FAIL; separate key lifecycle: 2 PASS. `node tests/e2e/firefox-key-lifecycle.mjs` checks real reloads, installation of a higher-version temporary package with the same ID, and browser exit/start in a single owned profile. The local key survived temporary reinstallation with both normal and preservation preferences. Preferences are changed only in the profile created by the test; the user profile is not used. After cleanup, no owned Firefox/driver processes remained and both profiles were removed. Signed permanent installation and updating the Firefox executable were not checked. Current hashes/limitations: [QA-REPORT](QA-REPORT.md).

The history of 0.1.0 is preserved below.

The WI-010 method and historical results below are preserved. After WI-011, the current build was checked again on Firefox 157.0.1: 10 PASS/0 FAIL; `observations.json` contains this new run. Current package hash, Mozilla validation, and cleanup limitations are in [QA-REPORT](QA-REPORT.md).

The 2026-10-07 check uses the installed Firefox 157.0 and geckodriver 0.37.1. The original production directory `.output/firefox-mv3` is installed as a temporary add-on without modifying manifest, CSP, permissions, or JavaScript. This checks runtime, not signing or AMO publication.

Assignee's full pass on 07.10.2026, 11:17:52–11:18:33 MSK: **10 PASS, 0 FAIL**, exit code 0. Tested package snapshot before/after: `78dbc619cdfa64dd39ce225a719dfd34277edf407aa54518dd24363f1b55ba26` (13 files, 343 380 bytes). After cleanup: 0 owned Firefox/driver processes, profile removed, 0 active mock requests, and 0 pending mock timers. No production defects were found within the tested scope; the limitations listed below remain unverified.

After the assignee's snapshot, the coordinator fixed UI raw-authority/C0/DEL validation and background model limit 200, rebuilt production, and independently repeated full smoke. **Final WI-010 run, 11:28:32–11:29:15 MSK: 10 PASS, 0 FAIL**, 13 files / **343 812 bytes**, SHA-256 index **62487cf6ef6281404c884a84ab91c2a50e3d6795d14639a5fb52d495fc8e5c3c** identical before/after. After closure, remainingOwnedProcesses=0, profileRemoved=true, activeRequests/pendingTimers=0. These are historical WI-010 snapshots; the current package and evidence are listed above.

## Reproduction

From the Linguisty root, with the existing shared `node_modules` and a ready Firefox production build:

```powershell
node scripts/firefox-smoke.mjs
```

Default driver: `.cache/firefox-qa/driver/geckodriver.exe`. Default browser: `%LOCALAPPDATA%/Mozilla Firefox/firefox.exe`. `LINGUISTY_FIREFOX_EXECUTABLE` and `LINGUISTY_GECKODRIVER` support explicitly selected local executables; the test does not install a new browser or npm dependencies. `LINGUISTY_FIREFOX_SMOKE_FILTER` retains onboarding, matching checks, and package hash comparison; such a run saves a separate `observations-focused-*.json` and does not replace the full report.

To restore the local driver, use only the [official Mozilla 0.37.1 release](https://github.com/mozilla/geckodriver/releases/tag/v0.37.1):

```powershell
$firefoxQaRoot = Join-Path (Get-Location).Path '.cache/firefox-qa'
New-Item -ItemType Directory -Path $firefoxQaRoot -Force | Out-Null
$firefoxQaRoot = (Resolve-Path -LiteralPath $firefoxQaRoot).Path
$firefoxQaRelease = Invoke-RestMethod 'https://api.github.com/repos/mozilla/geckodriver/releases/tags/v0.37.1'
$firefoxQaAsset = $firefoxQaRelease.assets | Where-Object name -eq 'geckodriver-v0.37.1-win64.zip'
$firefoxQaArchive = Join-Path $firefoxQaRoot 'geckodriver-v0.37.1-win64.zip'
Invoke-WebRequest -Uri $firefoxQaAsset.browser_download_url -OutFile $firefoxQaArchive
$firefoxQaHash = (Get-FileHash -LiteralPath $firefoxQaArchive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($firefoxQaAsset.digest -ne "sha256:$firefoxQaHash") { throw 'Official release digest mismatch.' }
Expand-Archive -LiteralPath $firefoxQaArchive -DestinationPath (Join-Path $firefoxQaRoot 'driver') -Force
@{ name=$firefoxQaAsset.name; url=$firefoxQaAsset.browser_download_url; digest=$firefoxQaAsset.digest; verifiedSha256=$firefoxQaHash; bytes=$firefoxQaAsset.size } |
  ConvertTo-Json | Set-Content -LiteralPath (Join-Path $firefoxQaRoot 'driver-source.json')
if ((Split-Path -Parent $firefoxQaArchive) -ne $firefoxQaRoot) { throw 'Unowned archive path.' }
Remove-Item -LiteralPath $firefoxQaArchive
```

Verified archive SHA-256: `dfed9315abe8d2fbc1b6161a2ee8002452e79cf05ee92fdc653a4e26bc35edd8`. The archive is removed after extraction; the binary and source metadata remain for the next run. The coordinator performs the final production build separately; smoke does not build or write to `.output`.

## Method and evidence

`tests/e2e/firefox-runtime.mjs` uses direct WebDriver HTTP, so no Selenium dependency is needed. Each run creates a new `.cache/firefox-qa/profile-*`; geckodriver and Firefox run hidden/headless, and the remote endpoint listens only on `127.0.0.1`. Neither an existing user profile nor unrelated Firefox/Node processes are used or closed.

`--allow-system-access` is enabled only for the test driver: Firefox chrome scope is needed to open options/popup in a trusted context and control the real optional-host prompt. This is the [documented Firefox UI testing mode](https://firefox-source-docs.mozilla.org/testing/geckodriver/Flags.html#allow-system-access). Host permission is neither added to the manifest nor assigned directly through the internal permission store: production options calls `permissions.request`, and the test first denies, then allows the real Firefox prompt using its button. In headless Firefox, WebDriver click on native `moz-button` returned `element not interactable`; the harness calls that button's `.click()` in chrome scope after the anti-click-through delay. A physical user click remains a separate check.

The popup opens as a trusted inactive extension tab over the selected fixture. It uses production markup, handlers, and the real background. This method does not establish conditions for native toolbar/activeTab-only gestures: the API-origin permission granted through options covers the loopback fixture.

`tests/e2e/local-server.mjs` and existing HTML/CSS/JS fixtures were reused. The mock listens on a random loopback port, checks Authorization and bounded input, and returns deterministic texts and errors; external APIs are not called. The test credential is not the user's key and is not written to evidence. Report errors and driver logs are redacted in case it appears.

Main evidence: `test-results/linguisty-firefox/observations.json`. It contains the runtime version, package manifest/file SHA-256 before/after, scenario results, bounded cache stats, lifecycle counters, RAM samples, and finally cleanup. Screenshot evidence: `real-estate-translated.png`, `spa-translated.png`, `options-light.png`, `options-dark.png`, `options-system.png`, `popup-system.png`. These generated files are not production assets.

## Scenarios

| Check | Observed behavior |
|---|---|
| Onboarding/options | Onboarding is visible without a key; denying the optional-host prompt preserves previous settings and absence of a key; granting saves the local gateway and manual model and clears the password input; connection/model discovery use the mock |
| Production popup pipeline | Popup → background → injected page → mock → Text nodes; viewport handled before far content; numeric values, whitespace, DOM references, entered form values, gallery, and submit listeners preserved |
| Original/resume | Exact original restored without network; insertion in original mode remains original; returning to translated handles new nodes; own mutations do not trigger repeated requests; reopening the popup preserves real progress |
| Dynamic/SPA | External changes become the new original; inserted and removed nodes tracked; a history route creates a new sessionId, translation, and provider context with the new title |
| Cache | Repeating the same table makes no requests; fully cached `fromCache` equals the translated-node count; changing models makes a request; stats bounded; clearing without a provider resets entries to zero |
| DOM/security | hidden/editable/code/URLs/email exclusions respected; placeholders preserved; a response containing HTML is displayed as literal text without img/script execution |
| Errors | 401, 429, malformed JSON, and unknown node IDs produce the corresponding public errors without raw mock response/credential; restricted `about:config` rejected |
| Resources | Three start/cancel/close cycles; reinjection does not multiply observers/listeners; cancellation resets content timers/observers and mock requests/timers to zero; closed tabs removed from session snapshots |
| Secrets | session/persistent transfer leaves exactly one copy; UI public responses do not contain the key; content GET_SETTINGS/GET_SECRET_STATUS rejected; deletion clears both areas |
| Themes/accessibility | Light/dark/system applied in real options, fields have labels, Tab from model moves focus to the discovery button, popup progress uses aria-live |

Exact PASS/FAIL and SHA-256 apply to the specific run in the JSON. A PASS from an old package cannot be assigned to a new build without repeating smoke.

## Resources and limits of the conclusion

The resource probe is installed in the isolated content world before production injection. It tracks `setTimeout`/`clearTimeout`, MutationObserver/IntersectionObserver, and page listeners; production files remain unchanged. Native observer subclasses in Firefox did not preserve intercepted methods, so the probe uses a JS wrapper that forwards calls to the real observer. Zero counters after cancellation are checked only after nonzero activity. The bootstrap pagehide listener remains until document closure and is not counted as a canceled-session leak.

Finally removes only a profile with the verified parent `.cache/firefox-qa` and prefix `profile-`; closes the WebDriver session and captured owned PIDs; closes the local mock and checks `activeRequests=0`, `pendingTimers=0`. Working set and available RAM are recorded at installation, after the pipeline, after three lifecycle cycles, and after cleanup. RAM snapshots alone do not prove that every leak is absent. Cache TTL/LRU/50 MiB eviction and IndexedDB failure are not simulated in this runtime smoke; they require corresponding contract/unit tests.

Unverified: signed-install/AMO, installation-time data consent, physical native permission/toolbar gesture, activeTab-only on an external site without a persistent host grant, real popup geometry, real provider/language accuracy, full WCAG/contrast/reduced-motion audit, and browser restart with a session-key lifetime check. Do not count these items as PASS.

## Research before implementation

Forums were reviewed as sources of known problems; API solutions were confirmed with Mozilla:

- [Reddit: Selenium and a separate Firefox profile](https://www.reddit.com/r/learnpython/comments/gifr92/) — confirms the need to distinguish the test instance from the user profile.
- [Stack Overflow: temporary add-on through geckodriver](https://stackoverflow.com/questions/54754945/how-to-install-extension-permanently-in-geckodriver/54807581) — starting point for installAddon.
- [Mozilla geckodriver profiles](https://firefox-source-docs.mozilla.org/testing/geckodriver/Profiles.html) — new profile, scoped TMP/TEMP, and explicit session removal.
- [Mozilla geckodriver flags](https://firefox-source-docs.mozilla.org/testing/geckodriver/Flags.html) — loopback binding and chrome-context UI testing.
- [Mozilla Marionette API](https://firefox-source-docs.mozilla.org/python/marionette_driver.html) — chrome/content contexts and automation primitives.
- [Mozilla Bug 1959376](https://bugzilla.mozilla.org/show_bug.cgi?id=1959376) — obtaining the real extension URL through WebExtensionPolicy.
- [Mozilla temporary installation limitations](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/#limitations) — temporary installation does not reproduce installation-time permission/data-consent prompts.
- [MDN content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts) — Firefox isolated scope and Xray; the harness is not injected into the MAIN world.

Owning specs: `spec://common/PROP-002-quality#checks`, `#resources`, `#hygiene`; `spec://modules/platform/INFRA-001-extension#root`; `spec://modules/page/FEAT-002-page-translation#sessions`; `spec://modules/interface/FEAT-003-controls#options`.
