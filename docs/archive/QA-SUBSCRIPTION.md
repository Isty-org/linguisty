# Linguisty — ChatGPT subscription checks

Developed by Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI tools and actual checks are listed below. See [AUTHORS](../../AUTHORS.md).

## Completed SSE text in 0.4.6 — 2026-10-09

The user reported LGT-response-content. A separate reader bug was proven: final_answer from response.output_item.done was lost when completed.response.output was empty. The regression reproduced the exact code before the change; after the change, PASS. The user's real response was not read, so the same cause is not claimed.

Before → after: the reader used only the last aggregate output → it retains only completed text by output_index and confirms success through response.completed/status=completed. Repeats and aggregates are merged without duplicates; contradictions are rejected. Commentary, raw deltas, refusal, incomplete, and failed do not become translations. The existing parser/cache and selected gpt-6-luna are preserved. Additional safe reasons empty/commentary/output/message/phase/status/part/conflict pass through port, progress, and 16 localizations without provider body/claims/tokens/page text.

Typecheck/lint and 739 Vitest tests / 47 files PASS; maximum 2 workers. 28 production files / 24 referenced assets each, 1 143 444 / 1 143 607 bytes before compression. Manifest/secret/resource checks and 9 manifest/hygiene tests PASS. Shared UI chunk 609 125 bytes: the existing open TD-002.

Chromium 152.0.7977.8 / Firefox 157.0.1: 8 groups PASS each on the unchanged production package. The new fixture sends commentary, reasoning, and final_answer as output_item.done, with empty terminal output. In each browser, 1 340/1 340 nodes / 84 requests, 0 errors; repeat: 1 340 from cache / 0 new requests. Incomplete and empty completed responses were rejected with LGT-response-completion / LGT-response-empty, original DOM and cache entries were preserved, pending=0.

Chrome ZIP 441 258 bytes, Firefox 441 344 bytes; internal manifest=0.4.6, all 28 files in each archive match the tested build directory by SHA-256. Mozilla: 0 errors/notices/warnings. The sources ZIP excludes cache and temporary test-results. Signing/publication were not performed.

.cache before/between/after: 5 652 files / 203 426 930 bytes; source duplicates/suspicious=0; remaining QA/watch processes=0. Last Firefox runtime: 13 owned processes / 1 368 829 952 bytes working set → 0, profileRemoved=true. Chrome context/profile closed; free RAM snapshot after checks: 14 264 799 232 bytes. This is observation and lifecycle evidence, not a promise that all possible leaks are absent. Other people's cache/processes and WI-011 are preserved.

Evidence: `test-results/linguisty-response-stream/{chrome,firefox,hygiene-middle,hygiene-final}.json`. A live Luna 6 response and the cause of the user's specific LGT-response-content remain unconfirmed; the fixed loss of a completed stream message is proven by a separate test. Chrome native host prompt/toolbar geometry and Firefox signed installation were not checked separately.

## Recheck in 0.4.5 — 2026-10-09

After replacing the settings button with a gear and protecting the model from a stale popup form, both subscription suites were repeated: 8 groups PASS each, 1 340/1 340 fragments and 84 fixture requests in each browser, repeat entirely from cache, incomplete response rejected without caching the error. Live Luna 6 remains unverified. Packages and extended regression smoke: [QA-POPUP](QA-POPUP.md); the results of the previous protocol fix are preserved below.

## Subscription translation in 0.4.4 — 2026-10-09

Before: the translation format was specified only by the prompt; the Responses reader concatenated commentary and final JSON, did not support CR-only SSE; a generic failure hid the stage. After: the request sends the shared strict schema through Responses text.format, the reader excludes commentary and accepts the final answer after response.completed, supports LF/CRLF/CR; the popup retains only a fixed safe LGT code. The selected Luna 6 is not replaced. Shared prompt/parser/cache are not weakened.

Before the change, three regressions reproduced the missing schema, INVALID_MODEL_RESPONSE for commentary + valid JSON, and rejection of a CR-only stream; after the change they passed. Existing models without phase remain compatible; commentary-only, unknown phase, incomplete message, refusal, invalid JSON, and output exceeding 1 MiB are rejected. Diagnostics do not transmit body, claims, tokens, or original text.

Checks:

