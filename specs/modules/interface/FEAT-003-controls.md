---
status: active
---

# FEAT-003: Linguisty controls and settings {#root}

The popup provides translation, progress, cancellation, and the original. Separate settings contain the provider, key, and model. All actions use validated messages to the background.

## Governing specs and scope {#governing}

`spec://common/PROP-000-product#scope.in`, `spec://common/PROP-001-contracts#messages`, `spec://common/PROP-002-quality#ui`. Visual reference docs/design/README.md: the user-supplied Retro Orbit Editorial, with Paper / Graphite themes. User-facing copy and the manifest use only Linguisty; its logo was supplied separately. Isty remains the name of the design reference and the author credit in the footer.

## Popup {#popup}

Width around 360–400 px, a compact Linguisty header, immediately followed by target-language selection, source auto/explicit, current provider/model, and the primary “Translate page” button. The popup has no large introductory banner; the editorial heading remains only in settings. Progress uses aria-live and actual discovered/translated/failed counts. Actions: cancel/show original/show translation and open settings. Without a key/model, clear onboarding leads to settings. Protected pages show a warning. Reopening the popup restores actual status instead of resetting progress. Errors are readable and retryable actions match the error.

The settings button in the header is a gear without a visible text label. Its hit area is 44×44 px; localized accessible name and tooltip are retained, and the SVG is decorative. Keyboard, focus-visible, both themes, and RTL work.

## Settings {#options}

Provider OpenRouter / OpenAI-compatible, custom baseUrl only when needed, a password input for the key (empty by default; a saved key is not inserted), session/persistent selection, model discovery/search plus manual ID, source/target, natural/accurate/literal, custom instructions. Test connection, save, delete key, cache stats/clear. Origin permission is requested from a synchronous user gesture before saving or testing; a denied grant does not save the new provider config. An empty apiKey means retain the existing key; deletion uses a separate button. Changing keyMode transfers the existing key. Testing an entered key does not have to save it. There is no optional shared API key.

The third and only new keyless option is localized “ChatGPT subscription.” The “Connect ChatGPT” button saves the form without an API key and opens/focuses codex.html with four steps, ChatGPT sign-in, verification, model selection, cancellation/disconnection, and return to settings while keeping the tab open. Old CLIs are not offered: their saved configuration is displayed through the subscription connection form but saved only by an explicit action. The popup checks for a connected page and offers connection without requiring a key. All strings/errors and the callback are available in 16 locales; language and RTL match settings. Tokens stay only in the separate page's memory under spec://modules/platform/INFRA-004-codex-connection#root; this is an exception to the import restriction for popup/options. The internal provider ID `codex` is preserved.

For a temporary Firefox install, settings explain removal of the add-on and possible data deletion after restart. Optional management.getSelf reads only the extension's own installType without management permission, does not delay the form, and does not change browser preferences. Regular use after restart requires a signed, permanently installed package.

“Show translations progressively” is enabled by default. Completed phrases appear before the response finishes; on an error, unconfirmed translation is rolled back. Turning it off selects an ordinary request for the next session. Do not promise that an arbitrary generic API/chosen model delivers data early or that abort is guaranteed to stop upstream billing.

## Themes and accessibility {#design}

CSS semantic tokens follow docs/design/README.md: violet #b9a6f2 / #8d71cb, sage #9eb58f / #6f8a65, graphite #121018 / #17131d, cream/paper #f5f0e6 / #f3ead8. Text contrast is maintained through semantic variants. Onest and JetBrains Mono are bundled with licenses, with system fallbacks for other writing systems; no remote fetch. Large italic headings, thin rectangular panels, restrained orbit lines; product controls take priority over a landing poster. The header uses the supplied Linguisty logo: monochrome on paper, color on graphite, beside an accessible product name. It is decorative for screen readers; sizes are 64×64 px in options and 44×44 px in the popup. The color SVG is the source for PNG toolbar icons at 16/32/48/128 px on a graphite background, without an additional orbit; Isty is used only in the footer author credit. The light/dark/system preference is persisted and applied before visual paint where possible without inline scripts. 44 px click targets, focus-visible, labels, keyboard, reduced motion; status is not conveyed by color alone. Settings have navigation through actual sections; the popup is around 390 px. Do not create a separate landing page/backend.

## Languages {#languages}

