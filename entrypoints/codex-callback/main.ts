/** @spec spec://modules/platform/INFRA-004-codex-connection#auth */
import { browser } from 'wxt/browser';
import { CODEX_CALLBACK_CHANNEL, CODEX_CALLBACK_URL } from '../../src/codex/protocol';
import { localizeSubscriptionCallback } from '../../src/ui/subscriptionCallback';
async function finish() {
  const callback = location.hash.slice(1);
  // Remove the short-lived authorization code from this page's address/history.
  history.replaceState(null, '', location.pathname);
  localizeSubscriptionCallback();
  if (callback.length > 8192) return;
  try {
    const url = new URL(callback);
    if (`${url.origin}${url.pathname}` !== CODEX_CALLBACK_URL || url.hash || url.username || url.password) return;
    await browser.runtime.sendMessage({ channel: CODEX_CALLBACK_CHANNEL, callback });
  } catch { /* The connection page reports the result; never render the code or raw error. */ }
}
void finish();
