# WI-016: Reliable extension interface startup

- Kind: `fix`
- Canon action: `direct-edit`

## Outcome

Popup and settings open despite slow background startup and cache failure; waiting is bounded, and errors offer reload and a clear message.

## Specs

- Governing / Affected: `spec://modules/interface/FEAT-003-controls#errors`
- Governing / Affected: `spec://modules/platform/INFRA-001-extension#recovery`
- Constraint: `spec://common/PROP-001-contracts#messages`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- In: bounded messaging/retry, independent settings/cache loading, background recovery, bootstrap/render fallback, unit/UI/browser checks.
- Out: paid API requests and bypassing browser CSP.

## Acceptance

- [x] Hanging cache reproduced by a test; it does not block the settings form.
- [x] Slow/unavailable background ends waiting with a clear error; read-only commands allow bounded retry; mutations are not duplicated.
- [x] Session snapshot restoration failure does not block settings and persistent secret status.
- [x] React/bootstrap failure shows an accessible fallback instead of an empty window.
- [x] Repeated opens/unmount free listeners and timers; late replies do not replace newer state.
- [x] Typecheck/lint/tests, both builds, and browser smoke completed; resources and duplicates checked.

## Result

Before → after: cache stats and session restore blocked configuration; reads had no deadline → form independent of stats, configuration independent of snapshots, reads bounded at 5s, transient transport has one retry, mutations not retried. Abort on UI close removes waits/timers for user actions; late replies do not change a new load. HTML startup fallback and React boundary provide a safe message with reload without raw error/form values.

Unit regression first confirmed the hanging form, then passed with independent loading. Separate packaged Chromium run confirmed pending cache, first missing receiver, and pending settings → timeout/error/retry → recovered form. Typecheck/lint, 417 unit/contract/DOM tests/20 suites (<=2 workers), 7 manifest/hygiene tests, and 5 fixtures PASS. Both production build/ZIP/byte comparison, full Chromium pipeline/UI/startup (12 Node tests with parent), 10 Firefox groups, and 2 Firefox key lifecycle scenarios PASS. Mozilla package validation: 0 errors/notices/warnings. Evidence: test-results/linguisty-ui-startup/, standard browser reports, and docs/QA-REPORT.md.

No transport timers/listeners after unmount; browser lifecycle checks confirm zero observers/timers/snapshots after sessions finish, with 0 for both active mock requests and remaining own Firefox processes. RAM/filesystem snapshot and absence of source duplicates checked separately; others' processes and old WI-011 cache were not deleted. Unverified signed install, browser executable upgrade, and live provider remain explicit in the report.
