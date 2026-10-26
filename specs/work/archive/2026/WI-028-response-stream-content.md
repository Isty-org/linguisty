# WI-028: Preserve completed Responses stream text

- Kind: `fix`
- Canon action: `direct-edit`

## Outcome

Completed messages from Responses SSE are not lost with empty terminal output; failure without text has a precise safe code.

## Specs

- Governing / Affected: `spec://modules/platform/INFRA-004-codex-connection#requests`.
- Constraint: `spec://common/PROP-002-quality#checks`, `spec://common/PROP-002-quality#resources`, `spec://common/PROP-002-quality#hygiene`.

## Scope

- In: Responses reader, fixed diagnostic labels, contract/security tests, realistic browser fixtures for both platforms, production packages, and QA.
- Out: reading user tokens/raw responses, live paid inference, changing Luna 6, weakening parser/cache, publication, and WI-011 cleanup.

## Acceptance

- [x] Before/after reproduction of final_answer loss from output_item.done when completed.output=[].
- [x] Completed text used only after response.completed/status=completed; commentary/refusal/incomplete/abort do not become success.
- [x] Repeated aggregate/stream does not duplicate text; conflicts and malformed events rejected; byte limits/reader cleanup preserved.
- [x] Remaining content errors have fixed reasons without body/claims/tokens/page text.
- [x] Typecheck/lint/unit, Chrome/Firefox builds, browser fixture, and manifest/packages checked; live cause of user failure explicitly not invented.
- [x] Cache/duplicates/RAM and QA resource release checked before, between, and after main work.

## Dependencies

- Related: `WI-026`, `WI-027`.

## Result

Before → after: reader ignored completed message events and used only terminal output → text from output_item.done saved by output_index, confirmed by terminal response.completed/status=completed, and merged with aggregate without duplicates. Before fix, regression reproduced exact LGT-response-content; after PASS. Empty aggregate no longer loses completed text. Commentary/raw deltas/refusal/incomplete do not become translation; conflicting items rejected. Map ≤128 slots, wire/output ≤1 MiB, reader cancel/release and Map cleanup in finally.

General content code split into fixed output/message/phase/status/part/empty/commentary/conflict reasons. Code passes through port/public progress/localization without arbitrary body, metadata, or text; parser/cache not weakened and selected gpt-6-luna preserved.

Typecheck/lint, 739 Vitest tests / 47 files, 9 manifest/hygiene tests, both production builds and ZIP PASS. 28 files / 24 referenced assets each; ZIP Chrome 441 258 / Firefox 441 344 bytes, manifest=0.4.6; all archive files match checked builds through SHA-256. Mozilla: errors/notices/warnings=0. On each platform, 8 browser groups, 1 340/1 340 nodes / 84 fixture requests, repeat from cache 1 340 / 0 requests. Incomplete and empty completed errors do not change original DOM/cache; fixed codes reach progress, pending=0.

.cache before/between/after 5 652 files / 203 426 930 bytes, source duplicates/suspicious=0; QA/watch=0. Firefox frees 13 own processes / 1 368 829 952 bytes working set and own profile; Chrome context/profile closed. RAM snapshots saved; absence of every possible leak not promised. Evidence: docs/archive/QA-SUBSCRIPTION.md, test-results/linguisty-response-stream/. Previous UI chunk TD-002 remains open: 609 125 bytes.

Real user response not obtained; a matching LGT-response-content cause and live Luna 6 inference/accuracy are not asserted. Signing/publication and native Chrome toolbar geometry not performed. Others' processes/cache and WAL/WI-011 preserved.
