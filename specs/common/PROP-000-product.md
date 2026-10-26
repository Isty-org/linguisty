---
status: active
---

# PROP-000: Linguisty product {#root}

Linguisty translates text on the current website using a model selected by the user and allows immediate restoration of the original. No project server is needed; the user supplies an API key or an eligible ChatGPT plan.

## Sources and priority {#sources}

The sources are `docs/product/original-plan.md`, `docs/design/README.md`, and the supplied SVG `public/brand/isty-logo.svg`. On 2026-10-07, the user specified the name Linguisty and included Chrome. This overrides the former name and Chrome's exclusion from v1. On 2026-10-08, the user changed the visual source to Retro Orbit Editorial and requested broader language selection with automatic browser detection. Isty does not become the extension's name. The instruction includes documentation, parallel implementation with Sol 6.1/max, and result verification.

## First version {#scope.in}

- Chrome desktop and Firefox desktop, Manifest V3, separate builds from one codebase.
- Translation of main-page text nodes, viewport first; automatic or manual source language and a user-selectable target language.
- OpenRouter and arbitrary OpenAI-compatible endpoints; manual model IDs work without discovery.
- Under the user's latest 2026-10-08 instruction, the only new keyless option is localized **ChatGPT subscription**, with a connection button and a separate step-by-step page using official Sign in with ChatGPT. Instructions and the post-sign-in return flow are available in all 16 UI languages. Tokens live only in the tab's memory; no CLI/connector is needed. Canon: `spec://modules/platform/INFRA-004-codex-connection#root`. Previous CLI adapters remain runtime-compatible but are not offered in the UI.
- Local storage of settings and the API key: session or persistent, chosen by the user.
- Natural / Accurate / Literal styles and optional custom instructions.
- Progress, cancellation, partial errors, original restoration, and showing a completed translation again without API access.
- Dynamic DOM, protection from self-generated mutations, SPA navigation, a bounded local cache, deduplication, and a bounded queue.
- Settings, popup, equally supported light and dark themes, with the system theme as default.

## Later versions {#scope.out}

Native Anthropic/Gemini and other adapters, bilingual mode, selection translation, context menu, glossary, per-site automatic translation, fallback chains, cost reporting, PDF/OCR, subtitles, mobile browsers, and Safari. These appear in the original plan but are outside the first implementation pass. There is no project account system, backend, telemetry, or cloud sync.

## Invariants {#invariants}

Secrets are accessible only to privileged extension code. Translation sends text and limited context, not full HTML. The model returns text by ID; results are inserted only through Text.data. Buttons, forms, and JavaScript handlers remain the same objects. Model instructions require preserving numbers, currencies, areas, URLs, names, and placeholders; semantic accuracy requires a separate live check.

## Authorship and license {#licensing}

The author of current development is Nikita Tsyzhman (@tsyzhman). Following the user's explicit choice on 2026-10-20, Linguisty's own code and documentation use MIT; the complete license and original copyright are in the root `LICENSE`. Third-party dependencies and fonts retain their own copyrights and licenses. The project license does not change access terms for third-party APIs or subscriptions.

## Product acceptance {#acceptance}

On a French property listing page in each browser, the user configures OpenRouter, translates into Russian, receives the first visible translation followed by the rest of the page, retains working links/gallery/forms, sees new text translated, restores the original instantly, and shows the translation again from memory. A repeat visit uses the appropriate local cache. Cancellation and errors do not damage the page. The key is sent only to the selected provider.

## Relationships {#relationships}

`spec://common/PROP-001-contracts#root`, `spec://common/PROP-002-quality#root`, and the module specs in SPEC-MAP.

## Completeness check {#checklist}

The name, platforms, sources, boundaries, invariants, and observable scenario are defined. No invented test results are included.

## Changelog {#changelog}

- 2026-10-26: translated into English and updated documentation locations; product behavior is unchanged.
- 2026-10-20: the user chose MIT with Nikita Tsyzhman's authorship; third-party licenses remain intact.
- 2026-10-08: following user clarification, Codex through ChatGPT replaces CLI selection in the UI; earlier adapters remain for compatibility.
- 2026-10-07: canonical requirements derived from user materials; Linguisty and Chrome included by direct instruction.
- 2026-10-08: added an installed-CLI mode through Native Messaging.
- 2026-10-08: clarified the user-facing “ChatGPT subscription” name, including all 16 instruction and return-flow languages; internal provider ID retained.
