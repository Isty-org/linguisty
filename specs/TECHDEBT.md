# Linguisty technical limitations

## Open

### TD-001: Two key storage areas without a shared transaction

- Area: storage/secrets.
- Related specs: `spec://modules/storage/INFRA-002-local-data#secrets`.
- Introduced by: WI-003.
- Current state: the persistent key and keyMode commit in one local write; a transition to session first prepares session storage, then commits local storage. The browser API does not provide a transaction spanning both areas.
- Risk: abrupt termination between operations may leave a temporary copy in the inactive area.
- Trigger: process termination between write and deletion.
- Mitigation: WI-030 serialized repair/settings/configuration, added best-effort rollback for every started write, and prevented returning a stale key from an inactive area when the committed mode is known. Reads/saves follow the committed mode; the next save removes residue, and explicit deletion clears both areas. This does not promise atomicity if the browser is killed.
- Work: [WI-030](work/archive/2026/WI-030-storage-recovery.md), completed 2026-10-12. The API limitation remains; confirmed recovery defects were fixed.

Unperformed checks are listed in QA reports and are not automatically accepted implementation defects.

## Resolved

### TD-002: All dictionaries in the shared UI chunk

- Area: interface/localization build.
- Related specs: `spec://modules/interface/FEAT-003-controls#languages`, `spec://common/PROP-002-quality#resources`.
- Introduced by: WI-020.
- Current state: fixed on 2026-10-12 in [WI-029](work/archive/2026/WI-029-locale-loading.md). en/ru are available synchronously; the other 14 languages and additional CLI/ChatGPT strings load as local chunks when selected.
- Risk removed: loading and parsing all 16 full packs whenever a UI opens.
- Evidence: shared UI chunk 609125 → 259999 bytes (-57.3%); both 0.4.7 production builds without the >500 kB warning. Callback 843 bytes + compact labels 11491 bytes; background 88243 bytes without full dictionaries. Chrome resource checks confirmed 0 eager locale chunks, then only selected de/fr; Firefox locale/offline behavior was checked, but Resource Timing does not measure module requests there.
- Mitigation: English fallback when a chunk is unavailable, stale-load protection, a cache bounded to 16 locales, and subscription cleanup are covered by UI regression tests.
- Work: WI-029; browser evidence in WI-031 and `docs/archive/QA-2026-10-12.md`.
