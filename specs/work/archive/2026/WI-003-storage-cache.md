# WI-003: Хранение, секреты и кэш

- Kind: `implement`
- Canon action: `direct-edit`

## Outcome

Рабочие settings, два режима ключа и ограниченный контекстный IndexedDB cache доступны фону и проходят собственные tests.

## Specs

- Governing: `spec://modules/storage/INFRA-002-local-data#root`
- Affected: `spec://modules/storage/INFRA-002-local-data#cache.key`
- Constraint: `spec://common/PROP-001-contracts#modules`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- In/owned: `src/storage/**`, `src/cache/**`, `tests/storage/**`, `tests/cache/**`, Result этого WI.
- Out: shared/config/lock, UI, фон, docs/BOARD/WAL, чужие tests.
- API: loadSettings(), saveSettings(settings); getApiKey(mode), setApiKey(key,mode), removeApiKey(), getSecretStatus(mode); getTranslationCache(); buildCacheKey(text,input,config).
- Дополнительные helpers и нормализатор допустимы внутри owned paths; экспортируй normalizeSettings и normalizeBaseUrl для background validation.

## Dependencies

- Depends on: WI-002.

## Acceptance

- [x] settings normalize/defaults/validation не допускают секреты в public data.
- [x] session/persistent, смена mode и удаление обеих копий проверены.
- [x] IDB cache key включает весь context и не включает ключ; TTL/LRU/лимиты/clear проверены.
- [x] При недоступном IDB перевод может идти без cache.
- [x] Собственные tests и доступные type/lint checks выполнены; Result содержит факты и ограничения.
- [x] Нет дублей storage и временных/watch процессов.

## Result

Реализация в owned paths готова к интеграционному принятию координатором. BOARD/WAL/.me, канон, shared contracts, config/lock, UI/фон, чужие исходники и tests исполнитель не изменял.

Было → стало: storage/cache модулей не было → настройки сохраняются разрешённой проекцией, API-ключ отделён от public data и переносится между local/session, переводы хранятся в ограниченном контекстном IndexedDB-кэше. Пустой/непереданный ключ сохраняет действующий ключ; удаление — отдельная операция.

Файлы и API:

- `src/storage/settings.ts`: `loadSettings()`, `saveSettings(settings)`; re-export `normalizeSettings(value)`/`normalizeBaseUrl(value)` для фона. Load исправляет повреждённые поля независимо, сохраняет допустимые значения и убирает неизвестные поля; schema >1 отклоняется без перезаписи. Save не обращается к secret stores.
- `src/storage/normalization.ts`: чистая валидация без browser API. Enum/числовые пределы, BCP 47 с source auto, target ru по умолчанию, model <=200, instructions <=4 000; HTTPS для удалённых адресов, HTTP только localhost/127.0.0.1/[::1]. Обязательна непустая raw HTTP(S) authority без `@`; credentials/query/hash и URL-формы, которые WHATWG нормализует с потерей пустого userinfo, отвергаются. `containsControls` доступен внутри storage validation.
- `src/storage/areas.ts`: local/session capability check и `TRUSTED_CONTEXTS`, когда метод доступен. Отсутствие session API возвращает безопасную русскую ошибку без молчаливого persistent fallback.
- `src/storage/secrets.ts`: `getApiKey(mode)`, `setApiKey(key: string | undefined, mode)`, `removeApiKey()`, `getSecretStatus(mode)`. Очередь сериализует изменения и чтения; ключ <=4 096, C0/DEL запрещены. Перенос пишет destination и удаляет другую копию; при отказе удаления откатывает destination. Удаление пробует обе копии даже при отказе одной. Статус содержит только hasKey/mode; raw storage errors не выходят наружу; память не используется как запасной secret store.
- `src/cache/cacheKey.ts`: async `buildCacheKey(text,input,config)`. SHA-256 учитывает prompt version, точный текст, languages/provider/canonical endpoint/model/style/instructions hash, pageContext и все соседние texts/groups пакета. API-key, timeout и transient IDs исключены; полная проекция захватывается до первого await. Engine уже добавляет отдельный group digest для одинакового текста в разных группах внутри одного batch.
- `src/cache/translationCache.ts`: `getTranslationCache()` возвращает singleton contract get/set/clear/stats/prune/dispose; `IndexedDbTranslationCache`/`TranslationCacheOptions` позволяют инъекцию fake IDB/clock и только уменьшение product caps в tests. TTL 30 дней, 10 000 entries/50 MiB UTF-8 key+text. Metadata/indexes поддерживают атомарные totals/TTL/LRU без getAll всего payload на каждой записи; accessOrder разрешает равные timestamps без выдуманных времён. Очередь ограничена 128 optional operations/8 MiB queued payload, запись <=1 MiB. Open/transactions ограничены тайм-аутами; dispose закрывает DB, обнуляет singleton, освобождает open timer и оставляет stateless late handlers.
- `tests/storage/{normalization,storage}.test.ts`, `tests/cache/{cacheKey,translationCache}.test.ts`: 4 собственных файла с `@spec`, контрактами и интеграцией реального cache implementation с mock-provider engine.

Проверки 2026-10-07:

