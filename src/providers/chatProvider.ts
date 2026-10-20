import type { ApiErrorInput, ApiOperation, ConnectionTestResult, ModelInfo, ProviderConfig, ProviderId, TranslationInput, TranslationItem, TranslationNode, TranslationProgress, TranslationProvider, TranslationResult } from '../shared/contracts';
import { MODEL_CACHE_TTL_MS, MODEL_MAX_ENTRIES } from '../shared/constants';
import { LinguistyError, toPublicError } from '../shared/errors';
import { throwIfCancelled, withSignal } from '../translation/abort';
import { snapshotInput } from '../translation/input';
import { isRecord, parseTranslations } from '../translation/parser';
import { buildTranslationMessages, translationResponseFormat } from '../translation/prompt';
import { containsControlCharacters, credentialScope, normalizeProviderConfig } from './config';
import { envelopeError, performRequest } from './request';
import { readChatStream } from './stream';
import type { NativeRequester } from './nativeClient';
import type { CodexRequester } from '../codex/protocol';

export interface ProviderOptions { fetchImpl?: typeof fetch; nativeRequest?: NativeRequester; codexRequest?: CodexRequester; onError?: (entry: ApiErrorInput) => Promise<void> | void }

function invalidResponse(): never { throw new LinguistyError('INVALID_MODEL_RESPONSE', undefined, true); }

/** @spec spec://modules/translation/FEAT-001-engine#providers */
export abstract class ChatProvider implements TranslationProvider {
  abstract readonly id: ProviderId;
  protected structuredOutput = false;
  private readonly fetchImpl: typeof fetch;
  private readonly onError?: ProviderOptions['onError'];
  private modelCache?: { scope: string; expiresAt: number; models: ModelInfo[] };

  constructor(options: ProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
    this.onError = options.onError;
  }

  async translate(input: TranslationInput, rawConfig: ProviderConfig, signal?: AbortSignal, sourceContext?: TranslationNode[], onProgress?: (progress: TranslationProgress) => void): Promise<TranslationResult> {
    return this.translateOperation(input, rawConfig, signal, sourceContext, 'translate', onProgress);
  }

  private async translateOperation(input: TranslationInput, rawConfig: ProviderConfig, signal: AbortSignal | undefined, sourceContext: TranslationNode[] | undefined, operation: ApiOperation, onProgress?: (progress: TranslationProgress) => void): Promise<TranslationResult> {
    throwIfCancelled(signal);
    const config = normalizeProviderConfig(rawConfig, this.id);
    const snapshot = snapshotInput(input);
    const context = sourceContext === undefined ? snapshot.nodes : snapshotInput({ ...snapshot, nodes: sourceContext }).nodes;
    if (!snapshot.nodes.length) return { translations: [], fromCache: 0 };
    this.expireModels();
    const scope = this.structuredOutput && this.modelCache ? await withSignal(credentialScope(config), signal) : undefined;
    const useSchema = scope !== undefined && this.modelCache?.scope === scope
      && this.modelCache.models.some(model => model.id === config.model && model.supportsStructuredOutput === true);
    const sensitiveTexts = [...context.map(node => node.text), snapshot.pageContext.title, snapshot.customInstructions].filter(Boolean);
    const streaming = config.streaming === true && operation === 'translate';
    const translations = await performRequest(config, this.fetchImpl, {
      path: '/chat/completions', method: 'POST',
      operation, onError: this.onError,
      sensitiveTexts,
      ...(streaming ? {
        parseStream: (response: Response, streamSignal: AbortSignal) => {
          const preview: TranslationItem[] = [];
          return readChatStream(response, snapshot.nodes, streamSignal, item => {
            preview.push(item);
            onProgress?.({ kind: 'segments', translations: [...preview] });
          }, { secrets: [config.apiKey], texts: sensitiveTexts });
        },
        onReset: () => onProgress?.({ kind: 'reset' }),
      } : {}),
      body: {
        model: config.model, stream: streaming, messages: buildTranslationMessages(snapshot, context),
        ...(useSchema ? { response_format: translationResponseFormat(), provider: { require_parameters: true, allow_fallbacks: false } } : {}),
        ...(this.id === 'openrouter' && !useSchema ? { provider: { allow_fallbacks: false } } : {}),
      },
    }, data => {
      if (!isRecord(data) || !Array.isArray(data.choices) || data.choices.length !== 1) invalidResponse();
      const choice: unknown = data.choices[0];
      if (!isRecord(choice)) invalidResponse();
      if (choice.error !== undefined && choice.error !== null) throw envelopeError(choice.error);
      if (choice.finish_reason === 'error') throw new LinguistyError('PROVIDER_UNAVAILABLE', undefined, true);
      if (choice.finish_reason === 'length') throw new LinguistyError('CONTEXT_TOO_LARGE');
      if (choice.finish_reason !== undefined && choice.finish_reason !== null && choice.finish_reason !== 'stop') throw new LinguistyError('INVALID_MODEL_RESPONSE');
      if (!isRecord(choice.message) || typeof choice.message.content !== 'string') invalidResponse();
      if (choice.message.refusal) throw new LinguistyError('INVALID_MODEL_RESPONSE');
      return parseTranslations(choice.message.content, snapshot.nodes);
    }, signal);
    return { translations, fromCache: 0 };
  }

