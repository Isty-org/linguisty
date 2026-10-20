# WI-030: Восстановление и ограничения локальных данных

- Kind: `fix`
- Canon action: `none`

## Outcome

Проверить TD-001, восстановление двух областей секретов и bounded cache; исправить воспроизводимые нарушения действующего канона без обещания недоступной общей транзакции browser API.

## Specs

- Governing: `spec://modules/storage/INFRA-002-local-data#secrets`
- Governing: `spec://modules/storage/INFRA-002-local-data#cache.data`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- Assigned paths: `src/storage/**`, `src/cache/**`, `tests/storage/**`, `tests/cache/**`, этот WI.
- In: recovery после частичных операций, secret mode, TTL/LRU/clear/dispose, проверяемые исправления.
- Out: shared contracts, background, канон, зависимости, BOARD/WAL/TECHDEBT.

## Acceptance

- [x] Проверены interrupted migration и committed mode; секреты не попадают в public/cache/log.
- [x] Проверены cache lifecycle, лимиты, отказ storage и дубли concurrent requests.
- [x] Найденные нарушения исправлены с regression tests; принципиальные ограничения перечислены отдельно.
- [x] Result содержит выполненные команды, было → стало, требуемые интеграционные изменения.

## Result

Было → стало:

- Отложенное исправление старых settings могло записать прежний `keyMode` после успешного `saveConfiguration` → `loadSettings`, `saveSettings` и конфигурационный commit используют одну очередь фонового экземпляра. Регрессия воспроизвела перезапись до правки.
- Если `storage.local.set` или `storage.session.set/remove` изменял данные, а затем отклонял Promise, восстановление пропускало уже изменённую область → откат восстанавливает каждую область, где была начата запись; если восстановление тоже отказало, ошибка честно сообщает о неполном результате. Регрессии воспроизвели потерю ключа и лишнюю копию до правки. Это best-effort при наблюдаемом отказе, не защита от аварийной остановки процесса.
- При зафиксированном `keyMode=session` и исчезнувшем session ключе сохранение пустого поля поднимало остаточный local ключ обратно в session; симметрично для persistent → при известном committed mode источником служит только его область. Fallback между областями сохранён только для legacy состояния без зафиксированного режима. Обе регрессии до правки падали.
- Прямой `setApiKey` при частично выполненном отказавшем переносе мог оставить лишнюю копию или удалить исходную → откат теперь пытается вернуть обе затронутые области.
- Кэш не потребовал изменения: тесты подтвердили TTL, LRU, UTF-8/entry/queue bounds, clear/dispose, отказ IndexedDB и дедупликацию одновременных одинаковых переводов с освобождением in-flight state. Проверки settings/cache/journal/public validation не обнаружили попадания тестового секрета в публичные ответы, cache key/data или журнал.

Проверки:

- До исправлений: `vitest run tests/storage/storage.test.ts --maxWorkers 2 --no-file-parallelism` — сначала 3 ожидаемых провала на гонке/частичном отказе, затем 2 ожидаемых провала на воскресшем stale ключе.
- После исправлений: `vitest run tests/storage tests/cache --maxWorkers 2` — 5 файлов, 138 тестов пройдено.
- `vitest run tests/background/controller.test.ts tests/background/validation.test.ts --maxWorkers 2` — 2 файла, 64 теста пройдено.
- `tsc --noEmit` — 0 ошибок; `eslint src/storage tests/storage src/cache tests/cache` — 0 ошибок.
- Промежуточная и заключительная проверка собственных добавлений: один helper очереди, второй реализации cache/secret helper не создано; `node_modules` 184.6 MiB, `.wxt` 0 MiB, `.output` 19.9 MiB. Доступная RAM около 11.5 GiB; число общих Node процессов менялось 94 → 82, чужие процессы/кэш не затронуты.

Исследование до решения: сценарии [Stack Overflow о commit IndexedDB](https://stackoverflow.com/questions/48863444/what-happens-when-a-database-operation-in-indexeddb-is-successful-but-the-trans) и [Reddit о local/session для ключа](https://www.reddit.com/r/chrome_extensions/comments/1sge1hh/best_practice_for_storing_a_userprovided_api_key/); API проверен по [Chrome Storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [MDN StorageArea.set](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageArea/set) и [MDN IDBTransaction.complete](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event).

Ограничения: две browser storage области не образуют физическую транзакцию. Остановка браузера между подготовкой session и коммитом local может оставить временную копию; чтение и последующее сохранение следуют committed mode и очищают остаток. Тесты используют storage mock/fake IndexedDB, поэтому реальный kill браузера, сохранность на диске, production builds и browser smoke в этом WI не подтверждены. Требуемых изменений в чужих назначенных файлах нет; глобальные сборки и smoke остаются координатору.