The Isty author mark appears in the popup/options footer with localized “Powered by,” while Linguisty remains in the header. The full credit template supports the brand's position within the phrase; the SVG has the accessible name Isty, without an external request or invented link.

The translation catalog contains ISO 639-1 languages and common BCP 47 variants, with names in the current UI language and the language's own name. It represents available prompt choices; capabilities of the selected model are not guaranteed. A manual BCP 47 code recognized by Intl.getCanonicalLocales is saved even outside the catalog; a separate parser for grandfathered/private-only tags is not added.

A new profile uses source=auto, targetLanguageMode=browser, uiLanguage=auto. Target is selected from navigator.languages preferences, then i18n.getUILanguage/navigator.language, then English. UI auto prefers browser i18n.getUILanguage, then navigator.languages; an unsupported UI locale uses English. UI and translation language are independent settings. Browser mode resolves target again when reading settings; manual remains unchanged. A previously saved target without a mode migrates to manual. The user-specified uiLanguage is stored separately; regional/script matching accounts for simplified/traditional Chinese. Local dictionaries for the complete UI include at least en/ru/uk/de/fr/es/it/pt/pl/tr/ja/ko/zh-CN/zh-TW/ar/hi; lang and dir match the locale, with Arabic RTL. There is no attempt to read the OS language directly. Native keyboard navigation and entry of long/rare language codes are preserved.

## Errors and data {#errors}

The UI does not import secret/provider/cache helpers. The entered key is cleared after saving and is not logged. Validation errors appear beside the field/in a general alert; raw provider responses are excluded. Button busy state is robust to rejection; subscriptions/poll timers are released on unmount. Cache clear requires a clear action; page translation is not destroyed.

The “API error log” section shows sanitized diagnostic fields, time, operation, and attempt count separately from PublicError. Untrusted messages are textual React children. Refresh, copy, and clear are available, with explicit empty/loading/error states. Copy writes only displayed sanitized data to the clipboard following a user gesture; its result is not invented. Loading is independent of the form, has a timeout, and cleans up on unmount; the log refreshes after test/discovery. Nothing is sent to a server.

Loading the cache does not delay the settings form. Background reads have a finite timeout and one bounded retry only for a startup transport failure; commands with side effects are not automatically retried. After timeout, a clear message and reload are available. Closing the UI cancels waiting and releases timers. Bootstrap and React render errors leave a visible safe fallback with page reload; it shows neither raw errors nor keys. An old window retains current keyMode unless the user explicitly changed it.

## Readiness and traceability {#acceptance}

Complete onboarding and restart; manual model when discovery fails; denied permission; session/persistent; clear cache; progress/cancel/toggle; light/dark/system; mobile options and keyboard. No fictional counts or successful test connection without a response. `@spec` on major React components/hooks and direct interaction tests.

## Relationships and history {#changelog}

- 2026-10-26: translated into English and updated documentation paths; existing behavior, contracts, and limits preserved.

- 2026-10-08: the visible service name is “ChatGPT subscription” in 16 languages; buttons, statuses, and the short post-sign-in return page are localized.
- 2026-10-08: API + one Codex option in the dropdown, a separate four-step sign-in page, verified popup status; instructions translated into 16 languages.

- 2026-10-08: four CLIs in the selector; keyless options/popup, connector installation, default model, and an honest presence check rather than a claim of a verified model response. Instructions and CLI errors are available in all 16 UI locales.
Related: `spec://modules/storage/INFRA-002-local-data#settings`, `spec://modules/platform/INFRA-001-extension#permissions`.
- 2026-10-07: popup/options and adaptation of Isty Cloudline for Linguisty.
- 2026-10-08: bounded UI startup, independent cache stats, safe fallback, and retention of current key mode.
- 2026-10-08: local sanitized API errors section, manual refresh/copy/clear.
- 2026-10-08: user choice of progressive/ordinary display.
- 2026-10-08: Retro Orbit Editorial, supplied SVG, local fonts; expanded translation catalog and independent auto/manual UI/target preferences preserving previous choices.
- 2026-10-08: user clarification — Isty mark and localized credit moved from header to footer.
- 2026-10-08: new user-supplied Linguisty SVGs in the header according to theme and in PNG toolbar icons; localized Isty footer retained.
- 2026-10-08: following user clarification, the introductory banner was removed from the popup; the large options heading was retained.
- 2026-10-09: at the user's request, the popup settings text button was replaced with a gear with accessible name and tooltip.

