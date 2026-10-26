# WI-043: Translate design sources, protocols, and module specifications

- Kind: `migration`
- Canon action: `none`

## Outcome

Complete English translation proposals cover the original product/design references, workflow protocols, and module specifications.

## Specs

- Governing: `spec://common/PROP-000-product#sources`
- Constraint: `spec://common/structure#operations`

## Scope

- Read: `docs/product/original-plan.md`, `docs/design/README.md`, `docs/design/*.md`, `specs/protocols/ADOPTION.md`, `specs/protocols/*.md`, and `specs/modules/**/*.md`.
- Assigned write paths: `.cache/english-docs/references/**` and this WI Result only.
- Mirror original repository-relative paths below the assigned proposal directory. The coordinator applies proposals, moves files, and updates links.
- Out: direct source/shared/spec edits, runtime code, dependencies, board, WAL, and archive operations.

## Acceptance

- [x] Every assigned source has a complete English proposal, preserving all sections, facts, examples, IDs, explicit anchors, commands, and code semantics.
- [x] Source material remains historical where applicable; its product decisions are not promoted to current requirements.
- [x] Result lists proposal files and verification, including any uncertainty.

## Result

Translation, coordinator application, and acceptance are complete. Before: the assigned references, protocols, and module specifications contained Russian prose. After: 19 complete English proposals mirror every assigned source under `.cache/english-docs/references/`; this executor did not edit the originals, runtime code, shared contracts, board, WAL, or dependencies.

Applied document destinations after coordinator relocation:

- `docs/product/original-plan.md`
- `docs/design/README.md`
- `specs/protocols/ADOPTION.md`
- `docs/design/isty-cloudline-superseded.md`
- `docs/design/isty-retro-orbit-reference.md`
- `specs/protocols/BOARD-PROTOCOL.md`
- `specs/protocols/BOOT.md`
- `specs/protocols/SPEC-AUTHORING-PROTOCOL.md`
- `specs/protocols/SPEC-PROTOCOL.md`
- `specs/protocols/TECHDEBT-PROTOCOL.md`
- `specs/protocols/WAL-PROTOCOL.md`
- `specs/protocols/WORK-ITEM-PROTOCOL.md`
- `specs/modules/interface/FEAT-003-controls.md`
- `specs/modules/page/FEAT-002-page-translation.md`
- `specs/modules/platform/INFRA-001-extension.md`
- `specs/modules/platform/INFRA-003-local-cli.md`
- `specs/modules/platform/INFRA-004-codex-connection.md`
- `specs/modules/storage/INFRA-002-local-data.md`
- `specs/modules/translation/FEAT-001-engine.md`

Verification performed:

- Compared every source/proposal pair: explicit anchor, `spec://` address, Markdown link-target, URL, code-fence-marker, and numeric-token multisets match; heading-level counts match.
- All documents retain the source line count except the already-English original plan, which adds two lines containing English explanations of retained Russian target-language examples.
- All executable fenced code blocks are unchanged. In both long design references, every original line without Cyrillic is unchanged apart from line-ending normalization; all 957 Cloudline and 416 Retro Orbit Cyrillic-bearing source lines were translated.
- All seven module specifications and all seven workflow protocols contain no Cyrillic. The only remaining Cyrillic is on five lines: two Russian translation examples in the original plan with English glosses, two active-design lines explaining localized Russian labels, and one Retro Orbit line showing Cyrillic glyphs for its spacing rule.
- Historical source status, former scope decisions, and chronological changelogs remain historical; no historical design or original-plan decision is promoted to current canon. Source paths and link targets are intentionally retained for coordinator relocation and adjustment.
- Proposal hygiene: exactly 19 Markdown files, 203,068 bytes total; no duplicate-content groups and no extra scripts or temporary mapping files. Only short-lived foreground PowerShell/Python commands were used; no installation, paid request, watch process, or persistent helper was started. Final foreground PowerShell working set was 89,649,152 bytes, private memory 30,392,320 bytes; the final OS snapshot reported 19,181,208 KiB free physical memory of 33,478,528 KiB visible. These measurements do not establish absence of runtime leaks.

No translation uncertainty requiring a product decision was found. The translation contributor did not retest runtime behavior, live provider access, or browser scenarios. The coordinator performed the documentation integration checks and static/unit checks recorded in WI-040; live-provider and browser checks were not rerun for this documentation change.

Coordinator acceptance, 2026-10-26: complete translations were reviewed and applied, and document links were rebased to the organized layout under WI-040. All 200 local documentation links and 661 spec references pass validation; original evidence and contract identifiers are preserved. Application is complete. Temporary proposals remain in ignored .cache/english-docs because automatic approval review rejected their removal with "blocked by policy"; see WI-040 for final resource measurements and cleanup limitations.
