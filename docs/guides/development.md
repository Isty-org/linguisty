# Developing and installing Linguisty

## Environment

Node.js 22.12+ or 24+ and npm. Chrome 120+ or Firefox 142+ desktop. In Windows PowerShell, use `npm.cmd` if `npm.ps1` is blocked. Install dependencies once at the root. The coordinator owns build settings and shared configuration.

```text
npm ci
npm run dev:chrome
npm run dev:firefox
npm run typecheck
npm run lint
npm test
npm run build:chrome
npm run build:firefox
npm run check:manifests
npm run zip:chrome
npm run zip:firefox
```

Use `dev` for interactive debugging; acceptance requires production builds. Do not leave unnecessary watch processes running.

GitHub release **0.4.10** includes MIT: [release page](https://github.com/Isty-org/linguisty/releases/tag/v0.4.10). Packages are `.output/linguisty-0.4.10-chrome.zip` and `.output/linguisty-0.4.10-firefox.zip`; release assets also include `SHA256SUMS.txt`. Extract a downloaded ZIP before following the installation steps below. The Firefox ZIP is unsigned. Full sources, including tests, are available from GitHub's Source code download for tag `v0.4.10`; run `npm ci` at the root, followed by `npm run build:chrome` or `npm run build:firefox`. Local `.me`, credentials, test results, and caches are excluded. The author and development owner is Nikita Tsyzhman ([@tsyzhman](https://github.com/tsyzhman)); see [AUTHORS](../../AUTHORS.md).

Historical checks: [QA-2026-10-13](../archive/QA-2026-10-13.md), [QA-POPUP](../archive/QA-POPUP.md), [QA-SUBSCRIPTION](../archive/QA-SUBSCRIPTION.md), and [QA-CODEX](../archive/QA-CODEX.md). Checks for the first published release are recorded separately in [QA-RELEASE-2026-10-20](../archive/QA-RELEASE-2026-10-20.md).

MIT with Nikita Tsyzhman's copyright and third-party notices are automatically included in the sources and both v0.4.10 packages; see [QA-MIT-2026-10-20](../archive/QA-MIT-2026-10-20.md).

## Chrome

Run `build:chrome`. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `.output/chrome-mv3`. Pin Linguisty. After rebuilding, reload the extension and refresh the page under test.

## Firefox

Run `build:firefox`. Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `.output/firefox-mv3/manifest.json`. Temporary add-ons disappear when Firefox restarts. Permanent installation requires Mozilla signing, which is outside local development.

**Key persistence and updates.** For daily use, install a Mozilla-signed XPI through `about:addons` → **Install Add-on From File**. Signing can be used for unlisted self-distribution without a public store listing. New versions must retain the ID `linguisty@isty.local`; install updates over the existing version without uninstalling it. The “Save on this device” mode uses `browser.storage.local` and survives restarts and updates in the same profile. After saving, the password field remains empty; check the “Key saved: on this device” status.

With a temporary installation, Firefox may remove `storage.local` along with the add-on when the browser exits. Extension code cannot prevent this. For development, Mozilla documents `extensions.webextensions.keepStorageOnUninstall=true` and `extensions.webextensions.keepUuidOnUninstall=true`; these preferences affect the entire selected profile and retain data after add-on removal. Use a separate test profile and set them manually only if development requires them. Linguisty does not change these preferences. They do not turn a temporary installation into a permanent one.

Sources: [Mozilla restart testing](https://extensionworkshop.com/documentation/develop/testing-persistent-and-restart-features/), [storage.local](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local), and [signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

## Translation settings

In options, enter OpenRouter or an OpenAI-compatible URL, your API key, model ID, and languages. Save and grant permission for the selected API origin. The key can be retained for the browser session or on this device. An empty field on reopening means the saved key is hidden. A separate action removes it.

Open the popup on an HTTP(S) page and translate. Internal browser pages, PDFs, and iframe content may be unavailable; the UI explains the restriction. Cancellation keeps completed translations. **Original** and **Translation** switch saved Text nodes without an API call.

Since 0.2.0, “Show translations progressively” is enabled by default. If the API returns SSE, complete validated phrases appear before the final response; provisional text is rolled back on cancellation or error and is not cached. Clearing the checkbox restores a regular request. APIs returning regular JSON for `stream=true` remain supported. Automatic retry without streaming is allowed only for an explicit unsupported-parameter error; otherwise switch manually. Check model support with your provider.

The error log has its own settings section. It displays sanitized provider information, retains up to 100 entries for 7 days, and allows copying or clearing the log alone. Page/request payloads and API keys are not stored in the log.

## Checks without an API key

Settings also offer **ChatGPT subscription → Connect ChatGPT**. A separate tab contains four sign-in steps, model selection, access checking, and disconnection. Keep it open. No CLI/host installation is required; API mode retains its existing behavior. See [CODEX-CONNECTION](chatgpt-connection.md) for instructions and real-preview limitations.

Unit, DOM, and API contract tests use mocked fetch and local fixtures. They verify code behavior, cancellation, and response structure. They do not establish real French-to-Russian translation accuracy. The live test is described in [TESTING](testing.md).
