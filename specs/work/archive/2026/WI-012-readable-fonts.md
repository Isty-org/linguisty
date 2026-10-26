# WI-012: Readable fonts when translating between writing systems

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

When translating between CJK and alphabetic writing systems, text automatically receives a readable font size while the page preserves distinctions between body text, headings, and captions. The main reported scenario is Japanese → Russian; the reverse direction needs checking.

## Specs

- Governing: `spec://modules/page/FEAT-002-page-translation#render`
- Constraint: `spec://modules/page/FEAT-002-page-translation#sessions`
- Constraint: `spec://common/PROP-002-quality#ui`
- Constraint: `spec://common/PROP-002-quality#resources`
- Affected: `spec://modules/page/FEAT-002-page-translation#render`

## Scope

- In: reproducing the problem, measuring size and metrics of the fonts used, choosing automatic correction; DOM renderer and management of extension-owned styles; restoration of original formatting; Chrome/Firefox browser checks.
- Clarify canon before implementation: renderer currently changes only Text.data. Choose the size, fallback font, and line-height solution using reproducing pages, without a predetermined universal multiplier.
- Out: scaling the entire page, changing text or styling of untranslated elements, loading remote fonts.

## Acceptance

- [x] Japanese → Russian reproduced and recorded with a before/after example; Russian → Japanese checked separately, an assumption not presented as a confirmed bug.
- [x] Translation does not become excessively small or large on checked examples; main paragraphs, headings, and captions are readable and not clipped because of correction. Criteria and measurements of the selected solution recorded before acceptance.
- [x] Switching to original restores original styles; repeated switches, dynamic inserts, and external DOM changes do not accumulate corrections or break forms/events.
- [x] Meaningful regression tests and Chrome/Firefox browser checks pass; unavailable checks explicitly stated.
- [x] Element reference release, absence of mutation loops and duplicates, cache, and memory checked under PROP-002.

## Research starting points

- [Stack Overflow: differences in the apparent size of English and Japanese text](https://stackoverflow.com/questions/59677365/how-to-make-english-text-appear-the-same-size-as-japanese-text).
- [Reddit: changing the minimum CJK text size](https://www.reddit.com/r/ChineseLanguage/comments/hzcp96/).
- [MDN: font-size-adjust and font metrics](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-size-adjust). Check applicability and support for selected values in our browsers; this is a starting point, not an already selected fix.

## Result

2026-10-08, before implementation: `tests/fixtures/fonts.html`, Times New Roman / Yu Gothic. Chromium 152: body 18 px, CJK ink 16 px, Cyrillic caps 12 px; heading 30 px, 27/20 px; caption 12 px, 11/9 px. Firefox 157: body 18 px, 16.031/12.190 px; heading 30 px, 27.451/20.273 px; caption 12 px, 10.688/8.127 px. Baseline: `test-results/linguisty-fonts/baseline.json`. Confirmed metric differences at identical CSS size. This is a reproducing local example; the user's page URL was not provided.

Criteria before acceptance: alphabetic translation approaches original apparent height (15% tolerance for paragraph/heading), maximum scale 1.4; caption remains smaller than body, body smaller than heading; CJK is not reduced and has a 16/13 px minimum within 1.4; correction does not increase clipped overflow; the original two style properties return after repeated toggles and dispose. Reverse direction checked as an independent scenario, without claiming a previously reproduced reverse bug.

Result: PageTypography adjusts two properties of the leaf parent. Chromium: paragraph 18→24 px, Cyrillic ink 12→16 px; heading 30→40.5 px; caption 12→14.667 px. Firefox: separate actual numbers in `test-results/linguisty-firefox/observations-focused-fonts.json`. Fixed-height block remains 18 px after rollback. RU→JA: heading/paragraph do not shrink, caption 12→13 px. Both browsers: five toggles without network/accumulation, dynamic insert, external style, user input; screenshots visually reviewed.

Checks: 44 DOM/typography tests; typecheck; lint; both production builds; focused Chrome/Firefox browser smoke. Own profiles/PIDs closed, Firefox remainingOwnedProcesses=0. Cache returned to the original 203 426 930 bytes/5 652 files; free RAM 16.98 GB. Does not confirm real API quality or any arbitrary page/font.
