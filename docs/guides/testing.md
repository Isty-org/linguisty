# Linguisty acceptance

## Automated checks

Long batch: `node --test --test-concurrency=1 tests/e2e/long-batch.test.mjs`. Chrome checks transport with a 40 s synthetic fetch; Firefox uses loopback HTTP with headers/body delayed by 40 s and natural background unloading after completion. The extension lifecycle API is not polled while waiting. Final run: [QA-2026-10-13](../archive/QA-2026-10-13.md).

Lazy dictionary loading in 0.4.7: `node --test --test-concurrency=1 tests/e2e/locale-loading.test.mjs`. Chromium checks actual requests for only the selected de/fr chunks; both browsers check the offline local pack. Firefox Resource Timing does not expose module requests in the WebDriver session used, so its direct network counter remains unverified. Full-run results: [QA-2026-10-12](../archive/QA-2026-10-12.md).

Popup and 0.4.5 regressions: `node --test --test-concurrency=1 tests/e2e/rebrand-language.test.mjs`, `node --test --test-concurrency=1 tests/e2e/chromium-smoke.test.mjs`, and `node scripts/firefox-smoke.mjs`. Chrome requires an existing `LINGUISTY_CHROMIUM_EXECUTABLE` as described in QA-CODEX. The gear is checked for accessible name, tooltip, SVG, 44 px target size, keyboard access, themes, and 16 locales; model and preferences are protected when an old popup saves languages. Evidence: [QA-POPUP](../archive/QA-POPUP.md).

ChatGPT subscription in 0.4.6: `node --test --test-concurrency=1 tests/e2e/codex-chrome.test.mjs` and `node tests/e2e/codex-firefox.mjs`. For Chrome, set `LINGUISTY_CHROMIUM_EXECUTABLE` as described in QA-CODEX. Both checks run the unchanged package in their own temporary profiles, mock OAuth/JWKS/models/Responses in the test page, and verify the callback, port, and translation. The Responses fixture requires model=gpt-6-luna and strict text.format, returns commentary + final_answer through output_item.done, and supplies empty terminal output; a separate empty completed response tests the new safe code. The shared scenario checks 1,340 segments, a repeat entirely from cache, rejection of an incomplete response with a safe code, and no error response entering the cache. Evidence: `test-results/linguisty-response-stream/{chrome,firefox}.json`. The return flow is checked with web initiator `auth.openai.com`: Chrome submits a form from a locally mocked page at that origin; Firefox navigates with the corresponding content principal and separately verifies rejection of other origins/private pages. Direct `tabs.update(callback)` does not test this boundary. The signed fixture uses a singleton audience array; Firefox also checks the safe token HTTP 401 code, while Chrome checks an invalid-nonce code for secrets and overflow at 360 px. Firefox tests the normal host-access grant; Chrome host access is pre-granted by the test UI, so its permission dialog is unverified. Neither a real account nor paid models are used. Results and limitations: [QA-SUBSCRIPTION](../archive/QA-SUBSCRIPTION.md); original mode: [QA-CODEX](../archive/QA-CODEX.md).