- Typecheck and lint: PASS; Vitest: 702 PASS / 47 files, maximum 2 workers; native fixture tests: 15 PASS; manifest/hygiene checker tests: 9 PASS.
- Both production builds and manifest/secret/resource checks: PASS. The version inside both ZIPs was checked separately: 0.4.4. Chrome: 28 files / 1 141 227 bytes before compression, ZIP 440 489 bytes; Firefox: 28 / 1 141 390 bytes, ZIP 440 574 bytes. Mozilla Add-ons Linter: 0 errors/notices/warnings for package 0.4.4.
- Chromium 152.0.7977.8 and Firefox 157.0.1: 8 groups PASS each on unchanged packages: 16 languages, sign-in/callback/port, safe failure, tab reuse, and translation. The Responses fixture requires model=gpt-6-luna and a strict schema, and returns an intermediate message and final_answer.
- In each browser: 1 340 of 1 340 nodes, 84 Responses fixture requests, 0 errors; repeat: 1 340 from cache and 0 new requests. Separate incomplete response: 0 translations, 1 error, pending 0, original preserved, cache unchanged, message ends with `[LGT-response-completion]`.

Evidence: `test-results/linguisty-subscription-translation/{chrome,firefox}.json`, screenshots, and `hygiene-final.json`. Before/between/after checks: `.cache` 5 652 files / 203 426 930 bytes; no new duplicates or suspicious source artifacts; dependencies were not installed. After the final Firefox run, 13 owned processes / 1 276 989 440 bytes working set were released, and the temporary profile was removed; 0 owned QA/watch processes remained. Chrome closed its own context and removed its profile. RAM snapshots do not replace lifecycle checks; tests check release of port/listener/timer/flight state. The shared UI chunk warning for 608 946 bytes remains in TD-002.

Real Luna 6, the user's subscription, and the original response behind their 22 errors were not checked: all inference responses were substituted locally. The implementation errors found are proven by tests but are not claimed as the precise cause of the live failure without the provider response. The user's next step: update the extension to 0.4.4, reconnect ChatGPT, and retry translation; report the LGT code if it fails. The Firefox ZIP is unsigned; store publication was not performed.

## Subscription name and 16 languages in 0.4.1

Checked 2026-10-08. Before: visible service Codex and a short return page only in English. After: localized “Подписка ChatGPT” (English: ChatGPT subscription), “Подключить ChatGPT” button (English: Connect ChatGPT), updated headings/statuses/errors, and a localized return after sign-in. The internal provider ID and OAuth contract are preserved.

The name follows the [official description of using a ChatGPT plan in other applications](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites). Instructions: [CODEX-CONNECTION](../guides/chatgpt-connection.md).

Checks:

- TypeScript and ESLint: PASS.
- Vitest: 661 PASS, 46 files, maximum 2 workers. Covers completeness of all 16 dictionaries and selected/automatic callback language, including RTL and unavailable localStorage.
- Manifest/hygiene checker tests: 8 PASS; both production builds and ZIPs: 0.4.1. Each package has 28 files and 24 linked resources; manifest/secrets/local assets: PASS.
- Mozilla Add-ons Linter 10.13.0: 0 errors, 0 notices, 0 warnings; the existing linter was used without installing dependencies.
- Unchanged Chrome package: 6 check groups. All 16 languages in selector/guide/callback, four steps, no Codex name in the new interface, 360 px width without horizontal overflow, Arabic RTL. Then fixture sign-in, a real redirect to its own callback, session check, reopening without duplication, actual text-node translation, cache repeat and account separation, disconnection and tab closure.
- Unchanged Firefox package: 5 groups, including all 16 selector/guide/callback languages, RTL, no overflow, real browser permission prompts, fixture sign-in/redirect, page translation, return/reopening, and disconnection.
- Russian and Arabic variants were reviewed visually at 360 px width. Evidence: `test-results/linguisty-subscription/`; browser versions and specific results are in `chrome.json` and `firefox.json`.

Cache and resources were checked between stages and after the main work: protected `.cache` remains 5 652 files / 203 426 930 bytes; source duplicates and suspicious artifacts are absent. Firefox cleanup: owned processes 13 → 0, working memory 1 445 388 288 → 0 bytes, owned profile removed. Chrome closed its own context and removed its temporary profile. Final filesystem/RAM snapshot: `hygiene-final.json`; shared UI chunk 608 410 bytes and the size warning are tracked in TD-002. Callback loads only a compact shared chunk of 11 492 bytes, without shared UI dictionaries.

OpenAI OAuth/JWKS/models/Responses were replaced with test responses only on the test page. Real sign-in, plan availability, OpenAI CORS, response quality and cost, native-speaker translation review, minimum-version browsers, signed/store installation, and publication were not checked. Original connection limitations are preserved in [QA-CODEX](QA-CODEX.md); its historical results and snapshots were not rewritten.

## Firefox return fix in 0.4.2 — 2026-10-09

