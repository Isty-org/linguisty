# WI-022: Connecting Codex from settings

- Kind: `change`
- Canon action: `new-spec`

## Outcome

In settings, the user selects Codex, clicks “Connect Codex,” and gets a separate page with instructions, ChatGPT sign-in, and verified connection status. The new mode requires neither a Native Messaging host nor an installed CLI.

## Specs

- Governing: `spec://modules/interface/FEAT-003-controls#options`
- Governing: `spec://modules/platform/INFRA-004-codex-connection#auth`, `spec://modules/platform/INFRA-004-codex-connection#requests`
- Constraint: `spec://common/PROP-002-quality#checks`, `spec://common/PROP-002-quality#resources`
- Affected: `spec://modules/platform/INFRA-004-codex-connection#root`, `spec://common/PROP-001-contracts#types`
- Affected: `spec://modules/storage/INFRA-002-local-data#cache.key`, `spec://modules/platform/INFRA-001-extension#permissions`, `spec://common/PROP-000-product#invariants`

## Scope

- In: Codex selection, steps page, official OSS OAuth with PKCE/OIDC, tokens in tab memory only, Responses/SSE, cancellation and bounded resources, both browsers, documentation.
- Out: direct sign-in through Claude/Antigravity/Grok subscriptions; automatic publication; real model requests without a separate test assignment.

## Acceptance

- [x] Dropdown contains API providers and one new Codex; other CLIs are not offered.
- [x] Button opens/focuses one own connection tab with clear steps and the consequence of closing it.
- [x] OAuth verifies state, PKCE, ID token signature/issuer/audience/nonce/expiry, and ChatGPT plan eligibility; access/refresh/ID tokens are not written to storage, URL, journal, or background messages.
- [x] Callback intercepted only for the own sign-in attempt and frees temporary rule/tab/timer on completion and cancellation; background cleans only its own abandoned rules/tabs.
- [x] Provider implements the documented Responses contract, strict translation validation, account scope for persistent cache, and cancellation.
- [x] Typecheck, lint, meaningful tests, both builds/ZIP, manifest/hygiene, and browser scenario pass; live OAuth/model separately marked unverified without manual sign-in.

## Result

Implemented dropdown Codex → button → separate page with four ChatGPT sign-in steps, model list check, model selection, cancellation, disconnection, and return. Instructions and errors available in 16 languages. New mode uses no CLI/Native Messaging and keeps tokens only in RAM of the open page. API settings and previous key preserved; old CLIs no longer offered in UI.

Checks: TypeScript/ESLint PASS; 644 Vitest / 45 files (2 workers max); 15 native mock tests; 8 manifest/hygiene tests; production builds/ZIP Chrome+Firefox; Mozilla Add-ons Linter 10.13.0 — 0 errors/notices/warnings. Unmodified packages: Chrome Codex 5 groups, Firefox Codex 4 groups; API full smoke — 13 Chrome scenarios / 14 Node PASS and 14 Firefox groups, then after account cache change — final focused API cache checks in both browsers. OAuth/JWKS/Responses use fixtures only, not real accounts/models.

Acceptance fixes: required DNR permission, Chrome duplicate tab/worker-wake lookup through own getContexts, persistent cache separation by account, and narrow header. Protected .cache remained 5 652 files / 203 426 930 B; source duplicates/suspicious=0; own QA processes=0, created profiles removed. UI chunk 614 710 B recorded in TD-002. Report: docs/archive/QA-CODEX.md; instructions: docs/guides/chatgpt-connection.md; evidence: test-results/linguisty-codex/.

Real OAuth/eligibility/CORS, model response/accuracy/cost, store publication permission, signed install, native localization review, and minimum-version browsers not checked. Connection tab must stay open; the model is cloud-based. These limitations shown in UI/documentation; live checks and publication outside scope.
