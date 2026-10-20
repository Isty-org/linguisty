import type { TranslationInput } from '../shared/contracts';
import { DEFAULT_SETTINGS } from '../shared/constants';
import { LinguistyError } from '../shared/errors';

/** @spec spec://modules/translation/FEAT-001-engine#dedup */
export function snapshotInput(input: TranslationInput): TranslationInput {
  if (!input || !Array.isArray(input.nodes) || !input.pageContext
    || typeof input.pageContext.title !== 'string' || input.pageContext.title.length > 300
    || typeof input.pageContext.domain !== 'string' || input.pageContext.domain.length > 253
    || (input.pageContext.contentType !== undefined && (typeof input.pageContext.contentType !== 'string' || input.pageContext.contentType.length > 128))
    || typeof input.sourceLanguage !== 'string' || !input.sourceLanguage.trim() || input.sourceLanguage.length > 64
    || typeof input.targetLanguage !== 'string' || !input.targetLanguage.trim() || input.targetLanguage.length > 64
    || !['natural', 'accurate', 'literal'].includes(input.style)
    || typeof input.customInstructions !== 'string' || input.customInstructions.length > 4_000) {
    throw new LinguistyError('INVALID_SETTINGS');
  }
  if (input.nodes.length > DEFAULT_SETTINGS.maxNodesPerBatch) throw new LinguistyError('CONTEXT_TOO_LARGE');
  const ids = new Set<string>();
  let chars = 0;
  const nodes = input.nodes.map(node => {
    if (!node || typeof node.id !== 'string' || !node.id || node.id.length > 512 || ids.has(node.id)
      || typeof node.text !== 'string'
      || (node.group !== undefined && (typeof node.group !== 'string' || node.group.length > 512))) {
      throw new LinguistyError('INVALID_SETTINGS');
    }
    ids.add(node.id);
    chars += node.text.length;
    if (chars > DEFAULT_SETTINGS.maxCharsPerBatch) throw new LinguistyError('CONTEXT_TOO_LARGE');
    return { id: node.id, text: node.text, ...(node.group === undefined ? {} : { group: node.group }) };
  });
  return { ...input, pageContext: { ...input.pageContext }, nodes };
}
