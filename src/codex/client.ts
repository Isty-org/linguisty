/** @spec spec://modules/platform/INFRA-004-codex-connection#resources */
import { browser } from 'wxt/browser';
import { isErrorCode, LinguistyError } from '../shared/errors';
import { throwIfCancelled } from '../translation/abort';
import { byteLength, CODEX_MAX_RESPONSE, CODEX_PORT, object, validateCodexRequest, type CodexRequester } from './protocol';
import { translationError, translationErrorReference } from './translationError';
type Port = ReturnType<typeof browser.runtime.connect>;
interface Pending { finish(error?: LinguistyError, data?: unknown): void }
export class CodexClient {
  private port?: Port;
  private idle?: ReturnType<typeof setTimeout>;
  private readonly pending = new Map<string, Pending>();
  constructor(private readonly connect: () => Port = () => browser.runtime.connect({ name: CODEX_PORT })) {}
  get pendingCount(): number { return this.pending.size; }
  get connected(): boolean { return !!this.port; }
  readonly request: CodexRequester = (rawRequest, signal) => {
    throwIfCancelled(signal);
    const request = validateCodexRequest(rawRequest);
    if (this.pending.size >= 16) return Promise.reject(new LinguistyError('RATE_LIMIT'));
    clearTimeout(this.idle); this.idle = undefined;
    let port: Port;
    try {
      if (!this.port) {
        this.port = this.connect(); this.port.onMessage.addListener(this.onMessage); this.port.onDisconnect.addListener(this.onDisconnect);
      }
      port = this.port;
    } catch { return Promise.reject(new LinguistyError('CODEX_NOT_CONNECTED')); }
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      let finished = false;
      const finish = (error?: LinguistyError, data?: unknown) => {
        if (finished) return;
        finished = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); this.pending.delete(id);
        if (!this.pending.size) this.idle = setTimeout(() => this.disconnect(), 100);
        if (error) reject(error); else resolve(data);
      };
      const cancel = (code: 'CANCELLED' | 'REQUEST_TIMEOUT') => {
        try { port.postMessage({ version: 1, type: 'cancel', id }); } catch { /* Page already closed. */ }
        finish(new LinguistyError(code));
      };
      const abort = () => cancel('CANCELLED');
      const timer = setTimeout(() => cancel('REQUEST_TIMEOUT'), request.timeoutMs);
      this.pending.set(id, { finish }); signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      try { port.postMessage({ version: 1, id, request }); } catch { finish(new LinguistyError('CODEX_NOT_CONNECTED')); }
    });
  };
  private readonly onMessage = (message: unknown) => {
    if (!object(message) || message.version !== 1 || typeof message.id !== 'string' || byteLength(message) > CODEX_MAX_RESPONSE + 4096) {
      this.fail(new LinguistyError('INVALID_MODEL_RESPONSE')); return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    if (message.ok === true) pending.finish(undefined, message.data);
    else if (message.ok === false && isErrorCode(message.code)) {
      const reference = message.code === 'INVALID_MODEL_RESPONSE' ? translationErrorReference(message.reference) : undefined;
      pending.finish(reference ? translationError(reference) : new LinguistyError(message.code));
    }
    else pending.finish(new LinguistyError('INVALID_MODEL_RESPONSE'));
  };
  private readonly onDisconnect = () => { void browser.runtime.lastError; this.fail(new LinguistyError('CODEX_NOT_CONNECTED')); };
  private fail(error: LinguistyError) { for (const entry of [...this.pending.values()]) entry.finish(error); this.disconnect(); }
  disconnect(): void {
    clearTimeout(this.idle); this.idle = undefined;
    const port = this.port; this.port = undefined;
    if (port) {
      port.onMessage.removeListener(this.onMessage); port.onDisconnect.removeListener(this.onDisconnect);
      try { port.disconnect(); } catch { /* Page already closed. */ }
    }
  }
  dispose(): void { this.fail(new LinguistyError('CANCELLED')); }
}
const client = new CodexClient();
export const codexRequest = client.request;
