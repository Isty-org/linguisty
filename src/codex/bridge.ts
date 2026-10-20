/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
import { browser } from 'wxt/browser';
import { LinguistyError, toPublicError } from '../shared/errors';
import { byteLength, CODEX_MAX_RESPONSE, CODEX_PORT, object, validateCodexRequest } from './protocol';
import type { CodexSession } from './session';
import { translationErrorMessageReference } from './translationError';
type Port = ReturnType<typeof browser.runtime.connect>;
export function startCodexBridge(session: CodexSession): () => void {
  const ports = new Map<Port, () => void>(); let active = 0;
  const connect = (port: Port) => {
    if (port.name !== CODEX_PORT) return;
    const sender = port.sender;
    const own = browser.runtime.getURL('');
    if (sender?.id !== browser.runtime.id || sender.tab || (sender.url && ![`${own}background.js`, `${own}_generated_background_page.html`].includes(sender.url)) || ports.size >= 16) {
      port.disconnect(); return;
    }
    const pending = new Map<string, AbortController>(); let closed = false;
    const post = (value: unknown) => { if (!closed) { try { port.postMessage(value); } catch { /* Port closed. */ } } };
    const message = (value: unknown) => {
      if (!object(value) || value.version !== 1 || typeof value.id !== 'string' || !/^[\w-]{1,128}$/.test(value.id)) { cleanup(); return; }
      const id = value.id;
      if (value.type === 'cancel') { pending.get(id)?.abort(); return; }
      if (pending.has(id)) { cleanup(); return; }
      let request;
      try { request = validateCodexRequest(value.request); } catch { post({ version: 1, id, ok: false, code: 'INVALID_SETTINGS' }); return; }
      if (active >= 4) { post({ version: 1, id, ok: false, code: 'RATE_LIMIT' }); return; }
      const controller = new AbortController(); pending.set(id, controller); active++;
      void session.request(request, controller.signal).then(data => {
        if (byteLength(data) > CODEX_MAX_RESPONSE) throw new LinguistyError('INVALID_MODEL_RESPONSE');
        post({ version: 1, id, ok: true, data });
      }).catch(error => {
        const reference = error instanceof LinguistyError && error.code === 'INVALID_MODEL_RESPONSE'
          ? translationErrorMessageReference(error.message) : undefined;
        post({ version: 1, id, ok: false, code: toPublicError(error).code, ...(reference ? { reference } : {}) });
      }).finally(() => {
        pending.delete(id); active--;
      });
    };
    const disconnected = () => { void browser.runtime.lastError; cleanup(); };
    const cleanup = () => {
      if (closed) return;
      closed = true; for (const controller of pending.values()) controller.abort(); pending.clear();
      port.onMessage.removeListener(message); port.onDisconnect.removeListener(disconnected); ports.delete(port);
      try { port.disconnect(); } catch { /* Already closed. */ }
    };
    port.onMessage.addListener(message); port.onDisconnect.addListener(disconnected); ports.set(port, cleanup);
  };
  browser.runtime.onConnect.addListener(connect);
  return () => { browser.runtime.onConnect.removeListener(connect); for (const cleanup of [...ports.values()]) cleanup(); session.clear(); };
}
