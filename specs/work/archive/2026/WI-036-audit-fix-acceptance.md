# WI-036: Acceptance of independent audit fixes

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Version 0.4.9 contains verified A1–A3 fixes from WI-032 and additional Firefox lifecycle fix WI-037, new ZIPs, and an honest final QA report; Astra rechecks resolution of its findings.

## Specs

- Governing: `spec://common/PROP-002-quality#checks`
- Governing: `spec://common/PROP-002-quality#hygiene`
- Constraint: `spec://common/PROP-000-product#acceptance`
- Affected: `spec://modules/translation/FEAT-001-engine#errors`
- Affected: `spec://modules/storage/INFRA-002-local-data#contracts`

## Scope

- Coordinator paths: version metadata in package/lock/wxt, shared docs, specs/BOARD/WAL/TECHDEBT/archiving, and this WI.
- Auditor follow-up paths: closure addition only to `docs/archive/AUDIT-2026-10-12.md`; production read-only.
- In: integration checks for WI-033…035, long-batch and journal browser scenarios, both builds/manifest/ZIP/Mozilla, resources, and Astra recheck.
- Out: live paid/login, publication/signing, bypassing blocked WI-011 cleanup.

## Acceptance

- [x] A1–A3 fixed and confirmed by regressions; Astra recheck completed.
- [x] Typecheck/lint/unit/native, both builds, and manifests pass.
- [x] Affected Chrome/Firefox browser scenarios and long-batch pass; limitations explicitly recorded.
- [x] ZIPs exactly match checked builds; Mozilla linter without warnings.
- [x] Links/duplicates/cache/RAM and absence of own helpers checked; docs/BOARD updated.

## Result

0.4.8: 767 tests, typecheck/lint/native/manifests, both full browser14/14, mockChatGPT, and journal PASS. Long-batch Chrome PASS, Firefox FAIL due to confirmed event page unloading around30s. Continuation: WI-037, new build0.4.9, and final acceptance.

Accepted 2026-10-13: 0.4.9, 780 tests/50 files, typecheck/lint/native15, both builds/manifests, full browser14/14 on each platform, long-batch2/2, and mockChatGPT PASS. ZIP56/56 checked byte for byte, Mozilla0/0/0. Astra closure A1–A3/WI037: no new findings. README/QA/TESTING updated; links, duplicates, RAM, and absence of QA helpers checked. WI011 remains separately Blocked due to automatic approval review; not declared complete. Report: docs/QA-2026-10-13.md.
