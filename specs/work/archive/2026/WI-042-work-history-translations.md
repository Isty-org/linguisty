# WI-042: Translate completed work history

- Kind: `migration`
- Canon action: `none`

## Outcome

English translation proposals cover every completed work item without changing its recorded acceptance or result.

## Specs

- Governing: `spec://common/structure#operations`
- Constraint: `spec://common/PROP-002-quality#checks`

## Scope

- Read: every existing `specs/work/archive/2026/WI-*.md`.
- Assigned write paths: `.cache/english-docs/work-history/**` and this WI Result only.
- Produce one translated Markdown file per original, preserving basenames. The coordinator alone applies proposals to the archive and handles status.
- Out: direct archive edits, shared files, other docs, runtime code, dependencies, board, and WAL.

## Acceptance

- [x] Every existing completed WI has a full English proposal, preserving evidence, numbers, IDs, URLs, code, checked/unchecked acceptance, and limitations.
- [x] Result lists proposal files and verification, including any uncertainty.

## Result

Before → after: 38 completed WIs contained Russian prose → 38 full English translation proposals are ready in `.cache/english-docs/work-history/`. The translation contributor left the archive untouched; the coordinator subsequently applied and accepted all proposals. No source, shared, canon, BOARD, WAL, configuration, dependency, or other assigned paths were changed by this executor.

Proposal files (same basenames as the originals):

- `WI-001-project-documentation.md`
- `WI-002-foundation.md`
- `WI-003-storage-cache.md`
- `WI-004-engine-providers.md`
- `WI-005-page-dom.md`
- `WI-006-background.md`
- `WI-007-interface.md`
- `WI-008-quality-release.md`
- `WI-009-integration-control.md`
- `WI-010-firefox-runtime.md`
- `WI-012-readable-fonts.md`
- `WI-013-api-error-log.md`
- `WI-014-page-streaming.md`
- `WI-015-persistent-key.md`
- `WI-016-ui-startup.md`
- `WI-017-adaptive-batches.md`
- `WI-018-inline-layout.md`
- `WI-019-orbit-redesign.md`
- `WI-020-browser-languages.md`
- `WI-021-local-cli.md`
- `WI-022-codex-connection.md`
- `WI-023-chatgpt-subscription-labels.md`
- `WI-024-firefox-chatgpt-callback.md`
- `WI-025-chatgpt-id-validation.md`
- `WI-026-subscription-translations.md`
- `WI-027-popup-regression.md`
- `WI-028-response-stream-content.md`
- `WI-029-locale-loading.md`
- `WI-030-storage-recovery.md`
- `WI-031-project-acceptance.md`
- `WI-032-astra-audit.md`
- `WI-033-batch-message-budget.md`
- `WI-034-session-recovery-retry.md`
- `WI-035-diagnostics-privacy.md`
- `WI-036-audit-fix-acceptance.md`
- `WI-037-active-request-lifetime.md`
- `WI-038-first-github-release.md`
- `WI-039-mit-license.md`

Verification on 2026-10-26: every original has a proposal, every proposal has a unique SHA-256, and every file retains its original nonempty-line count. Exact inline code, URLs, acceptance checkbox states, and numeric tokens were compared against originals; no evidence was omitted or added. The machine-readable comparison with original/proposal hashes is `.cache/english-docs/work-history/verification.json`. Recorded results and limitations remain historical claims; no archived runtime PASS was retested or newly asserted by translation.

Cyrillic exceptions are intentional: WI-018 retains two exact quoted Russian translation outputs with English glosses; WI-038/039 retain the author's original proper name, including the exact legal copyright string. All surrounding prose is English. Chinese/other-language source samples and identifiers remain exact. There is no unresolved translation uncertainty identified; coordinator review and application were completed on 2026-10-26.

Resource checks: `node scripts/check-hygiene.mjs --json` PASS, suspicious/duplicates empty, hashSkipped=0. Snapshot: node_modules 193594577 B, .wxt 6713 B, .output 24763713 B, .cache 203789624 B; free system RAM 19318431744 / total 34282012672 B; hygiene inspector RSS 63295488 B. This is a filesystem/RAM snapshot, not leak evidence. The proposals occupy about 179 kB plus their verification report; no dependency installation, model calls, helper/server/watch processes, browser profiles, or duplicate source implementations were created. Other workers' files, caches, and processes were preserved.

Coordinator acceptance, 2026-10-26: complete translations were reviewed and applied, and document links were rebased to the organized layout under WI-040. All 200 local documentation links and 661 spec references pass validation; original evidence and contract identifiers are preserved. Application is complete. Temporary proposals remain in ignored .cache/english-docs because automatic approval review rejected their removal with "blocked by policy"; see WI-040 for final resource measurements and cleanup limitations.
