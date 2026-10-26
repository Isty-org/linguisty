# WI-027: Compact popup settings and regression checks

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

A verified Linguisty build with a settings gear in the popup and fixes for reproduced regressions.

## Specs

- Governing / Affected: `spec://modules/interface/FEAT-003-controls#popup`.
- Governing: `spec://modules/interface/FEAT-003-controls#design`, `spec://modules/interface/FEAT-003-controls#errors`.
- Governing / Affected: `spec://common/PROP-001-contracts#messages`.
- Governing: `spec://modules/storage/INFRA-002-local-data#settings`.
- Constraint: `spec://common/PROP-002-quality#checks`, `spec://common/PROP-002-quality#resources`, `spec://common/PROP-002-quality#hygiene`.

## Scope

- In: popup gear, accessible name and tooltip, UI/translation/cache/cancellation review and regression checks, fixes for proven failures, production packages for both platforms.
- Out: paid inference, Firefox publication/signing, changing the user's selected Luna 6, clearing others' cache and WI-011.

## Acceptance

- [x] Gear replaces visible text, localized accessible name, 44 px click target; keyboard/theme/RTL checked.
- [x] Old popup saves only languages; new model, provider, key mode, and other settings are not rolled back. Regression confirmed with a before/after test.
- [x] Typecheck, lint, meaningful unit and Chrome/Firefox browser regression checks completed; found bugs described factually.
- [x] ZIPs for both platforms prepared and verified with matching manifest versions.
- [x] Cache, duplicates, memory, and release of own QA resources checked at intermediate and final stages.
- [x] Unchecked live scenarios explicitly stated; Result and canon aligned.

## Dependencies

- Related: `WI-026`.

## Result

Before → after: text settings button → 44×44 px gear with localized aria-label/title and decorative SVG. Both themes, 16 locales, RTL, keyboard focus, and Enter checked on both platforms.

New bug reproduced: language from an old popup restored previous provider/model/theme/instructions. Regression before fix FAIL, after PASS. languagesOnly=true applies only language/mode over latest configuration under the existing queue; key rejected in this mode. New Luna 6 model not replaced. Queue/security checks and actual Chrome popup/Firefox background evidence included.

Checks: typecheck/lint PASS; 705 Vitest tests / 47 files, 15 Native fixtures, 9 manifest/hygiene tests PASS. Chrome: 13 overall smoke groups, Firefox: 14, all PASS. Subscription: 8 groups each, 1 340/1 340 nodes / 84 fixture requests, repeat entirely from cache, incomplete rejected and not cached. Chrome UI test error involving a closed API URL fixed by checking tab IDs; production permissions not expanded.

Version 0.4.5 matches in package.json/lock/WXT and ZIP manifest. ZIP Chrome 440 832 / Firefox 440 918 bytes; 28 files each match checked builds through SHA-256. Mozilla: 0 errors/notices/warnings. .cache 5 652 files / 203 426 930 bytes unchanged at checkpoints, source duplicates/suspicious=0, remaining QA/watch processes=0; own browser profiles removed. Firefox working-set/lifecycle and RAM snapshots saved; absence of every leak not promised. Sources ZIP excludes temporary results/cache; own documentation and WI archive included.

Full facts: docs/archive/QA-POPUP.md and test-results/linguisty-popup-regression/. Live Luna 6 and cause of the original 22 user failures remain unconfirmed without the real response. Firefox signing/store install/native Chrome toolbar geometry not performed; previous UI chunk 608 946 bytes remains TD-002. WAL/WI-011 and others' processes/cache preserved.
