/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
import type { ModelInfo } from '../shared/contracts';
import { LinguistyError } from '../shared/errors';

export const CODEX_PORT = 'linguisty-codex-v1';
export const CODEX_CALLBACK_CHANNEL = 'linguisty-codex-callback';
export const CODEX_CALLBACK_URL = 'http://127.0.0.1:1455/auth/callback';
export const CODEX_AUTH_ORIGIN = 'https://auth.openai.com';
export const CODEX_API_ORIGIN = 'https://api.openai.com';
export const CODEX_MAX_PAYLOAD = 900 * 1024;
export const CODEX_MAX_RESPONSE = 1024 * 1024;
export const CODEX_CONNECTION_MESSAGE = 'Вход подтверждён, список моделей доступен. Ответ модели не проверялся.';
export interface CodexStatus { connected: boolean; email?: string; accountScope?: string }
export interface CodexPrompt { role: 'system' | 'user'; content: string }
export type CodexRequest = { timeoutMs: number } & (
  | { type: 'status' } | { type: 'models' }
  | { type: 'translate'; model: string; accountScope: string; messages: CodexPrompt[] }
);
export type CodexReply = CodexStatus | ModelInfo[] | { content: string };
export type CodexRequester = (request: CodexRequest, signal?: AbortSignal) => Promise<unknown>;
export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function byteLength(value: unknown): number { return new TextEncoder().encode(JSON.stringify(value)).byteLength; }
export function boundedText(value: unknown, max: number, empty = false): value is string {
  return typeof value === 'string' && value.length <= max && (empty || value.length > 0)
    && !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
export function validateCodexRequest(value: unknown): CodexRequest {
  if (!object(value) || !Number.isInteger(value.timeoutMs) || (value.timeoutMs as number) < 1000
    || (value.timeoutMs as number) > 120_000 || byteLength(value) > CODEX_MAX_PAYLOAD) throw new LinguistyError('INVALID_SETTINGS');
  const timeoutMs = value.timeoutMs as number;
  if (value.type === 'status' || value.type === 'models') return { type: value.type, timeoutMs };
  if (value.type !== 'translate' || !boundedText(value.model, 200) || typeof value.accountScope !== 'string' || !/^[a-f0-9]{64}$/.test(value.accountScope) || !Array.isArray(value.messages)
    || value.messages.length !== 2 || value.messages.some((message, index) => !object(message)
      || message.role !== (index === 0 ? 'system' : 'user') || typeof message.content !== 'string'
      || !message.content.length || message.content.length > 80_000 || message.content.includes('\0'))) throw new LinguistyError('INVALID_SETTINGS');
  return { type: 'translate', model: value.model, accountScope: value.accountScope, timeoutMs,
    messages: value.messages.map(message => ({ role: message.role as 'system' | 'user', content: message.content as string })) };
}
