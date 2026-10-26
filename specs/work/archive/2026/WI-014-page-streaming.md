# WI-014: Streaming translation onto the page — investigate and implement

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Translation begins appearing directly on the page before the model response completes. First check feasibility with the current ID-based translation format; if possible, implement safe streaming for Chrome and Firefox.

## Specs

- Governing: `spec://modules/translation/FEAT-001-engine#providers`
- Governing: `spec://modules/page/FEAT-002-page-translation#render`
- Constraint: `spec://common/PROP-002-quality#resources`
- Constraint: `spec://modules/page/FEAT-002-page-translation#sessions`
- Affected: `spec://modules/translation/FEAT-001-engine#providers`
- Affected: `spec://modules/translation/FEAT-001-engine#validation`
- Affected: `spec://modules/page/FEAT-002-page-translation#render`
- Affected: `spec://common/PROP-001-contracts#messages`
- Affected: `spec://modules/platform/INFRA-001-extension#runtime`
- Affected: `spec://modules/interface/FEAT-003-controls#options`
- Affected: `spec://modules/storage/INFRA-002-local-data#settings`

## Scope

- In: researching SSE and model/structured output compatibility; incremental parsing prototype; provider → background → page stream; early display of verifiable segments, cancellation, errors, and fallback to a regular request when unsupported.
- Define and establish rules for ID validation, unfinished text display, finalization, and rollback on a corrupted response before implementation. Currently stream=false and a failed batch is atomically rejected; streaming requires an explicit change to these contracts.
- Preserve real progress, cache/dedup, original toggle, and protection from stale sessions and external DOM changes.
- Out: our server, indefinite connections, paid API checks without a separate assignment and key, inserting model output as HTML.

## Acceptance

- [x] Feasibility checked with `{translations:[{id,text}]}`; model/API limitations and selected early-display method described. Unconfirmed support is not declared working.
- [x] In Chrome and Firefox mock streaming, first translation appears before the response ends; time to first display and full completion measured against a regular request.
- [x] SSE/UTF-8/JSON splits, unknown/repeated/missing IDs, error event at HTTP 200, and dropped connections leave no invalid translation and are not cached as successful results.
- [x] Cancel, show original, navigation, tab close, and text changes block late fragments; resume does not translate already translated text again.
- [x] Buffers, DOM update frequency, and queue are bounded; fetch/readers, listeners, and timers are released; memory, cache, and duplicates checked.
- [x] Regular requests remain working; required contract/DOM/browser checks passed. If safe implementation failed, the specific reason is recorded in Result and the feature is not declared implemented.

## Research starting points

- [OpenRouter: streaming](https://openrouter.ai/docs/api_reference/streaming) — SSE, cancellation, and errors after the response starts.
- [Stack Overflow: JSON fragments in ReadableStream](https://stackoverflow.com/questions/62927478/parse-json-data-chunk-from-readablestream-with-vanilla-js) — an example of the network chunk boundary problem.
- [Reddit: OpenRouter streaming response errors](https://www.reddit.com/r/openrouter/comments/1r3zuow/openrouter_down/) — failure scenarios to check, not proof of support for a specific model.

## Dependencies

- Related: `WI-012`, `WI-013`.

## Result

2026-10-08: streaming implemented provider → engine → background → page. Incremental SSE/UTF-8 and JSON parser shows only complete valid items; preview is separated from committed translation, cache, and counters. Any failure/retry/cancel rolls back preview and its styling while preserving external page changes. Cumulative snapshots limited to one pending update and serial sending every 100 ms. Wire/model ≤1 MiB, events ≤16 384. Engine remaps deduplicated IDs, gives current preview to late consumers, and frees subscriptions/readers/timers.

Default streaming=true for page translation; testConnection and an unchecked checkbox use regular requests. Old settings receive the default without changing the persistent key. HTTP200 JSON accepted immediately; explicit unsupported stream gives one fallback within the overall retry budget. Handling DONE/stop, usage/comments, errors after HTTP200, and strict finalization established in canon. Research/limitations: docs/RESEARCH.md; SSE/schema compatibility of a particular model without paid API is unverified.

493 Vitest tests / 28 suites (max 2 workers), typecheck/lint, 7 manifest/hygiene contracts, both production builds, 12 Chromium scenarios (13 PASS with parent), 13 Firefox groups, packaged UI/startup, and 2 Firefox key lifecycle scenarios PASS. Mock browser checks cover duplicate/unknown/missing IDs, HTTP200 error, dropped connection, fallback, cancel/original/resume, source edits, route/tab close, and no cache after invalid response. Unit tests additionally split UTF-8/SSE/JSON and check limits, remapping/late consumers, reader locks, coalescing/backpressure, and cleanup. Full Firefox production hash identical before/after.

Mock with response after 2.5 s: Chrome first phrase 144 ms / full display 2516 ms versus regular 2513 ms; Firefox 136 / 2527 versus 2519 ms. DOM probe measures from mock request start; this is not an OpenRouter measurement. After each full browser run mock activeRequests/pendingTimers=0, own Firefox processes=0, profiles removed. .cache 203 426 930 bytes with no growth; source duplicates=0; RAM snapshot 18.82 GB free. Previous blocked WI-011 cleanup untouched. Final report/ZIP/evidence: docs/archive/QA-REPORT.md, .output/linguisty-0.2.0-{chrome,firefox}.zip, and test-results/linguisty-0.2.0/.
