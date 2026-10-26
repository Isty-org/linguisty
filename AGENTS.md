# Linguisty: development entry point

Workflow mode: standalone

Before making changes, read `specs/protocols/BOOT.md`, your WI, its governing specs, and the relevant code. The full product source is `docs/product/original-plan.md`; the visual source is `docs/design/README.md`. Their interpretation for Linguisty is recorded in `specs/`. The user's current instructions take priority.

## User instructions

- State facts plainly. Do not call an unverified outcome successful.
- Describe changes in chat as “before → after.”
- Before devising a solution, research the web, Reddit, Stack Overflow, and other forums; verify technical decisions against official documentation. Checked starting points are in `docs/RESEARCH.md`.
- Check caches, duplicates, and memory use at intermediate stages and after the main task. Do not delete unrelated caches or stop unrelated processes.
- Use **English** for repository documentation, specifications, work items, comments explaining the project, and new commit/PR/release text. Preserve exact legal notices, proper names, and localized examples when their spelling is evidence. Conversation can follow the user's language. Product UI localization is independent.
- The product is **Linguisty**. The first version supports **Chrome and Firefox desktop**.
- There is no project server, telemetry, or shared API key. Users supply their own key or, following the 2026-10-08 instruction, use Codex with ChatGPT sign-in. The new UI offers only Codex and API providers; Codex tokens exist only in a separate tab's memory. Canon: `specs/modules/platform/INFRA-004-codex-connection.md`.

## Parallel work

The user authorized the coordinator to create `gpt-6.1-sol` chats with `thinking=max`, assign work, and supervise implementation. All chats share this folder. Do not independently create additional chats.

- Each contributor changes only paths assigned in their WI. If another contributor's file is needed, state the exact need in your Result/response; the coordinator arranges the change.
- Only the coordinator changes shared contracts `src/shared/contracts.ts`, build settings, dependencies, `README.md`, canonical specs, `BOARD.md`, `WAL.md`, `.me`, and the WI archive. Do not overwrite shared files or apply broad formatting changes.
- Contributors update their WI Result without archiving the file or editing the board. The coordinator accepts and archives the result after verification.
- Do not install dependencies separately: the project uses one shared `node_modules` and one `package-lock.json`. Report missing dependencies.
- Tests use at most two workers; leave no watch processes running after verification. Do not run paid requests without a user-provided key and a specific test instruction.
- A missing module during parallel work is not a reason to create a duplicate. Work against the contracts and record the integration dependency.
- Add `@spec spec://...#anchor` at responsibility boundaries and direct contract tests. A single-step local fix does not require a new WI.

## Readiness

Accepting a version requires typecheck, lint, meaningful tests, builds for both platforms, manifest/secret/resource checks, and a browser scenario in the available environment. Without a key, real translation accuracy through OpenRouter remains explicitly unverified. Policy: `specs/common/PROP-002-quality.md`.

