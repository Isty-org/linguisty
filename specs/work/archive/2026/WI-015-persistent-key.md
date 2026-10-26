# WI-015: Preserving the key across restart and update

- Kind: `fix`
- Canon action: `direct-edit`

## Outcome

The persistent key and selected mode are not lost because of stale UI or separate settings/key saving; temporary Firefox installation boundaries are explicitly described.

## Specs

- Governing / Affected: `spec://modules/storage/INFRA-002-local-data#secrets`
- Governing / Affected: `spec://modules/interface/FEAT-003-controls#options`
- Governing / Affected: `spec://common/PROP-001-contracts#messages`
- Constraint: `spec://modules/platform/INFRA-001-extension#build`
- Constraint: `spec://common/PROP-002-quality#checks`

## Scope

- In: storage/settings/secrets, background save, UI save callers, regression tests, Firefox lifecycle evidence, installation documentation, updated packages.
- Out: others' Firefox profiles, user keys, publication or signing on the user's behalf.

## Acceptance

- [x] A test reproduces persistent reverting to session through a stale window.
- [x] Saving language/theme without an explicit mode change preserves current keyMode.
- [x] Persistent key and keyMode saved in one local write; interrupted saving and storage failure do not erase the previous key.
- [x] Session, explicit mode changes, and removal of both copies pass regression tests.
- [x] Firefox reload/restart/update checked in the available isolated environment; temporary/signing limitations recorded without promises of unverified behavior.
- [x] Typecheck/lint/tests, both builds, and package checks completed; resources and duplicates checked.

## Result

Before → after: stale UI could revert persistent to session, and key and mode were saved separately → preserveKeyMode preserves the current choice under the mutation queue; saveConfiguration writes the local key and settings together and rolls back failure. With a residual copy from an interrupted update, source is determined by committed mode. Key/status remain separated; public response contains no secret.

0.1.1: typecheck/lint PASS; 417 unit/contract/DOM tests (20 suites, <=2 workers), 7 manifest/hygiene tests, 5 fixtures. Both production build/ZIP, manifest/secret/resource checks, and byte comparison PASS. Chromium: 9 pipeline scenarios + UI + startup (12 Node tests with parent); Firefox157.0.1: 10 groups and 2 key lifecycle scenarios PASS. Actual reload/higher-version same-ID install preserve local key; after real browser exit/start and temporary reinstall in the same profile, the key survived with default and test preservation preferences. Signed permanent install and Firefox executable update were not checked. Mozilla linter10.13.0: 0 errors/notices/warnings. Details/ZIP hashes: docs/archive/QA-REPORT.md and test-results/linguisty-key-lifecycle/.

Successful own profiles/Firefox processes cleaned up; no new cache/source duplicates, dependency source not duplicated, no install performed. Old WI-011 cache unchanged. Real API and user key were not used.