  /** @spec spec://modules/translation/FEAT-001-engine#providers */
  async testConnection(config: ProviderConfig, signal?: AbortSignal): Promise<ConnectionTestResult> {
    try {
      await this.translateOperation({
        nodes: [{ id: 'connection-test', text: 'Hello' }],
        pageContext: { title: 'Connection test', domain: '' },
        sourceLanguage: 'en', targetLanguage: 'ru', style: 'accurate', customInstructions: '',
      }, config, signal, undefined, 'test-connection');
      return { success: true, message: 'Подключение проверено: модель вернула корректный ответ.' };
    } catch (error) {
      if (error instanceof LinguistyError && error.code === 'CANCELLED') throw error;
      return { success: false, message: toPublicError(error).message };
    }
  }

  /** @spec spec://common/PROP-002-quality#resources */
  async listModels(rawConfig: ProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]> {
    throwIfCancelled(signal);
    const config = normalizeProviderConfig(rawConfig, this.id, false);
    this.expireModels();
    const scope = await withSignal(credentialScope(config), signal);
    throwIfCancelled(signal);
    if (this.modelCache?.scope === scope) return this.modelCache.models.map(model => ({ ...model }));
    const models = await performRequest(config, this.fetchImpl, {
      path: this.id === 'openrouter' ? '/models?limit=1000&offset=0' : '/models', method: 'GET',
      operation: 'list-models', onError: this.onError,
    }, data => this.parseModels(data), signal);
    throwIfCancelled(signal);
    this.modelCache = { scope, expiresAt: Date.now() + MODEL_CACHE_TTL_MS, models };
    return models.map(model => ({ ...model }));
  }

  private expireModels(): void {
    if (this.modelCache && this.modelCache.expiresAt <= Date.now()) this.modelCache = undefined;
  }

  private parseModels(data: unknown): ModelInfo[] {
    if (!isRecord(data) || !Array.isArray(data.data)) invalidResponse();
    const models: ModelInfo[] = [];
    const ids = new Set<string>();
    for (const entry of data.data) {
      if (models.length === MODEL_MAX_ENTRIES) break;
      if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim() || entry.id.length > 200 || containsControlCharacters(entry.id) || ids.has(entry.id)) continue;
      ids.add(entry.id);
      const context = entry.context_length;
      models.push({
        id: entry.id,
        name: typeof entry.name === 'string' && entry.name.trim() && entry.name.length <= 512 ? entry.name : entry.id,
        ...(typeof context === 'number' && Number.isSafeInteger(context) && context > 0 ? { contextLength: context } : {}),
        ...(this.structuredOutput && Array.isArray(entry.supported_parameters)
          ? { supportsStructuredOutput: entry.supported_parameters.includes('structured_outputs') } : {}),
      });
    }
    return models;
  }
}
