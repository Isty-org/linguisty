# WI-018: CJK → Russian spacing and style preservation

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Translated neighboring alphabetic text fragments within a sentence are separated by spaces, while font changes do not affect inline links and interface elements.

## Specs

- Governing: `spec://modules/page/FEAT-002-page-translation#render`
- Governing: `spec://modules/translation/FEAT-001-engine#validation`
- Constraint: `spec://modules/page/FEAT-002-page-translation#sessions`
- Constraint: `spec://common/PROP-002-quality#resources`
- Affected: `spec://modules/page/FEAT-002-page-translation#render`
- Affected: `spec://modules/translation/FEAT-001-engine#validation`

## Scope

- In: inline Text node boundaries, prompt and cache version; conservative typography; links, footnotes, forms, restore, streaming, and external DOM; mock Chrome/Firefox.
- Out: rewriting DOM/HTML, dictionary-based word splitting inside an incorrectly concatenated model response.

## Acceptance

- [x] Chinese text with inline links reproduced; Russian result has spaces; punctuation/footnotes/BR/separate blocks preserved.
- [x] Batch/stream preview readiness order, original/translated, and external edits do not create duplicate spaces or stale entries.
- [x] Links/events/forms and their styling preserved; font enlargement limited to semantic blocks.
- [x] New prompt version isolates old cached responses; regressions and browser checks on both platforms completed.
- [x] Resources checked; real API language accuracy not declared verified.

## Dependencies

- Related: `WI-012`, `WI-014`, `WI-017`.

## Result

2026-10-08: before, only original edge whitespace was preserved, causing CJK inline nodes to concatenate Russian words → renderer preserves model edge whitespace for CJK and adds one owned space between alphabetic translations at a directly touching CJK boundary. Traversal limited to 64 steps/8 levels, does not cross block/BR/images or add a space before punctuation/sup/sub. Original alphabetic joining is preserved, including `请用i<b>Phone</b>阅读。` → “Используйте iPhone для чтения.” (Russian output meaning “Use iPhone for reading.”). No new wrappers/HTML; current Text/Element objects remain the same. Words are not guessed inside an incorrectly concatenated Russian response.

Before, resizing any simple text HTML parent → correction only for semantic leaf blocks outside nav/aside/forms/buttons/tables/nowrap. Links, inline spans, user input, and handlers preserved. Original restores original Text; owned font-size/line-height are removed. In some browsers, CSSOM may leave empty `style=""`; browser restore compares the entire HTML while normalizing only this empty attribute. This is not restoration of HTML from the model or a promise of identical layout for every translation length.

Prompt explicitly requires normal target-language word separation and coordination of inline fragments without moving text between IDs. `PROMPT_VERSION` linguisty-1→linguisty-2 isolates earlier responses in bounded TTL/LRU cache; user source data is not deleted.

Checks: unit tests for reverse neighbor readiness order, Unicode seams, punctuation/sup/BR/Latin joins, external edits, eight toggles without new requests, and conservative typography. Overall run 566 tests / 33 suites, typecheck/lint, and 8 package/hygiene tests PASS. Final Chrome/Firefox builds and manifests PASS. After packaging, full smoke Chrome 13 scenarios + parent / Firefox 14 groups PASS. Large fixture translates all 28 original nodes with regular and artificially truncated responses; inline output “Искусственный интеллект может обучаться.[1]” (Russian for “Artificial intelligence can learn.” followed by the reference), element identity/events/input/styles preserved; four toggles restored source without network. Images `test-results/linguisty-smoke/large-page-translated.png` and `test-results/linguisty-firefox/large-page-translated.png` reviewed. Other lifecycle/cache/streaming regressions also passed; final Firefox fingerprint unchanged, ZIPs match builds byte for byte.

Resources checked together with WI-017: duplicates/suspicious/hash-skipped=0, project .cache without growth, own browser processes and profiles cleaned up, mock requests/timers=0. No paid API requests: journal for the user's attempt, real language accuracy, and Gemini Flash Lite speed were not checked. Research details: `docs/RESEARCH.md`.
