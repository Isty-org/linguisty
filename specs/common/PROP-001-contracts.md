---
status: active
---

# PROP-001: Architecture and contracts {#root}

Extension contexts communicate through messages: the page retains references to text nodes, the background calls APIs, and popup/settings control the process. A separate owned Codex page holds an OAuth session only in memory and executes requests through a validated internal port. Legacy CLI adapters remain compatible within the runtime.

## Stack and boundaries {#architecture}

Strict TypeScript, WXT, React for popup/options, native DOM for page handling, IndexedDB for the cache, browser APIs through `wxt/browser`, and Vitest/jsdom/fake-indexeddb for tests. One npm installation and one lockfile. Runtime API requests use fetch without a large provider SDK. The product does not use remotely executed code or remote fonts.

```text
Popup / Options → Background controller → Settings / Secrets
                         ↓
Injected page script ↔ Background controller → Translation engine → Provider API
                         ↓
                   IndexedDB cache
```

## Single contract {#types}

`src/shared/contracts.ts` contains Settings, ProviderConfig, TranslationInput/Result, TabTranslationState, RuntimeMessage, and PublicError. Contributors import these definitions. The coordinator approves changes; do not create alternative data models. Do not duplicate full TypeScript types in documentation: the source file is the verifiable code contract.

Settings contains independent targetLanguageMode (browser/manual) and uiLanguage (auto/supported locale). In browser mode, loadSettings returns a resolved BCP 47 target, so providers/cache/content continue to use a concrete language without an auto sentinel in the prompt. UI language and mode are not part of the cache key: only concrete source/target languages and semantic context affect translation. A previously saved target without a mode is treated as a manual choice.

CLI provider IDs and fixed errors are defined in `spec://modules/platform/INFRA-003-local-cli#protocol`. ProviderConfig retains the shared contract; CLI mode normalizes apiKey to an empty string, baseUrl to an internal cache namespace, an empty model to default, and streaming to false. Neither URL nor key is sent to the native host. NativeRequester is an internal adapter/test dependency; the UI continues using existing runtime messages.

The new codex provider fixes baseUrl=https://api.openai.com/v1, an empty apiKey, default model, concurrency=1, and streaming=false for atomic delivery of a validated Responses result. ProviderConfig.accountScope is a SHA-256 of verified sub/client_id for cache isolation, without storing identity/token in settings. A translation port request must match the page's current account scope; switching accounts cannot write a new response into the previous cache. Details: `spec://modules/platform/INFRA-004-codex-connection#requests`.

## Messages {#messages}

Each message has `channel: 'linguisty'` and a `type` discriminant. Responses are `{ok:true,data}` or `{ok:false,error}`. Errors contain a fixed code, a safe Russian message, and retryable; raw provider responses are not shown to the user.

Localized UI translates known safe messages or shows a local explanation by code; Russian UI retains the diagnostic specificity of the original public message. The local API log stores sanitized data and is not replaced by a translation of raw model output.

- GET_SETTINGS, GET_SECRET_STATUS, GET_TAB_STATE, GET_CACHE_STATS.
- OPEN_CODEX_CONNECTION and GET_CODEX_STATUS: owned UI only; one tab and a connection boolean, without tokens.
- GET_ERROR_LOG and CLEAR_ERROR_LOG: owned extension pages only; content cannot access diagnostics.
- SAVE_SETTINGS, REMOVE_API_KEY, TEST_CONNECTION, LIST_MODELS, CLEAR_CACHE: owned extension pages only.
- START_TRANSLATION, CANCEL_TRANSLATION, SET_DISPLAY_MODE: popup/options only, with tabId verified by the background.
- TRANSLATE_BATCH and PAGE_PROGRESS: only the injected top-frame script of the owned active session; the tab comes from sender, not an arbitrary message.
- CONTENT_COMMAND sends start/cancel/set-display/get-state/batch-progress to a specific tab; TAB_STATE_CHANGED sends safe status to the UI.

All payloads are validated at runtime. No settings, status, or model read returns a key. TEST_CONNECTION can use a key entered in options without saving it. There is no `externally_connectable` or key exchange through DOM/window.postMessage.

SAVE_SETTINGS accepts optional boolean preserveKeyMode: when true, the background uses the current mode inside its save queue and ignores a stale UI keyMode. Popup always sets it to true; options sets it to true if the user did not change the mode relative to the loaded form. An explicit mode change still transfers the key.

