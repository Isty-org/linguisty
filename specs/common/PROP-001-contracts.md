---
status: active
---

# PROP-001: Архитектура и контракты {#root}

Контексты расширения взаимодействуют сообщениями: страница хранит ссылки на текстовые узлы, фон обращается к API, popup и настройки управляют процессом. Отдельная собственная страница Codex держит OAuth-сеанс только в памяти и исполняет запросы через проверенный внутренний port. Старые CLI adapters остаются совместимыми внутри runtime.

## Стек и границы {#architecture}

TypeScript strict, WXT, React для popup/options, нативный DOM для страницы, IndexedDB для кэша, browser API через `wxt/browser`, Vitest/jsdom/fake-indexeddb для тестов. Одна установка npm и один lockfile. Runtime API-запросы выполняются через fetch без большого provider SDK. Продукт не использует удалённый исполняемый код или удалённые шрифты.

```text
Popup / Options → Background controller → Settings / Secrets
                         ↓
Injected page script ↔ Background controller → Translation engine → Provider API
                         ↓
                   IndexedDB cache
```

## Единственный контракт {#types}

`src/shared/contracts.ts` содержит Settings, ProviderConfig, TranslationInput/Result, TabTranslationState, RuntimeMessage и PublicError. Исполнители импортируют эти определения. Изменения согласует координатор; не создавать альтернативные модели данных. Не повторять полные TypeScript-типы в документах: исходный файл является проверяемым контрактом кода.

Settings содержит независимые targetLanguageMode (browser/manual) и uiLanguage (auto/поддержанная локаль). Результат loadSettings в browser режиме содержит разрешённый BCP 47 target, поэтому provider/cache/content продолжают использовать конкретный язык, без auto sentinel в prompt. Язык UI и mode не входят в cache key: на перевод влияет только конкретный source/target и смысловой контекст. Прежний сохранённый target без mode считается ручным выбором.

CLI provider IDs и фиксированные ошибки описаны в spec://modules/platform/INFRA-003-local-cli#protocol. ProviderConfig сохраняет общий контракт; CLI нормализует apiKey в пустую строку, baseUrl в служебный cache namespace, пустой model в default и streaming в false. Ни URL, ни ключ не передаются native host. NativeRequester — внутренняя зависимость adapter/tests, UI продолжает использовать прежние runtime сообщения.

Новый provider codex фиксирует baseUrl=https://api.openai.com/v1, apiKey пустой, default model, concurrency=1, streaming=false для атомарной выдачи проверенного ответа Responses. ProviderConfig.accountScope — SHA-256 подтверждённых sub/client_id для изоляции кэша, без сохранения identity/token в настройках. Переводный port request обязан совпадать с текущим account scope страницы; смена аккаунта не записывает новый ответ в прежний кэш. Детали: spec://modules/platform/INFRA-004-codex-connection#requests.

## Сообщения {#messages}

Каждое сообщение имеет `channel: 'linguisty'` и discriminant `type`. Ответ — `{ok:true,data}` или `{ok:false,error}`. Ошибка содержит фиксированный code, безопасное русское message и retryable; сырой ответ провайдера не выводится пользователю.

Локализованный UI переводит известные безопасные сообщения или показывает локальное пояснение по code; русский UI сохраняет диагностическую конкретику исходного public message. Локальный журнал API хранит очищенные данные и не подменяется переводом сырого ответа модели.

- GET_SETTINGS, GET_SECRET_STATUS, GET_TAB_STATE, GET_CACHE_STATS.
- OPEN_CODEX_CONNECTION и GET_CODEX_STATUS — только собственный UI; одна вкладка и boolean подключения, без токенов.
- GET_ERROR_LOG, CLEAR_ERROR_LOG разрешены только собственным extension pages; content не получает diagnostics.
- SAVE_SETTINGS, REMOVE_API_KEY, TEST_CONNECTION, LIST_MODELS, CLEAR_CACHE разрешены только собственным extension pages.
- START_TRANSLATION, CANCEL_TRANSLATION, SET_DISPLAY_MODE разрешены popup/options, а tabId проверяется фоном.
- TRANSLATE_BATCH и PAGE_PROGRESS разрешены только injected script верхнего frame собственной активной сессии; tab берётся из sender, а не произвольного сообщения.
- CONTENT_COMMAND направляет start/cancel/set-display/get-state/batch-progress в конкретную вкладку; TAB_STATE_CHANGED сообщает UI безопасный статус.

Все payload валидируются в runtime. Ключ не возвращается ни одним чтением настроек, статуса или модели. TEST_CONNECTION может использовать введённый в options ключ без сохранения. Нет `externally_connectable` и обмена ключом через DOM/window.postMessage.

SAVE_SETTINGS принимает optional boolean preserveKeyMode: при true фон под своей очередью сохранений использует актуальный режим, игнорируя keyMode устаревшего UI. Popup всегда выставляет true; options выставляет true, если пользователь не изменял режим относительно загруженной формы. Явная смена режима продолжает переносить ключ.

