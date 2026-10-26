# WI-031: Full project acceptance and remaining regression fixes

- Kind: `fix`
- Canon action: `none`

## Outcome

Check the current first version against canon and obtain reproducible Chrome/Firefox evidence; close fixable verification and release hygiene gaps.

## Specs

- Governing: `spec://common/PROP-002-quality#checks`
- Governing: `spec://common/PROP-002-quality#hygiene`
- Constraint: `spec://common/PROP-000-product#acceptance`

## Scope

- Assigned paths: `scripts/**`, `tests/e2e/**`, `tests/build/**`, `tests/fixtures/**`, `docs/archive/QA-2026-10-12.md`, this WI.
- Coordinator paths: versions in `package.json`, `package-lock.json`, `wxt.config.ts`; shared documentation, BOARD/WAL/TECHDEBT, and archiving after verification.
- In: acceptance completeness, harness fixes, resource measurements, browser/mock verification, list of specific outstanding tasks.
- Out: production modules, dependencies, build config, README, canon, and BOARD/WAL. Coordinator accepts integration and updates shared documents.

## Acceptance

- [x] Active scope checked; future capabilities not presented as current obligations.
- [x] Available browser scenarios for both platforms and manifest/secret/resource checks completed after implementation stabilized.
- [x] Cache/duplicates/RAM measured; own helpers terminated, others' processes preserved.
- [x] Report accurately distinguishes PASS/FAIL/unverified; no real paid/login requests.

## Result

Before: browser/manifest evidence applied to old 0.4.6, and loading of individual UI languages had not been measured. After: full smoke on unmodified 0.4.7 Chrome/Firefox production directories 14 PASS each, ChatGPT mock and 16 languages PASS; new browser harness checked selective Chromium locale requests and offline loading in both browsers. Typecheck/lint PASS, 751 unit/contract/DOM tests PASS, manifest/secrets/resources PASS; Firefox directory and exact ZIP passed Mozilla Linter without errors/warnings. Details, artifacts, and boundaries: `docs/archive/QA-2026-10-12.md`.

Cache `.cache` unchanged (5 652 files / 203 426 930 bytes), no duplicates or suspicious source copies. Final Firefox smoke freed its 12 processes and profile; no QA/watch helpers from this WI remain. No proven production regressions found in the available browser/mock scope. Old WI-011 cache not deleted: automatic approval review had previously rejected cleanup. Real OpenRouter/ChatGPT login, model quality, signed installation, and a direct Firefox dynamic import counter remain unverified; explicitly separated from PASS. WI ready for coordinator review; file not archived.
