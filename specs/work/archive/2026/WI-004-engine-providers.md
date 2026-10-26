# WI-004: Translation engine and providers

- Kind: `implement`
- Canon action: `none`

## Outcome

Engine translates a batch through OpenRouter/a compatible API, validates the response, uses cache/dedup, and safely cancels requests.

## Specs

- Governing: `spec://modules/translation/FEAT-001-engine#root`
- Constraint: `spec://common/PROP-001-contracts#modules`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- In/owned: `src/providers/**`, `src/translation/**`, `tests/providers/**`, `tests/translation/**`, this WI's Result.
- Out: shared/config/lock, storage/cache implementation, DOM, background, UI, docs/BOARD/WAL.
- API: TranslationEngine(cache, options?: {fetchImpl?: typeof fetch}); translate(input,config,signal?), testConnection(config,signal?), listModels(config,signal?). Registry getProvider(providerId). Cache buildCacheKey(text,input,config) will be created by WI-003; do not duplicate another owner's missing file.

## Dependencies

- Depends on: WI-002; cache integration requires WI-003.

## Acceptance

- [x] Two adapters work with the same contract and strict parser.
- [x] Request, 401/403/429/5xx/error envelope, malformed JSON, oversized response, timeout/abort tested.
- [x] Prompt injection separation and numbers/placeholders/URLs are established in the prompt.
- [x] Cache-hit without fetch, contextual dedup with remap, and in-flight cleanup tested.
- [x] Manual model is possible without discovery; discovery is bounded.
- [x] Own tests and available checks are completed; Result contains facts, with no logged key/raw body.

## Result

Ready for coordinator review on 2026-10-07. Acceptance was checked with mock/contract tests; acceptance, BOARD changes, and archiving remain with the coordinator.

Before → after: providers/translation and their tests did not exist → implemented OpenRouter and generic OpenAI-compatible adapters, registry, shared bounded transport, prompt, strict parser, a cache-first engine with contextual dedup/remap, and cancellation of individual consumers.

### Files and API

- `src/translation/engine.ts`: `TranslationEngine(cache, { fetchImpl? })`; `translate`, `testConnection: Promise<ConnectionTestResult>`, `listModels`. Read-only `inFlightCount`/`activeRequestCount`/`pendingRequestCount` expose lifecycle counts only.
- `src/providers/registry.ts`: `getProvider(providerId)`; optional `{ fetchImpl? }` allows isolated adapter testing. `openrouter.ts`/`openaiCompatible.ts`: `OpenRouterProvider`/`OpenAICompatibleProvider`, both implement shared `TranslationProvider` via `chatProvider.ts`.
- `src/providers/config.ts`/`request.ts`: endpoint/config normalization, credential fingerprint without keeping the raw key in the model cache, bounded response reader, safe HTTP/error envelope classification, retry/timeout/abort.
- `src/translation/input.ts`/`prompt.ts`/`parser.ts`/`abort.ts`/`queue.ts`: batch snapshot/limits, JSON serialization and prompt version, schema with confirmed capability, strict ID/shape/empty translation validation, cancellable waits, a queue with a hard ceiling of 4 active/32 queued.
- `tests/providers/contract.test.ts`, `fixtures.ts`, `tests/translation/parser-prompt.test.ts`, `engine.test.ts`, `queue.test.ts`: shared contract suite for two adapters and engine/parser/lifecycle checks.

### Behavior and integration

- No SDK, own storage, or duplicate cache module. Uses the real `src/cache/cacheKey.ts` from WI-003. Cache lookup/write receive the original batch snapshot, including neighboring texts/groups without transient IDs. For a specific semantic group, engine additionally hashes `[commonKey, group]` so that two identical phrases from different groups in one batch have different records.
- Dedup reduces only the list of requested IDs. Original neighboring texts and groups remain in JSON `sourceContext`. The internal optional fourth argument `ChatProvider.translate(..., sourceContext)` carries that context into the prompt. Results remap to original ID order. The shared contract was changed by the coordinator; the implementer did not edit it.
- WI-005 review integration fix: previously only aggregate `fromCache` → engine always returns `cacheHitIds` of original caller nodes from real cache hits in original order, including `[]` for an empty batch/no hits and the full list for an all-cache result. Input validation already forbids repeated IDs; duplicate text does not reduce the list of original IDs. `fromCache` is calculated from `cacheHitIds.length`, so the count and list cannot disagree. A shared in-flight/network response is not presented as a cache hit. The array is local to the call and limited to 40 original nodes; cache payload/prompt/providers were unchanged.
- In-flight entries are separated by credential fingerprint and timeout. Canceling one subscriber does not interrupt the shared request for others; the last subscriber cancels fetch/queued request and frees entries. A failed provider batch is not partially cached; cache get/set failure does not block translation.
- Generic endpoint works without `response_format`, even after discovery. OpenRouter uses `json_schema` only after discovering `structured_outputs` for the selected model and with matching credential scope/unexpired TTL. Otherwise, a strict JSON prompt is used; discovery does not start automatically or block a manual ID.
- Discovery: `/models` (OpenRouter `limit=1000&offset=0`), max 1 000 normalized unique models, one cached selection context per adapter, TTL 15 minutes, total response bound 1 MiB. Model metadata copies are returned.
- 401/403 → INVALID_API_KEY, 404/typed model errors → MODEL_NOT_FOUND, 429 → RATE_LIMIT, all 5xx → PROVIDER_UNAVAILABLE; top-level/choice error envelopes at HTTP 200 are recognized. 429/5xx/network have at most 2 retries, malformed JSON at most 1, overall maximum 3 attempts. Backoff 500/1 000 ms with Retry-After, cap 5 s. Timeout and cancellation are distinct and are not retried.
- The endpoint boundary independently of UI rejects remote HTTP, credentials (including empty login/`@` in authority), query/fragment, control chars, and redirecting the OpenRouter key to a different baseUrl. HTTPS and HTTP localhost/127.0.0.1/[::1] are allowed; redirect error, credentials omit. Model max 200 chars; key max 4 096; timeout 1 000–120 000 ms.

