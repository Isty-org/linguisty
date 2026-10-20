/** @spec spec://modules/platform/INFRA-003-local-cli#settings */
import type { CliProviderId, ProviderId } from './contracts';

export const CLI_PROVIDERS = ['codex-cli', 'claude-code', 'antigravity-cli', 'grok-build'] as const;
export const PROVIDER_IDS = ['openrouter', 'openai-compatible', 'codex', ...CLI_PROVIDERS] as const;
export const CODEX_BASE_URL = 'https://api.openai.com/v1';
export const CLI_HOST = 'com.linguisty.cli';
// Cache namespace only. CLI providers never fetch this address.
export const CLI_BASE_URL = 'http://localhost/linguisty-cli';
export const PROVIDER_NAMES: Record<ProviderId, string> = {
  openrouter: 'OpenRouter', 'openai-compatible': 'OpenAI-compatible',
  codex: 'ChatGPT subscription',
  'codex-cli': 'Codex', 'claude-code': 'Claude Code',
  'antigravity-cli': 'Antigravity CLI', 'grok-build': 'Grok Build',
};
export function isCliProvider(value: unknown): value is CliProviderId {
  return typeof value === 'string' && (CLI_PROVIDERS as readonly string[]).includes(value);
}
export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value);
}
/** @spec spec://modules/platform/INFRA-004-codex-connection#settings */
export function isKeylessProvider(value: unknown): boolean {
  return value === 'codex' || isCliProvider(value);
}
