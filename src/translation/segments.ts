/** @spec spec://modules/translation/FEAT-001-engine#dedup */
export const TARGET_BATCH_NODES = 16;
export const TARGET_BATCH_COST = 3_000;
export const MAX_LONG_NODE_CHARS = 100_000;
export const MAX_TEXT_PARTS = 128;
export const MAX_RECOVERY_DEPTH = 2;
const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const alphabet = /[\p{Script=Latin}\p{Script=Cyrillic}\p{Number}]/u;

export function firstCharacter(text: string): string { return /^./su.exec(text.slice(0, 2))?.[0] ?? ''; }
export function lastCharacter(text: string): string { return /.$/su.exec(text.slice(-2))?.[0] ?? ''; }
export function hasCjkBoundary(before: string, after: string): boolean {
  return cjk.test(lastCharacter(before) + firstCharacter(after));
}

export function textCost(text: string): number {
  let cost = 0;
  for (const letter of text) cost += cjk.test(letter) ? 3 : letter.length;
  return cost;
}

/** Preserve exact source text and Unicode boundaries, preferring sentence/word ends. */
export function splitText(text: string, maxChars: number, maxCost = maxChars): string[] {
  const parts: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start;
    let cost = 0;
    for (const letter of text.slice(start)) {
      const weight = cjk.test(letter) ? 3 : letter.length;
      if (end > start && (end - start + letter.length > maxChars || cost + weight > maxCost)) break;
      if (letter.length > maxChars) throw new RangeError('Character budget cannot hold a Unicode code point');
      end += letter.length;
      cost += weight;
    }
    if (end < text.length) {
      const prefix = text.slice(start, end);
      const boundaries = [...prefix.matchAll(/[。！？.!?](?:\s+|$)|[。！？]|\s+/gu)];
      const boundary = boundaries.reverse().find(match => match.index + match[0].length >= prefix.length / 2);
      if (boundary) end = start + boundary.index + boundary[0].length;
    }
    parts.push(text.slice(start, end));
    if (parts.length > MAX_TEXT_PARTS) throw new RangeError('Too many translation parts');
    start = end;
  }
  return parts;
}

export function joinTranslatedParts(sources: readonly string[], translations: readonly string[]): string {
  let joined = translations[0]?.trim() ?? '';
  for (let i = 1; i < translations.length; i++) {
    const next = translations[i]!.trim();
    const whitespace = /\s*$/u.exec(sources[i - 1]!)![0] + /^\s*/u.exec(sources[i]!)![0];
    const left = lastCharacter(joined);
    const right = firstCharacter(next);
    const words = alphabet.test(left) && alphabet.test(right);
    const sentence = /[.!?。！？]/u.test(left) && alphabet.test(right);
    const cjkBoundary = hasCjkBoundary(sources[i - 1]!, sources[i]!);
    const separator = whitespace.includes('\n') ? whitespace : whitespace ? ' '
      : cjkBoundary && (words || sentence) ? ' ' : '';
    joined += separator + next;
  }
  return joined;
}

/** Per-attempt timeout is separate from retries/recovery; the whole job remains bounded. */
export function batchTimeoutMs(timeoutMs: number): number {
  return Math.min(300_000, (timeoutMs * 3 + 10_000) * (2 ** (MAX_RECOVERY_DEPTH + 1) - 1));
}
