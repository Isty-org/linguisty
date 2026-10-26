# Linguisty

Linguisty translates web pages with your chosen language model while preserving buttons, forms, and page structure. It supports **Chrome and Firefox on desktop**, using your API key or an eligible ChatGPT subscription. Settings and the translation cache stay local; Linguisty has no server or telemetry.

Created and maintained by **Nikita Tsyzhman ([@tsyzhman](https://github.com/tsyzhman))**. The project's own code and documentation are licensed under [MIT](LICENSE). See [authorship and development tools](AUTHORS.md).

## Download and install

[Download v0.4.10 for Chrome or Firefox](https://github.com/Isty-org/linguisty/releases/tag/v0.4.10). Both ZIP packages include the MIT license and third-party notices; the first release, v0.4.9, remains available in the release history.

- **Chrome 120+:** extract `linguisty-0.4.10-chrome.zip`, open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
- **Firefox 142+:** extract `linguisty-0.4.10-firefox.zip`, open `about:debugging` → **This Firefox** → **Load Temporary Add-on**, and select `manifest.json`. This package is unsigned and does not provide a permanent installation in standard Firefox.

See the [installation guide](docs/guides/development.md) and [v0.4.10 release notes](docs/releases/v0.4.10.md).

## Translate a page

For ChatGPT, choose **ChatGPT subscription → Connect ChatGPT** in settings. A separate tab walks you through sign-in, an access check, and model selection. Keep that tab open: tokens exist only in its memory, so closing or reloading it requires signing in again. No CLI or connector installation is needed. The model runs in OpenAI's cloud and uses your ChatGPT account limits.

This connection uses an official preview and requires an eligible account plan and OpenAI authorization. Availability to every subscriber is not guaranteed. Real sign-in, paid model responses, and translation accuracy have not been verified by the automated acceptance checks. Read the [connection guide and limitations](docs/guides/chatgpt-connection.md).

For an API provider:

1. Open settings and choose OpenRouter or an OpenAI-compatible service.
2. Enter your own API key, model ID, and translation languages.
3. Grant access to the selected API origin.
4. Open a web page and click **Translate page**.
5. Cancel if needed, or switch between the original and translated text.

Visible text is translated first, followed by the rest of the page. New text added by the site is translated while translation mode is active. Cancellation stops new requests and leaves completed translations visible. Restoring the original or showing an already completed translation requires no API request.

Complete phrases can appear before the model finishes its response. Provisional text is rolled back on failure or cancellation; only fully validated responses enter the cache. You can disable streaming in settings, where a local API error log can also be copied or cleared. Font adjustments between CJK and alphabetic scripts are bounded and restore the original styling.

The interface and target languages are independent. New profiles use the browser's preferred languages for translation and its interface language for the UI. Manual choices are retained, including target languages saved by older versions. The language catalog includes ISO 639-1 languages and common regional variants; additional valid BCP 47 codes can be entered manually. The UI has 16 bundled dictionaries, including English, Russian, Chinese, and Arabic with RTL support. A language's presence in the catalog does not establish the chosen model's accuracy.

## Documentation

Start with the [documentation index](docs/README.md) for guides, design references, research, release notes, and the full QA archive.

- [Development and installation](docs/guides/development.md)
- [Testing and acceptance](docs/guides/testing.md)
- [Product scope](specs/common/PROP-000-product.md)
- [Architecture and contracts](specs/common/PROP-001-contracts.md)
- [Specification catalog](specs/SPEC-MAP.md) and [work board](specs/BOARD.md)
- [Contributor instructions](AGENTS.md)

Repository documentation and contribution text use English. The extension remains multilingual.

## Development

Use Node.js 22.12+ or 24+ and npm. Run commands from the repository root; on Windows, `npm.cmd` can be used if PowerShell blocks `npm.ps1`.

```text
npm ci
npm run typecheck
npm run lint
npm test
npm run build:chrome
npm run build:firefox
npm run check:manifests
npm run check:hygiene
```

Production output is written to `.output/chrome-mv3` and `.output/firefox-mv3`; release ZIPs use `.output/linguisty-0.4.10-{chrome,firefox}.zip`. Generated builds, local profiles, credentials, and caches are excluded from Git.

Acceptance requires the checks in the [testing guide](docs/guides/testing.md). Historical results distinguish browser runs, mocked provider tests, and unverified scenarios; two successful builds do not establish two working browser runtimes. Real ChatGPT access, model accuracy, native-speaker localization review, Firefox signing, and store installation remain separate checks.

