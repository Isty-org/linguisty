# WI-004: Translation engine и providers

- Kind: `implement`
- Canon action: `none`

## Outcome

Engine переводит batch через OpenRouter/совместимый API, проверяет ответ, использует cache/dedup и безопасно отменяет запросы.

## Specs

- Governing: `spec://modules/translation/FEAT-001-engine#root`
- Constraint: `spec://common/PROP-001-contracts#modules`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- In/owned: `src/providers/**`, `src/translation/**`, `tests/providers/**`, `tests/translation/**`, Result этого WI.
- Out: shared/config/lock, storage/cache implementation, DOM, фон, UI, docs/BOARD/WAL.
- API: TranslationEngine(cache, options?: {fetchImpl?: typeof fetch}); translate(input,config,signal?), testConnection(config,signal?), listModels(config,signal?). Registry getProvider(providerId). Cache buildCacheKey(text,input,config) будет создан WI-003; отсутствующий чужой файл не дублировать.

## Dependencies

- Depends on: WI-002; интеграция cache требует WI-003.

## Acceptance

- [x] Два adapters работают с одинаковым contract и строгим parser.
- [x] Request, 401/403/429/5xx/error envelope, malformed JSON, oversized response, timeout/abort tested.
- [x] Prompt injection separation и числа/placeholders/URLs закреплены prompt.
- [x] Cache-hit без fetch, contextual dedup с remap и cleanup in-flight tested.
- [x] Manual model возможен без discovery, discovery bounded.
- [x] Own tests и доступные checks выполнены; Result содержит факты, нет logged key/raw body.

## Result

Готово к проверке координатором 2026-10-07. Acceptance проверен mock/contract tests; принятие, изменение BOARD и архивирование остаются у координатора.

Было → стало: отсутствовали providers/translation и их tests → реализованы OpenRouter и generic OpenAI-compatible adapters, registry, общий bounded transport, prompt, strict parser, cache-first engine с contextual dedup/remap и отменой отдельных потребителей.

### Файлы и API

- `src/translation/engine.ts`: `TranslationEngine(cache, { fetchImpl? })`; `translate`, `testConnection: Promise<ConnectionTestResult>`, `listModels`. Read-only `inFlightCount`/`activeRequestCount`/`pendingRequestCount` показывают только lifecycle counts.
- `src/providers/registry.ts`: `getProvider(providerId)`; optional `{ fetchImpl? }` позволяет изолированно проверять adapters. `openrouter.ts`/`openaiCompatible.ts`: `OpenRouterProvider`/`OpenAICompatibleProvider`, оба реализуют shared `TranslationProvider` через `chatProvider.ts`.
- `src/providers/config.ts`/`request.ts`: нормализация endpoint/config, fingerprint credentials без хранения сырого ключа в model cache, bounded response reader, безопасная классификация HTTP/error envelopes, retry/timeout/abort.
- `src/translation/input.ts`/`prompt.ts`/`parser.ts`/`abort.ts`/`queue.ts`: snapshot/лимиты batch, JSON serialization и prompt version, schema при подтверждённой capability, строгая проверка IDs/формы/пустых переводов, отменяемые ожидания, очередь с hard ceiling 4 active/32 queued.
- `tests/providers/contract.test.ts`, `fixtures.ts`, `tests/translation/parser-prompt.test.ts`, `engine.test.ts`, `queue.test.ts`: общий contract suite для двух adapters и проверки engine/parser/lifecycle.

### Поведение и интеграция

- Нет SDK, собственного storage или дубля cache module. Используется реальный `src/cache/cacheKey.ts` из WI-003. Cache lookup/write получают исходный snapshot batch, включая соседние texts/groups без transient IDs. Для конкретной semantic group engine дополнительно хэширует `[commonKey, group]`, чтобы две одинаковые фразы из разных групп одного batch имели разные записи.
- Dedup уменьшает только список запрашиваемых IDs. Исходные соседние тексты и группы остаются в JSON `sourceContext`. Внутренний optional четвёртый аргумент `ChatProvider.translate(..., sourceContext)` переносит этот контекст в prompt. Results remap в порядок исходных IDs. Shared contract изменён координатором; исполнитель его не редактировал.
- Интеграционная правка review WI-005: было только aggregate `fromCache` → engine всегда возвращает `cacheHitIds` исходных caller nodes из реальных cache hits в исходном порядке, включая `[]` для empty batch/no hits и полный список для all-cache result. Input validation уже запрещает повторяющиеся IDs; текстовые дубли не сокращают список исходных IDs. `fromCache` вычисляется из `cacheHitIds.length`, так что количество и список не расходятся. Общий in-flight/network response не выдаётся за cache hit. Массив локален вызову и ограничен 40 исходными nodes; cache payload/prompt/providers не менялись.
- In-flight entries разделяются по credential fingerprint и timeout. Отмена одного подписчика не прерывает общий запрос остальных; последний подписчик отменяет fetch/queued request и освобождает entries. Ошибочная provider batch не записывается частично; отказ get/set кэша не блокирует перевод.
- Generic endpoint работает без `response_format`, даже после discovery. OpenRouter использует `json_schema` только после обнаружения `structured_outputs` у выбранной модели и при совпадающем credential scope/неистёкшем TTL. В остальных случаях строгий JSON prompt; discovery не запускается автоматически и не блокирует manual ID.
- Discovery: `/models` (OpenRouter `limit=1000&offset=0`), max 1 000 нормализованных уникальных моделей, одна cached selection context на adapter, TTL 15 минут, общий response bound 1 MiB. Возвращаются копии model metadata.
- 401/403 → INVALID_API_KEY, 404/typed model errors → MODEL_NOT_FOUND, 429 → RATE_LIMIT, все 5xx → PROVIDER_UNAVAILABLE; распознаются top-level/choice error envelopes при HTTP 200. 429/5xx/network имеют максимум 2 retries, malformed JSON максимум 1, общий максимум 3 attempts. Backoff 500/1 000 ms с Retry-After, cap 5 s. Timeout и cancellation различаются и не повторяются.
- Endpoint boundary независимо от UI отклоняет remote HTTP, credentials (также пустой login/`@` в authority), query/fragment, control chars и перенаправление OpenRouter key на иной baseUrl. Разрешены HTTPS и HTTP localhost/127.0.0.1/[::1]; redirect error, credentials omit. Model max 200 chars; key max 4 096; timeout 1 000–120 000 ms.

