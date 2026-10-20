/** @spec spec://modules/translation/FEAT-001-engine#providers */
import type { TranslationItem, TranslationNode } from '../shared/contracts';
import { MAX_RESPONSE_BYTES } from '../shared/constants';
import { LinguistyError } from '../shared/errors';
import { IncrementalTranslations } from '../translation/incremental';
import { isRecord } from '../translation/parser';
import { apiDiagnostic, type DiagnosticContext } from './diagnostics';
import { envelopeError, readBounded } from './request';

/** Incremental SSE framing (LF, CRLF, CR); one bounded pending event. */
export class SseFrames {
  private buffer = '';
  private scan = 0;
  private lines: string[] = [];
  private eventChars = 0;
  private events = 0;
  constructor(private readonly onData: (data: string) => void) {}
  push(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length + this.eventChars > MAX_RESPONSE_BYTES) throw new LinguistyError('INVALID_MODEL_RESPONSE');
    let start = 0;
    for (; this.scan < this.buffer.length; this.scan++) {
      const character = this.buffer[this.scan];
      if (character !== '\r' && character !== '\n') continue;
      if (character === '\r' && this.scan === this.buffer.length - 1) break;
      this.line(this.buffer.slice(start, this.scan));
      if (character === '\r' && this.buffer[this.scan + 1] === '\n') this.scan++;
      start = this.scan + 1;
    }
    this.buffer = this.buffer.slice(start); this.scan -= start;
  }
  finish(): void { if (this.buffer.endsWith('\r')) this.push('\n'); }
  private line(line: string): void {
    if (!line) {
      if (this.lines.length) {
        if (++this.events > 16_384) throw new LinguistyError('INVALID_MODEL_RESPONSE');
        this.onData(this.lines.join('\n'));
      }
      this.lines = []; this.eventChars = 0;
    } else if (line.startsWith('data:')) {
      const value = line.slice(5).replace(/^ /u, '');
      this.eventChars += value.length;
      if (this.eventChars > MAX_RESPONSE_BYTES) throw new LinguistyError('INVALID_MODEL_RESPONSE');
      this.lines.push(value);
    }
  }
}

export async function readChatStream(response: Response, nodes: TranslationNode[], signal: AbortSignal, onItem: (item: TranslationItem) => void, _context: DiagnosticContext): Promise<TranslationItem[]> {
  let done = false;
  let finished = false;
  const parser = new IncrementalTranslations(nodes, onItem);
  const fail = () => { throw new LinguistyError('INVALID_MODEL_RESPONSE', undefined, true); };
  const frames = new SseFrames(data => {
    if (done) return;
    if (data === '[DONE]') { if (!finished) fail(); done = true; return; }
    let event: unknown;
    try { event = JSON.parse(data); } catch { fail(); }
    if (!isRecord(event)) return fail();
    const choices = event.choices;
    const choice: unknown = Array.isArray(choices) ? choices[0] : undefined;
    const error = event.error ?? (isRecord(choice) ? choice.error : undefined);
    if (error !== undefined && error !== null) {
      const failure = envelopeError(error);
      failure.diagnostic = apiDiagnostic(error, response.status);
      throw failure;
    }
    if (Array.isArray(choices) && choices.length === 0 && isRecord(event.usage)) return;
    if (!Array.isArray(choices) || choices.length !== 1 || !isRecord(choice) || (choice.index !== undefined && choice.index !== 0)) return fail();
    if (choice.finish_reason === 'error') throw new LinguistyError('PROVIDER_UNAVAILABLE', undefined, true);
    if (choice.finish_reason === 'length') throw new LinguistyError('CONTEXT_TOO_LARGE');
    if (choice.finish_reason != null && choice.finish_reason !== 'stop') return fail();
    const delta = isRecord(choice.delta) ? choice.delta : {};
    if (delta.refusal || delta.tool_calls || (delta.content != null && typeof delta.content !== 'string')) return fail();
    if (typeof delta.content === 'string' && delta.content) {
      if (finished) return fail();
      parser.push(delta.content);
    }
    if (choice.finish_reason === 'stop') finished = true;
  });
  await readBounded(response, signal, chunk => { frames.push(chunk); return !done; });
  frames.finish();
  if (!done || !finished) fail();
  return parser.finish();
}
