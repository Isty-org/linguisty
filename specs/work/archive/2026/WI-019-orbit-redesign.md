# WI-019: Retro Orbit Editorial redesign

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Linguisty popup and settings use the supplied violet/sage design system and SVG mark; both themes remain readable and functional.

## Specs

- Governing: `spec://modules/interface/FEAT-003-controls#design`
- Affected: `spec://modules/interface/FEAT-003-controls#design`
- Constraint: `spec://common/PROP-002-quality#checks`, `spec://common/PROP-002-quality#ui`, `spec://common/PROP-000-product#invariants`

## Scope

- In: docs/design/README.md, semantic CSS tokens, compact popup, responsive settings with section navigation, SVG branding/icons, local Onest/JetBrains Mono and licenses, integration checks.
- Out: product renaming, landing page, backend, translation pipeline changes, paid requests.
- Assigned root: `src/ui/styles.css`, `src/ui/components.tsx`, `public/**`, `scripts/generate-icons.mjs`, `scripts/assets/linguisty-mark.svg`, `docs/design/README.md`, canon, shared contracts/configuration, and operational documents.
- Assigned UI executor: `src/ui/Popup.tsx`, `src/ui/Options.tsx`, `src/ui/ErrorJournal.tsx`, `src/ui/settingsForm.ts`, `src/ui/bootstrap.tsx`, `entrypoints/popup/**`, `entrypoints/options/**`, `tests/ui/**` except new localization tests, `tests/e2e/chromium-smoke.test.mjs` only UI language test setup.

## Dependencies

- Related: `WI-020`

## Acceptance

- [x] Popup/options use violet/sage, graphite/paper, editorial headings, supplied SVG.
- [x] Light/dark themes, 320/390 px, keyboard/focus, 44 px targets, reduced motion checked.
- [x] Typecheck, lint, unit tests, Chrome/Firefox builds, and manifest/resources checks passed.
- [x] Packaged browser UI checked; real API/language accuracy explicitly distinguished from mock.
- [x] Sizes, duplicates, and cleanup of own checking processes verified.

## Result

Before → after: Cloudline → Retro Orbit Editorial from the user's reference. docs/design/README.md establishes adaptation to the extension; full reference and previous design preserved in docs/design/. Popup and options use semantic violet/sage/graphite/paper tokens, rectangular controls/cards, large italic headings, CSS orbit/texture, responsive navigation, and supplied SVG mask. Local Onest/JetBrains Mono include OFL and source; PNG icons generated from the same SVG; previous duplicate mark removed. Product name and BYOK boundaries preserved.

Checks: typecheck/lint PASS, 566 unit/contract/DOM /33 files, 8 manifest/hygiene tests, 5 fixtures; both production builds/ZIP (19 files each, byte match), 15 referenced assets. Chromium full smoke 14 PASS with parent, Firefox 14 PASS; packaged UI/startup 2 PASS, separate rebrand/language scenarios 2 PASS. All 16 locales checked in Chromium at 320/390/1280 px, Arabic RTL, loaded local fonts, contrast tokens ≥5.68:1, zero external UI resources/page errors. Paper/graphite popup/options, mobile, and Arabic screenshots visually reviewed.

Evidence/limitations: docs/archive/QA-REPORT.md, test-results/linguisty-rebrand/, and overall browser reports. Real API, semantic accuracy, native toolbar geometry, and full WCAG audit not checked. Vite shared UI chunk warning 566 974 bytes retained in TD-002; background has metadata only. No dependencies/paid calls/publication. Source duplicates/suspicious copies 0, old .cache did not grow, own profiles removed and runtime processes/timers released. Others' CUA helpers and WI-011 cleanup left in place.