### Checks actually performed

- `node node_modules/vitest/vitest.mjs run tests/providers tests/translation --maxWorkers=2`: **4 test files, 153 tests passed**, exit 0; final run 2026-10-07 11:07:50 in test runner time. Includes regression cases `https://@example.com/v1`, empty login/password, and invalid slash variants; fetch does not start.
- `node node_modules/eslint/bin/eslint.js src/providers src/translation tests/providers tests/translation`: exit 0, no errors/warnings.
- `node node_modules/typescript/bin/tsc --noEmit`: **overall typecheck exit 0**. Previously found own lint/type defects were fixed; others' background/content defects disappeared after their owners' changes.
- Tested cache hits without fetch, original-context cache writes with partial hits, group/neighbor/page/style/language/instructions/provider/model invalidation, changed-ID concurrent dedup/remap, credential isolation, IDB failure, missing-ID atomic rejection, and a fresh request after error/cancellation.
- `cacheHitIds` regression: before the fix, 8 meaningful assertions reproduced the missing metadata. After the fix, tested empty input, network/in-flight response with `[]`, cached empty translation of a whitespace-only source, all-cache original IDs, group remap to new IDs, and a mixed batch with two cached duplicates and two network duplicates. Mixed result contains exactly the cached caller IDs; a subsequent all-cache call returns new caller IDs. Direct tests and the engine method have `@spec spec://common/PROP-001-contracts#modules`.
- Tested HTTP/error envelopes, finite retries/Retry-After, malformed JSON recovery, streamed UTF-8, exceeding the UTF-8 byte bound with incorrect Content-Length, timeout during fetch/body read, cancellation of fetch/retry sleep/queue/cache wait, and listener/timer cleanup. Connection result contains no key/raw response.
- 30 repeated success + cancellation cycles of a request that actually started leave `inFlightCount=0`, `pendingRequestCount=0`, `activeRequestCount=0`. Overload test: 4 active + 32 queued; the 37th gets RATE_LIMIT; everything is freed after cancellation. This is a lifecycle check, not proof of the absence of all browser heap leaks.
- Resource snapshot after the integration fix: 17 owned source/test files, 89 178 bytes, no exact SHA-256 duplicates. `node_modules`: 193 585 485 bytes; `.wxt`: 6 390; `.output`: 685 293. Available RAM before/after the current pass 15 536 868 → 16 292 824 KiB out of 33 478 528 KiB. Test/lint/typecheck/watch processes by the inspected command lines: 0. No own watch/server/helper left running; others' processes/cache were not deleted. No console logging, localStorage/IndexedDB/browser.storage in these modules' sources.

### Research and limitations

Before implementation, existing [Reddit JSON schema discussions](https://www.reddit.com/r/LocalLLaMA/comments/1kip5qj/openrouters_api_does_not_follow_given_json_schema/) and [Stack Overflow fetch timeout discussions](https://stackoverflow.com/questions/46946380/fetch-api-request-timeout/62470009) were researched. API/lifecycle were checked against [OpenRouter errors](https://openrouter.ai/docs/api/reference/errors-and-debugging), [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs), [models](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties), [MDN AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort), and [stream cancel](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/cancel).

Real provider access, semantic language accuracy, model resistance to prompt injection, and browser memory profile were not tested: there is no user key or assignment for a paid request. The prompt contains rules for preserving numbers/placeholders/URLs; tests check their presence/data separation; this is not a measurement of real translation quality. The coordinator accepts production builds/manifest/browser smoke as a whole; the implementer does not claim these as own checks.

The previous max key length request was closed by neighboring module owners: UI (`API_KEY_INPUT_MAX_LENGTH`), storage, and provider now allow 4 096. The implementer did not change others' paths. Engine's side of `cacheHitIds` is complete; WI-005/root checks metadata use after external DOM changes. There are no open module/import dependencies or requests to change another owner's file for WI-004.


Accepted by the coordinator on 2026-10-07: overall typecheck/lint PASS, 384 unit tests PASS, both production builds/manifest checks PASS, 9 Chromium scenarios PASS after the latest contract changes. Firefox runtime is supplemented by WI-010; real language accuracy was not tested.
