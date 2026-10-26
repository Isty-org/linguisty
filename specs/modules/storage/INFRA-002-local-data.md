---
status: active
---

# INFRA-002: Local settings, secrets, and cache {#root}

Settings and translations remain on the user's device. Key persistence is chosen explicitly; repeated translation uses a bounded cache with full context.

## Governing specs and scope {#governing}

`spec://common/PROP-000-product#invariants`, `spec://common/PROP-001-contracts#types`, `spec://common/PROP-002-quality#resources`. Scope includes settings schema/migration, secret modes, IndexedDB, stats/pruning. Cloud sync and import/export are outside v1.

## Settings {#settings}

CLI modes use the same schemaVersion=1. During normalization, the internal baseUrl is not used as an HTTP endpoint; an empty model becomes default, concurrency=1, and streaming=false. Switching to CLI does not remove the previous API key; a new key from CLI settings is not saved. Provider/model retain cache separation. Third-party CLI tokens are not read.

Codex retains the same schemaVersion=1: fixed OpenAI baseUrl, an empty model becomes default, concurrency=1, and streaming=false. The previous API key is retained for returning to API mode. Only nonsecret host/client registration IDs are stored separately. Access/refresh/ID tokens are not written to browser storage, DOM, or logs; sub/email are not persisted in storage or logs. A verified email may be shown on the connection page. The cache account scope comes from a verified RAM session under INFRA-004 and is not stored in Settings.

Settings schemaVersion=1, defaults from shared/constants, provider/model/languages/style/instructions/theme/keyMode/concurrency/batch/timeouts. Settings contain no apiKey. Validate enum values, lengths, HTTP(S) endpoint, absence of credentials/query/hash, and customInstructions max 4 000 chars. targetLanguageMode=browser/manual and uiLanguage=auto/supported UI locale are independent settings. A fresh target is determined from browser preferred languages with fallback en on load; DEFAULT_SETTINGS has safe static en. In browser mode, loadSettings returns the current target; manual preserves a BCP 47 choice recognized by Intl.getCanonicalLocales. A previously valid target without a mode migrates to manual; secrets/model/source are not reset. Save only normalized allowed fields and discard unknown ones. Old/corrupt state is safely normalized or rejected with a clear error. Save does not erase the key if the key field is empty/omitted; deletion is a separate action.

Settings.streaming is boolean, default true; a missing field in the previous schemaVersion=1 receives the default without changing keyMode/secret. Transport choice is not part of the cache key because it does not change translation language/context.

## Secrets {#secrets}

`persistent` uses browser.storage.local, `session` uses browser.storage.session. Default is session. Switching mode transfers the existing key to the new store and removes the old copy; deletion clears both. Session survives service worker termination but ends with the browser session. If session storage API is unavailable, do not silently persist the key; show the limitation. Chrome storage local/session accessLevel TRUSTED_CONTEXTS is set when the API is available. Content scripts do not import the secret helper or read storage. getSecretStatus returns hasKey/mode; getApiKey is allowed only for a background caller. Never promise local storage encryption.

When saving configuration, the persistent key and settings.keyMode are written together in one browser.storage.local.set operation. Switching to session first prepares the session key, then saves settings and removes the persistent value in one local write; a null tombstone followed by remove is allowed. If the operation fails, restore the previous key/settings. Ordinary browser restart and browser/permanently installed extension updates do not change the local key or stable Firefox gecko ID. Extension removal, profile clearing, and removal of a temporary install have browser limitations: the extension cannot prevent Firefox from deleting its data.

A stale popup or options page without an explicit mode change does not transfer a persistent key into session; the background uses the current mode when saving.

## Cache key {#cache.key}

Codex additionally includes verified accountScope from the RAM session in the context hash; absence of valid scope is rejected. Switching accounts does not retrieve the previous translation from persistent cache. Tokens and email are not part of the key; API providers retain their previous digest.

SHA-256 of JSON containing prompt version, exact source text (safe whitespace normalization is allowed only if display whitespace is preserved), source/target, providerId, canonical baseUrl, model, style, customInstructions hash, pageContext.title/domain/contentType, and neighboring texts/semantic groups from the input batch without transient node IDs. API keys are excluded. Cache lookup context matches actual prompt context: a phrase does not receive translation from a different group/batch on the same page. TranslationEngine performs conservative dedup within equal context and remaps IDs without merging nodes.

## Data and operations {#cache.data}

IndexedDB record: key, translated text, createdAt, accessedAt, estimatedBytes; schema version 1. TTL 30 days; <=10 000 entries/50 MiB; LRU eviction. With quota/IDB unavailable, translation continues without cache; a cache error does not become a translation failure. Stats reports entries/estimatedBytes/hits/misses; timestamps are not invented. Clear actually removes records. Clear and write are serialized where atomicity is required.

## Contract and recovery {#contracts}

The local API log is stored as a separate allowlisted record in protected browser.storage.local: at most 100 entries, 4 KiB per entry, 256 KiB total, TTL 7 days. Time/ID are generated by the background; unknown fields are discarded. Read/write/clear are serialized; TTL/count/size pruning occurs on reads and writes. Log storage contains no requests, keys, or translations. Diagnostics are sanitized before passing to the storage helper; a log-write error does not replace the original API error. The UI reads the log independently of the main form and can clear only the log.

Provider message/upstream message/request ID are not among persisted fields; API code/type are allowed only from a finite safe vocabulary. The bounded model comes from the request's own settings and is sanitized for secrets before passing to the log. When old entries are read, free-form fields are discarded and sanitized entries are written back: old unwanted text does not return to UI/clipboard.

Exports of storage/settings.ts, storage/secrets.ts, cache/translationCache.ts, cache/cacheKey.ts are listed in PROP-001. getTranslationCache returns one instance per background lifetime. dispose closes the DB/releases references. Settings migration does not clear the key or translations. If session mode is unavailable, the message matches the actual browser.

## Errors and readiness {#acceptance}

Tests cover normalization, no-secret settings, session/persistent transition, deletion of both copies, cache context invalidation, TTL/LRU/size, concurrent writes, clear, and IDB failure. Secrets are absent from cache keys/data and public responses. `@spec` on helpers and tests.

## Relationships and history {#changelog}

- 2026-10-26: translated into English and updated documentation paths; existing behavior, contracts, and limits preserved.

- 2026-10-12: tightened the persistent API log allowlist after reproducing storage of short page text; legacy free-form fields are sanitized on read.

- 2026-10-08: Codex uses a RAM session, stores only nonsecret registration, and separates cache by verified account.

- 2026-10-08: normalization of four CLI provider IDs without migration or deletion of the previous API key.
Related: `spec://modules/translation/FEAT-001-engine#dedup`, `spec://modules/platform/INFRA-001-extension#permissions`.
- 2026-10-07: bounded local storage and two key persistence modes.
- 2026-10-07: clarified inclusion of neighboring batch text context without transient IDs for short ambiguous phrases.
- 2026-10-08: joint local key/mode write, protection against stale UI, and explicit temporary Firefox install boundary.
- 2026-10-08: separate bounded local sanitized API diagnostics log.
- 2026-10-08: streaming default and compatible migration of previous settings without changing the key.
- 2026-10-08: targetLanguageMode/uiLanguage, browser-based fresh defaults, and retention of the previous explicitly selected target during migration.

