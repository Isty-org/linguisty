# WI-017: Reliable small batches for large pages

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

A large page translates through bounded parallel requests; a long node is split without truncation, and size-dependent failure triggers bounded request splitting.

## Specs

- Governing: `spec://modules/translation/FEAT-001-engine#dedup`
- Governing: `spec://modules/page/FEAT-002-page-translation#queue`
- Constraint: `spec://common/PROP-002-quality#resources`
- Affected: `spec://modules/translation/FEAT-001-engine#dedup`
- Affected: `spec://modules/page/FEAT-002-page-translation#queue`
- Affected: `spec://modules/platform/INFRA-001-extension#runtime`
- Affected: `spec://common/PROP-002-quality#resources`

## Scope

- In: small batches accounting for CJK; splitting long Text nodes with internal IDs; bounded recovery, cancellation, cache/dedup; mock browser checks on both platforms.
- Out: changing the selected model, server, paid API requests without an assignment and key.

## Acceptance

- [x] Batches follow settings and bounded parallelism; CJK gets a smaller text budget.
- [x] A long node is translated completely; only the full result is applied to DOM; error/cancellation/external editing blocks late parts.
- [x] Truncated/oversized responses cause finite splitting; auth/rate-limit do not create a fan-out of retries.
- [x] Cache, dedup, and lifecycle pass regressions; typecheck/lint/unit, both builds, manifests, and browser checks completed.
- [x] Cache, duplicates, and memory checked; lack of real API evidence explicitly recorded.

## Dependencies

- Related: `WI-014`, `WI-018`.

## Result

2026-10-08: before, up to 40 nodes/10 000 characters per regular request and rejection of overly long Text nodes → target 16 nodes/3 000 weighted characters with CJK weight 3, lossless Unicode segmentation of a long node up to 100 000 characters, maximum 128 parts. Parts run sequentially within one slot; other batches use configured concurrency. Original node displayed only after full assembly, counted once; source characters are not truncated. Cancel/original/node change/removal stop subsequent parts.

Engine performs bounded depth-2 recovery for context/timeout/multi-node invalid response; halves run sequentially in one RequestQueue slot, with smaller context and no intermediate cache/commit of the original batch. Auth/rate/network/outage are not split. Assembled output ≤1 MiB. Overall background deadline accounts for retries/recovery instead of incorrectly limiting to one attempt; content watchdog aligned with it. In-flight dedup and cleanup preserved.

Checks: typecheck/lint PASS; 566 Vitest tests / 33 suites (2 workers); 8 manifest/hygiene contract tests PASS. Production Chrome/Firefox builds and ZIPs ready; current manifests/CSP/secrets/resources PASS, 19 files per platform. All files in both ZIPs match builds byte for byte. After final packaging, full Chromium smoke: 13 scenarios + parent PASS; Firefox: 14 groups PASS, production fingerprint identical before/after. Large mock page: 28 original nodes, long node >10 000 chars, 0 failed; 20 regular requests or 64 bounded requests under artificial size failures. Streaming recovery/rollback, cache, SPA, worker restart, and cancel also passed. Evidence: `test-results/linguisty-smoke/observations.json`, `test-results/linguisty-firefox/observations.json`.

On the same mock, concurrency 1→2 reduced total time Chrome 2162→1255 ms, Firefox 2237→1310 ms; observed peak matched setting. This measures our pipeline with a local fixed response, not model speed. User scenario: Chinese Wikipedia “人工智能”, latest Gemini Flash Lite model. Exact model ID, journal for that attempt, real API access, and language accuracy were not checked; no paid requests.

Resources: after smoke activeRequests/pendingTimers=0; own Firefox processes=0, profiles removed; Chrome isolated profile removed. No new watch/helper remained. Project cache without growth: 5 652 files / 203 426 930 bytes; old blocked WI-011 files untouched. .output 47 files / 4 805 240 bytes (two production folders and nine historical ZIPs), .wxt 6 files / 6 589 bytes; source duplicates/suspicious/hash-skipped=0, RAM snapshot 15.03 GB free. Snapshot does not prove absence of every heap leak; bounded lifecycle separately checked by tests.
