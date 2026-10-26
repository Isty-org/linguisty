# Connecting a ChatGPT subscription in Linguisty 0.4.3

In settings, choose **ChatGPT subscription** and click **Connect ChatGPT**. A separate extension page opens with instructions. Clicking again returns to the same tab. The name, instructions, buttons, statuses, errors, and sign-in return page follow the selected interface language: all 16 Linguisty languages are available. Automatic selection uses the browser language, with English as the fallback for unsupported languages.

If Firefox stayed on `about:blank` after OpenAI confirmation or displayed “Could not confirm sign-in,” update the extension to 0.4.3. For a temporary installation from `.output/firefox-mv3`, open `about:debugging#/runtime/this-firefox` and click **Reload** for Linguisty. Close old connection/sign-in tabs and start a new attempt from settings. Version 0.4.2 fixed access from the OpenAI page to the extension return page; 0.4.3 fixed rejection of a valid sign-in confirmation format. Real sign-in and plan availability for your account still require user verification.

If the error recurs, report its text and bracketed code, such as `[LGT-token-http-401]` or `[LGT-identity-nonce]`. The code identifies the step and reason for failure, contains no tokens, return address, or account data, and is not saved to the log. Do not send the full OpenAI page address, server response contents, or tokens. Generic text without this code cannot establish the cause.

1. Click **Sign in with ChatGPT**. The official OpenAI page opens in a new tab. Sign in to your account.
2. Allow Linguisty to use your eligible ChatGPT plan. Your account/plan must support the connection; OpenAI may refuse access.
3. After sign-in, the check result and available models appear. Keep `default` or select a model and save. The check retrieves the model list; it does not translate text or test a model response.
4. Click **Return to settings**, open the desired site, and use **Translate page** in Linguisty. The connection tab stays open.

**Keep the connection tab open.** Tokens exist only in its memory. Closing, reloading, or browser unloading of this tab, or restarting the browser, requires signing in again. After a lost connection, the popup points to settings; the background does not report a successful translation.

This mode needs neither an API key nor additional software. The model runs in OpenAI's cloud: page text and limited context are sent to OpenAI, and translation uses shared ChatGPT account limits. Linguisty has no project server, shared key, or telemetry. The name reflects connection to an eligible ChatGPT plan: [OpenAI explanation](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites).

The page offers sign-in cancellation, an access check, disconnection, and switching accounts. Disconnecting always clears the local session; if OpenAI does not confirm revocation, the page says so and suggests checking app access in ChatGPT settings. API providers remain available.

In 0.4.6, translation requests strict JSON; intermediate model messages are separated from the final answer. The reader retains completed stream messages until overall completion is confirmed. Empty final output does not discard text already received; repeats are deduplicated. Facts and limitations: [QA-SUBSCRIPTION](../archive/QA-SUBSCRIPTION.md).

“The model returned an invalid response” includes a safe code. `LGT-response-empty` means no final text in either the stream or the last event; `LGT-response-commentary` means only intermediate messages were present; `LGT-response-phase/status/message/part/output` identifies an invalid phase, status, message shape, part, index, or output shape; `LGT-response-conflict` means the stream and final event disagree. `LGT-response-content` remains the code for invalid internal response content; before 0.4.6, it covered several reader failures.

Other causes: `LGT-response-completion` means an incomplete response; `LGT-response-json`, invalid event JSON; `LGT-response-refusal`, model refusal; `LGT-response-limit`, a limit exceeded; `LGT-response-body`, a missing or damaged stream; `LGT-translation-json`, final JSON inconsistent with the segment set. To report a failure, send only the code and model name. Codes contain no raw response, tokens, or page text. Reconnect ChatGPT after updating the extension.

This integrates the official [Sign in with ChatGPT preview for OSS/local applications](https://developers.openai.com/siwc/token-sharing-open-source/sign-in). The protocol and browser transitions were tested with mocked responses in Chrome/Firefox; real sign-in, plan availability for your account, app distribution restrictions, and model responses/accuracy remain unverified. Real sign-in and OpenAI's terms must be checked before store publication; publication was outside this task.

Legacy CLI adapters remain for internal compatibility but no longer appear in the provider list. Opening old CLI settings displays **ChatGPT subscription** in the form; saved data changes only after you save or connect.

Access, refresh, and ID tokens are not written to browser.storage/localStorage/IndexedDB, page addresses, logs, or background messages. The one-time OAuth code is passed only to finish its own sign-in attempt; the callback clears the address before forwarding it and closes. Only nonsecret app registration IDs are persisted. The translation cache is isolated by the verified account. The temporary sign-in return rule is bound to its own tab and one-time state; it does not intercept other apps' sign-ins.
