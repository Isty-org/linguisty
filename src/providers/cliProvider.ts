/** @spec spec://modules/platform/INFRA-003-local-cli#execution */
import type { CliProviderId, ConnectionTestResult, ModelInfo, ProviderConfig, TranslationInput,
  TranslationNode, TranslationProvider, TranslationResult } from '../shared/contracts';
import { LinguistyError } from '../shared/errors';
import { throwIfCancelled } from '../translation/abort';
import { snapshotInput } from '../translation/input';
import { isRecord, parseTranslations } from '../translation/parser';
import { buildTranslationMessages } from '../translation/prompt';
import { normalizeProviderConfig } from './config';
import { nativeRequest, type NativeRequester } from './nativeClient';

export class CliProvider implements TranslationProvider {
  constructor(readonly id: CliProviderId, private readonly request: NativeRequester = nativeRequest) {}
  async translate(input: TranslationInput, rawConfig: ProviderConfig, signal?: AbortSignal,
    sourceContext?: TranslationNode[]): Promise<TranslationResult> {
    throwIfCancelled(signal);
    const config = normalizeProviderConfig(rawConfig, this.id);
    const snapshot = snapshotInput(input);
    if (!snapshot.nodes.length) return { translations: [], fromCache: 0 };
    const context = sourceContext === undefined ? snapshot.nodes : snapshotInput({ ...snapshot, nodes: sourceContext }).nodes;
    const response = await this.request({ type: 'translate', providerId: this.id, model: config.model,
      timeoutMs: config.timeoutMs, messages: buildTranslationMessages(snapshot, context) }, signal);
    throwIfCancelled(signal);
    if (!isRecord(response) || typeof response.content !== 'string') throw new LinguistyError('INVALID_MODEL_RESPONSE');
    return { translations: parseTranslations(response.content, snapshot.nodes), fromCache: 0 };
  }
  async testConnection(rawConfig: ProviderConfig, signal?: AbortSignal): Promise<ConnectionTestResult> {
    const config = normalizeProviderConfig(rawConfig, this.id);
    const response = await this.request({ type: 'status', providerId: this.id, model: config.model,
      timeoutMs: Math.min(config.timeoutMs, 5_000) }, signal);
    if (!isRecord(response) || response.available !== true) throw new LinguistyError('CLI_NOT_FOUND');
    return { success: true, message: 'Соединитель подключён, CLI найден. Вход в аккаунт и ответ модели не проверялись.' };
  }
  async listModels(rawConfig: ProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]> {
    await this.testConnection(rawConfig, signal);
    return [{ id: 'default', name: 'Модель по умолчанию в CLI' }];
  }
}
