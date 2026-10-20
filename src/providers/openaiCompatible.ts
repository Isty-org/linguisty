import { ChatProvider } from './chatProvider';

/** @spec spec://modules/translation/FEAT-001-engine#providers */
export class OpenAICompatibleProvider extends ChatProvider {
  readonly id = 'openai-compatible' as const;
}
