# Linguisty through an installed CLI

Historical guide for version 0.3.0. The current UI offers [ChatGPT subscription](chatgpt-connection.md) and API providers; the CLI adapters below remain for runtime compatibility.

Before: the extension called OpenRouter or an OpenAI-compatible API with your key. After: **Codex, Claude Code, Antigravity CLI, or Grok Build** could also be selected, using an official CLI installed and authenticated on your computer.

These are the user's own tools: Codex CLI (including the binary bundled with Codex desktop), Claude Code, agy Antigravity, and grok Grok Build. Linguisty starts a separate short translation. Sign-in happens in the original CLI; the extension does not manage existing application chats.

The UI, model selection, starting, cancellation, and original-text display are in the extension. Chrome/Firefox do not let extensions start system programs directly; [Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) provides that connection. Install the connector once; the browser then starts it when needed. No permanently open terminal or separate server is required.

## Windows installation

1. Install the new Linguisty build for your browser. In Chrome, retain and update the same unpacked extension folder: changing the path changes the ID and its separate settings.
2. Install the desired official CLI and sign in normally. Antigravity needs the headless agy command; installing the editor alone does not establish availability. Access to ordinary Grok chat does not establish access to Grok Build.
3. The connector needs [Node.js 22.12+](https://nodejs.org/en/download). An existing installation does not need to be replaced.
4. Choose the CLI in Linguisty settings. For Chrome, copy the displayed extension ID for connector installation.
5. Extract `.output/linguisty-0.3.0-cli-helper.zip` and double-click `INSTALL.cmd`. Enter the Chrome ID; for Firefox, the field can be left empty. Administrator access is not needed.
6. Click **Save settings**, accept permission to communicate with local programs, then click **Test connection**.
7. Keep model `default` or enter an available CLI model ID. Open a page and click **Translate page**.

The development installer is `native-host/install.ps1`. From PowerShell: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File native-host/install.ps1 -ChromeId ID_FROM_SETTINGS`; for Firefox alone, use `-FirefoxOnly`.

The installer copies the connector to `%LOCALAPPDATA%\Linguisty\native-host` and registers **only** `com.linguisty.cli` under HKCU for the browsers. API settings and third-party CLI sign-ins are preserved. Run the installer with `-Uninstall` to unregister it; installed files and unrelated accounts are retained.

## What the check button verifies

“Connector connected, CLI found. Account sign-in and model response were not tested” means exactly that. The button locates the executable through the local filesystem without making a model request. “Load model list” offers `default` for CLI providers, without promising an account model catalog. An ID can be entered manually.

If the connector is not found, reinstall it with the current Chrome ID and restart the browser. If the CLI is not found, install the official CLI and reinstall the connector. If the CLI requests sign-in, sign in within that CLI.

## Limitations

The CLI runs on your computer, but these models run in the cloud. Translation consumes the selected tool's account limits and budget; offline translation and free unlimited access are not promised. Linguisty does not read token files, copy accounts, or replace the official CLI.

Each text batch starts a new process, which is slower than a direct API call. CLI mode runs one translation at a time, disables progressive text display, and selects a 120-second timeout. Caching and deduplication reduce repeat requests. Cancellation stops further extension work but does not guarantee reversal of cloud charges already incurred.

The Windows installer is supported. Compatibility with a particular CLI version and a real model response require separate checks. No live model requests were made during this acceptance run; exact results are in [QA-CLI](../archive/QA-CLI.md). A third-party CLI may retain its own history/cache, which Linguisty does not clear.
