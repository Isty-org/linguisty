import type { ProviderConfig, ProviderId } from '../shared/contracts';
import { OPENROUTER_BASE_URL } from '../shared/constants';
import { LinguistyError } from '../shared/errors';
import { CLI_BASE_URL, CODEX_BASE_URL, isCliProvider, isKeylessProvider, isProviderId } from '../shared/providers';

export function containsControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/** @spec spec://modules/translation/FEAT-001-engine#providers */
export function normalizeProviderConfig(config: ProviderConfig, providerId: ProviderId, requireModel = true): ProviderConfig {
  if (config && config.providerId === providerId && isKeylessProvider(providerId)) {
    if (typeof config.model !== 'string' || config.model.length > 200 || containsControlCharacters(config.model)
      || !Number.isInteger(config.timeoutMs) || config.timeoutMs < 1_000 || config.timeoutMs > 120_000) {
      throw new LinguistyError('INVALID_SETTINGS');
    }
    if (config.accountScope !== undefined && !/^[a-f0-9]{64}$/.test(config.accountScope)) throw new LinguistyError('INVALID_SETTINGS');
    return { providerId, baseUrl: isCliProvider(providerId) ? CLI_BASE_URL : CODEX_BASE_URL, model: config.model.trim() || 'default', apiKey: '',
      timeoutMs: config.timeoutMs, streaming: false, ...(providerId === 'codex' && config.accountScope ? { accountScope: config.accountScope } : {}) };
  }
  if (!config || !isProviderId(providerId) || config.providerId !== providerId || typeof config.baseUrl !== 'string' || config.baseUrl.length > 2_048
    || containsControlCharacters(config.baseUrl)
    || typeof config.apiKey !== 'string' || !config.apiKey.trim() || config.apiKey.length > 4_096 || containsControlCharacters(config.apiKey)
    || typeof config.model !== 'string' || config.model.length > 200 || containsControlCharacters(config.model) || (requireModel && !config.model.trim())
    || !Number.isInteger(config.timeoutMs) || config.timeoutMs < 1_000 || config.timeoutMs > 120_000
    || (config.streaming !== undefined && typeof config.streaming !== 'boolean')) {
    throw new LinguistyError('INVALID_SETTINGS');
  }
  let url: URL;
  try { url = new URL(config.baseUrl.trim()); } catch { throw new LinguistyError('INVALID_SETTINGS'); }
  // WHATWG URL normalization drops an empty username marker; inspect authority too.
  const authority = /^https?:\/\/([^/?#\\]*)/i.exec(config.baseUrl.trim())?.[1];
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!authority || authority.includes('@') || (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password
    || config.baseUrl.includes('?') || config.baseUrl.includes('#')) {
    throw new LinguistyError('INVALID_SETTINGS');
  }
  const baseUrl = url.href.replace(/\/+$/, '');
  if (providerId === 'openrouter' && baseUrl !== OPENROUTER_BASE_URL) throw new LinguistyError('INVALID_SETTINGS');
  return { providerId, baseUrl, model: config.model.trim(), apiKey: config.apiKey.trim(), timeoutMs: config.timeoutMs,
    ...(config.streaming === undefined ? {} : { streaming: config.streaming }) };
}

export async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function credentialScope(config: ProviderConfig): Promise<string> {
  // @spec spec://modules/platform/INFRA-004-codex-connection#requests
  if (config.providerId === 'codex') {
    if (!config.accountScope || !/^[a-f0-9]{64}$/.test(config.accountScope)) throw new LinguistyError('CODEX_NOT_CONNECTED');
    return JSON.stringify([config.providerId, CODEX_BASE_URL, config.accountScope]);
  }
  return JSON.stringify([config.providerId, config.baseUrl, await digest(config.apiKey)]);
}
