/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
import type { ConnectionTestResult, ModelInfo, ProviderConfig, TranslationInput, TranslationNode, TranslationProvider, TranslationResult } from '../shared/contracts';
import { LinguistyError } from '../shared/errors';
import { codexRequest } from '../codex/client';
import { boundedText, CODEX_CONNECTION_MESSAGE, object, type CodexRequester } from '../codex/protocol';
import { throwIfCancelled } from '../translation/abort';
import { snapshotInput } from '../translation/input';
import { parseTranslations } from '../translation/parser';
import { buildTranslationMessages } from '../translation/prompt';
import { normalizeProviderConfig } from './config';
import { translationError } from '../codex/translationError';
export class CodexProvider implements TranslationProvider {
  readonly id = 'codex';
  constructor(private readonly request: CodexRequester = codexRequest) {}
  async translate(input: TranslationInput, rawConfig: ProviderConfig, signal?: AbortSignal, sourceContext?: TranslationNode[]): Promise<TranslationResult> {
    throwIfCancelled(signal);
    const config = normalizeProviderConfig(rawConfig, this.id);
    if (!config.accountScope) throw new LinguistyError('CODEX_NOT_CONNECTED');
    const snapshot = snapshotInput(input);
    if (!snapshot.nodes.length) return { translations: [], fromCache: 0 };
    const context = sourceContext === undefined ? snapshot.nodes : snapshotInput({ ...snapshot, nodes: sourceContext }).nodes;
    const value = await this.request({ type: 'translate', model: config.model, timeoutMs: config.timeoutMs,
      accountScope: config.accountScope, messages: buildTranslationMessages(snapshot, context) }, signal);
    throwIfCancelled(signal);
    if (!object(value) || typeof value.content !== 'string') throw translationError('LGT-response-content');
    try { return { translations: parseTranslations(value.content, snapshot.nodes), fromCache: 0 }; }
    catch (error) {
      if (error instanceof LinguistyError && error.code === 'INVALID_MODEL_RESPONSE') throw translationError('LGT-translation-json', error.retryable);
      throw error;
    }
  }
  async testConnection(config: ProviderConfig, signal?: AbortSignal): Promise<ConnectionTestResult> {
    await this.listModels(config, signal);
    return { success: true, message: CODEX_CONNECTION_MESSAGE };
  }
  async listModels(rawConfig: ProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]> {
    const config = normalizeProviderConfig(rawConfig, this.id, false);
    const value = await this.request({ type: 'models', timeoutMs: config.timeoutMs }, signal);
    throwIfCancelled(signal);
    if (!Array.isArray(value) || !value.length || value.length > 1_000) throw new LinguistyError('INVALID_MODEL_RESPONSE');
    const seen = new Set<string>();
    return value.map(model => {
      if (!object(model) || !boundedText(model.id, 200) || seen.has(model.id) || !boundedText(model.name, 300)) throw new LinguistyError('INVALID_MODEL_RESPONSE');
      seen.add(model.id); return { id: model.id, name: model.name };
    });
  }
}