Before: the callback page allowed only origin 127.0.0.1; the previous fixture initiated navigation through the extension API and skipped the web-initiator check. After: the exact https://auth.openai.com/* was added; Firefox is checked with navigation from the OpenAI content principal, Chrome by form submission from a locally substituted page at that origin. OAuth state/tab/PKCE/nonce and token storage boundaries were unchanged.

Before the manifest change, Firefox 157.0.1 reproduced the failure: callback=0, token=0, sign-in did not complete. After the change, the same scenario passed. Firefox also confirmed that a foreign domain, a spoofed suffix, and HTTP OpenAI have no access; codex.html/options.html remain closed to the OpenAI site. Both unchanged builds passed connection, port/translation, rule cleanup, and disconnection; Chrome additionally repeated sign-in with another account and checked cache separation. Both browsers checked 16 languages. Current results: `test-results/linguisty-subscription/{chrome,firefox}.json`.

Typecheck and lint: PASS; Vitest: 661 tests / 46 files; manifest/hygiene tests: 9 PASS; Chrome/Firefox builds and manifest/secret/resource checks: PASS. The existing shared UI chunk warning for 608 410 bytes (TD-002) is retained. Firefox released 13 owned processes and 1 447 309 312 bytes working set; the temporary profile was removed. This checks test completion, not independent proof that leaks are absent. Cache before/between checks stayed at 5 652 files / 203 426 930 bytes; no source duplicates were found.

Mozilla Add-ons Linter: 0 errors, 0 notices, 0 warnings. Firefox ZIP 0.4.2 was built; 28 files / 1 137 648 bytes before compression. Check of remaining QA browser/watch command lines: 0 processes. After testing, 17 130 971 136 of 34 282 012 672 bytes RAM were free; dependencies were not installed, and other people's cache/processes were unchanged.

Real sign-in to the user's account, availability of their subscription, live token exchange/CORS, and model responses are unverified. The regression checks the browser return mechanism, not the whole OpenAI service.

## Confirmation validation and failure codes in 0.4.3 — 2026-10-09

Before: a signed ID token with `aud: [clientId]` and no `azp` was rejected, although this format is valid; different causes were reduced to a generic message. After: a single audience is accepted as a string or array, multiple audiences require a matching `azp`, and an explicitly foreign `azp` is rejected. Checks of RS256/JWKS, issuer, nonce, state, time, and subject are preserved. The new regression test reproduced the failure before the fix and passed afterward.

Errors on the owned page show a fixed code `LGT-<stage>-<reason>[-HTTP]`. Codes distinguish callback/token/discovery/identity/JWKS/refresh/models and do not include provider body, exception text, claim values, callback URL, or credentials. The shared port/PublicError and persistent log were not expanded with these data. HTTP error bodies are canceled without reading.

Typecheck/lint: PASS; Vitest: 685 tests / 47 files; manifest/hygiene tests: 9 PASS; both production builds and manifest/secret/resource checks: PASS. Mozilla Add-ons Linter: 0 errors/notices/warnings. Firefox package: 28 files / 1 139 383 bytes; Chrome: 28 / 1 139 220 bytes before compression. The shared UI chunk warning for 608 410 bytes remains unchanged (TD-002).

Unchanged packages passed 7 check groups each in Firefox 157.0.1 and Chromium 152.0.7977.8. In both browsers, the signed fixture now uses `aud: [clientId]`. After sign-in/translation/disconnection, Firefox checks token HTTP 401 failure with `[LGT-token-http-401]`, Chrome checks an incorrect nonce with `[LGT-identity-nonce]`. Checks cover no secrets in the message, callback rule cleanup, disconnected status after failure, 16 languages, and tab reuse. Reviewed: the error in Firefox's dark theme and Chrome's light variant at 360 px without overflow. Evidence: `test-results/linguisty-subscription/{chrome,firefox}.json`, `*-guide-safe-error.png`.

Intermediate and final checks: `.cache` 5 652 files / 203 426 930 bytes; no source duplicates. Firefox cleanup released 12 owned processes / 1 387 491 328 bytes working set and removed the temporary profile; Chrome closed its own context/profile. Dependencies were not installed. Final: QA/watch processes 0, free RAM 17 973 329 920 of 34 282 012 672 bytes. Final resource check is recorded in `hygiene-final.json`; these snapshots do not replace lifecycle tests or prove that all leaks are absent.

The cause of the user's specific message without an LGT code is unknown. The fixed audience bug is confirmed separately. Real OAuth/token exchange, CORS, account availability, and model responses remain unverified; the user needs to repeat sign-in in 0.4.3 and, if it fails, report only the message with the safe code.