### Фактически выполненные проверки

- `node node_modules/vitest/vitest.mjs run tests/providers tests/translation --maxWorkers=2`: **4 test files, 153 tests passed**, exit 0; финальный прогон 2026-10-07 11:07:50 по времени test runner. Включены regression cases `https://@example.com/v1`, пустой login/password и некорректные slash variants; fetch не запускается.
- `node node_modules/eslint/bin/eslint.js src/providers src/translation tests/providers tests/translation`: exit 0, ошибок/предупреждений нет.
- `node node_modules/typescript/bin/tsc --noEmit`: **общий typecheck exit 0**. Ранее найденные свои lint/типовые дефекты исправлены; чужие background/content defects исчезли после правок их владельцев.
- Проверены cache hits без fetch, original-context cache writes при частичных hits, group/neighbor/page/style/language/instructions/provider/model invalidation, changed-ID concurrent dedup/remap, credential isolation, отказ IDB, missing-ID atomic rejection и fresh request после ошибки/отмены.
- `cacheHitIds` regression: до правки 8 meaningful assertions воспроизвели отсутствие metadata. После правки проверены empty input, network/in-flight response с `[]`, cached пустой перевод whitespace-only source, all-cache original IDs, group remap на новые IDs и mixed batch с двумя cached-дублями и двумя network-дублями. Mixed result содержит ровно cached caller IDs; последующий all-cache вызов возвращает новые caller IDs. Прямые tests и метод engine имеют `@spec spec://common/PROP-001-contracts#modules`.
- Проверены HTTP/error envelopes, finite retries/Retry-After, malformed JSON recovery, streamed UTF-8, превышение UTF-8 byte bound при неверном Content-Length, timeout во время fetch/body read, cancellation fetch/retry sleep/queue/cache wait и listener/timer cleanup. Connection result не содержит ключ/сырой ответ.
- 30 повторных циклов success + отмена реально начавшегося запроса оставляют `inFlightCount=0`, `pendingRequestCount=0`, `activeRequestCount=0`. Overload test: 4 active + 32 queued; 37-й получает RATE_LIMIT; после отмены всё освобождено. Это проверка lifecycle, не доказательство отсутствия всех browser heap leaks.
- Resource snapshot после интеграционной правки: 17 owned source/test files, 89 178 bytes, точных дубликатов по SHA-256 нет. `node_modules`: 193 585 485 bytes; `.wxt`: 6 390; `.output`: 685 293. Доступная RAM до/после текущего прохода 15 536 868 → 16 292 824 KiB из 33 478 528 KiB. Процессов test/lint/typecheck/watch по проверенным командным строкам — 0. Собственных watch/server/helper не оставлено; чужие процессы/кэш не удалялись. В source этих модулей нет console logging, localStorage/IndexedDB/browser.storage.

### Исследование и ограничения

До реализации исследованы существующие обсуждения [Reddit о JSON schema](https://www.reddit.com/r/LocalLLaMA/comments/1kip5qj/openrouters_api_does_not_follow_given_json_schema/) и [Stack Overflow о fetch timeout](https://stackoverflow.com/questions/46946380/fetch-api-request-timeout/62470009). API/lifecycle сверены с [OpenRouter errors](https://openrouter.ai/docs/api/reference/errors-and-debugging), [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs), [models](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties), [MDN AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort) и [stream cancel](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/cancel).

Реальный provider access, смысловая языковая точность, устойчивость модели к prompt injection и browser memory profile не проверены: пользовательского ключа и поручения на платный запрос нет. Prompt содержит правила сохранения numbers/placeholders/URLs, tests проверяют их наличие/разделение данных; это не измерение качества настоящего перевода. Production builds/manifest/browser smoke целиком принимает координатор; исполнитель их не выдаёт за свои проверки.

Прежний запрос о max key length закрыт владельцами соседних модулей: UI (`API_KEY_INPUT_MAX_LENGTH`), storage и provider теперь допускают 4 096. Исполнитель чужие пути не менял. Сторона engine для `cacheHitIds` завершена; использование metadata после внешних DOM изменений проверяет WI-005/root. Открытых module/import dependencies или запросов на изменение чужого файла для WI-004 нет.


Принято координатором 2026-10-07: общий typecheck/lint PASS, 384 unit tests PASS, обе production builds/manifest checks PASS, 9 Chromium scenarios PASS после последних контрактных правок. Firefox runtime дополняет WI-010; реальная языковая точность не проверена.
