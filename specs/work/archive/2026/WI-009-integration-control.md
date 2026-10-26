# WI-009: Coordination and integration acceptance

- Kind: `implement`
- Canon action: `direct-edit`

## Outcome

Implementers' independent results are combined into a verifiable local Linguisty version; documentation, board, and actual readiness agree.

## Specs

- Governing: `spec://common/PROP-001-contracts#root`
- Affected: `spec://common/PROP-001-contracts#modules`
- Governing: `spec://common/PROP-002-quality#checks`
- Constraint: `spec://common/PROP-000-product#acceptance`

## Scope

- In: managing assigned chats, reviewing results, fixing shared/config integration, returning defects to their owners, final builds/checks, documents/board/archive.
- Owned: shared/config/package/lock/docs/specs as coordinator; production-owned paths are not rewritten while their implementer is active.
- Out: future features, real language evaluation without a provided key, store publication.

## Dependencies

- Depends on: WI-002; independent modules WI-003…WI-008.

## Acceptance

- [x] Contracts agree; no alternative types/duplicate modules or ownership conflicts.
- [x] Intermediate defects resolved and implementers' results reviewed.
- [x] Final typecheck/lint/tests, Chrome/Firefox builds, and manifest checks performed after fixes.
- [x] Browser smoke performed in the available runtime; unperformed browser/real-provider checks explicitly stated.
- [x] Cache/duplicates/resources checked; no forgotten own helper/watch processes.
- [x] Board, WI Results, links, documentation, and artifacts match the facts.

## Result

Accepted by the coordinator on 2026-10-07. Before: original plan/design without implementation and Chrome outside v1. After: Linguisty 0.1.0, shared canon, plan, shared contracts, Chrome/Firefox production packages, and verified local pipeline.

- Created and supervised 7 local gpt-6.1-sol / max chats: storage/cache, engine/providers, page DOM, background, UI, QA/assets, and Firefox runtime. Paths did not overlap; one node_modules/lock. All results reviewed, modules and acceptance accepted.
- Root prepared specifications/contracts/build; agreed on Chrome inclusion and the name; Firefox min140/data consent, dependency updates to 0 audit vulnerabilities. Integration defects were returned to owners before verification rather than masked by changing acceptance.
- Fixed SPA loading/same-document, cancellation/original, secret migration rollback, contextual cache/dedup, and stable group labels. Added cacheHitIds for exact live-node progress; root synchronized UI raw authority/C0/DEL validation with pure normalization, model200, key4096. Unsupported absence of session API does not cause silent persistent fallback.
- Final checks: typecheck PASS, lint PASS, 391 unit/contract/DOM tests PASS; 6 manifest/hygiene tests and 5 fixtures PASS; production build/zip for both browsers and manifest/assets/permission/CSP/heuristic credential checks PASS.
- Final browser results: 9 Chromium scenarios PASS on 152.0.7977.8 and 10 Firefox groups PASS on 157.0/geckodriver0.37.1. Both unmodified builds used a loopback mock,52 requests each/max2 concurrent; final activeRequests/timers0, temporary profiles/server and own processes closed. Three repeated Firefox lifecycle cycles zero session timers/observers/listeners; closed snapshots removed.
- QA report, FIREFOX-QA, README, DEVELOPMENT, TESTING, and PLAN aligned. BOARD keeps Done for the current release; WAL has no unfinished checkpoints. Results and screenshots are in ignored test-results. Derived folders excluded from source ZIP; ZIP contents checked against verified production bytes. Source archive additionally rebuilt with the shared dependency installation.
- Cache/duplicates/RAM checked at intermediate stages and at the end; node_modules about184.6 MiB, QA driver cache4.1MB with metadata, no duplicate downloaded ZIP or profiles. RAM snapshot is not claimed as proof of no leaks; lifecycle tests check specific resources. Others' processes/cache were not deleted.
- Real OpenRouter/semantic accuracy, native toolbar/activeTab-only, signed store install, and full accessibility audit remain unverified and are explicitly listed in the QA report. Crash-atomic migration of two key stores is TD-001. Subsequent product stages are preserved in PLAN and were not started automatically.
