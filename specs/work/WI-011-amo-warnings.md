# WI-011: Remove Mozilla warnings from the Firefox package

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

The Firefox production package passes Mozilla Add-ons Linter without Android-minimum or dynamic-innerHTML warnings; popup/options and translation retain working behavior.

## Specs

- Governing: `spec://modules/platform/INFRA-001-extension#build`
- Governing: `spec://modules/interface/FEAT-003-controls#errors`
- Constraint: `spec://common/PROP-000-product#scope.in`
- Constraint: `spec://common/PROP-002-quality#checks`
- Constraint: `spec://common/PROP-002-quality#hygiene`
- Affected: `spec://modules/platform/INFRA-001-extension#build`

## Scope

- In: Firefox floor 142 without gecko_android; explicitly disabling the unused React raw-HTML renderer at build time; contract/regression checks; builds, browser checks, ZIP, and evidence.
- Assigned paths: `wxt.config.ts`, `scripts/**`, `tests/build/**`, `docs/RESEARCH.md`, `docs/archive/QA-REPORT.md`, `docs/guides/development.md`, `docs/guides/testing.md`, `docs/archive/FIREFOX-QA.md`, `README.md`, `specs/modules/platform/INFRA-001-extension.md`, this WI, and its BOARD/WAL entry.
- Out: Android support, changing UI framework, real paid API requests, AMO publication/signing.

## Acceptance

- [x] The original three warnings were reproduced with Mozilla Add-ons Linter.
- [x] Firefox minimum 142 and absence of Android support are verified by a manifest contract test.
- [x] Both React raw-HTML paths reject HTML; text children retain literal text. An upstream renderer change stops the build.
- [x] Typecheck, lint, unit/contract tests, Chrome/Firefox builds, and manifest/resource checks pass.
- [x] Available browser UI/translation smoke passes on the new packages; limitations are explicit.
- [x] The final Firefox ZIP passes Mozilla Add-ons Linter without errors or warnings and matches the verified production files.
- [ ] Caches, duplicates, RAM, and owned helper processes are checked; the temporary linter cache is removed.

## Dependencies

- Related: `WI-009`, `WI-010`.

## Result

2026-10-26: the user requested filesystem cleanup while translating all documentation. A read-only check confirmed the same four temporary paths, no reparse points in the inspected targets, and no processes using them. The guarded cleanup command was rejected before execution by automatic approval review: `blocked by policy`, without a detailed reason. No deletion occurred and no alternate deletion method was attempted. The command also included moving old generated ZIPs into an output archive; that move did not execute either. WI-011 remains blocked by policy, not by missing user authorization.

2026-10-12: the user explicitly authorized deleting the four listed temporary paths. The repeated command, with checks of absolute `.cache` boundaries, reparse points, and processes using those paths, was rejected before execution: `blocked by policy`. The remaining constraint was external policy, not missing consent. Files were retained; no bypass was attempted. Initial total `.cache` size was 203426930 bytes; the initial snapshot showed no Linguisty-related node/firefox/chrome/geckodriver processes.

The main fix and checks are complete. Before: gecko floor 140 and two dynamic innerHTML setters in React DOM 19.3.0 produced 3 Mozilla warnings. After: floor 142 without gecko_android; both raw-HTML paths throw an explicit error, while ordinary React text children/DOM nodes work. Installed dependencies and package-lock were unchanged. Mozilla Add-ons Linter 10.13.0 checked the directory and Firefox ZIP: 0 errors, 0 notices, 0 warnings.

Checks: typecheck/lint PASS; 398 tests/18 suites (Vitest max 2 workers); 7 manifest/hygiene contract tests; 5 fixtures; both production builds/ZIPs; Chromium152 pipeline (9 scenarios) and separate packaged UI; Firefox157.0.1/geckodriver0.37.1 (10 groups). Chrome: 13 files/343499 bytes; Firefox: 13/343662. Both ZIPs match production byte for byte; the source ZIP excludes generated artifacts. Firefox package hash before/after runtime: `26f637d572b1e90b7f729b6d72783352fb34fd5a2dab7f409a2d6a3761bdd66f`. Evidence: `test-results/linguisty-amo/` and standard runtime artifacts. Real API access, language accuracy, signed installation, and minimum-version runtime were not tested.

The first Firefox launch exited before extension installation; the repeated full launch passed. The repeated run closed 12 owned processes, removed its profile, and cleared mock requests/timers. Two remaining processes from the first launch (27160/33360) were identified by the exact `profile-MaLnaU` path and terminated specifically; unrelated processes were not closed.

Hygiene PASS: no exact duplicates or suspicious source copies; node_modules 193587680 bytes (+2096 bytes of test cache), .wxt 6390, .output 1251308 at measurement; free RAM 16125992960 bytes. The temporary npm linter cache and first Firefox launch residue remained in `.cache` (203425397 bytes including the earlier geckodriver cache): recursive removal was rejected by automatic approval review with `blocked by policy`, without further detail. At that point, the user was asked about deleting only these temporary files. Operational completion awaited cleanup; authorization was subsequently supplied, but the policy rejection persisted.
