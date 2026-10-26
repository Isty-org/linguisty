# WI-038: First Linguisty release on GitHub

- Kind: `migration`
- Canon action: `none`

## Outcome

First release v0.4.9 published in `Isty-org/linguisty` with verified Chrome/Firefox packages, sources, and authorship credited to Никита Цыжман @tsyzhman.

## Specs

- Governing: `spec://common/PROP-002-quality#checks`
- Governing: `spec://common/PROP-002-quality#hygiene`
- Governing: `spec://modules/platform/INFRA-001-extension#build`
- Constraint: `spec://common/PROP-000-product#acceptance`

## Scope

- In: gitignore and exclusion of local `.me`; authorship and metadata; release documentation; current automated and browser checks; initial commit, tag, and GitHub Release with packages and SHA-256.
- In: fixing reproduced instability in `tests/storage/errorLog.test.ts`: random UUID matched PII sentinel `250`; production journal logic unchanged.
- Out: store publication, Firefox signing, real paid API/ChatGPT requests, removal of old temporary WI-011 files.
- Version 0.4.9 retained. License added only on user selection; no selection does not imply permission to license.

## Acceptance

- [x] `.me` is local and contains @tsyzhman / Никита Цыжман / human; generated files, caches, and credentials excluded from Git.
- [x] Authorship in README, metadata, BOARD, and current documentation aligned; Git author configured to confirmed GitHub noreply of @tsyzhman account.
- [x] Typecheck, lint, unit/native/manifest tests, both production builds, and available browser smoke performed; limitations recorded.
- [x] Chrome/Firefox ZIPs matched against checked builds; checksums and correct installation instructions published.
- [x] Source commit and tag published; GitHub Release accessible with expected assets; resources, duplicates, and own process cleanup checked.

## Result

Published [first release v0.4.9](https://github.com/Isty-org/linguisty/releases/tag/v0.4.9), initial commit `c23c3c977b70ea97a8041559c833048f32367f60`, default branch `main`. GitHub confirmed author/committer/release author `Tsyzhman`; Git name — Никита Цыжман, email — GitHub noreply. Public source tree contains 333 files without `.me`, credentials, or generated folders. All three assets downloaded from GitHub and matched local files by SHA-256; GitHub asset digests match too.

780 unit / 15 native / 9 manifest-hygiene tests PASS, typecheck/lint/builds/manifests/fixtures PASS, full browser smoke 14/14 on each platform, mock ChatGPT Chrome PASS / Firefox 8 PASS, long-batch 2 PASS. Mozilla 0/0/0. ZIPs checked byte for byte; all 112 production files unchanged after browser runs. QA: `docs/archive/QA-RELEASE-2026-10-20.md`. Source scan, 146 local links, and 642 spec references passed; no related helper processes. Limitations of real provider access, signing/stores, absence of a selected open license, and original whitespace diagnostics recorded without declaring unperformed checks successful.
