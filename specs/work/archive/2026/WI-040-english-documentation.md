# WI-040: English documentation and repository organization

- Kind: `migration`
- Canon action: `direct-edit`

## Outcome

All repository documentation, including historical reports and completed work items, is readable in English and has a clear location and navigation path.

## Specs

- Governing: `spec://common/structure#root`
- Constraint: `spec://common/PROP-000-product#sources`
- Constraint: `spec://common/PROP-002-quality#hygiene`
- Affected: `spec://common/structure#root`

## Scope

- In: README, contributor instructions, canonical specs, protocols, guides, historical translations, documentation navigation, relocation of loose documentation/reference assets, broken-link repair, and verified local cleanup.
- Coordinator owns all shared files, canonical specs, board, WAL, and archive mutations. Translation proposals for these paths are reviewed and applied by the coordinator.
- Related translation work: WI-041, WI-042, WI-043.
- Out: extension behavior, UI localization dictionaries, dependency changes, rewriting Git history, publishing releases, and unrelated files or processes.

## Acceptance

- [x] README, guides, specifications, protocols, reports, and completed work items are in English; names, legal notices, exact localized examples, and evidence retain their meaning.
- [x] Documentation is grouped by purpose, with an index and updated relative links; spec IDs and explicit anchors remain stable.
- [x] English is recorded as the default for future repository documentation and contribution text.
- [x] Historical measurements, dates, unresolved blockers, and unverified scenarios remain explicit.
- [x] Markdown/spec links, duplicate files, resource use, and checks appropriate to the actual changed paths are verified.

## Result

Completed on 2026-10-26. Before: Russian documentation and a flat mix of guides, reports, design sources, and a reference image. After: all 97 Markdown documents use English prose, including the full 38-item completed work history, 15 historical report/research/release documents, 19 reference/protocol/module documents, and the coordinator-owned guides/specifications. Exact legal names, localized examples, and the legacy research anchor are retained with English context.

Moved 23 documentation/reference files into purposeful locations. The root now holds the project entry, contributor instructions, authorship/license files, and required tool configuration. docs/README.md indexes guides, product/design references, releases, and the historical archive. The original PNG is under docs/design/assets; the adoption guide is alongside the workflow protocols. Canonical spec paths, IDs, explicit anchors, runtime modules, localization dictionaries, and package/dependency configuration are unchanged. One Firefox test diagnostic now points to the relocated guide.

Verification: typecheck PASS; lint PASS; 780 Vitest tests in 50 files PASS with maxWorkers=2; JavaScript syntax check for the adjusted diagnostic PASS; git diff --check PASS. Final documentation validation found 200 valid local links and 661 valid spec references, no duplicate document hashes/board IDs, no replacement-character encoding damage, and a populated Result for every archived WI. Original numeric/code/link/checkbox evidence was compared before applying the translation proposals; known post-translation changes are new language/layout notes and updated document paths. No runtime builds, browser checks, live provider calls, store actions, commits, or pushes were performed for this documentation-only change. Earlier historical PASS results remain historical.

Resource check PASS for source hygiene: no duplicate/suspicious source files and no skipped hashes. node_modules 193594543 B; .wxt 6713 B; .output 24763713 B; test-results 25712193 B. Free RAM 17724538880 / 34282012672 B; inspector RSS 63475712 B. No project browser/test/helper processes remained. These are resource snapshots, not proof of runtime leak freedom.

Cleanup limitation: automatic approval review rejected the guarded deletion of the four existing WI-011 temporary paths and later rejected deletion of this task's own .cache/english-docs proposals plus the empty .human directory, each with "blocked by policy" and no detailed reason. No alternate deletion method was attempted. The old cache, 58 task files totaling 421709 B, and empty .human directory remain local; .cache is ignored by Git. Total final .cache is 203848639 B. WI-011 remains Blocked. The proposed move of older generated ZIPs was in the first rejected command and did not execute. Repository documentation organization and translation are complete; blocked cache removal is explicitly unresolved.

Publication follow-up, 2026-10-26: the user explicitly requested committing and pushing the accepted documentation change to `origin/main`. The earlier no-commit/no-push statement describes the initial acceptance stage.
