/** @spec spec://modules/platform/INFRA-003-local-cli#protocol */
import { endianness } from 'node:os';
export const MAX_FRAME_BYTES = 900 * 1024;
export const PROVIDERS = ['codex-cli', 'claude-code', 'antigravity-cli', 'grok-build'];
const le = endianness() === 'LE';
export function encodeFrame(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  if (body.length > MAX_FRAME_BYTES) throw new Error('CONTEXT_TOO_LARGE');
  const header = Buffer.alloc(4);
  if (le) header.writeUInt32LE(body.length); else header.writeUInt32BE(body.length);
  return Buffer.concat([header, body]);
}
export class FrameReader {
  #buffer = Buffer.alloc(0);
  push(chunk) {
    const frames = [];
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    while (this.#buffer.length >= 4) {
      const size = le ? this.#buffer.readUInt32LE(0) : this.#buffer.readUInt32BE(0);
      if (!size || size > MAX_FRAME_BYTES) throw new Error('CONTEXT_TOO_LARGE');
      if (this.#buffer.length < size + 4) break;
      const raw = this.#buffer.subarray(4, size + 4);
      frames.push(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)));
      this.#buffer = this.#buffer.subarray(size + 4);
    }
    if (this.#buffer.length > MAX_FRAME_BYTES + 4) throw new Error('CONTEXT_TOO_LARGE');
    return frames;
  }
  end() { if (this.#buffer.length) throw new Error('INVALID_MODEL_RESPONSE'); }
  clear() { this.#buffer = Buffer.alloc(0); }
}
export function validateRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1
    || typeof value.id !== 'string' || !/^[\w-]{1,80}$/.test(value.id)) throw new Error('INVALID_SETTINGS');
  if (value.type === 'cancel') {
    if (Object.keys(value).some(k => !['version', 'id', 'type'].includes(k))) throw new Error('INVALID_SETTINGS');
    return value;
  }
  if (!['status', 'translate'].includes(value.type) || !PROVIDERS.includes(value.providerId)
    || Object.keys(value).some(k => !['version', 'id', 'type', 'providerId', 'model', 'timeoutMs', 'messages'].includes(k))
    || typeof value.model !== 'string' || value.model.length > 200 || [...value.model].some(char => char.codePointAt(0) < 32 || char.codePointAt(0) === 127)
    || !Number.isSafeInteger(value.timeoutMs) || value.timeoutMs < 1000 || value.timeoutMs > 120000) throw new Error('INVALID_SETTINGS');
  if (value.type === 'translate' && (!Array.isArray(value.messages) || value.messages.length !== 2
    || value.messages[0]?.role !== 'system' || value.messages[1]?.role !== 'user'
    || value.messages.some(m => !m || Object.keys(m).some(k => !['role', 'content'].includes(k))
      || typeof m.content !== 'string' || m.content.length > 80000))) throw new Error('INVALID_SETTINGS');
  if (value.type === 'status' && value.messages !== undefined) throw new Error('INVALID_SETTINGS');
  return value;
}