Popup дополнительно выставляет optional boolean languagesOnly=true: фон под той же очередью применяет только sourceLanguage, targetLanguage и targetLanguageMode к последней конфигурации. Прежние provider/model/theme/keyMode и остальные параметры формы не перезаписывают новые значения. Передача apiKey в этом режиме отклоняется. Options сохраняет полную форму как раньше.

## Границы модулей {#modules}

`TranslationResult` содержит `translations`, `fromCache` и optional `cacheHitIds`. Engine всегда возвращает уникальные IDs исходных узлов, действительно взятых из кэша; их число равно `fromCache`. Content использует IDs для точного счётчика после внешних изменений/удаления узлов. Provider adapters с `fromCache=0` могут опускать список. Перед применением content проверяет IDs, дубли и соответствие количеству.

- `storage/settings.ts`: loadSettings/saveSettings; `storage/secrets.ts`: getApiKey/setApiKey/saveConfiguration/removeApiKey/getSecretStatus. saveConfiguration сохраняет нормализованные настройки вместе с ключом, сохраняя отдельные storage keys.
- `cache/translationCache.ts`: getTranslationCache возвращает объект get/set/clear/stats/prune; `cache/cacheKey.ts`: buildCacheKey.
- `translation/engine.ts`: TranslationEngine с cache и необязательным fetchImpl; translate(input, config, signal, onProgress?), testConnection(config, signal), listModels(config, signal).
- `providers/registry.ts`: getProvider(providerId); единый TranslationProvider описан в contracts.
- `content/controller.ts`: createPageController с start/cancel/setDisplayMode/progress/getState/dispose; `entrypoints/translate.ts` подключает единственный message listener.
- `background/controller.ts`: registerBackgroundController; `entrypoints/background.ts` подключает listener синхронно внутри defineBackground.
- Popup/options общаются с фоном, не импортируют secret store, provider или кэш напрямую. Codex connection page — отдельный привилегированный владелец только своего OAuth-сеанса по INFRA-004; токены не пересекают границу page→background.

## Сессия и отмена {#sessions}

Каждый запуск получает sessionId, привязанный к tabId. batchId и исходный текст проверяются перед применением. Settings фиксируются на запуск. Поздний ответ после отмены/смены маршрута/смены оригинального текста не применяется. В памяти хранится ограниченное число запросов; runtime AbortController останавливает fetch. Browser session storage хранит безопасный snapshot сессий; не хранит DOM или исходные страницы. Если фон был остановлен, контент может продолжить текущую сессию по snapshot; завершённые/закрытые вкладки удаляются.

TranslationProgress — reset или cumulative segments с проверенными TranslationItem. Provider/engine optional callback не переносит секреты. CONTENT_COMMAND.batch-progress содержит sessionId/batchId/sequence/progress и проходит тот же background-only sender guard; старый sequence пропускается. Финальный TRANSLATE_BATCH сохраняет прежний ApiResult/TranslationResult контракт. Progress callbacks удаляются при settlement/отмене consumers.

## Политика ошибок {#errors}

INVALID_API_KEY, PERMISSION_REQUIRED, RATE_LIMIT, PROVIDER_UNAVAILABLE, MODEL_NOT_FOUND, REQUEST_TIMEOUT, INVALID_MODEL_RESPONSE, NETWORK_ERROR, CONTEXT_TOO_LARGE, CANCELLED, INVALID_SETTINGS, RESTRICTED_PAGE, INTERNAL_ERROR. Для 401/403/ошибки модели и denied permission нет автоматического retry. Для 429/5xx/сети максимум 2 retry с bounded exponential backoff и Retry-After, отменяемый timer. Не более одного retry malformed JSON. Нет бесконечного retry и автоматического переключения провайдера.

## Связи и проверка {#relationships}

Governing: `spec://common/PROP-000-product#invariants`. Модульные owning specs перечислены в SPEC-MAP. Проверка заполнения: определены контексты, общие типы, сообщения, security boundary, lifecycle, ошибки, точки импорта и владение.

## История {#changelog}

- 2026-10-08: страница Codex владеет токенами, фон получает проверенный account scope; добавлены UI-only открытие подключения и безопасный status.
- 2026-10-09: languagesOnly сохраняет языки popup под очередью без отката новой модели/провайдера/предпочтений.

- 2026-10-08: четыре CLI provider IDs, Native Messaging boundary и безопасные CLI errors; общий TranslationProvider без изменения page contract.
- 2026-10-07: исходная архитектура и контракт параллельной реализации.
- 2026-10-07: engine передаёт cacheHitIds для точного прогресса при внешнем изменении DOM.
- 2026-10-08: сохранение конфигурации и preserveKeyMode защищают persistent выбор от раздельной записи и устаревших форм.
- 2026-10-08: типы allowlist API diagnostics и UI-only сообщения GET_ERROR_LOG/CLEAR_ERROR_LOG.
- 2026-10-08: optional translation progress и batch-progress command; transport не меняет cache context.
- 2026-10-08: независимые browser/manual target и auto/manual UI locale; разрешённый язык поступает в прежний translation contract.

