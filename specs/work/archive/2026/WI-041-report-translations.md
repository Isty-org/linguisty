# WI-041: Translate historical reports and research

- Kind: `migration`
- Canon action: `none`

## Outcome

Historical QA, audit, release, and research documents have complete English translations preserving their evidence.

## Specs

- Governing: `spec://common/structure#operations`
- Constraint: `spec://common/PROP-002-quality#checks`

## Scope

- Assigned paths: `docs/archive/AUDIT-2026-10-12.md`, `docs/archive/FIREFOX-QA.md`, `docs/archive/QA*.md`, `docs/releases/v*.md`, `docs/RESEARCH.md`, and this WI Result.
- In: translate all prose and nonliteral explanatory text; preserve metrics, dates, links, code commands, IDs, outcomes, and limitations.
- Out: moves, shared files, other docs, runtime code, dependencies, board, WAL, and archive operations. The coordinator relocates and updates links after translation.

## Acceptance

- [x] All assigned documents are fully translated without summarizing or dropping evidence.
- [x] Remaining non-English text is limited to exact examples, quoted UI/test data, proper names, and legal notices.
- [x] Result lists files and verification, including any uncertainty.

## Result

Translated all 15 assigned documents in full: `docs/archive/AUDIT-2026-10-12.md`, `docs/archive/FIREFOX-QA.md`, `docs/archive/QA-2026-10-12.md`, `docs/archive/QA-2026-10-13.md`, `docs/archive/QA-CLI.md`, `docs/archive/QA-CODEX.md`, `docs/archive/QA-LOGOS.md`, `docs/archive/QA-MIT-2026-10-20.md`, `docs/archive/QA-POPUP.md`, `docs/archive/QA-RELEASE-2026-10-20.md`, `docs/archive/QA-REPORT.md`, `docs/archive/QA-SUBSCRIPTION.md`, `docs/releases/v0.4.9.md`, `docs/releases/v0.4.10.md`, and `docs/RESEARCH.md`. The translation contributor did not move files; the coordinator subsequently completed relocation and acceptance.

Before → after: Russian and mixed-language report/research prose is now English, including the full audit diagnosis/recheck/closure history. Historical successes, failures, dates, metrics, commands, hashes, restrictions, mock-versus-live distinctions, and unresolved limitations are preserved. These translations do not claim any new runtime verification.

Verification against Git HEAD passed for all 15 files: identical numeric-token sequences and link targets; identical heading levels, paragraph counts, and table shapes; verbatim non-text fenced code (PowerShell, JavaScript, and JSON). The explanatory placeholders in `LGT-<stage>-<reason>[-HTTP]` were translated; executable commands were not changed. `git diff --check` passed. A Cyrillic scan found only the exact author/legal name, quoted localized UI examples with English context, and the retained legacy research fragment with its explicit HTML alias. The original Chinese article-title example is retained with an English explanation. Document text totals 183,209 → 186,785 characters (UTF-8 257,134 → 187,529 bytes before line-ending normalization); translation was not replaced by summaries.

Intermediate and final `node scripts/check-hygiene.mjs` completed with no duplicate warnings and zero hash skips. Final snapshot: node_modules 8,473 files / 193,594,543 B; `.wxt` 6 / 6,713 B; `.output` 162 / 24,763,713 B; test-results 633 / 25,712,193 B; `.cache` 5,710 / 203,848,639 B; free RAM 19,562,819,584 / 34,282,012,672 B; inspector RSS 63,238,144 B. Shared-directory size changes are observations, not attributed to this task or treated as heap-leak evidence. Project browser/test/helper process count was 0 in the final process check. No temporary copies, dependency installation, browser/model calls, persistent helpers, cache deletion, or process termination were performed by this task.

No runtime tests were rerun because only documentation changed. All preserved historical test results retain their original scope and provenance. One multi-file shell write was rejected by automatic approval review with `blocked by policy` and no detailed reason; it changed no files, and subsequent scoped single-file document writes completed. No permission decision or unresolved translation blocker remains.

Coordinator acceptance, 2026-10-26: complete translations were reviewed and applied, and document links were rebased to the organized layout under WI-040. All 200 local documentation links and 661 spec references pass validation; original evidence and contract identifiers are preserved. Application is complete. Temporary proposals remain in ignored .cache/english-docs because automatic approval review rejected their removal with "blocked by policy"; see WI-040 for final resource measurements and cleanup limitations.
