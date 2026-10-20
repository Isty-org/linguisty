import { ChatProvider } from './chatProvider';

/** @spec spec://modules/translation/FEAT-001-engine#providers */
export class OpenRouterProvider extends ChatProvider {
  readonly id = 'openrouter' as const;
  protected override structuredOutput = true;
}
