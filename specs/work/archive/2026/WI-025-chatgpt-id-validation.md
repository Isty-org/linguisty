# WI-025: ChatGPT identity validation and precise failure reason

- Kind: `fix`
- Canon action: `direct-edit`

## Outcome

A valid ID token with a single aud in an array is accepted after full signature verification; connection errors receive a safe reason on the own page.

## Specs

- Governing: `spec://modules/platform/INFRA-004-codex-connection#auth`
- Affected: `spec://modules/platform/INFRA-004-codex-connection#auth`
- Constraint: `spec://modules/platform/INFRA-004-codex-connection#resources`
- Constraint: `spec://common/PROP-002-quality#checks`

## Scope

- In: OIDC audience/azp regression; bounded callback/token/discovery/JWKS/identity/models diagnostics; displaying reason code without external messages or secrets; both builds, tests, and ZIPs.
- Out: weakening signature/state/nonce, reading user tokens, paid inference, asserting the real failure's cause without diagnostics.

## Acceptance

- [x] Test reproduces rejection of valid aud=[clientId]; fix accepts it, rejects foreign audience/azp, and preserves signature validation.
- [x] Reason codes distinguish step/HTTP status/claim validation; external text, tokens, callback URL, and account data do not enter them.
- [x] Error visible on connection page; browser checks include audience array and safe rejection.
- [x] Typecheck/lint, tests, both builds, package checks, resource check, and updated ZIPs ready.

## Dependencies

- Related: `WI-022`, `WI-024`

## Result

Before: singleton audience array without azp incorrectly rejected; general text hid the failing step. After: valid audience passes full validation; foreign azp/audience and invalid signature rejected; own page shows only a bounded LGT code. Tokens/external messages/claims not added to UI, journal, or port contract. The cause of the user's actual message has not yet been established; the new code is intended for the next attempt.

Checks on 2026-10-09: regression before fix — FAIL, after — PASS; typecheck/lint; 685 Vitest tests / 47 files; 9 manifest/hygiene tests; both production builds, manifest/secret/resource checks. Firefox 157.0.1 and Chromium 152.0.7977.8: 7 browser-check groups each with signed aud=[clientId], callback with OpenAI initiator, fixture translation, cleanup, and safe rejection (token HTTP 401 / invalid nonce). Messages visually checked in Firefox dark and Chrome light 360 px. Mozilla linter: 0 errors/notices/warnings. Packages 0.4.3: Firefox 28 files / 1 139 383 bytes, Chrome 28 / 1 139 220 bytes before compression; ZIP versions checked.

Cache before/between/after: .cache 5 652 files / 203 426 930 bytes; source duplicates/suspicious=0; watch/QA processes after check=0. Firefox freed 12 own processes / 1 387 491 328 bytes working set; own profile removed. Dependencies not installed; others' cache/processes preserved. Final snapshot: test-results/linguisty-subscription/hygiene-final.json. Shared UI chunk 608 410 bytes still recorded in TD-002.

Documentation: docs/RESEARCH.md, docs/archive/QA-SUBSCRIPTION.md, docs/guides/chatgpt-connection.md, docs/guides/testing.md, docs/DEVELOPMENT.md. Live user sign-in, plan availability, and model responses not checked. Next user check: update the extension, start a new sign-in, and on failure report only the text containing the LGT code.
