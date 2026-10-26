---
status: active
---

# INFRA-001: Platforms and background coordination {#root}

One codebase produces independent Linguisty builds for Chrome and Firefox. The background receives commands, protects keys, and coordinates tabs.

## Governing specs and scope {#governing}

`spec://common/PROP-000-product#scope.in`, `spec://common/PROP-001-contracts#messages`, `spec://common/PROP-002-quality#resources`. Scope includes packaging, MV3, messaging, permissions, and tab/session lifecycle. Store publication and Firefox signing are outside this pass.

## Environments and build {#build}

Node 22+, WXT 0.21.x, React, TypeScript. WXT browser-specific manifest: Chrome service_worker; Firefox background scripts/event page. Minimum Firefox 142/Chrome 120. Built-in data consent is available from Firefox desktop 140/Android 142; the shared gecko floor of 142 removes the Mozilla linter warning without gecko_android or a claim of Android support. Firefox 140–141 are no longer within the installation range. Required websiteContent, browsingActivity, and authenticationInfo reflect transmission of text, limited domain context, and the API key only to the user's selected service. A none flag would be incorrect: absence of our backend/telemetry does not mean no data is sent to the provider. Popup and options have no inline executable scripts; CSP is self only. Separate `.output/chrome-mv3`, `.output/firefox-mv3`, and zip. Firefox gecko ID is `linguisty@isty.local`; this is a local technical identifier, not a support address.

The UI uses React nodes and textual children. The production build disables two unused React DOM raw-HTML setters (ordinary/custom element): non-null dangerouslySetInnerHTML raises an explicit error instead of parsing HTML. No dynamic HTML sanitizer or alternative HTML parser is added for this. A build guard checks the expected upstream code shape and stops the build if it changes; the source dependency on disk is not modified. React's constant creation of an inert script element is preserved. Updating React requires checking the guard and a browser smoke test.

Root `LICENSE` (MIT, Nikita Tsyzhman @tsyzhman) and `THIRD_PARTY_NOTICES.txt` are automatically copied into both build roots through the WXT public assets hook. Git stores one source for each text; ZIPs contain exact copies. Manifest/resource inspection rejects missing or changed files. Font OFL licenses remain unchanged in `fonts/`.

## Permissions {#permissions}

Optional nativeMessaging is declared for CLIs. Only a user action in options/popup requests it; the background checks the grant before invoking a CLI. Content has no direct native channel. One-time system host registration is defined in `spec://modules/platform/INFRA-003-local-cli#acceptance`.

Required activeTab, scripting, storage, and declarativeNetRequestWithHostAccess for the owned Codex callback. DNR does not automatically receive host access: access remains optional and is requested by a click only for OpenAI/loopback under INFRA-004. No required `<all_urls>` or permanent content script. `entrypoints/translate.ts` is an unlisted script injected on the user's command. API origins are requested as optional host permissions from options during a user gesture. Arbitrary HTTPS endpoints are allowed; HTTP is allowed only for localhost/127.0.0.1/[::1] local gateways. URLs with credentials/query/hash are rejected. A request never follows an external redirect with Authorization: redirect error.

## Runtime {#runtime}

The listener is registered synchronously. UI senders are checked by runtime.id and owned extension URL; content by runtime.id, tabId, frameId=0, sessionId. GET_SETTINGS returns settings only; secret status is boolean/mode. START injects translate.js once and sends CONTENT_COMMAND.start. GET_TAB_STATE restores progress after popup closure. URLs chrome://, about:, extension pages, and closed tabs return RESTRICTED_PAGE/a safe error. The provider origin is checked before a request. Tab close/navigation cancels the queue and removes the snapshot; the page script separately tracks SPA and changed DOM.

The background TRANSLATE_BATCH deadline covers bounded retries and adaptive splitting under PROP-002. A provider per-attempt timeout does not end the entire batch before recovery. At the overall deadline, batch, preview, and abort listeners are released; UI commands retain separate short deadlines.

## State and recovery {#recovery}

The background forwards the current batch's cumulative preview through CONTENT_COMMAND.batch-progress. One pending snapshot and one cancelable 100 ms timer per batch; sending is sequential, without an unbounded frame queue. After settlement, abort, tab close, or dispose, pending data is cleared. Preview is not stored in session snapshots; a restored session retries only the unfinished batch.

browser.storage.session contains bounded settings/sessionId/tabId snapshots and safe progress. The key is stored by a separate secret storage helper. After worker termination, the background restores session settings before handling a content batch; an in-flight request may be lost when the worker stops, but the UI does not hang indefinitely and the page can be translated again. A snapshot contains no HTML/texts. Rollback means removing the unpacked/temporary install; settings are not destructively migrated.

Settings, keys, and cache do not wait for tab snapshot restoration. A failed session read/write does not block configuration; page/session commands receive a safe recovery error and may retry recovery on the next request. Snapshot restore is time-bounded; a late result from a canceled attempt does not replace current sessions. There is no infinite list of pending messages.

## Errors and observability {#errors}

Payload type validation, permissions denial, injection unavailable, missing API key, invalid settings, background wake/restart, stale session. Logs contain no secrets/provider body. No telemetry. Handled errors return ApiResult.

The background connects the provider reporter to the protected local log. One final network failure creates one entry even with multiple engine consumers. GET_ERROR_LOG/CLEAR_ERROR_LOG validate the sender's owned extension URL and do not depend on session recovery. Diagnostics do not enter tab state, snapshots, or content replies.

## Traceability and readiness {#acceptance}

`@spec` on background controller, entrypoint, and manifest config. Both production manifests are valid; UI→background→content→background works; only the background reads the key; tab closure clears state; Chrome SW and Firefox event page are not mixed; builds contain no development server.

## Relationships and history {#changelog}

- 2026-10-26: translated into English and updated documentation paths; existing behavior, contracts, and limits preserved.

- 2026-10-20: MIT and third-party notices are included in both builds and checked before release.

- 2026-10-08: Codex OAuth return through a temporary rule for an owned tab; declarativeNetRequestWithHostAccess is required at install, host access is requested by a button.

- 2026-10-08: optional nativeMessaging and a keyless CLI branch in the background controller.
Related: `spec://modules/storage/INFRA-002-local-data#secrets`, `spec://modules/page/FEAT-002-page-translation#sessions`.
- 2026-10-07: both first-version platforms and the security/runtime boundary.
- 2026-10-07: clarified Firefox minimum 140 and actual provider data transmission according to Mozilla built-in consent documentation.
- 2026-10-07: WI-011 — shared Firefox floor 142 without Android support and production guard for unused React raw-HTML setters for clean Mozilla validation.
- 2026-10-08: configuration is independent of snapshot restoration; recovery is bounded and can be retried.
- 2026-10-08: provider reporter and UI-only local diagnostics log.
- 2026-10-08: bounded sequential preview forwarding and data release on batch completion.
- 2026-10-08: the overall bounded batch deadline accounts for provider retries and sequential recovery.

