import type { ProviderConfig, TranslationInput } from '../shared/contracts';
import { PROMPT_VERSION } from '../shared/constants';
import { normalizeBaseUrl } from '../storage/normalization';
import { LinguistyError } from '../shared/errors';

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** @spec spec://modules/storage/INFRA-002-local-data#cache.key */
export async function buildCacheKey(text: string, input: TranslationInput, config: ProviderConfig): Promise<string> {
  // @spec spec://modules/platform/INFRA-004-codex-connection#requests
  if (config.providerId === 'codex' && (typeof config.accountScope !== 'string' || !/^[a-f0-9]{64}$/.test(config.accountScope))) {
    throw new LinguistyError('CODEX_NOT_CONNECTED');
  }
  // Project context explicitly: API keys, request timeouts and node IDs never enter the digest.
  // Capture the complete context before the first async boundary.
  const context = {
    promptVersion: PROMPT_VERSION,
    text,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    providerId: config.providerId,
    ...(config.providerId === 'codex' ? { accountScope: config.accountScope } : {}),
    baseUrl: normalizeBaseUrl(config.baseUrl),
    model: config.model,
    style: input.style,
    instructionsHash: '',
    batchContext: input.nodes.map((node) => ({ text: node.text, group: node.group ?? null })),
    pageContext: {
      title: input.pageContext.title,
      domain: input.pageContext.domain,
      contentType: input.pageContext.contentType ?? null,
    },
  };
  context.instructionsHash = await sha256(input.customInstructions);
  return sha256(JSON.stringify(context));
}
