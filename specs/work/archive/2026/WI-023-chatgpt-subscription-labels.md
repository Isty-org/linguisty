# WI-023: ChatGPT subscription naming and return localization

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

The user selects “ChatGPT subscription”; buttons, instructions, and messages use this clear name. The connection page and return after sign-in support all 16 interface languages.

## Specs

- Governing: `spec://modules/platform/INFRA-004-codex-connection#settings`
- Governing: `spec://modules/interface/FEAT-003-controls#languages`
- Constraint: `spec://common/PROP-002-quality#checks`, `spec://common/PROP-002-quality#hygiene`
- Affected: `spec://modules/platform/INFRA-004-codex-connection#settings`, `spec://modules/interface/FEAT-003-controls#options`

## Scope

- In: localized service, button, and message names; callback language; current instructions; builds and Chrome/Firefox checks.
- Out: OAuth changes, provider ID, CLI compatibility, paid requests, publication.

## Acceptance

- [x] All 16 languages contain naming, steps, statuses, and errors; the new user interface does not call the service Codex.
- [x] Return after sign-in uses the selected language and RTL; OAuth code cleanup preserved.
- [x] Typecheck, lint, meaningful tests, both builds, manifest/hygiene, and browser scenario completed; real sign-in and model explicitly remain unverified.
- [x] Cache, duplicates, memory, and absence of own leftover processes checked.

## Result

Linguisty 0.4.1: localized “ChatGPT subscription” in selector/options/popup/guide, ChatGPT connection and disconnection, all statuses and errors; callback supports the selected language and RTL without loading the full UI dictionary. Internal provider ID `codex`, entrypoint names, and protocol unchanged. Canon and instructions updated; historical QA-0.4.0 preserved.

TypeScript/ESLint PASS; 661 Vitest / 46 files / max 2 workers; 8 checker tests; production builds/ZIP for both platforms; manifest/hygiene PASS; Mozilla linter 0 errors/notices/warnings. Chrome — 6 groups, Firefox — 5, including all 16 languages and fixture sign-in/translation. Russian/Arabic mobile images reviewed. Actual live OAuth/eligibility/model and native-speaker review not declared checked. Evidence and limitations: docs/archive/QA-SUBSCRIPTION.md, test-results/linguisty-subscription/.

Intermediate and final hygiene snapshots have no suspicious files or duplicates; protected .cache unchanged. Firefox own processes 13 → 0; Chrome own context closed, created profiles removed. Shared UI chunk size 608 410 bytes and callback shared chunk 11 492 bytes recorded in TD-002.
