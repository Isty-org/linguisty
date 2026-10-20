import type { ProviderId, TranslationProvider } from '../shared/contracts';
import { LinguistyError } from '../shared/errors';
import type { ProviderOptions } from './chatProvider';
import { OpenAICompatibleProvider } from './openaiCompatible';
import { OpenRouterProvider } from './openrouter';
import { CliProvider } from './cliProvider';
import { CodexProvider } from './codexProvider';
import { isCliProvider, isProviderId } from '../shared/providers';

const defaults: Partial<Record<ProviderId, TranslationProvider>> = {
  openrouter: new OpenRouterProvider(),
  'openai-compatible': new OpenAICompatibleProvider(),
};

/** @spec spec://common/PROP-001-contracts#modules */
export function getProvider(providerId: ProviderId, options?: ProviderOptions): TranslationProvider {
  if (!isProviderId(providerId)) throw new LinguistyError('INVALID_SETTINGS');
  if (providerId === 'codex') return new CodexProvider(options?.codexRequest);
  if (isCliProvider(providerId)) return new CliProvider(providerId, options?.nativeRequest);
  if (!options) return defaults[providerId]!;
  return providerId === 'openrouter' ? new OpenRouterProvider(options) : new OpenAICompatibleProvider(options);
}
