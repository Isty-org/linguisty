# WI-014: Стриминг перевода на страницу — проверить и реализовать

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Перевод начинает появляться прямо на странице до завершения ответа модели. Сначала проверить осуществимость с текущим форматом переводов по ID; при возможности реализовать безопасный поток для Chrome и Firefox.

## Specs

- Governing: `spec://modules/translation/FEAT-001-engine#providers`
- Governing: `spec://modules/page/FEAT-002-page-translation#render`
- Constraint: `spec://common/PROP-002-quality#resources`
- Constraint: `spec://modules/page/FEAT-002-page-translation#sessions`
- Affected: `spec://modules/translation/FEAT-001-engine#providers`
- Affected: `spec://modules/translation/FEAT-001-engine#validation`
- Affected: `spec://modules/page/FEAT-002-page-translation#render`
- Affected: `spec://common/PROP-001-contracts#messages`
- Affected: `spec://modules/platform/INFRA-001-extension#runtime`
- Affected: `spec://modules/interface/FEAT-003-controls#options`
- Affected: `spec://modules/storage/INFRA-002-local-data#settings`

## Scope

- In: исследование SSE и совместимости моделей/structured output; прототип incremental parsing; поток provider → background → page; раннее отображение проверяемых сегментов, отмена, ошибки и fallback на обычный запрос при отсутствии поддержки.
- До реализации определить и закрепить правила проверки ID, отображения незавершённого текста, финализации и отката при повреждённом ответе. Сейчас stream=false и ошибочная batch атомарно отклоняется; переход на поток требует явного изменения этих контрактов.
- Сохранить реальный прогресс, cache/dedup, переключение оригинала, защиту от устаревшей сессии и чужих изменений DOM.
- Out: наш сервер, бессрочные соединения, платные API-проверки без отдельного поручения и ключа, вставка вывода модели как HTML.

## Acceptance

- [x] Проверена осуществимость с форматом `{translations:[{id,text}]}`; ограничения моделей/API и выбранный способ раннего отображения описаны. Неподтверждённая поддержка не объявлена рабочей.
- [x] На mock-потоке в Chrome и Firefox первый перевод появляется до окончания ответа; измерены время первого отображения и полного завершения относительно обычного запроса.
- [x] Разрывы SSE/UTF-8/JSON, неизвестные/повторные/пропущенные ID, error event при HTTP 200 и обрыв соединения не оставляют некорректный перевод и не кэшируются как успешный результат.
- [x] Cancel, show original, навигация, закрытие вкладки и изменение текста блокируют поздние фрагменты; возобновление не переводит уже переведённый текст повторно.
- [x] Буферы, частота обновления DOM и очередь ограничены; fetch/readers, listeners и timers освобождаются, проверены память, кэш и дубли.
- [x] Обычный запрос остаётся рабочим; пройдены необходимые contract/DOM/browser checks. Если безопасная реализация не получилась, конкретная причина записана в Result, функция не объявлена реализованной.

## Research starting points

- [OpenRouter: streaming](https://openrouter.ai/docs/api_reference/streaming) — SSE, отмена и ошибки после начала ответа.
- [Stack Overflow: JSON-фрагменты в ReadableStream](https://stackoverflow.com/questions/62927478/parse-json-data-chunk-from-readablestream-with-vanilla-js) — пример проблемы границ сетевых chunks.
- [Reddit: ошибки потокового ответа OpenRouter](https://www.reddit.com/r/openrouter/comments/1r3zuow/openrouter_down/) — сценарии отказов для проверки, не доказательство поддержки конкретной модели.

## Dependencies

- Related: `WI-012`, `WI-013`.

## Result

2026-10-08: поток реализован provider → engine → background → page. Incremental SSE/UTF-8 и JSON parser показывает только целые валидные items; preview отделён от committed translation, cache и счётчиков. Любой отказ/retry/cancel откатывает preview и его оформление, сохраняя внешние изменения страницы. Cumulative snapshots ограничены одним pending update и последовательной отправкой раз в 100 ms. Wire/model ≤1 MiB, events ≤16 384. Engine remaps deduplicated IDs, отдаёт текущий preview поздним consumers и освобождает subscriptions/readers/timers.

Default streaming=true для перевода страницы; testConnection и выключенный флажок используют обычный запрос. Старые настройки получают default без изменения persistent key. HTTP200 JSON принимается сразу; explicit unsupported stream даёт один fallback в общем retry budget. Обработка DONE/stop, usage/comments, errors после HTTP200 и строгой финализации закреплена в каноне. Исследование/ограничения — docs/RESEARCH.md; совместимость SSE/schema конкретной модели без paid API не проверена.

493 Vitest tests / 28 suites (max 2 workers), typecheck/lint, 7 manifest/hygiene contracts, обе production builds, 12 Chromium scenarios (13 PASS с parent), 13 Firefox groups, packaged UI/startup и 2 Firefox key lifecycle scenarios PASS. Mock browser checks проверяют duplicate/unknown/missing IDs, HTTP200 error, dropped connection, fallback, cancel/original/resume, source edits, route/tab close и отсутствие cache после invalid ответа. Unit tests дополнительно разрывают UTF-8/SSE/JSON, проверяют limits, remapping/late consumers, reader locks, coalescing/backpressure и cleanup. Полный production hash Firefox до/после одинаков.

Mock с ответом через 2.5 s: Chrome первая фраза 144 ms / полный показ 2516 ms против regular 2513 ms; Firefox 136 / 2527 против 2519 ms. DOM probe измеряет время от начала mock request; это не замер OpenRouter. После каждого полного browser run mock activeRequests/pendingTimers=0, собственные Firefox процессы=0, profiles удалены. .cache 203 426 930 bytes без роста; source duplicates=0; RAM snapshot 18.82 GB free. Предыдущий blocked cleanup WI-011 не затронут. Итоговые отчёт/ZIP/evidence: docs/QA-REPORT.md, .output/linguisty-0.2.0-{chrome,firefox}.zip и test-results/linguisty-0.2.0/.