Popup also sets optional boolean languagesOnly=true: within the same queue, the background applies only sourceLanguage, targetLanguage, and targetLanguageMode to the latest configuration. The form's old provider/model/theme/keyMode and other fields cannot overwrite newer values. apiKey is rejected in this mode. Options continues saving the complete form.

## Module boundaries {#modules}

`TranslationResult` contains `translations`, `fromCache`, and optional `cacheHitIds`. The engine always returns unique original-node IDs actually served from cache; their count equals `fromCache`. Content uses the IDs for accurate counting after external changes/node removal. Provider adapters with `fromCache=0` may omit the list. Before applying results, content validates IDs, duplicates, and count consistency.

- `storage/settings.ts`: loadSettings/saveSettings; `storage/secrets.ts`: getApiKey/setApiKey/saveConfiguration/removeApiKey/getSecretStatus. saveConfiguration saves normalized settings together with the key while retaining separate storage keys.
- `cache/translationCache.ts`: getTranslationCache returns an object with get/set/clear/stats/prune; `cache/cacheKey.ts`: buildCacheKey.
- `translation/engine.ts`: TranslationEngine with cache and optional fetchImpl; translate(input, config, signal, onProgress?), testConnection(config, signal), listModels(config, signal).
- `providers/registry.ts`: getProvider(providerId); the single TranslationProvider interface is defined in contracts.
- `content/controller.ts`: createPageController with start/cancel/setDisplayMode/progress/getState/dispose; `entrypoints/translate.ts` registers the single message listener.
- `background/controller.ts`: registerBackgroundController; `entrypoints/background.ts` registers the listener synchronously inside defineBackground.
- Popup/options communicate with the background and do not directly import the secret store, providers, or cache. The Codex connection page separately owns only its own privileged OAuth session under INFRA-004; tokens do not cross the page→background boundary.

## Sessions and cancellation {#sessions}

Each run receives a sessionId tied to tabId. batchId and original text are checked before applying results. Settings are fixed at start. Late responses after cancellation, route changes, or original-text changes are not applied. Memory holds a bounded number of requests; a runtime AbortController stops fetch. Browser session storage keeps a safe session snapshot, not DOM or original pages. If the background stops, content can resume the current session from the snapshot; completed/closed tabs are removed.

TranslationProgress is either reset or cumulative segments with validated TranslationItem entries. The optional provider/engine callback carries no secrets. CONTENT_COMMAND.batch-progress contains sessionId/batchId/sequence/progress and passes the same background-only sender guard; old sequence values are skipped. Final TRANSLATE_BATCH retains the existing ApiResult/TranslationResult contract. Progress callbacks are removed on consumer settlement/cancellation.

## Error policy {#errors}

INVALID_API_KEY, PERMISSION_REQUIRED, RATE_LIMIT, PROVIDER_UNAVAILABLE, MODEL_NOT_FOUND, REQUEST_TIMEOUT, INVALID_MODEL_RESPONSE, NETWORK_ERROR, CONTEXT_TOO_LARGE, CANCELLED, INVALID_SETTINGS, RESTRICTED_PAGE, INTERNAL_ERROR. No automatic retry for 401/403, model errors, or denied permission. For 429/5xx/network errors, at most 2 retries with bounded exponential backoff, Retry-After, and a cancellable timer. At most one retry for malformed JSON. No infinite retry or automatic provider switching.

## Relationships and verification {#relationships}

Governing: `spec://common/PROP-000-product#invariants`. Owning module specs are listed in SPEC-MAP. Completeness check: contexts, shared types, messages, security boundaries, lifecycle, errors, import points, and ownership are defined.

## Changelog {#changelog}

- 2026-10-26: English translation; runtime contracts and existing diagnostic language remain unchanged.
- 2026-10-08: the Codex page owns tokens; the background receives a verified account scope; added UI-only connection opening and safe status.
- 2026-10-09: languagesOnly saves popup languages through the queue without reverting a newer model/provider/preferences.
- 2026-10-08: four CLI provider IDs, Native Messaging boundary, and safe CLI errors; shared TranslationProvider without changing the page contract.
- 2026-10-07: initial architecture and parallel implementation contract.
- 2026-10-07: engine supplies cacheHitIds for accurate progress during external DOM changes.
- 2026-10-08: configuration saving and preserveKeyMode protect persistent selection from separate writes and stale forms.
- 2026-10-08: allowlisted API diagnostic types and UI-only GET_ERROR_LOG/CLEAR_ERROR_LOG messages.
- 2026-10-08: optional translation progress and batch-progress command; transport does not change cache context.
- 2026-10-08: independent browser/manual target and auto/manual UI locale; the resolved language enters the existing translation contract.