CLI: `npm run test:native`; `node --test --test-concurrency=1 tests/e2e/native-chrome.test.mjs`; `node tests/e2e/native-firefox.mjs`. Native smoke does not call live models. Chrome's test copy, the normal Firefox grant, and reproduction steps are described in [QA-CLI](../archive/QA-CLI.md).

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build:chrome`, `npm run build:firefox`, and `npm run check:manifests`. Tests cover contracts, storage/migration, secret boundaries, TTL/LRU/cache limits, prompts/parsers, provider errors/timeouts/abort, deduplication, DOM filtering/whitespace/restore/mutations/stale replies, and cleanup. Use at most 2 test workers.

## Browser smoke

| Scenario | What to check |
|---|---|
| Installing both builds | Manifest V3, Linguisty, popup/options without CSP errors |
| Onboarding | Missing key/model, link to settings, manual model entry |
| Permissions | Only the selected API origin; denial does not save new configuration |
| Static fixture | Visible text first, complete text, unchanged event handlers/forms |
| JSON/API errors | Unknown IDs, malformed JSON, 401, 429, timeout, no raw secrets |
| Fonts | CJK ↔ Cyrillic: measured glyph heights, size hierarchy, clipping, restoration, and external styles |
| API log | Only allowed machine code/type, HTTP status, and attempts; no provider prose/request IDs or page fragments in storage/UI/copy; old-record cleanup, one record after retry, clear, both themes |
| Streaming | First complete phrase before response completion; damaged IDs/UTF-8/SSE, error under HTTP 200, disconnection, rollback/cancel/route/close, regular mode, and explicit fallback |
| Cancel and restore | No new requests after cancellation; original/translated display without API |
| Dynamic/SPA | New text translated once; old batch not applied after a route change |
| Popup reopen / worker restart | Current status, predictable continuation/restart |
| Cache | Second request without fetch; a different model/instructions/context cannot receive an old translation |
| Resources | Detached nodes, observers/timers/in-flight map released; bounded cache/queue |
| Themes | Light/dark/system, keyboard/focus/labels/reduced motion |
| Languages | New browser default, retained manual choice, independent UI/target, return to auto through form submission, 16 locales, Arabic RTL |

QA reports must distinguish real browser checks, mock/integration tests, and unperformed checks. Two successful builds are not equivalent to two verified browsers.

## Live OpenRouter evaluation

With a supplied key: French property listings (PAP/SeLoger/Bien'ici), news, documentation, an SPA, infinite scrolling, and a table. Check prices/areas/DPE/numbers/names, working buttons/gallery, completeness of meaning, first-viewport latency, restoration, and repeat visits. Compare several independently selected models; do not declare one best after a single test. Do not automatically run paid API calls using someone else's discovered key.

## Final report

`docs/archive/QA-REPORT.md` records actual commands/results, Europe/Moscow dates, artifacts, tested browsers, limitations, and cache/package sizes. An unfinished mandatory acceptance criterion keeps the WI In Progress/Blocked, not Done.

The last local 0.2.0 run after Retro Orbit recorded 566 tests / 33 files, 8 manifest/hygiene tests, 5 fixtures, 13 Chromium scenarios (14 PASS including the parent), separate UI/startup runs, 14 Firefox groups, and 2 packaged language scenarios. Mozilla Add-ons Linter 10.13.0 reported 0 errors and warnings for the Firefox ZIP. Details and historical key-lifecycle evidence: [QA-REPORT](../archive/QA-REPORT.md) and [FIREFOX-QA](../archive/FIREFOX-QA.md). Real-provider quality, native-speaker review of all localizations, permanent signed installation, and updating the Firefox executable are separate from the available automated acceptance.

Complete new scenarios are included in `node --test tests/e2e/chromium-smoke.test.mjs` and `node scripts/firefox-smoke.mjs`. To run an individual scenario, set LINGUISTY_SMOKE_FILTER / LINGUISTY_FIREFOX_SMOKE_FILTER to `fonts`, `journal`, or `streaming`. Production packages are not patched; a test loopback server simulates errors, SSE chunks, and disconnection. Font baseline: `node tests/e2e/font-metrics.mjs`; results: `test-results/linguisty-fonts/baseline.json`.

New regression runs: `node tests/e2e/firefox-key-lifecycle.mjs` and `node --test --test-concurrency=1 tests/ui/startup-browser.test.mjs`. For Chromium, use an available runtime through LINGUISTY_CHROMIUM_EXECUTABLE as described in QA-REPORT. The first run uses only a test credential without API access; the second injects pending cache/settings reads and a first transport failure into the test page, then checks form opening, timeout/retry, and cleanup. Unit tests need no watch process and use at most two workers.

Retro Orbit/languages: `node --test --test-concurrency=1 tests/e2e/rebrand-language.test.mjs`. The test covers all 16 locales at 320/390/1280 px in Chromium, both selection modes through real Chrome/Firefox forms, RTL, contrast tokens, local fonts/SVG, and absence of external UI resources. The footer has a localized credit and accessible Isty mark; that mark is absent from the header. After selecting the browser target, the test waits for removal of the manual input (React commit); after saving, it waits for feedback and the completed form. A native select.value alone does not establish application state. Firefox preferences change only in the test's own temporary profile; no paid requests are made. Reports/screenshots: `test-results/linguisty-rebrand/`.
