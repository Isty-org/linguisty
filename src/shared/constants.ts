/** @spec spec://common/PROP-001-contracts#types */
import type { Settings, TabTranslationState } from './contracts';

export const CHANNEL = 'linguisty' as const;
export const PROMPT_VERSION = 'linguisty-2';
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const MAX_PAGE_NODES = 5_000;
export const MAX_RESPONSE_BYTES = 1_048_576;
export const CACHE_MAX_ENTRIES = 10_000;
export const CACHE_MAX_BYTES = 50 * 1024 * 1024;
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MODEL_CACHE_TTL_MS = 15 * 60 * 1000;
export const MODEL_MAX_ENTRIES = 1_000;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  providerId: 'openrouter',
  baseUrl: OPENROUTER_BASE_URL,
  model: '',
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  targetLanguageMode: 'browser',
  uiLanguage: 'auto',
  style: 'natural',
  customInstructions: '',
  theme: 'system',
  keyMode: 'session',
  concurrency: 2,
  maxNodesPerBatch: 40,
  maxCharsPerBatch: 10_000,
  requestTimeoutMs: 25_000,
  streaming: true,
};

export function createIdleState(tabId?: number): TabTranslationState {
  return {
    ...(tabId === undefined ? {} : { tabId }),
    sessionId: null, status: 'idle', displayMode: 'original',
    discovered: 0, translated: 0, failed: 0, inFlight: 0, fromCache: 0, limited: false,
  };
}

