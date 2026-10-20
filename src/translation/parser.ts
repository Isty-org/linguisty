import type { TranslationItem, TranslationNode } from '../shared/contracts';
import { MAX_RESPONSE_BYTES } from '../shared/constants';
import { LinguistyError } from '../shared/errors';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalid(retryable = true): never {
  throw new LinguistyError('INVALID_MODEL_RESPONSE', undefined, retryable);
}

/** @spec spec://modules/translation/FEAT-001-engine#validation */
export function validateTranslationItem(item: unknown, expected: ReadonlyMap<string, string>, seen: ReadonlyMap<string, string>): TranslationItem {
  if (!isRecord(item) || Object.keys(item).length !== 2 || typeof item.id !== 'string'
    || !expected.has(item.id) || seen.has(item.id) || typeof item.text !== 'string'
    || ((expected.get(item.id) ?? '').trim() && !item.text.trim())) invalid();
  return { id: item.id, text: item.text };
}

/** @spec spec://modules/translation/FEAT-001-engine#validation */
export function parseTranslations(content: string, nodes: TranslationNode[]): TranslationItem[] {
  if (typeof content !== 'string') invalid();
  if (new TextEncoder().encode(content).byteLength > MAX_RESPONSE_BYTES) invalid(false);
  let json = content.trim();
  if (json.startsWith('```')) {
    const fence = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n?```$/i.exec(json);
    if (!fence) invalid();
    json = fence[1] ?? '';
  }
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { invalid(); }
  if (!isRecord(parsed) || Object.keys(parsed).length !== 1 || !Array.isArray(parsed.translations)
    || parsed.translations.length !== nodes.length) invalid();
  const expected = new Map(nodes.map(node => [node.id, node.text]));
  if (expected.size !== nodes.length) invalid(false);
  const result = new Map<string, string>();
  for (const item of parsed.translations) {
    const valid = validateTranslationItem(item, expected, result);
    result.set(valid.id, valid.text);
  }
  return nodes.map(node => ({ id: node.id, text: result.get(node.id)! }));
}
