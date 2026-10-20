/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
import { LinguistyError } from '../shared/errors';
import { CODEX_MAX_RESPONSE, object } from './protocol';
import { httpError } from './http';
import { translationError } from './translationError';

const MAX_OUTPUT_ITEMS = 128;
interface MessageText { text: string; commentary: boolean }

/** Retain only final text and fixed phase information, never arbitrary item metadata. */
function messageText(item: unknown): MessageText | undefined {
  if (!object(item) || item.type !== 'message') return;
  if (item.role !== 'assistant' || !Array.isArray(item.content)) throw translationError('LGT-response-message');
  if (item.phase === 'commentary') return { text: '', commentary: true };
  if (item.phase != null && item.phase !== 'final_answer') throw translationError('LGT-response-phase');
  if (item.status !== undefined && item.status !== 'completed') throw translationError('LGT-response-status');
  let text = '';
  for (const part of item.content) {
    if (object(part) && part.type === 'refusal') throw translationError('LGT-response-refusal');
    if (!object(part) || part.type !== 'output_text' || typeof part.text !== 'string') throw translationError('LGT-response-part');
    text += part.text;
  }
  return { text, commentary: false };
}

function joinedText(messages: Iterable<MessageText>): MessageText {
  let text = ''; let commentary = false;
  for (const message of messages) { text += message.text; commentary ||= message.commentary; }
  return { text, commentary };
}

function failed(value: unknown): never {
  const error = object(value) && object(value.error) ? value.error : value;
  const code = object(error) ? error.code : undefined;
  throw new LinguistyError(code === 'subscription_sharing_usage_limit_exceeded' || code === 'rate_limit_exceeded' ? 'RATE_LIMIT'
    : code === 'subscription_sharing_usage_unavailable' ? 'CODEX_PLAN_REQUIRED'
    : code === 'context_length_exceeded' ? 'CONTEXT_TOO_LARGE' : 'PROVIDER_UNAVAILABLE');
}
export async function readResponses(response: Response): Promise<string> {
  if (!response.ok) { await response.body?.cancel().catch(() => undefined); throw httpError(response.status); }
  if (!response.body) throw translationError('LGT-response-body');
  const reader = response.body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = ''; let eventData: string[] = []; let bytes = 0;
  const completedMessages = new Map<number, MessageText>();
  function event(): string | undefined {
    if (!eventData.length) return;
    const data = eventData.join('\n'); eventData = [];
    if (data === '[DONE]') throw translationError('LGT-response-completion');
    let value: unknown;
    try { value = JSON.parse(data); } catch { throw translationError('LGT-response-json'); }
    if (!object(value)) throw translationError('LGT-response-json');
    if (value.type === 'response.failed' || value.type === 'error') failed(value.response ?? value.error ?? value);
    if (value.type === 'response.incomplete') throw translationError('LGT-response-completion');
    if (value.type === 'response.output_item.done') {
      if (!object(value.item)) throw translationError('LGT-response-message');
      const message = messageText(value.item);
      if (!message) return;
      if (!Number.isSafeInteger(value.output_index) || (value.output_index as number) < 0
        || (value.output_index as number) >= MAX_OUTPUT_ITEMS) throw translationError('LGT-response-output');
      const index = value.output_index as number;
      const previous = completedMessages.get(index);
      if (previous && (previous.text !== message.text || previous.commentary !== message.commentary)) throw translationError('LGT-response-conflict');
      completedMessages.set(index, message);
      return;
    }
    if (value.type !== 'response.completed') return;
    if (!object(value.response) || value.response.status !== 'completed') throw translationError('LGT-response-completion');
    const output = value.response.output ?? [];
    if (!Array.isArray(output)) throw translationError('LGT-response-output');
    if (output.length > MAX_OUTPUT_ITEMS) throw translationError('LGT-response-limit');
    const messages = new Map(completedMessages);
    for (const [index, item] of output.entries()) {
      const terminal = messageText(item);
      const previous = messages.get(index);
      if (previous && (!terminal || previous.commentary !== terminal.commentary
        || (previous.text && terminal.text && previous.text !== terminal.text))) throw translationError('LGT-response-conflict');
      if (terminal && (!previous?.text || terminal.text)) messages.set(index, terminal);
    }
    const result = joinedText([...messages].sort(([first], [second]) => first - second).map(([, message]) => message));
    const content = result.text;
    if (!content) throw translationError(result.commentary ? 'LGT-response-commentary' : 'LGT-response-empty');
    if (new TextEncoder().encode(content).byteLength > CODEX_MAX_RESPONSE) throw translationError('LGT-response-limit');
    return content;
  }
  function lines(final = false): string | undefined {
    let ending: RegExpExecArray | null;
    while ((ending = /\r\n|\r|\n/.exec(buffer))) {
      // Keep a trailing CR until the next chunk determines CRLF versus CR.
      if (!final && ending[0] === '\r' && ending.index === buffer.length - 1) break;
      const line = buffer.slice(0, ending.index); buffer = buffer.slice(ending.index + ending[0].length);
      if (!line) { const result = event(); if (result !== undefined) return result; }
      else if (line.startsWith('data:')) eventData.push(line.slice(5).replace(/^ /, ''));
    }
    if (final) {
      if (buffer.startsWith('data:')) eventData.push(buffer.slice(5).replace(/^ /, '').replace(/\r$/, ''));
      buffer = ''; return event();
    }
  }
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > CODEX_MAX_RESPONSE) throw translationError('LGT-response-limit');
      buffer += decoder.decode(chunk.value, { stream: true });
      const result = lines(); if (result !== undefined) return result;
    }
    buffer += decoder.decode();
    const result = lines(true);
    if (result === undefined) throw translationError('LGT-response-completion');
    return result;
  } catch (error) { if (error instanceof LinguistyError) throw error; throw translationError('LGT-response-body'); }
  finally { completedMessages.clear(); buffer = ''; eventData = []; await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
