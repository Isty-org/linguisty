# Linguisty 0.3.0 — actual CLI verification

Developed by Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI tools and actual checks are listed below. See [AUTHORS](../../AUTHORS.md).

Date: 2026-10-08. WI-021. Supplements the previous [QA-REPORT](QA-REPORT.md) without replacing its historical results.

Before: only OpenRouter/OpenAI-compatible APIs with a key. After: four additional installed CLIs through an automatically launched Native Messaging connector; the extension interface, existing APIs, cache, and restoration of the original are preserved.

## Completed

| Check | Actual result |
|---|---|
| TypeScript / ESLint | PASS |
| Vitest | 589 PASS, 37 files, maximum 2 workers |
| Node native tests | 15 PASS: frame/Unicode/limits, queue/cancel/timeout/disconnect, Windows cmd/ps1 shim resolution, four subprocess adapters, and cleanup |
| Manifest checker tests | 8 PASS |
| Chrome and Firefox builds / ZIP | PASS, version 0.3.0 |
| Manifests / secrets / local assets | PASS, 21 files each, existing required permissions, optional nativeMessaging |
| Mozilla addons-linter | 0 errors, 0 notices, 0 warnings |
| Chrome API/UI + native smoke | 16 PASS; Chromium 152.0.7977.8 |
| Firefox API regression smoke | 14 PASS; Firefox 157.0.1 |
| Firefox native smoke | 5 checks PASS: standard optional grant, keyless save, presence, and four page translations |
| Hygiene | PASS, no source duplicates or suspicious copies |

The Windows installer was actually run: owned manifests were registered in HKCU, and files were copied to LocalAppData/Linguisty/native-host. Real Native Messaging status detected Codex from the desktop installation and Grok Build. Claude Code and Antigravity CLI were not found through the supported paths in this environment. Presence detection did not perform inference.

Chrome native transport used a **separate temporary copy** of the package with nativeMessaging in required permissions: headless Chromium cannot control its own native approval bubble. JavaScript/assets were unchanged; the production manifest retains the optional permission. An attempted grant through temporary preferences did not survive reloading the unpacked extension and is not counted as successful. The main Chrome API/UI scenarios used the unchanged production package.

The Firefox native scenario uses the **unchanged package** and the standard optional permission, accepted with the real prompt button through the privileged area of the isolated test driver.

Native page translations in both browsers use a deterministic host fixture; responses from the four CLI subprocess adapters use local Node fixtures. They verify the channel, framing, launch, strict IDs, and page pipeline, and **do not establish** compatibility with a live account or model quality.

Evidence: test-results/linguisty-native/chrome.json, firefox.json, cli-options.png; test-results/linguisty-smoke/observations.json; test-results/linguisty-firefox/observations.json; test-results/linguisty-ui/observations.json.

## Resources

Client and host are limited to 16 pending requests, CLI inference is sequential, frame 900 KiB, stdout 4 MiB, stderr 32 KiB. Verified 30 connect/reply cycles without accumulating timers/listeners; 100 queue cancellations without retaining text; real fixture children terminated and removed their own temporary workspaces. Cache/dedup of repeated CLI requests was checked through the existing engine.

After browser checks, **0** processes from the connector/CLI fixtures created by this task were found; no temporary CLI/native/Chromium directories created by this task remained. The Firefox driver records 0 processes owned by it and removal of its profile. Other people's processes and cache were not cleaned.

Last measurement before writing the report: node_modules 193 592 668 B; .wxt 6 664 B; .output 8 136 550 B; .cache 203 426 930 B; test-results 17 421 351 B; free RAM 14 913 101 824 / 34 282 012 672 B. During the Firefox run, .cache grew because of the temporary profile, then returned to the previous 203 426 930 B. These numbers are observations, not proof that all leaks are absent. WI-011 leftovers and a separate UI snapshot are preserved.

The shared UI chunk of 586 435 B triggers Vite's >500 kB warning; the previous API chunk with logos was 568 216 B. The warning is not hidden; the trade-off is recorded in TD-002.

## Packages

| ZIP | Size | SHA-256 |
|---|---:|---|
| .output/linguisty-0.3.0-chrome.zip | 413 183 B | 21458db533a9b965a007b890b6afe4d85106e278c243627f80e85e070c40017c |
| .output/linguisty-0.3.0-firefox.zip | 413 266 B | d9c1387ed28f578b258f43f1efb5e823eb6a24132a00bfeea69043a74dba550d |
| .output/linguisty-0.3.0-cli-helper.zip | 11 932 B | 0799c92e46655a62c74a290ae1ad6ad968606da7f2a5a5288eebe0dca0139c81 |

The CLI installer ZIP contains only 7 runtime/installer files and LOCAL-CLI.md, with no Node, third-party CLIs, tokens, or user configurations.

## Reproduction and boundaries

Main commands: npm run typecheck, npm run lint, npm test, npm run test:native, node --test --test-concurrency=2 scripts/check-manifests.test.mjs, npm run zip:chrome, npm run zip:firefox, npm run zip:cli, npm run check:manifests, npm run check:hygiene.

For the available Chromium, set LINGUISTY_CHROMIUM_EXECUTABLE=C:/Users/Nik/AppData/Local/ms-playwright/chromium-1237/chrome-win64/chrome.exe; node --test --test-concurrency=1 tests/ui/browser-ui.test.mjs tests/e2e/chromium-smoke.test.mjs tests/e2e/native-chrome.test.mjs. Firefox: node scripts/firefox-smoke.mjs and node tests/e2e/native-firefox.mjs. Native smoke installs the host and temporarily substitutes only its own registration; the fixture registration is restored after the test browser closes.

Live responses from all four tools, authorization, model language/quality/speed, and account costs are **unverified**. Physical Chrome approval of the native permission, toolbar-only activeTab, signed/store installation, minimum-version browsers, the macOS/Linux installer, and abrupt shutdown of the whole computer are unverified. Cancellation does not guarantee cancellation of cloud charges. The CLI may keep its own history.
