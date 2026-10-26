# Linguisty 0.4.0 — Codex connection

Developed by Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI tools and actual checks are listed below. See [AUTHORS](../../AUTHORS.md).

Date: 2026-10-08, Europe/Moscow. WI-022. User instructions: [CODEX-CONNECTION](../guides/chatgpt-connection.md); primary sources and discovered browser limitations: [RESEARCH](../RESEARCH.md#wi-022-codex-без-установки-соединителя).

Before → after: four CLIs in the selector and installation of a Native Messaging host → API providers and a single Codex option; the button opens a separate page with four steps, ChatGPT sign-in, models, testing, and disconnection. The new mode uses the official OSS/local OAuth preview. The old native transport is retained for internal compatibility. The new mode requires neither a CLI nor a host.

## Checks performed

| Check | Actual result |
|---|---|
| TypeScript / ESLint | PASS |
| Vitest | 644 PASS, 45 files, maximum 2 workers |
| Existing native contracts | 15 PASS, fake CLI subprocesses only |
| Manifest/hygiene checker tests | 8 PASS |
| Chrome / Firefox production builds and ZIPs | PASS, version 0.4.0 |
| Manifest / secrets / local assets | PASS, 28 files and 24 referenced assets each |
| Mozilla Add-ons Linter 10.13.0 | 0 errors, 0 notices, 0 warnings |
| Codex in Chrome 152.0.7977.8 | 5 groups PASS; unchanged package, mock OAuth/Responses |
| Codex in Firefox 157.0.1, geckodriver 0.37.1 | 4 groups PASS; unchanged package, mock OAuth/Responses |
| Full existing API smoke | Chrome: 13 scenarios / 14 Node PASS; Firefox: 14 groups PASS |
| Final API cache regression after account-scope fix | Chrome: 2 scenarios / 3 Node PASS; Firefox: 3 groups PASS |
| Cache / duplicates / temporary resources | PASS; details below |

Full API smoke was performed before the final change limited to Codex account scope in the cache key. After that change, full Vitest, both Codex browser checks, and focused API cache smoke were repeated; other API browser groups were not rerun. This is not presented as a second full browser run.

Chrome checks the three-option dropdown, hidden API fields, saving before opening the guide, four steps, a real browser redirect to its own callback, PKCE/RSA/OIDC fixture, rule cleanup, a single guide tab on repeated clicks, background port, and actual Text-node translation/restoration of the original. A repeat in the same account uses the persistent cache; sign-in with a different signed fixture sub triggers a new Responses request. Total: two token/model/Responses/callback requests, zero unexpected network requests. Disconnecting/closing the tab produces a safe reconnect error. The 360 px layout has no horizontal overflow; desktop/mobile screenshots were reviewed.

Firefox checks the standard optional host grant, the same callback and bridge, translation/original, reopening, and disconnection. Testing uses temporary installation; the system test area is used only to click browser permission UI. Chrome host access was granted in advance through test-browser UI: the physical Chrome permission dialog was not checked. OpenAI endpoints are substituted only on the test page; production package sources are not patched.

Unit contracts check state/PKCE/nonce, RSA signature/issuer/audience/expiry, mandatory plan authorization, refresh rotation/failure, Responses completed/incomplete/refusal/UTF-8/limits, scoped cache and strict IDs, timeout/cancel, and 30 port cleanup cycles. They also check waking the Chrome background when the tab URL is hidden and cleanup limited to owned rules/tabs.

## Problems found and fixed

- Optional declarativeNetRequestWithHostAccess: Firefox did not expose the API, and Chrome stalled on updateSessionRules. The permission is now required; OpenAI/loopback host access remains optional and is granted by the button. There is no broad required host access.
- Chrome tabs.query could not find its own guide URL, created a duplicate, and mixed status from two sessions. Discovery through runtime.getContexts is restricted to its own documentUrl and survives worker restart. Five repeats passed after the fix; the final extended cache run also passed.
- Account scope initially separated only in-flight requests. It now also enters the persistent cache digest; tokens and email do not enter the digest. The API digest is preserved.
- The narrow heading broke a word. Its size was corrected only for the Codex guide; both themes and the mobile screenshot were reviewed visually.

## Memory and artifacts

Snapshot after browser checks: node_modules — 8 473 files / 193 593 454 B; .wxt — 6 / 6 713 B; .output — 75 / 10 038 595 B before documentation was updated in the sources ZIP. Source scan: 206 files, no identical copies or suspicious artifacts. No dependencies were installed, no watch/helper processes were left running. Shared UI JS chunk: 614 710 B; the Vite >500 kB warning remains in TD-002 and is not hidden.

Protected .cache retained the initial 5 652 files / 203 426 930 B. Old cache/profiles/reports from other tasks were not removed. Test profiles created by this task were deleted; Firefox cleanup reports ownProcessCount=0/profileRemoved=true, and an additional check of Chrome/Firefox QA command lines found 0 processes. Free RAM in the checkpoint snapshot: 13 429 415 936 B of 34 282 012 672 B; this is a measurement, not independent proof that leaks are absent. Lifecycle is supported by separate tests.

Artifacts: `test-results/linguisty-codex/{chrome,firefox,hygiene,packages}.json`, four screenshots, and the owned driver log. Full API reports: `test-results/linguisty-smoke/observations.json` and `test-results/linguisty-firefox/observations.json`; final cache reports: `observations-focused-cache.json` in the same directories. The JSON with package hashes is created after final packaging.

## Reproduction and limitations

Basic commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:native`, `node --test --test-concurrency=2 scripts/check-manifests.test.mjs`, both `zip:*`, `npm run check:manifests`, `npm run check:hygiene`. Browser commands are listed in [TESTING](../guides/testing.md). Available Chromium is set through `LINGUISTY_CHROMIUM_EXECUTABLE=C:/Users/Nik/AppData/Local/ms-playwright/chromium-1237/chrome-win64/chrome.exe`. The Mozilla linter was run from the existing protected cache without npm install.

**Real ChatGPT sign-in, account/plan eligibility, real CORS/OpenAI callback, model responses/language accuracy/costs, store distribution conditions, signed/store installation, and minimum-version browsers are unverified.** The official preview is used; the fixture does not establish universal subscription access. The model runs in OpenAI's cloud. The connection tab must stay open; closing, reloading/unloading the tab, or restarting the browser requires signing in again. Chrome and Firefox ZIPs are local packages; Firefox is unsigned.
