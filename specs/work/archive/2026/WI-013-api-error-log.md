# WI-013: Detailed OpenRouter/API errors in settings

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

In settings, the user opens a local error journal and sees exactly what OpenRouter or a compatible API reported, to understand why translation or a connection test failed.

## Specs

- Governing: `spec://modules/translation/FEAT-001-engine#errors`
- Governing: `spec://modules/interface/FEAT-003-controls#options`
- Constraint: `spec://common/PROP-002-quality#resources`
- Affected: `spec://modules/translation/FEAT-001-engine#errors`
- Affected: `spec://modules/interface/FEAT-003-controls#errors`
- Affected: `spec://common/PROP-001-contracts#messages`
- Affected: `spec://modules/platform/INFRA-001-extension#errors`
- Affected: `spec://modules/storage/INFRA-002-local-data#root`

## Scope

- In: extracting diagnostic fields in provider/background, bounded local storage, and a journal section in options; viewing, copying, and clearing entries.
- Store time, operation, provider/model, HTTP status, error code/type, API-returned message, and request ID when available. Do not invent missing information; distinguish own network errors from API responses.
- Update canon before implementation: public response currently contains only a general safe error and forbids raw provider response. Allow separate sanitized journal fields that preserve the API message's specific meaning; do not store complete request/response bodies.
- Out: server, telemetry, automatic journal sending, recording API keys, Authorization, or translated page text.

## Acceptance

- [x] Translation, test connection, and discovery errors appear in settings with a specific service message rather than only the general phrase “service unavailable.”
- [x] Mock scenarios cover 401/402/403/429/5xx, error envelope at HTTP 200, timeout/network, and invalid response; journal shows only actually available data.
- [x] Keys, authorization headers, and page text do not enter entries, UI, or copied journal; untrusted messages render as text; redaction tested.
- [x] Entry count, size, and retention are bounded and established in canon; copy/clear work; journal does not duplicate retry entries without explanation.
- [x] Chrome/Firefox, both settings themes, cache, duplicates, memory, and cleanup of own handlers checked. Real API without a key remains unverified.

## Research starting points

- [OpenRouter: errors and debugging](https://openrouter.ai/docs/api_reference/errors-and-debugging) — official error format and diagnostic fields.
- [Reddit: OpenRouter errors and observability limitations](https://www.reddit.com/r/openrouter/comments/1teqe6e/things_i_figured_out_about_openrouter_after/) — issues to reproduce, not an API contract.

## Result

2026-10-08: implemented provider diagnostics/final-error reporter, protected ErrorJournal (100 / 4 KiB / 256 KiB / 7 days), UI-only messages, and an independent options section. PublicError, page state, and snapshots do not receive diagnostics. Metadata.raw is not stored; sanitized message from a known upstream JSON error is allowed. Request-text echo hides the message; fetch exception messages are excluded.

449 Vitest tests / 24 suites, <=2 workers; typecheck/lint; both builds. Provider tests for both adapters: HTTP 401/402/403/429/503/200-error, network/timeout/malformed, test/discovery, cancellation, redaction. Storage: count/UTF-8 bytes/TTL/concurrency/corruption/timeout. UI: inert markup, copying/clear/retry/unmount timers. Security: content denied journal read/clear.

Chrome/Firefox production packages: three mock operations produce three entries; 429 after 3 attempts produces one additional entry; messages/HTTP/code/type/request ID are readable; both themes visually checked; clear preserves cache. `test-results/linguisty-{smoke,firefox}/observations-focused-journal.json`. Clipboard boundary intercepted in the test window and matches the sanitized journal; the user's system clipboard was unchanged. Native OS clipboard/paid API not checked.

Own browser profiles removed, Firefox remainingOwnedProcesses=0. Original cache 203 426 930 bytes; RAM 18.00 GB free. Journal creates no poll/listener; unmount releases the wait.
