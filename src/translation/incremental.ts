/** @spec spec://modules/translation/FEAT-001-engine#validation */
import type { TranslationItem, TranslationNode } from '../shared/contracts';
import { MAX_RESPONSE_BYTES } from '../shared/constants';
import { LinguistyError } from '../shared/errors';
import { parseTranslations, validateTranslationItem } from './parser';

/** Only closed objects in the known array grammar may be previewed. Final JSON is still validated atomically. */
export class IncrementalTranslations {
  private content = '';
  private bytes = 0;
  private cursor = 0;
  private state: 'prefix' | 'value' | 'separator' | 'closing' | 'done' | 'fallback' = 'prefix';
  private start = -1;
  private depth = 0;
  private quoted = false;
  private escaped = false;
  private readonly expected: Map<string, string>;
  private readonly seen = new Map<string, string>();
  constructor(private readonly nodes: TranslationNode[], private readonly onItem: (item: TranslationItem) => void) {
    this.expected = new Map(nodes.map(node => [node.id, node.text]));
  }
  push(chunk: string): void {
    this.bytes += new TextEncoder().encode(chunk).byteLength;
    if (this.bytes > MAX_RESPONSE_BYTES) throw new LinguistyError('INVALID_MODEL_RESPONSE');
    this.content += chunk;
    if (this.state === 'prefix') {
      const prefix = /^\s*(?:```(?:json)?[ \t]*\r?\n)?\{\s*"translations"\s*:\s*\[/u.exec(this.content);
      if (!prefix) { if (this.content.length > 512) this.state = 'fallback'; return; }
      this.cursor = prefix[0].length; this.state = 'value';
    }
    if (this.state === 'fallback' || this.state === 'done') return;
    for (; this.cursor < this.content.length; this.cursor++) {
      const character = this.content[this.cursor]!;
      if (this.start >= 0) {
        if (this.quoted) {
          if (this.escaped) this.escaped = false;
          else if (character === '\\') this.escaped = true;
          else if (character === '"') this.quoted = false;
        } else if (character === '"') this.quoted = true;
        else if (character === '{') this.depth++;
        else if (character === '}' && --this.depth === 0) {
          let value: unknown;
          try { value = JSON.parse(this.content.slice(this.start, this.cursor + 1)); }
          catch { throw new LinguistyError('INVALID_MODEL_RESPONSE', undefined, true); }
          const item = validateTranslationItem(value, this.expected, this.seen);
          this.seen.set(item.id, item.text); this.start = -1; this.state = 'separator'; this.onItem(item);
        }
      } else if (/\s/u.test(character)) continue;
      else if (this.state === 'value' && character === '{') { this.start = this.cursor; this.depth = 1; }
      else if ((this.state === 'value' || this.state === 'separator') && character === ']') this.state = 'closing';
      else if (this.state === 'separator' && character === ',') this.state = 'value';
      else if (this.state === 'closing' && character === '}') { this.state = 'done'; break; }
      else throw new LinguistyError('INVALID_MODEL_RESPONSE', undefined, true);
    }
  }
  finish(): TranslationItem[] { return parseTranslations(this.content, this.nodes); }
}
