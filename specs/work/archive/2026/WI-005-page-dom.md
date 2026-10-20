# WI-005: DOM перевод, динамика и восстановление

- Kind: `implement`
- Canon action: `none`

## Outcome

Injected script переводит страницу через общие messages, сохраняет DOM/оригинал, обрабатывает динамику и очищает свои ресурсы.

## Specs

- Governing: `spec://modules/page/FEAT-002-page-translation#root`
- Constraint: `spec://common/PROP-001-contracts#messages`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- In/owned: `src/content/**`, `entrypoints/translate.ts`, `tests/content/**`, Result этого WI.
- Out: shared/config/lock, providers/storage/background/UI, docs/BOARD/WAL.
- API: createPageController(options?) => PageController (start/cancel/setDisplayMode/getState/dispose). Testability через injected document/sendMessage/observers/time source внутри своего модуля. Default uses shared sendMessage. translate.js inject path закреплён.
- BEGIN_PAGE_SESSION позволяет SPA получить новый sessionId/settings от background; PAGE_PROGRESS сообщает state; TRANSLATE_BATCH возвращает TranslationResult.

## Dependencies

- Depends on: WI-002; browser integration requires WI-006.

## Acceptance

- [x] Filtering/layout visibility/whitespace/URLs/editable и 5 000-node cap tested.
- [x] Только Text.data, event handlers и form input сохраняются; restore/toggle без API.
- [x] Viewport priority/concurrency/batch limits/dedup на уровне текста не превращаются в one request per node.
- [x] Mutation observer не зацикливается, dynamic text/SPA/stale response/external writes tested.
- [x] Cancel и dispose освобождают очередь/timers/listeners/registry; detached prune tested.
- [x] Собственные tests и доступные checks выполнены; Result включает ограничения.

## Result

Модуль готов к интеграционному review (2026-10-07). Принятие версии/архивирование — координатор и WI-008; общую browser acceptance не объявляю завершённой.

### Было → стало и API

- Было: unlisted `translate.ts` только с заглушкой, DOM pipeline отсутствовал. Стало: `src/content/scanner.ts`, `registry.ts`, `renderer.ts`, `batcher.ts`, `controller.ts`, `bootstrap.ts` и подключённый `entrypoints/translate.ts`. Публичный вход `createPageController(options?) => PageController` использует общие start/cancel/setDisplayMode/getState/dispose; `bootstrapPageRuntime()` регистрирует ровно один callback listener и marker на документ, удаляет их на pagehide. Выход сборки — `translate.js`. Default transport — shared sendMessage, который unwraps ApiResult; CONTENT_COMMAND отвечает ApiResult через sendResponse/return true для Chrome 120 и Firefox.
- TreeWalker пропускает исключённые/editable/hidden/inert/aria-hidden/translate=no области, невидимый layout, пустые/пунктуационные строки и чистые URL/email/hash. Числа внутри семантических фраз сохраняются. Priority viewport → near → rest, nearest semantic container grouping, node/char/concurrency bounds. Каждая DOM ссылка имеет отдельный ID; text dedup/cache и ID remapping выполняет общий engine. Повторный START выдаёт новые node IDs и стабильные group labels для одинакового документа.
- Только Text.data, точные ведущие/замыкающие пробелы, intact DOM objects/handlers/form values. Готовые original/translated переключаются без сети. Original приостанавливает новые batch/dynamic translation; CANCELLED от фонового abort возвращает unfinished в pending. Abort-before-original-command не запускает retry loop. External text становится новым original, старые batch/session/revision/owned-value ответы не применяются. Eligibility повторно проверяется перед apply; ставший редактором текст и editable values не переписываются. Суммарный response text ограничен 1 MiB до apply.
- MutationObserver с 400 ms debounce обрабатывает dirty subtrees/characterData и relevant attribute changes; own writes отключают наблюдение после обработки takeRecords, поэтому внешние ожидающие мутации не теряются и translation loop не возникает. Dirty roots bounded 128 с coalesced fallback scan; registry/queue ≤5 000. IntersectionObserver освобождает прежнюю цель при перемещении node, detached записи удаляются также из pending job snapshots.
- SPA URL/popstate/hashchange/body replacement очищают старую очередь и registry, восстанавливают сохранённый shell source, согласуют новый контекст/settings/session через BEGIN_PAGE_SESSION и сохраняют режим отображения. Cancel освобождает unfinished/detached entries, jobs, очередь, timers, observers и navigation listeners; готовые originals/translations остаются bounded для offline toggle после отмены. Dispose освобождает весь registry/listeners/timers и восстанавливает ещё принадлежащий нам source, что предотвращает translation-of-translation после BFCache.

### Фактические проверки

