# WI-017: Устойчивые небольшие батчи больших страниц

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Большая страница переводится ограниченными параллельными запросами; длинный узел разбивается без обрезания, а размерозависимый отказ вызывает ограниченное дробление запроса.

## Specs

- Governing: `spec://modules/translation/FEAT-001-engine#dedup`
- Governing: `spec://modules/page/FEAT-002-page-translation#queue`
- Constraint: `spec://common/PROP-002-quality#resources`
- Affected: `spec://modules/translation/FEAT-001-engine#dedup`
- Affected: `spec://modules/page/FEAT-002-page-translation#queue`
- Affected: `spec://modules/platform/INFRA-001-extension#runtime`
- Affected: `spec://common/PROP-002-quality#resources`

## Scope

- In: небольшие батчи с учётом CJK; разбиение длинных Text nodes с внутренними ID; ограниченное recovery, cancellation, cache/dedup; mock browser checks обеих платформ.
- Out: смена выбранной модели, сервер, платные API-запросы без поручения и ключа.

## Acceptance

- [x] Батчи соблюдают настройки и ограниченную параллельность, CJK получает меньший текстовый бюджет.
- [x] Длинный узел переводится полностью, в DOM применяется только полный результат; ошибка/отмена/внешняя правка блокирует поздние части.
- [x] Обрезанный/слишком большой ответ вызывает конечное дробление; auth/rate-limit не создают веер повторов.
- [x] Cache, dedup и lifecycle проходят регрессии; typecheck/lint/unit, обе сборки, manifests и browser checks выполнены.
- [x] Кэш, дубли и память проверены; отсутствие real API evidence явно записано.

## Dependencies

- Related: `WI-014`, `WI-018`.

## Result

2026-10-08: было до 40 узлов/10 000 символов на обычный запрос и отказ для слишком длинного Text node → ориентир 16 узлов/3 000 условных символов с весом CJK 3, lossless Unicode segmentation длинного узла до 100 000 символов, максимум 128 частей. Части последовательны внутри одного слота; остальные батчи идут с установленной concurrency. Исходный узел отображается только после полной сборки, считается один раз; исходные символы не обрезаются. Cancel/original/изменение/удаление узла прекращают следующие части.

Engine выполняет ограниченное depth-2 recovery для context/timeout/multi-node invalid response; половины идут последовательно в одном RequestQueue slot, с меньшим контекстом и без промежуточного cache/commit исходного batch. Auth/rate/network/outage не дробятся. Собранный output ≤1 MiB. Общий deadline фона учитывает retries/recovery вместо ошибочного ограничения одной попыткой; content watchdog согласован с ним. In-flight dedup и cleanup сохраняются.

Проверки: typecheck/lint PASS; 566 Vitest tests / 33 suites (2 workers); 8 manifest/hygiene contract tests PASS. Production Chrome/Firefox сборки и ZIP готовы; текущие manifests/CSP/секреты/ресурсы PASS, 19 файлов на платформу. Все файлы обоих ZIP побайтно совпадают со сборками. После финальной упаковки полный Chromium smoke: 13 scenarios + parent PASS; Firefox: 14 groups PASS, production fingerprint до/после одинаков. Большая mock-страница: 28 исходных узлов, длинный узел >10 000 chars, 0 failed; 20 обычных запросов или 64 ограниченных запроса при искусственных size failures. Streaming recovery/rollback, cache, SPA, worker restart и cancel также прошли. Evidence: `test-results/linguisty-smoke/observations.json`, `test-results/linguisty-firefox/observations.json`.

На том же mock concurrency 1→2 сократила общее время Chrome 2162→1255 ms, Firefox 2237→1310 ms; наблюдаемый peak соответствовал настройке. Это замер нашего pipeline с локальным фиксированным ответом, не скорости модели. Сценарий пользователя: китайская Wikipedia «人工智能», последняя модель Gemini Flash Lite. Точный model ID, журнал той попытки, real API доступ и языковая точность не проверены; paid requests не выполнялись.

Ресурсы: после smoke activeRequests/pendingTimers=0; собственные Firefox processes=0, profiles удалены; Chrome isolated profile удалён. Новых watch/helper не осталось. Кэш проекта без роста: 5 652 files / 203 426 930 bytes; старые файлы blocked WI-011 не затронуты. .output 47 files / 4 805 240 bytes (две production папки и девять исторических ZIP), .wxt 6 files / 6 589 bytes; source duplicates/suspicious/hash-skipped=0, RAM snapshot 15.03 GB free. Snapshot не доказывает отсутствие любых heap leaks; bounded lifecycle отдельно проверен тестами.
