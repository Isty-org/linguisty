/** @spec spec://modules/platform/INFRA-004-codex-connection#auth */
import { browser } from 'wxt/browser';
import { LinguistyError } from '../shared/errors';
import { waitForBrowser } from '../shared/messaging';
import { createAuthAttempt, type AuthAttempt, type CodexRegistration } from './auth';
import { CODEX_CALLBACK_CHANNEL, CODEX_CALLBACK_URL, object } from './protocol';
const REGISTRATION_KEY = 'linguisty_codex_registration_v1';
export const CODEX_RULE_ID = 2201;
export async function registration(fresh = false): Promise<CodexRegistration> {
  const saved: unknown = (await browser.storage.local.get(REGISTRATION_KEY))[REGISTRATION_KEY];
  const value: CodexRegistration = object(saved) && typeof saved.hostId === 'string' && /^urn:uuid:[\w-]{36}$/.test(saved.hostId)
    ? { hostId: saved.hostId, ...(!fresh && typeof saved.clientId === 'string' && /^[\w.-]{1,200}$/.test(saved.clientId) ? { clientId: saved.clientId } : {}) }
    : { hostId: `urn:uuid:${crypto.randomUUID()}` };
  await browser.storage.local.set({ [REGISTRATION_KEY]: value });
  return value;
}
export async function saveRegistration(value: CodexRegistration): Promise<void> { await browser.storage.local.set({ [REGISTRATION_KEY]: value }); }
export function callbackRule(attempt: AuthAttempt, tabId: number, ruleId = CODEX_RULE_ID, ownerTabId?: number) {
  return { id: ruleId, priority: 1,
    action: { type: 'redirect' as const, redirect: { regexSubstitution: `${browser.runtime.getURL('/codex-callback.html')}#\\0` } },
    condition: { regexFilter: `^http://127\\.0\\.0\\.1:1455/auth/callback\\?(?:[^#]*&)?state=${attempt.state}(?:&[^#]*)?$`,
      tabIds: [tabId], ...(ownerTabId === undefined ? {} : { excludedTabIds: [ownerTabId] }), resourceTypes: ['main_frame' as const] },
  };
}
/** Call the permission request synchronously in the user click handler. */
export function requestCodexPermission(): Promise<boolean> {
  return browser.permissions.request({ origins: ['https://auth.openai.com/*', 'https://api.openai.com/*', 'http://127.0.0.1/*'] });
}
export async function authorize(registration: CodexRegistration, signal: AbortSignal): Promise<{ attempt: AuthAttempt; callback: string }> {
  if (signal.aborted) throw new LinguistyError('CANCELLED');
  const attempt = await createAuthAttempt(registration);
  const owner = await waitForBrowser(() => browser.tabs.getCurrent(), { signal });
  if (owner?.id === undefined || signal.aborted) throw new LinguistyError(signal.aborted ? 'CANCELLED' : 'CODEX_AUTH_FAILED');
  const ruleId = CODEX_RULE_ID + crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  const tab = await waitForBrowser(() => browser.tabs.create({ url: 'about:blank', active: true }), { signal });
  if (tab.id === undefined) throw new LinguistyError('CODEX_AUTH_FAILED');
  const tabId = tab.id;
  let settle: ((error?: LinguistyError, callback?: string) => void) | undefined;
  const result = new Promise<string>((resolve, reject) => { settle = (error, callback) => error ? reject(error) : resolve(callback!); });
  // Attach a rejection handler before browser operations that may fail.
  void result.catch(() => undefined);
  const abort = () => settle?.(new LinguistyError('CANCELLED'));
  const timer = setTimeout(() => settle?.(new LinguistyError('REQUEST_TIMEOUT')), 120_000);
  const removed = (id: number) => { if (id === tabId) abort(); };
  const callback = (message: unknown, sender: { id?: string; url?: string; tab?: { id?: number } }, sendResponse: (response: unknown) => void) => {
    if (!object(message) || message.channel !== CODEX_CALLBACK_CHANNEL) return;
    if (sender.id !== browser.runtime.id || sender.tab?.id !== tabId || sender.url?.split('#')[0] !== browser.runtime.getURL('/codex-callback.html')
      || typeof message.callback !== 'string' || message.callback.length > 8192) return;
    try {
      const url = new URL(message.callback);
      if (`${url.origin}${url.pathname}` !== CODEX_CALLBACK_URL || url.searchParams.get('state') !== attempt.state) return;
      settle?.(undefined, message.callback);
      sendResponse({ received: true });
      return false;
    } catch { return; }
  };
  browser.runtime.onMessage.addListener(callback); browser.tabs.onRemoved.addListener(removed); signal.addEventListener('abort', abort, { once: true });
  try {
    if (signal.aborted) throw new LinguistyError('CANCELLED');
    await waitForBrowser(() => browser.declarativeNetRequest.updateSessionRules({ addRules: [callbackRule(attempt, tabId, ruleId, owner.id)] }), { signal });
    await waitForBrowser(() => browser.tabs.update(tabId, { url: attempt.url }), { signal });
    const value = await result;
    return { attempt, callback: value };
  } finally {
    clearTimeout(timer); signal.removeEventListener('abort', abort); browser.tabs.onRemoved.removeListener(removed); browser.runtime.onMessage.removeListener(callback);
    await waitForBrowser(() => browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] })).catch(() => undefined);
    await waitForBrowser(() => browser.tabs.remove(tabId)).catch(() => undefined);
    settle = undefined;
  }
}
