# WI-024: Returning to Linguisty after ChatGPT sign-in in Firefox

- Kind: `fix`
- Canon action: `none`

## Outcome

Firefox allows the return from the OpenAI page to Linguisty's own callback page without hanging on about:blank.

## Specs

- Governing: `spec://modules/platform/INFRA-004-codex-connection#auth`
- Constraint: `spec://modules/platform/INFRA-004-codex-connection#resources`
- Constraint: `spec://modules/platform/INFRA-001-extension#permissions`
- Constraint: `spec://common/PROP-002-quality#checks`

## Scope

- In: reproducing the return with a web initiator in Firefox, targeted callback accessibility configuration, browser regression, both build and resource checks.
- Out: changing OAuth protocol, tokens, subscription limits, and real paid inference.

## Acceptance

- [x] Regression check reproduces blocking of the current build with auth.openai.com as initiator.
- [x] Fixed build receives callback in its own auth tab; a foreign origin cannot access the callback page.
- [x] Typecheck, lint, tests, both builds, manifest/secret checks, and Chrome/Firefox smoke passed.
- [x] Cache, duplicates, memory, and termination of own browser processes checked; updated Firefox ZIP prepared.

## Dependencies

- Related: `WI-022`, `WI-023`

## Result

Before: web_accessible_resources allowed callback page only from 127.0.0.1; fixture opened the URL through extension API and did not check the initiating site. After: exact auth.openai.com added to callback origins, private pages closed, OAuth protocol and token boundary preserved. Version 0.4.2; package checks and re-sign-in instructions updated.

On the previous Firefox 157.0.1 build, navigation from auth.openai.com content principal did not deliver callback: callback/token=0. After the change, the same scenario passed; 7 Firefox principal checks confirmed allowed origins and denial of foreign origins/private pages. Chromium 152.0.7977.8 passed two sign-ins through a form on a substituted auth.openai.com page, translation, cache hit, and account separation. Firefox also passed translation and session cleanup. Both browsers checked in 16 languages.

Checks: typecheck/lint PASS, 661 Vitest tests / 46 files, 9 manifest/hygiene tests, both production builds and manifest/secret/resource checks PASS. Mozilla linter: 0 errors/notices/warnings. Firefox ZIP `.output/linguisty-0.4.2-firefox.zip`: 28 files / 1 137 648 B before compression. Previous UI chunk size warning remains in TD-002.

Resources: .cache unchanged — 5 652 files / 203 426 930 B; no source duplicates. Firefox: 13 own processes / 1 447 309 312 B working set → 0; profile removed. Chrome context closed and profile removed; separate QA command line inspection found no remaining browser/watch processes. RAM snapshot after checks: free 17 130 971 136 out of 34 282 012 672 B; this does not prove absence of every leak.

Evidence: `docs/archive/QA-SUBSCRIPTION.md`, `docs/RESEARCH.md`, `test-results/linguisty-subscription/{chrome,firefox,hygiene-final}.json`. Real user account sign-in, plan availability, live token exchange/CORS, and model responses not checked. User needs to reload the extension and start a new sign-in attempt; old OAuth tabs are not reused.
