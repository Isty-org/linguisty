# WI-035: Exclude page fragments from persistent API diagnostics

- Kind: `fix`
- Canon action: `none`

## Outcome

Eliminate WI-032 audit-confirmed storage of a short page fragment in linguisty.apiErrors through a provider message.

## Specs

- Governing: `spec://modules/translation/FEAT-001-engine#errors`
- Governing: `spec://modules/storage/INFRA-002-local-data#contracts`
- Constraint: `spec://common/PROP-000-product#invariants`

## Scope

- Assigned paths: `src/providers/diagnostics.ts`, `src/providers/request.ts`, `src/providers/stream.ts`, `tests/providers/diagnostics.test.ts`, `tests/providers/contract.test.ts`, `tests/providers/stream.test.ts`, `src/storage/errorLog.ts`, `tests/storage/errorLog.test.ts`, `tests/e2e/journal-scenario.mjs`, `tests/e2e/local-server.mjs`, this WI.
- In: safe partial echo/encoded echo diagnostics, end-to-end verification through persisted journal, bounded processing.
- Out: contracts.ts, background, content, UI, other storage modules, dependencies/build/docs/BOARD/WAL.

## Acceptance

- [x] Regression reproduces storage of a synthetic name/short fragment before the fix.
- [x] Short partial/encoded echoes, keys, and request text are not stored in journal.
- [x] Useful safe codes/status/attempts retained; exhaustive protection through a length heuristic cannot be promised.
- [x] End-to-end tests through ErrorJournal/read storage pass; memory/length limits preserved.
- [x] Result contains before → after, commands, and all limitations.

## Result

Before → after: provider `message`, `metadata.raw.error.message`, request ID, and arbitrary model entered diagnostic records; before-fix tests for both API providers saved `John-Smith / 250 EUR`, `John%20Smith`, and `John.Smith-250` in `linguisty.apiErrors` (2 new tests failed, 19 previous tests passed). Now provider passes only source, HTTP status, and code/type from a finite machine-value dictionary; model comes only from own normalized ProviderConfig after format and key-absence checks. Storage sanitizes records again on append/list, including former free-text fields, and rewrites legacy data before returning it to UI/clipboard. PublicError unchanged.

Checks: `vitest run tests/providers/diagnostics.test.ts tests/providers/contract.test.ts tests/providers/stream.test.ts tests/storage/errorLog.test.ts --maxWorkers=2` — 158/158; `tsc --noEmit` — successful; targeted `eslint` — successful; `node --check` for both changed e2e files — successful. Loopback mock `journal-echo` checked with a local HTTP request: HTTP 400, short page fragment and URL-encoded form in response, active requests after response 0. Browser scenario updated: GET_ERROR_LOG, UI, and clipboard check absence of short/encoded echo, amount, and key; coordinator runs it on a fresh build.

Limitations: old bytes in `browser.storage.local` removed on next `list` or `append`, not before journal access. Syntactic validation of legacy model does not prove its origin; new API records receive model only from request settings. Real OpenRouter/paid request and browser run not performed in this pass. Canon change performed separately by coordinator in WI-036; this WI changes implementation and tests.