- `node node_modules/vitest/vitest.mjs run tests/content --maxWorkers=2`: **45 PASS**, 3 suites после follow-up cacheHitIds; `tests/content/{scanner,controller,bootstrap}.test.ts`, общий fixture helper только в `tests/content/helpers.ts`. Filtering/5 000 cap, priority/grouping/node/char/concurrency bounds, whitespace/event handlers/input values/literal HTML text, ready toggle, own-loop guard, dynamic insert/show/hide, external/stale source, undelivered mutation preservation, original pending abort/resume, abort-before-command, stable group context/new IDs, SPA/history-only/body reset, late returned session cancellation, cancel/dispose/repeated cycles/detached prune/moving observer target, malformed/oversized result/watchdog/safe snapshot/envelope проверены. Новые 12 regressions: exact mixed cache progress после удаления/внешнего изменения cached и uncached nodes, те же изменения до pending response, сохранение точного count при toggle/cancel и очистка в dispose, atomic rejection чужих/повторных/non-string/non-array/null cache-hit IDs и несовпадения count.
- `node node_modules/typescript/bin/tsc --noEmit`: **PASS** на финальном snapshot. `node node_modules/eslint/bin/eslint.js src/content entrypoints/translate.ts tests/content`: **PASS**. Общий lint/unit release gate принадлежит root/WI-008.
- `npm run build:chrome`, `npm run build:firefox`: **PASS до follow-up cacheHitIds**. Проверенный Chrome package 342 394 bytes / Firefox 342 689 bytes, по 13 файлов; translate.js 18 716 bytes в каждой сборке. `node scripts/check-manifests.mjs --json`: **PASS** обе прежние сборки, включая packaged resources/CSP/name/platform background/heuristic credential check. Пересборка после cacheHitIds — общий gate root/WI-008.
- Existing `node --test --test-concurrency=1 tests/e2e/chromium-smoke.test.mjs`, явно выбран Chromium 152.0.7977.8 (`chromium-1237`), isolated temporary profile + loopback mock: последний собственный запуск **9/9 scenarios PASS до follow-up cacheHitIds**, Node печатает 10 tests PASS с parent. Проверены настоящий extension UI→background→page, layout priority, forms/gallery/references/whitespace/restore/resume/dynamic/external/SPA/cache/cancel/errors и service-worker restart. Его evidence: ok=true, 52 mock provider requests, maximumActiveRequests=2, activeRequests=0, pendingTimers=0, pageErrors=0, isolatedProfileRemoved=true, localServerClosed=true. Дубли browser harness не создавались; по указанию координатора smoke после cacheHitIds самостоятельно не запускался. Новый общий browser acceptance/retest — root/WI-008; прежний PASS не доказывает новую правку.

### Интеграция и ограничения

- Подтверждённый первоначальный SPA FAIL: Chromium сообщает tabs.onUpdated `{status:'loading',url:'...dynamic.html?quartier=2'}` при pushState; прежний background cleanup удалял сессию до BEGIN_PAGE_SESSION, content получал CANCELLED. Владелец WI-006 исправил проверку documentId без content bypass; последний существующий Chromium smoke прошёл SPA с новым Nantes context. В content сохраняются session/revision guards. Не изменялись чужие production paths.
- Ограничение неточного cache counter устранено по обновлённому общему контракту. Было: aggregate lower bound после invalidation в mixed batch. Стало: controller валидирует cacheHitIds (array, уникальные строковые requested caller IDs, length=fromCache) до применения всей batch; registry хранит per-node cacheHit только для принятого current перевода. External write/remove сбрасывают этот признак, recount считает ровно оставшиеся live cached translations; uncached изменения не уменьшают hits. Engine/background уже передают список, что подтверждено чтением их текущих экспортов; чужие paths не изменялись. Zero-cache без списка допустим; для legacy test mocks сохранён безопасный fallback, который production engine по канону не использует. Открытого запроса к shared contract больше нет.
- Firefox package проверен, реальный Firefox extension runtime не выполнен. Chromium 152 не подтверждает запуск на minimum Chrome 120 (callback bridge проверен контрактным тестом и официальной документацией). Native optional permission prompt/toolbar activeTab gesture не автоматизированы; smoke предоставлял loopback origin в isolated profile. Mock не проверяет OpenRouter access/реальную смысловую языковую точность. Платных запросов и чтения пользовательских secrets не было.

### Ресурсы, дубли и исследование

- Промежуточный и финальный `node scripts/check-hygiene.mjs --json`: **PASS**, suspicious/duplicates пусты. Финальный snapshot после cacheHitIds: node_modules 193 585 485 bytes, .wxt 6 390, .output 685 293, test-results 1 820 913, .cache 5 855 605; RAM free 16 290 045 952 / total 34 282 012 672 bytes. Exact cache metadata — один boolean на bounded NodeEntry, без дополнительного долговечного набора DOM references. .cache создан соседними QA действиями; не удалялся. Собственных long-running node/watch/helper процессов после проверки не обнаружено; в этом follow-up browser/server не запускались. RAM snapshot не является доказательством отсутствия утечек: отдельные repeated lifecycle, detached, moving-node observer, exact cache invalidation/cancel/dispose и own-loop tests проверяют освобождение runtime references/ресурсов. Чужие кэши, файлы и процессы не удалялись.
- До решения изучены [Stack Overflow: MutationObserver loop](https://stackoverflow.com/questions/65484575/mutationobserver-create-infinite-loop-when-i-replace-a-string-with-span-tag) и [Reddit: SPA injection](https://www.reddit.com/r/webdev/comments/1rx76ux/chrome_extension_only_works_on_hard_refresh/). API сверены по [MDN disconnect/takeRecords](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect), [MDN popstate](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event), [MDN TreeWalker](https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker), [MDN runtime.onMessage](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage), [WXT unlisted entrypoints](https://wxt.dev/guide/essentials/entrypoints).
- Перед cacheHitIds follow-up изучены [Stack Overflow: per-key cache statistics](https://stackoverflow.com/questions/2007385/ehcache-statistics-by-key) и [Reddit: invalidation by entity IDs](https://www.reddit.com/r/ExperiencedDevs/comments/18b4dby). Проверки списка и уникальности сверены по [MDN Array.isArray](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray) и [MDN Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set).

Принято координатором 2026-10-07: общий typecheck/lint PASS, 384 unit tests PASS, обе production builds/manifest checks PASS, 9 Chromium scenarios PASS после последних контрактных правок. Firefox runtime дополняет WI-010; реальная языковая точность не проверена.
