# Linguisty v0.4.9 — first GitHub release verification

Date: 2026-10-20, Europe/Moscow. WI-038. Development author and owner: Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI implementation and audit tools are listed in [AUTHORS](../../AUTHORS.md) and historical reports.

## Before → after

- The local repository had no commits or remote → the current version 0.4.9 is published in `Isty-org/linguisty` with a tag, source code, and three release assets.
- `.me` and task owners identified an AI coordinator or individual AI chats → local `.me`: `@tsyzhman`, Никита Цыжман, `human`; all BOARD owners and current development authorship were assigned to @tsyzhman at the user's direct request. Information about AI tools and actual historical results was not removed.
- `.gitignore` excluded the main generated folders → it additionally excludes other local identity/credential files, private keys, temporary files, and `output/`. `.gitattributes` defines text line endings and binary files.
- Metadata lacked an author and repository URL → package metadata, both platform manifests, and README identify the author and repository.
- The privacy test compared PII sentinel `250` against a random UUID and the current timestamp → the legacy fixture uses a fixed ID and clock; verification that unwanted fields are removed is preserved. Production log logic was unchanged.

The first run did end with 779 PASS / 1 FAIL: the random UUID began with `250`. After correcting the test data, the full suite passed 780/780. The original local log was preserved separately; the failed run is not called successful.

## Checks

| Check | Result |
|---|---|
| Typecheck and lint | PASS |
| Vitest, maximum 2 workers | 780 PASS / 50 files |
| Native runtime | 15 PASS |
| Manifest/hygiene contracts | 9 PASS |
| Local HTML fixtures | 5 PASS |
| Chrome and Firefox production builds | PASS |
| Manifest, permissions, CSP, resources, and secret patterns | PASS; 56 files each |
| Chrome full smoke | 14 PASS |
| Firefox full smoke | 14 PASS |
| ChatGPT mock Chrome/Firefox | Chrome 1 scenario PASS; Firefox 8 checks PASS |
| Long batch Chrome/Firefox | 2 PASS; Firefox HTTP reply 40 046 ms, translation 40 133 ms, normal unload 31 665 ms after completion |
| Mozilla Add-ons Linter 10.13.0, Firefox ZIP | 0 errors / 0 notices / 0 warnings |
| Direct dependencies and package-lock | 21 versions match the installed versions |

Commands: `npm run typecheck`, `npm run lint`, `npm test -- --maxWorkers=2`, `npm run test:native`, `node --test --test-concurrency=2 scripts/check-manifests.test.mjs`, `node scripts/check-fixtures.mjs`, `npm run build:chrome`, `npm run build:firefox`, `npm run check:manifests`. Browser commands and methodology are described in [TESTING](../guides/testing.md).

Runtime: isolated Chromium 152.0.7977.8 and Firefox 158.0 / geckodriver 0.37.1 through a separate temporary profile. Production packages are not patched; provider/OAuth responses are substituted only by tests.

## Artifacts and source code

Packages were created from the production directories under test without rebuilding. Each ZIP was checked byte for byte by SHA-256 across all 56 files, including the manifest with author and homepage. `SHA256SUMS.txt` contains checksums of both ZIPs.

After all browser runs, SHA-256 hashes of all 112 production files matched the initial snapshot: 0 modified files. Checked 146 local links and 642 canonical specification links with anchors; no errors. 38 WIs have unique IDs, and every BOARD row belongs to @tsyzhman.

- Chrome: 487 765 B; SHA-256 `2d6d8933696b588d66abeb81e92cfa5c103d8132779ec3b4e966293abfb5897c`.
- Firefox: 487 843 B; SHA-256 `01e32ec0bf2532a86675efdffe13b3ce17871ce2917d8bc942b1d20c32d92a4e`.

Complete source code and tests are included in Git tag `v0.4.9`. Local `.me`, browser profiles, node_modules, generated builds, credentials, and raw QA artifacts are excluded from Git. The initial source scan found no secrets outside tests; four credential-URL matches in tests were reviewed as intentionally fake strings for rejecting unsafe endpoints.

Local evidence for this pass: `test-results/first-release-2026-10-20/`; browser JSON and screenshots use the existing scenario directories. They are not included in the release sources.

## Publication verification

[GitHub Release v0.4.9](https://github.com/Isty-org/linguisty/releases/tag/v0.4.9) was published on 2026-10-20 at 14:36 Europe/Moscow, neither draft nor prerelease. Source commit: `c23c3c977b70ea97a8041559c833048f32367f60`; default branch: `main`. The GitHub API confirmed author and committer `Tsyzhman`, name Никита Цыжман, and GitHub noreply. The release author is the same account.

The public tree at the release commit contains 333 files; forbidden local/generated paths 0, tree not truncated. Both ZIPs and `SHA256SUMS.txt` were downloaded back from GitHub: all three local and remote SHA-256 hashes match. GitHub asset digests confirm the same values.

Additional diagnostics with `git diff --cached --check` showed existing blank lines at the end of several files and trailing spaces in the original font OFL licenses. No mass formatting or third-party license modification was performed. The check for other trailing spaces / space-before-tab passes; this is not presented as a clean result of the original command.

## Resources and limitations

Initial snapshot: node_modules 193 594 094 B, `.wxt` 6 713 B, `.output` 23 786 054 B, `.cache` 203 426 930 B, test-results 23 436 592 B. After browser runs: node_modules 193 594 197 B, `.wxt` 6 713 B, `.output` 23 776 730 B. No exact source duplicates, suspicious copies, or hash skips. Free RAM 13 350 580 224 / 34 282 012 672 B; inspector RSS 63 389 696 B. This is a resource snapshot, not proof that every leak is absent.

After scenarios finished, no Linguisty-related helper processes were found. Firefox mock OAuth and long-batch additionally confirmed `profileRemoved=true`, `remainingOwnedProcesses=0`; long-batch finished with `pendingTimers=0` and `ownedMemoryAfterBytes=0`. No persistent watchers or servers were left running.

After published assets were verified, only the seven preparation scripts created for this task and their empty directory were removed. `.cache` returned to the initial 5 652 files / 203 426 930 B; source duplicates and suspicious copies: 0. Final free RAM: 13 334 360 064 / 34 282 012 672 B. Local reports and assets downloaded for comparison are preserved in test-results, totaling 24 590 000 B in the final snapshot; Git ignores this directory.

Old WI-011 cache was not deleted. Dependencies were neither reinstalled nor cleaned; additional platform packages in the shared node_modules were unchanged. Tests use neither watch mode nor paid requests.

Unverified: real ChatGPT sign-in and plan availability for every user/distributed application, real paid APIs and language accuracy, native-speaker localization review, actual execution on Chrome 120 / Firefox 142, Firefox signing and permanent installation, and store publication. Browser mocks do not establish these properties.
