---
status: active
---

# INFRA-003: Local translation CLI {#root}

Linguisty uses the user's officially installed CLI through a small Native Messaging host. Models remain services of the selected CLI; offline inference is not promised. The browser starts the host itself; there is no continuously listening server.

## Mode and interface {#settings}

After WI-022, this module serves only compatibility with previously saved configurations. The dropdown no longer offers four CLIs. When loading old CLI settings, the form shows Codex under INFRA-004 but does not overwrite settings until explicit save/connect. The host installation below remains the old native transport contract rather than a new user scenario.

Separate provider IDs: codex-cli, claude-code, antigravity-cli, grok-build. The extension needs no API key of its own and sends none to the host. The user signs in through the original CLI; Linguisty does not read, copy, or store tokens. An empty model means the CLI's default model; a manually specified ID is passed as a separate argument. API modes retain their previous contracts. CLI works with the final validated batch response; streaming UI is disabled for CLI. Selecting CLI sets concurrency=1 and timeout=120 s. Settings explicitly explain host installation and consumption of account limits.

## Native Messaging {#protocol}

Host name: com.linguisty.cli. Optional nativeMessaging permission is requested only by a user action in the UI. One background client multiplexes bounded requests by unique ID; protocol version 1. Operations: status, translate, cancel. The host accepts only the four provider IDs and bounded messages/model/timeout; the wire contains no executable paths, shell commands, secrets, or arbitrary flags. A response returns only bounded content or a fixed error code. No raw stdout/stderr/credentials in the log. Status checks CLI existence without inference and explicitly does not confirm account/model access. Default model discovery makes no network requests.

## CLI execution {#execution}

Processes start without a shell, hidden on Windows, from a separate temporary working directory. Documented headless/JSON modes are used. Codex is ephemeral/read-only, with shell/web/apps/MCP disabled; Claude has tools and MCP disabled, without persistence; Grok has no tools/subagents/web or auto-update; Antigravity uses its own workspace agent with tools=[] and sandbox. Standard CLI binaries are not modified. Windows npm cmd shims resolve to a known package JS entrypoint and run through Node without a shell. A missing binary returns CLI_NOT_FOUND, a missing host CLI_HOST_MISSING, and authorization failure CLI_LOGIN_REQUIRED. No automatic sign-in, third-party software installation, or interaction with existing chats.

## Resources and cancellation {#resources}

Native frames are limited to 900 KiB; CLI stdout to 4 MiB and stderr to 32 KiB; final content/response is bounded and strictly validated by the existing ID parser. The host performs one translation at a time, with a queue of at most 16; the client has at most 16 pending requests. The overall timeout includes queueing. Cancel/timeout/disconnect terminate only the process tree created by the host, remove timers/listeners, and remove the request-owned temporary workspace. Cache and dedup remain unchanged; provider/model are part of scope. The idle native port closes, and the host does not remain running without requests. Third-party CLI cache/history is not cleared and is not promised absent if the CLI maintains it independently.

## Installation and verification {#acceptance}

The one-time Windows installer copies only host files into LocalAppData/Linguisty, locates Node and CLIs, and registers owned HKCU native host manifests for Chrome/Firefox. The Chrome ID is passed explicitly (or taken from a local build smoke test); the Firefox ID is stable. Unrelated registry entries are untouched. Tests cover frames, limits, adapters, absence of shell/secrets, cancellation, missing executable/host, operation without an API key, and API regression. Browser mock smoke checks the native channel and translation, without establishing semantic accuracy. Real CLI model calls require a separate user test assignment.

## Relationships and history {#changelog}

- 2026-10-26: translated into English and updated documentation paths; existing behavior, contracts, and limits preserved.

- 2026-10-08: CLI choices removed from the new UI; the module remains for compatibility, while INFRA-004 defines the primary Codex scenario.

The headless Chrome native transport check uses a separate temporary package copy with nativeMessaging in required permissions; JS/assets remain byte-identical. This test does not establish the production optional grant or the physical Chrome dialog. Firefox smoke checks the unchanged package and standard optional permission prompt through a privileged test context. Both smoke tests use deterministic translations, not a live model.

Related: `spec://modules/translation/FEAT-001-engine#providers`, `spec://modules/storage/INFRA-002-local-data#cache.key`, `spec://modules/interface/FEAT-003-controls#options`, `spec://common/PROP-002-quality#resources`.
- 2026-10-08: new mode explicitly assigned by the user.
