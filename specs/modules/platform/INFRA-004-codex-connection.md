---
status: active
---

# INFRA-004: Connecting a ChatGPT subscription {#root}

The user selects “ChatGPT subscription” in Linguisty and connects their ChatGPT plan through official Sign in with ChatGPT for an OSS/local application. This mode requires no CLI installation, Native Messaging host, or server of our own. An owned extension page makes network requests; OAuth browser compatibility is not presented as verified live sign-in on the basis of mock tests.

## Settings and steps {#settings}

Provider ID `codex` is retained for compatibility; it uses a fixed OpenAI endpoint and accepts neither an API key nor a user-specified auth endpoint. Visible options: OpenRouter, OpenAI-compatible, localized “ChatGPT subscription.” Old CLI adapters remain a compatible historical mode but are not offered in the dropdown.

“Connect ChatGPT” saves the current form without passing an API key and opens/focuses the owned codex.html page. The page explains four steps: open ChatGPT sign-in; authorize use of the plan; verify access and select a model; return to translation. It states the need for an available plan, shared account limits, cloud processing of text, and keeping the page open. Actions include sign-in, cancel, test, disconnect, and return to settings. The name, instructions, statuses, and errors are available in all 16 UI languages. The short callback page uses the same selected language or browser language; lang/dir match the locale. It loads only compact labels, without complete interface dictionaries.

## Authorization {#auth}

Authorization Code + PKCE S256, with cryptographic state/nonce/verifier per attempt. Initial registration uses dynamic_agent_client, the actual name Linguisty, and a stable opaque host ID; the returned issued client ID is stored separately from tokens. Callback: http://127.0.0.1:1455/auth/callback. The session DNR rule applies only to the owned auth tab and fresh state, redirects to the owned callback page, and is removed in finally. No general interception of CLI or other applications' sign-in.

declarativeNetRequestWithHostAccess is declared required: Firefox does not support it as optional, and Chrome has a confirmed updateSessionRules hang after an optional grant. Host access remains optional and is granted by a click only for auth.openai.com, api.openai.com, and 127.0.0.1. The rule retains the owner tab ID and a separate random rule ID; the background removes only its own rules and auth tabs when the owner closes or a leftover rule is detected after waking.

The ID token is verified with WebCrypto against trusted OpenAI JWKS: RS256 algorithm, signature, issuer, issued audience, expiry, nonce, and sub. The chatgpt.tokens.use.direct permission is required. Tokens exist only in the connection page's memory: no chrome.storage/browser.storage/localStorage/IndexedDB, DOM, URL, or messages to other contexts. Closing the tab/restarting removes access; the interface offers reconnection. Only nonsecret host/client identifiers persist locally. Refresh is serialized; disconnect clears memory and confirms remote revoke or explicitly states it was not confirmed.

Audience accepts an OIDC string or array of strings. A single aud=[issued client ID] does not require azp; a present azp must match issued client ID, and multiple audiences require azp. A local connection failure includes a bounded stage/validation code and HTTP status if available. The code appears only on the owned page and contains no token/claims values, email, callback URL, provider body, or arbitrary error text; no long-term diagnostic log is created.

## Requests and isolation {#requests}

The background contacts the owned page through a named internal port. The page validates sender, protocol/version, bounded payload, and request ID; it returns no secrets. Status shows verified authorization, discovery shows actually available models, and test performs no paid inference. Strict translation returns only content for the existing parser. The cache account scope is SHA-256 of verified sub/client_id, not a token or email.

Responses HTTP: store=false, stream=true, input array with developer instructions, without prohibited fields or tools. The shared strict translation schema is passed through text.format={type:json_schema,name,strict,schema}, without a Chat Completions envelope. The default model is resolved through the available list; the selected model is not substituted. A response is assembled only after response.completed with status=completed: assistant commentary is excluded; final_answer and compatible messages without phase are read; failed/incomplete/abort/refusal do not count as success. SSE supports LF/CRLF/CR and UTF-8/separator splits between chunks. Page input is text, not HTML. Translation uses the existing prompt/parser/cache/dedup.

The reader retains completed assistant messages from response.output_item.done by output_index, with at most 128 slots, without metadata/annotations or commentary text. Success is possible only after response.completed/status=completed. If terminal output does not repeat the messages, completed stream text is used; a matching aggregate is not duplicated, and conflicting text is rejected. Raw deltas/added items without a completed message do not replace final_answer. The shared parser still validates the complete ID/translation set before cache/DOM commit.

Translation failures distinguish only fixed LGT-response-body/json/completion/content/refusal/limit/output/message/phase/status/part/empty/commentary/conflict and LGT-translation-json codes. The owned port passes only an allowlisted code; arbitrary errors, body/claims/tokens/page text are not passed. The popup retains this code when localizing the general error. No persistent Responses or provider-response log is created.

## Resources {#resources}

At most 16 pending port requests and 4 concurrently served page requests; payload up to 900 KiB, response up to 1 MiB. Timeout is bounded at 120 s; cancel/disconnect/page closure release controllers, listeners, timers, and ports. At most 1 000 models, with a 15-minute TTL. No continuous polling/keepalive or listening localhost process. Page opening is serialized and reuses the existing tab.

In Chrome, reopening looks only for an owned TAB/documentUrl through runtime.getContexts: tabs.query does not reveal the owned extension URL without broad tabs permission and is unsuitable for dedup. Firefox uses its own tabs.query. After the background wakes, lookup does not depend on a tab ID retained in RAM.

## Verification and history {#changelog}

- 2026-10-26: translated into English and updated documentation paths; existing behavior, contracts, and limits preserved.

Contract tests cover OAuth validation, SSE completion, secret boundary, cancellation, and repeated lifecycles. Chrome/Firefox smoke checks the unchanged package and owned UI/mock auth/translation. Real sign-in, plan availability, and model quality remain separately unverified without the user.

- 2026-10-09: fixed compatibility with a single OIDC audience in an array; defined bounded local connection-failure reason codes.
- 2026-10-08: following user clarification, visible Codex was renamed to localized “ChatGPT subscription”; callback localized into 16 languages, internal IDs and protocol preserved.
- 2026-10-08: new mode and page explicitly assigned by the user.
- 2026-10-09: strict Responses text.format, commentary/final_answer separation, compatible SSE line endings, and bounded translation-failure codes.
- 2026-10-09: completed text from output_item.done is retained until terminal completion; an empty aggregate does not lose translation, repeats are not duplicated, and content reasons use distinct safe codes.