- Финальный собственный запуск `vitest run tests/storage tests/cache --maxWorkers=2`: **107 tests / 4 files PASS**, exit 0, повторён после обновления shared `cacheHitIds` contract. Включены точные regressions `https://@example.com/v1`, `https:/@example.com/v1`, `https:@example.com/v1` и другие malformed authority формы.
- Исторический полный запуск исполнителя до обновления shared `cacheHitIds` contract: **364 tests / 17 files PASS**, exit 0. Он не подтверждает текущий общий набор после изменений координатора; финальную общую приёмку выполняет Root.
- `tsc --noEmit`: **PASS**, exit 0. Ранние ошибки чужих paths были исправлены их владельцами; в последнем запуске ошибок нет.
- `eslint src/storage src/cache tests/storage tests/cache`: **PASS**, exit 0.
- Проверены defaults/field repair/no-secret public data, миграция session/persistent в обе стороны, отсутствие API/session/accessLevel, rollback и retry после storage failure, удаление только secret keys, отсутствие дубликатов при конкуренции. Перезапуск secret-модуля проверен на mock browser.storage; настоящий restart браузерного background этим не подтверждается.
- Проверены cache context invalidation и стабильность при новых IDs/ключе, TTL на границе и при записи/старте, LRU с равным временем, Unicode byte accounting, overwrites, конкуренция нескольких IDB connections, настоящий clear, corrupt rows, quota/open/transaction failures, позднее открытие, versionchange/dispose, освобождение очереди. Engine с actual cache implementation и mock fetch продолжает перевод при отказе IDB, переиспользует переводы после создания нового instance, сохраняет различие groups и запрашивает перевод заново после clear; его flight/request/pending counters возвращаются к 0.
- `node scripts/check-hygiene.mjs --json`: **PASS**, suspicious=[], duplicates=[], hashSkipped=0. Последний снимок после cacheHitIds follow-up: node_modules 193 585 452 B, .wxt 6 390 B, .output 686 597 B, .cache 4 075 491 B; free RAM 16 624 111 616 / total 34 282 012 672 B. Чужие generated caches/test artifacts/processes не удалялись. Все собственные test/lint/type/hygiene команды завершились; watch/server/helper не запускались. Snapshot RAM не является доказательством отсутствия утечек; lifecycle подтверждён перечисленными tests.

Follow-up shared contract: Root сообщил **383 PASS / 1 FAIL** в общем наборе из 384 tests; единственный fail был устаревшим строгим expected интеграционного cache test. Было → стало: expected проверял только translations/fromCache → по актуальному `PROP-001#modules` добавлены точные `cacheHitIds: ['a-new','b-new']`, то есть caller IDs после remap, и отдельный `@spec` на этот contract test. `toEqual` сохранён, ни translations, ни fromCache, ни сравнение IDs не ослаблены. Storage/cache production code и shared/чужие paths не изменены. Повторно выполнены собственные 107 tests, `tsc --noEmit` и `eslint tests/cache/translationCache.test.ts`: **PASS**, exit 0. Общий набор после этой точечной правки исполнитель повторно не запускал.

Ограничения и интеграционные запросы:

- При недоступном IDB get даёт miss, set/prune не прерывают перевод. stats/clear возвращают безопасную ошибку вместо выдуманных нулей/успешной очистки. Нет memory-cache fallback.
- У local/session нет общей транзакции: обычный отказ покрыт rollback, но аварийное завершение браузера между записью destination и удалением source не даёт атомарной гарантии. Следующий setApiKey удаляет другую копию.
- Вызов `setApiKey(message.apiKey, next.keyMode)` перед `saveSettings(next)` — обязанность background; текущий controller уже делает это. Проверить в `src/background/controller.ts` SAVE_SETTINGS чтение previousKey через `readKey(previous.keyMode)`: при отсутствующем session API это чтение может блокировать явно выбранный пользователем persistent mode; нужен сценарий default session → explicit persistent в таком окружении, без попытки чтения отсутствующего store.
- `src/background/validation.ts`: на последнем чтении model ещё ограничен 256; согласовать с normalization/provider/UI пределом 200. API-key validation фона уже обновлена до 4 096/C0/DEL.
- `src/ui/settingsForm.ts`: предел ключа уже 4 096; синхронизировать запрет всех C0/DEL и raw authority с чистой storage/provider validation, чтобы локальная форма не принимала значение, которое фон отклоняет. Чистый `src/storage/normalization.ts` не импортирует browser/secret stores и доступен для согласования validation.
- Production builds Chrome/Firefox, packaged manifest/secret checks и browser smoke исполнитель не запускал; это интеграционная приёмка координатора. Платных запросов и реальных ключей не было; смысловая точность реального провайдера остаётся непроверенной.

Исследование перед реализацией: обсуждения Reddit/Stack Overflow проверены как отправные точки; API-решения сверены с [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [MDN storage.session](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/session), [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) и [MDN SHA-256 digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest).


Принято координатором 2026-10-07: общий набор 391 unit tests PASS; финальные production packages прошли 9 Chromium scenarios и 10 Firefox groups. Все runtime tests используют loopback mock, реальная языковая точность не проверена. Замечания UI raw authority/C0/DEL и background model200 исправлены координатором и проверены; отсутствие storage.session вне поддерживаемых desktop versions не принимается как целевой runtime. Ограничение аварийной миграции двух областей записано TD-001.
