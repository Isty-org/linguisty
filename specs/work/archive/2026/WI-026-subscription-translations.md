# WI-026: Correct translation through ChatGPT subscription

- Kind: `fix`
- Canon action: `direct-edit`

## Outcome

Subscription translation requests strict JSON and reads the final Responses answer without intermediate explanations; failure reports a safe reason. The cause of a specific live failure is not declared established without the original response.

## Specs

- Governing: `spec://modules/platform/INFRA-004-codex-connection#requests`
- Governing: `spec://modules/translation/FEAT-001-engine#validation`
- Governing: `spec://modules/platform/INFRA-001-extension#build`
- Affected: `spec://modules/platform/INFRA-004-codex-connection#requests`
- Constraint: `spec://modules/platform/INFRA-004-codex-connection#resources`
- Constraint: `spec://common/PROP-002-quality#checks`

## Scope

- In: Responses text.format, final_answer/commentary, SSE framing, safe translation failure codes, regression/lifecycle tests, Chrome/Firefox smoke, both builds and packages.
- Out: reading user tokens/raw responses, changing shared parser/cache, paid requests, substituting the selected model.

## Acceptance

- [x] Tests before the fix reproduce missing schema and commentary mixed with valid JSON.
- [x] Request contains the shared strict schema in Responses format; final answer without phase remains compatible; commentary is not mixed into translation.
- [x] Incomplete/failed/refusal/oversized responses are not accepted or cached; reasons limited to a fixed list.
- [x] Typecheck/lint, meaningful tests, both builds, manifest/secret/resource checks, and browser scenario passed.
- [x] Updated packages ready; live scenario and availability of the user's chosen model described factually.

## Dependencies

- Related: `WI-022`, `WI-025`

## Result

Before → after: prompt-only request and concatenation of all assistant messages → shared strict schema in Responses text.format and commentary separated from final_answer; SSE only LF/CRLF → LF/CRLF/CR across arbitrary chunks. General error → allowlisted LGT-response/translation code preserved through port, safeError, progress, and localization, without provider body or source text. Request preserves the user's selected Luna 6. Parser/cache unchanged; malformed/partial/refusal/oversized responses do not become success.

Three regressions before fix — FAIL, after — PASS. Checks on 2026-10-09: typecheck/lint, 702 Vitest tests / 47 files, 15 Native fixtures, 9 manifest/hygiene tests, production builds/ZIP for both platforms, manifest/secret/resource checks. Mozilla linter: 0 errors/notices/warnings. Internal ZIP manifest versions separately confirmed as 0.4.4; lingering manifest version override 0.4.3 fixed. Chrome/Firefox: 28 files, 1 141 227 / 1 141 390 bytes before compression, ZIP 440 489 / 440 574 bytes.

Chromium 152.0.7977.8 and Firefox 157.0.1: 8 groups PASS each on unmodified packages; each has 1 340/1 340 nodes, 84 fixture requests, 0 errors; repeat 1 340 from cache / 0 new requests. Incomplete response rejected with LGT-response-completion, original DOM and cache preserved, pending 0. Auth/callback, 16 languages, secret boundary, and tab reuse also checked.

Resource checks: .cache before/between/after 5 652 files / 203 426 930 bytes; new source duplicates/suspicious=0. Firefox freed 13 own processes / 1 276 989 440 bytes working set, profile removed=true, remainingOwnedProcesses=0; Chrome context/profile closed. Remaining QA/watch processes 0. Others' processes/cache preserved; no dependency installation. Shared UI chunk 608 946 bytes remains in TD-002. Evidence: test-results/linguisty-subscription-translation/{chrome,firefox,hygiene-final}.json and docs/QA-SUBSCRIPTION.md.

Real Luna 6 inference and original response from the 22 errors were not obtained: the cause of the specific user failure remains unconfirmed. Fixes proven independently; new build and safe diagnostics ready for another user check. Firefox signing and publication not performed.
