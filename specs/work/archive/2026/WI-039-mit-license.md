# WI-039: MIT with authorship credited to Никита Цыжман

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Linguisty published under MIT with copyright credited to Никита Цыжман @tsyzhman; sources and Chrome/Firefox packages of new release v0.4.10 contain the license.

## Specs

- Governing: `spec://common/PROP-000-product#licensing`
- Governing: `spec://modules/platform/INFRA-001-extension#build`
- Constraint: `spec://common/PROP-002-quality#checks`
- Constraint: `spec://common/PROP-002-quality#hygiene`
- Affected: `spec://common/PROP-000-product#licensing`
- Affected: `spec://modules/platform/INFRA-001-extension#build`

## Scope

- In: LICENSE, third-party notices, metadata and version 0.4.10, automatic license inclusion in build/ZIP, package checks, documentation, tag, and GitHub Release.
- Out: runtime behavior changes, overwriting published v0.4.9, store publication, Firefox signing, real paid requests, and others' cache.

## Acceptance

- [x] MIT contains the author's 2026 copyright notice; third-party copyright and OFL preserved. The notice used the author's Cyrillic name at release acceptance; its current English spelling is `Copyright (c) 2026 Nikita Tsyzhman (@tsyzhman)`, requested on 2026-10-26.
- [x] Metadata and canon aligned; Chrome/Firefox automatically include exact LICENSE/notices from root.
- [x] Build/manifest checks, required tests, and available browser smoke pass; actual limitations recorded.
- [x] v0.4.10 published; GitHub recognizes MIT; downloaded assets match by SHA-256; resources and duplicates checked.

## Result

Published [v0.4.10](https://github.com/Isty-org/linguisty/releases/tag/v0.4.10), commit `8862d27150d91ae6241c7c5b3aedfdae4b31ffc0`, author Никита Цыжман / `Tsyzhman`. GitHub License API at tag recognizes SPDX `MIT`; all three assets downloaded back and matched by SHA-256. Source tree contains 338 files without local `.me`, credentials, or generated folders. Tag, commit, and digests of v0.4.9 preserved.

Typecheck/lint, 780 unit, 15 native, 10 manifest/license contracts, both builds, and targeted Chrome/Firefox browser smoke PASS; Mozilla 0/0/0. All previous runtime/assets match v0.4.9; manifest differs only by version number; each of the two ZIPs contains 58 verified files. Root MIT and original third-party notices compared. QA: `docs/archive/QA-MIT-2026-10-20.md`. Checked 161 local links and 651 spec reference; no source duplicates or remaining own browser helpers. Full browser/ChatGPT/long-batch scenarios not repeated and live provider access are not declared a new successful run.
