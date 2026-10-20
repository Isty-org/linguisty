/** @spec spec://modules/platform/INFRA-003-local-cli#protocol */
import { browser } from 'wxt/browser';
import type { CliProviderId } from '../shared/contracts';
import { CLI_HOST } from '../shared/providers';
import { LinguistyError, isErrorCode } from '../shared/errors';
import { throwIfCancelled } from '../translation/abort';
import { isRecord } from '../translation/parser';

export interface NativeRequest {
  type: 'status' | 'translate';
  providerId: CliProviderId;
  model: string;
  timeoutMs: number;
  messages?: { role: 'system' | 'user'; content: string }[];
}
export type NativeRequester = (request: NativeRequest, signal?: AbortSignal) => Promise<unknown>;
type Port = ReturnType<typeof browser.runtime.connectNative>;
interface Pending { finish(error?: LinguistyError, data?: unknown): void }
const MAX_FRAME_BYTES = 900 * 1024;
const hostCodes = new Set(['CLI_NOT_FOUND', 'CLI_LOGIN_REQUIRED', 'CLI_EXECUTION_FAILED',
  'REQUEST_TIMEOUT', 'CANCELLED', 'RATE_LIMIT', 'CONTEXT_TOO_LARGE', 'INVALID_MODEL_RESPONSE']);

/** One short-lived port per background context; no retained text after settlement. */
export class NativeClient {
  private port?: Port;
  private idle?: ReturnType<typeof setTimeout>;
  private readonly pending = new Map<string, Pending>();
  constructor(private readonly connect: () => Port = () => browser.runtime.connectNative(CLI_HOST)) {}
  get pendingCount(): number { return this.pending.size; }
  get connected(): boolean { return this.port !== undefined; }

  readonly request: NativeRequester = (request, signal) => {
    throwIfCancelled(signal);
    if (this.pending.size >= 16) return Promise.reject(new LinguistyError('RATE_LIMIT'));
    clearTimeout(this.idle);
    this.idle = undefined;
    let port: Port;
    try {
      if (!this.port) {
        this.port = this.connect();
        this.port.onMessage.addListener(this.onMessage);
        this.port.onDisconnect.addListener(this.onDisconnect);
      }
      port = this.port;
    } catch { return Promise.reject(new LinguistyError('CLI_HOST_MISSING')); }
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      let finished = false;
      const finish = (error?: LinguistyError, data?: unknown) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        this.pending.delete(id);
        if (!this.pending.size) this.idle = setTimeout(() => this.disconnect(), 100);
        if (error) reject(error); else resolve(data);
      };
      const cancel = (code: 'CANCELLED' | 'REQUEST_TIMEOUT') => {
        try { port.postMessage({ version: 1, type: 'cancel', id }); } catch { /* Host may already be gone. */ }
        finish(new LinguistyError(code));
      };
      const abort = () => cancel('CANCELLED');
      const timer = setTimeout(() => cancel('REQUEST_TIMEOUT'), request.timeoutMs);
      this.pending.set(id, { finish });
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      try {
        const message = { version: 1, id, ...request };
        if (new TextEncoder().encode(JSON.stringify(message)).byteLength > MAX_FRAME_BYTES) {
          finish(new LinguistyError('CONTEXT_TOO_LARGE'));
        } else port.postMessage(message);
      } catch { finish(new LinguistyError('CLI_HOST_MISSING')); }
    });
  };

  private readonly onMessage = (message: unknown) => {
    if (!isRecord(message) || message.version !== 1 || typeof message.id !== 'string'
      || new TextEncoder().encode(JSON.stringify(message)).byteLength > MAX_FRAME_BYTES) {
      this.fail(new LinguistyError('INVALID_MODEL_RESPONSE')); return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    if (message.ok === true) pending.finish(undefined, message.data);
    else if (message.ok === false && hostCodes.has(String(message.code)) && isErrorCode(message.code)) {
      pending.finish(new LinguistyError(message.code));
    } else pending.finish(new LinguistyError('INVALID_MODEL_RESPONSE'));
  };
  private readonly onDisconnect = () => {
    // Consume Chrome lastError without retaining/logging its raw text.
    void browser.runtime.lastError;
    this.fail(new LinguistyError('CLI_HOST_MISSING'));
  };
  private fail(error: LinguistyError) {
    for (const entry of [...this.pending.values()]) entry.finish(error);
    this.disconnect();
  }
  disconnect(): void {
    clearTimeout(this.idle); this.idle = undefined;
    const port = this.port; this.port = undefined;
    if (port) {
      port.onMessage.removeListener(this.onMessage);
      port.onDisconnect.removeListener(this.onDisconnect);
      try { port.disconnect(); } catch { /* Already disconnected. */ }
    }
  }
  dispose(): void { this.fail(new LinguistyError('CANCELLED')); }
}
const client = new NativeClient();
export const nativeRequest: NativeRequester = client.request;
