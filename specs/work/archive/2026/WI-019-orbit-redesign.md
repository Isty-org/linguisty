# WI-019: Редизайн Retro Orbit Editorial

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Popup и настройки Linguisty используют приложенную фиолетово-шалфейную дизайн-систему и SVG-знак; обе темы остаются читаемыми и работоспособными.

## Specs

- Governing: `spec://modules/interface/FEAT-003-controls#design`
- Affected: `spec://modules/interface/FEAT-003-controls#design`
- Constraint: `spec://common/PROP-002-quality#checks`, `spec://common/PROP-002-quality#ui`, `spec://common/PROP-000-product#invariants`

## Scope

- In: DESIGN.md, semantic CSS tokens, компактный popup, адаптивные настройки с навигацией по разделам, SVG branding/icons, локальные Onest/JetBrains Mono и лицензии, интеграционные проверки.
- Out: смена названия продукта, лендинг, backend, изменение translation pipeline, платные запросы.
- Assigned root: `src/ui/styles.css`, `src/ui/components.tsx`, `public/**`, `scripts/generate-icons.mjs`, `scripts/assets/linguisty-mark.svg`, `DESIGN.md`, канон, общие контракты/конфигурация и операционные документы.
- Assigned UI executor: `src/ui/Popup.tsx`, `src/ui/Options.tsx`, `src/ui/ErrorJournal.tsx`, `src/ui/settingsForm.ts`, `src/ui/bootstrap.tsx`, `entrypoints/popup/**`, `entrypoints/options/**`, `tests/ui/**` кроме новых tests локализации, `tests/e2e/chromium-smoke.test.mjs` только язык UI test setup.

## Dependencies

- Related: `WI-020`

## Acceptance

- [x] Popup/options используют violet/sage, graphite/paper, editorial headings, supplied SVG.
- [x] Светлая/тёмная тема, 320/390 px, keyboard/focus, 44 px targets, reduced motion проверены.
- [x] Typecheck, lint, unit tests, Chrome/Firefox builds и manifest/resources checks пройдены.
- [x] Проверен packaged browser UI; реальные API/языковая точность явно отделены от mock.
- [x] Проверены размеры, дубли и освобождение собственных проверочных процессов.

## Result

Было → стало: Cloudline → Retro Orbit Editorial из пользовательского референса. DESIGN.md закрепляет адаптацию к расширению; полный референс и прежний дизайн сохранены в docs/design/. Popup и options используют semantic violet/sage/graphite/paper tokens, прямоугольные controls/cards, крупные italic headings, CSS orbit/texture, адаптивную навигацию и supplied SVG mask. Local Onest/JetBrains Mono содержат OFL и источник; PNG icons генерируются из того же SVG, прежний дублирующий mark удалён. Название продукта и BYOK границы сохранены.

Проверки: typecheck/lint PASS, 566 unit/contract/DOM /33 files, 8 manifest/hygiene tests, 5 fixtures; обе production builds/ZIP (19 files each, byte match), 15 referenced assets. Chromium full smoke 14 PASS с parent, Firefox 14 PASS; packaged UI/startup 2 PASS, отдельные rebrand/language scenarios 2 PASS. Все 16 locales проверены в Chromium при 320/390/1280 px, Arabic RTL, loaded local fonts, contrast tokens ≥5.68:1, zero external UI resources/page errors. Визуально просмотрены paper/graphite popup/options, mobile и Arabic screenshots.

Evidence/ограничения: docs/QA-REPORT.md, test-results/linguisty-rebrand/ и общие browser reports. Реальный API, смысловая точность, native toolbar geometry и полный WCAG audit не проверены. Vite warning общего UI chunk 566 974 bytes сохранён в TD-002; background только metadata. No dependencies/paid calls/publication. Source duplicates/suspicious copies 0, старый .cache не вырос, собственные профили удалены и runtime processes/timers освобождены. Чужие CUA helpers и WI-011 cleanup оставлены.
