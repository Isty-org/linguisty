# WI-021: Translation through an installed CLI

- Kind: `change`
- Canon action: `new-spec`

## Outcome

The user selects Codex, Claude Code, Antigravity CLI, or Grok Build and translates a page through their own installed CLI from the Linguisty interface.

## Specs

- Governing: `spec://common/PROP-000-product#scope.in`
- Governing: `spec://modules/platform/INFRA-003-local-cli#root`
- Affected: `spec://modules/platform/INFRA-003-local-cli#root`
- Constraint: `spec://common/PROP-002-quality#checks`, `spec://common/PROP-002-quality#resources`

## Scope

- In: Native Messaging, four CLI adapters, one-time Windows connector installation, UI without an API key, existing cache/deduplication, cancellation/limits, documentation, and checks.
- Out: installing third-party CLIs, moving their tokens, paid model requests, our server, managing existing user chats and processes.

## Acceptance

- [x] CLI can be selected, saved, and used without an API key; old API settings continue working.
- [x] Connector launched by browser, bounds queue/input/output, terminates processes it owns on cancellation/timeout/disconnect.
- [x] Four adapters checked with deterministic responses; missing CLI and connector give clear errors.
- [x] Connection test does not invoke a model and explicitly states its scope.
- [x] Windows installation, typecheck, lint, meaningful tests, both builds, manifests/secrets, browser smoke, and hygiene actually checked.
- [x] Real model responses and missing CLIs marked unverified.

## Result

Completed 2026-10-08 for @tsyzhman's project using Codex. Four CLI adapters, bounded stdio Native Messaging host, Windows installer, keyless options/popup in 16 UI locales, and 0.3.0 packages. API key is not read or transmitted during CLI translation; previous key preserved for returning to API.

Checks: typecheck/lint PASS, 589 unit PASS, 15 native PASS, 8 manifest checker PASS, Chrome API/UI/native 16 PASS, Firefox API 14 PASS and native 5 checks PASS, both builds/manifests/secrets PASS, Mozilla 0/0/0, hygiene PASS. No own helper processes/temp workspaces; others' cache and processes preserved. Vite UI size warning remains in TD-002.

Material limitations: real models/accounts/language accuracy not checked; Claude/Antigravity CLI not found. Chrome native transport used a separate test copy with only its permission declaration changed; physical optional prompt not confirmed. Firefox standard optional prompt checked in an unmodified package. Evidence and packages: docs/archive/QA-CLI.md; installation: docs/LOCAL-CLI.md.
