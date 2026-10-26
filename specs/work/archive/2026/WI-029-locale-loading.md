# WI-029: Load only the selected UI dictionary

- Kind: `fix`
- Canon action: `none`

## Outcome

Close TD-002: popup/options/connection page load the selected local dictionary with safe fallback, without a shared bundle of all 16 dictionaries.

## Specs

- Governing: `spec://modules/interface/FEAT-003-controls#languages`
- Constraint: `spec://common/PROP-002-quality#resources`
- Constraint: `spec://modules/interface/FEAT-003-controls#errors`

## Scope

- Assigned paths: `src/ui/**`, `entrypoints/popup/**`, `entrypoints/options/**`, `entrypoints/codex/**`, `tests/ui/**`, this WI.
- In: local dictionary loading, language switching, fallback, startup and race regressions.
- Out: dependencies, shared contracts, build configuration, canon, and operational documents.

## Acceptance

- [x] Selected language and auto resolved as before; all 16 languages available.
- [x] No eager import of all dictionaries in production UI; loading failure has safe fallback. Production chunks for both platforms and actual Chrome resource requests checked by coordinator and WI-031.
- [x] Language changes and unmount leave no stale state/listeners or unbounded cache.
- [x] Meaningful UI tests pass; Result contains before → after and limitations.

## Result

Coordinator acceptance on 2026-10-12: both 0.4.7 production builds PASS; shared UI chunk 609125 → 259999 bytes (-57.3%), 14 lazy languages in 28 local chunks. Callback entry 843 bytes and compact labels 11491 bytes did not grow. Both platform manifest/resource checks PASS (56 files each). Chrome browser evidence: eager locale requests=0, selecting de loads only de, fr only fr, including offline; Firefox confirmed locale/offline; Resource Timing does not show module requests there. Integration Vitest: 751 tests / 48 files PASS; typecheck/lint PASS. Precise boundary of network measurement recorded in WI-031.

Before → after: shared UI imported 16 full dictionaries and arrays of CLI/ChatGPT strings for all languages → English fallback and compact Russian source remain synchronous; other 14 full dictionaries and their CLI/ChatGPT strings load through local dynamic imports by selected language. Direct synchronous consumers receive safe English text until the dictionary is ready or if its chunk fails; React UI then updates. Document language while waiting and on failure matches the displayed English fallback. ChatGPT sign-in callback keeps a separate compact table and does not import full UI.

Language change uses the current requested locale; completion of an earlier load does not replace a new selection. Identical in-flight import deduplicated; ready/pending caches limited to 16 declared locales; pending removed on completion. Subscriptions to languagechange/storage/dictionary readiness freed on unmount. Failure is not cached as a successful dictionary.

Checked: `tsc --noEmit` PASS; eslint of affected UI and tests PASS; `vitest run tests/ui --maxWorkers=2` 10 files / 88 tests PASS. New tests cover delayed loading, dedup, language change before completion, chunk failure, and unmount before completion. Completeness and placeholder-variable tests pass for all 16 locales. 16 extra-string files have 16 unique SHA-256; previous shared arrays removed. Intermediate/final free RAM snapshot 12 250 392 / 11 463 172 KiB; `.cache` 5 746 / 5 734 files and 243 012 338 / 242 567 580 B; cause of size change during parallel work not established; cache not deleted. No own watch processes or temporary scripts left; others' processes preserved.

Limitation: coordinator performs Chrome/Firefox production builds, UI/locale/callback chunk measurements, and packaging checks. Until then TD-002 is not declared closed and WI is not archived. Native language editing of 16 translations and real ChatGPT sign-in not checked by this change.
