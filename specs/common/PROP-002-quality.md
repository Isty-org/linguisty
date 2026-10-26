---
status: active
---

# PROP-002: Quality and resource control {#root}

A working version is accepted based on observable behavior and completed checks. Caches, the DOM registry, network requests, and local processes must have limits and cleanup.

## Checks {#checks}

Integration acceptance requires typecheck; lint without errors; unit/contract/DOM tests; Chrome and Firefox production builds; checks of manifests, packaged permissions, CSP, naming, and absence of secrets; and browser smoke when a runtime is available. An unperformed test remains unperformed. Automated tests use mocks when no user API key is supplied, but mocks do not establish semantic translation accuracy or real provider access.

## Resources {#resources}

- Default API concurrency is 2, with an allowed range of 1–4; a batch has at most 40 nodes/10,000 characters. The usual page target is 16 nodes/3,000 weighted characters, with CJK weighted by 3. HTTP attempt timeout is 25 s; the total batch budget with retries/recovery is `min(300 000, (timeoutMs × 3 + 10 000) × 7)` ms. Responses and assembled results are limited to 1 MiB.
- The DOM registry holds at most 5,000 nodes; removed nodes are released. Timers/observers/listeners are released on dispose and session completion. Exceeding the limit produces a user explanation rather than unbounded load.
- Cache: IndexedDB, 30-day TTL, at most 10,000 entries and 50 MiB of estimated UTF-8 payload; LRU pruning on writes/startup; stats and clear work without API access. No keys, full DOM, or raw provider responses.
- Model discovery uses a bounded list with a 15-minute TTL and at most 1,000 models; discovery is not required for manual ID entry.
- Queues, in-flight deduplication, and snapshots have finite lifetimes. Cancellation and tab closure release state. Restoring the original stops automatic translation of new nodes until translation mode is resumed.
- Vitest uses at most 2 workers. There is one dependency installation. Leave no watch/server/helper running after acceptance unless the user is using it. Operate on owned PIDs/paths; do not stop unrelated processes.

## Memory and duplicate checks {#hygiene}

At checkpoints, the coordinator records node_modules/.wxt/.output sizes, the number of local helper processes, and available RAM. Runtime tests check registry/observer cleanup, cache limits, repeated-request deduplication, and absence of mutation loops. A working-set measurement does not prove the absence of leaks: repeatable lifecycle checks are required. Generated folders are excluded from Git; sources and history are not duplicated.

## Design and accessibility {#ui}

Check light and dark themes separately, keyboard access, field labels, aria-live progress/errors, and reduced motion. Normal text contrast is 4.5:1. Do not load CDN scripts/fonts or add fictional statistics. Settings must clearly say the key is stored locally, without promising hardware encryption.

## Relationships and completeness {#relationships}

`spec://common/PROP-000-product#acceptance`, `spec://common/PROP-001-contracts#sessions`. Checks, limits, lifecycle, evidence limitations, and UI criteria are defined.

## Changelog {#changelog}

- 2026-10-26: English translation; existing acceptance and resource limits preserved.
- 2026-10-07: first-version acceptance criteria and bounded resource policy.
- 2026-10-08: separate bounded retries/recovery budget and smaller CJK batches; the limit also applies to assembled results.

