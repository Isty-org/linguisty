/** @spec spec://common/PROP-001-contracts#messages */
import type {
  ErrorCode, PageContext, PublicError, RuntimeMessage, Settings, TabTranslationState, TranslationNode,
} from '../shared/contracts';
import { MAX_PAGE_NODES } from '../shared/constants';
import { LinguistyError, toPublicError } from '../shared/errors';
import { translationError, translationErrorMessageReference } from '../codex/translationError';
import { CLI_BASE_URL, CODEX_BASE_URL, isCliProvider, isKeylessProvider, isProviderId } from '../shared/providers';

export type InboundMessage = Exclude<RuntimeMessage, { type: 'CONTENT_COMMAND' | 'TAB_STATE_CHANGED' }>;

const errorCodes = new Set<ErrorCode>([
  'INVALID_API_KEY', 'PERMISSION_REQUIRED', 'RATE_LIMIT', 'PROVIDER_UNAVAILABLE', 'MODEL_NOT_FOUND',
  'REQUEST_TIMEOUT', 'INVALID_MODEL_RESPONSE', 'NETWORK_ERROR', 'CONTEXT_TOO_LARGE', 'CANCELLED',
  'INVALID_SETTINGS', 'RESTRICTED_PAGE', 'INTERNAL_ERROR',
  'CLI_HOST_MISSING', 'CLI_NOT_FOUND', 'CLI_LOGIN_REQUIRED', 'CLI_EXECUTION_FAILED',
  'CODEX_NOT_CONNECTED', 'CODEX_AUTH_FAILED', 'CODEX_PLAN_REQUIRED',
]);
const statuses = new Set(['idle', 'scanning', 'translating', 'completed', 'cancelled', 'error']);

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valid(condition: unknown): asserts condition {
  if (!condition) throw new LinguistyError('INVALID_SETTINGS');
}

function text(value: unknown, limit: number, nonempty = false): value is string {
  return typeof value === 'string' && value.length <= limit && (!nonempty || value.trim().length > 0);
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function keys(value: Record<string, unknown>, allowed: string[]): void {
  valid(Object.keys(value).every((key) => allowed.includes(key)));
}

export function validTabId(value: unknown): value is number {
  return integer(value, 0, 2_147_483_647);
}

export function validSessionId(value: unknown): value is string {
  return text(value, 128, true);
}

/** @spec spec://modules/platform/INFRA-001-extension#runtime */
export function validateSettings(value: unknown): Settings {
  valid(record(value));
  valid(value.schemaVersion === 1);
  valid(isProviderId(value.providerId));
  valid(text(value.baseUrl, 2_048, !isKeylessProvider(value.providerId)) && text(value.model, 200));
  valid(text(value.sourceLanguage, 64, true) && text(value.targetLanguage, 64, true));
  valid(value.targetLanguageMode === undefined || value.targetLanguageMode === 'browser' || value.targetLanguageMode === 'manual');
  valid(value.uiLanguage === undefined || text(value.uiLanguage, 64, true));
  valid(value.style === 'natural' || value.style === 'accurate' || value.style === 'literal');
  valid(text(value.customInstructions, 4_000));
  valid(value.theme === 'system' || value.theme === 'light' || value.theme === 'dark');
  valid(value.keyMode === 'session' || value.keyMode === 'persistent');
  valid(integer(value.concurrency, 1, 4));
  valid(integer(value.maxNodesPerBatch, 1, 40) && integer(value.maxCharsPerBatch, 1, 10_000));
  valid(integer(value.requestTimeoutMs, 1_000, 120_000));
  valid(value.streaming === undefined || typeof value.streaming === 'boolean');
  // Copy the public schema explicitly: a settings object never carries an API key.
  return {
    schemaVersion: 1, providerId: value.providerId,
    baseUrl: value.providerId === 'codex' ? CODEX_BASE_URL : isCliProvider(value.providerId) ? CLI_BASE_URL : value.baseUrl,
    model: value.model.trim() || (isKeylessProvider(value.providerId) ? 'default' : ''),
    sourceLanguage: value.sourceLanguage, targetLanguage: value.targetLanguage, style: value.style,
    targetLanguageMode: value.targetLanguageMode === 'browser' ? 'browser' : 'manual',
    uiLanguage: typeof value.uiLanguage === 'string' ? value.uiLanguage : 'auto',
    customInstructions: value.customInstructions, theme: value.theme, keyMode: value.keyMode,
    concurrency: isKeylessProvider(value.providerId) ? 1 : value.concurrency, maxNodesPerBatch: value.maxNodesPerBatch,
    maxCharsPerBatch: value.maxCharsPerBatch, requestTimeoutMs: value.requestTimeoutMs,
    streaming: isKeylessProvider(value.providerId) ? false : value.streaming === undefined ? true : value.streaming,
  };
}

/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
export function safeError(error: unknown): PublicError {
  const parsed = toPublicError(error);
  // Even a provider's LinguistyError must not echo its raw message/body/key.
  const reference = parsed.code === 'INVALID_MODEL_RESPONSE' ? translationErrorMessageReference(parsed.message) : undefined;
  return toPublicError(reference ? translationError(reference, parsed.retryable) : new LinguistyError(parsed.code, undefined, parsed.retryable));
}

/** @spec spec://modules/platform/INFRA-001-extension#recovery */
export function validateState(value: unknown, tabId?: number): TabTranslationState {
  valid(record(value));
  valid(value.tabId === undefined || (validTabId(value.tabId) && (tabId === undefined || value.tabId === tabId)));
  valid(value.sessionId === null || validSessionId(value.sessionId));
  valid(typeof value.status === 'string' && statuses.has(value.status));
  valid(value.displayMode === 'original' || value.displayMode === 'translated');
  for (const key of ['discovered', 'translated', 'failed', 'inFlight', 'fromCache']) {
    valid(integer(value[key], 0, MAX_PAGE_NODES));
  }
  valid((value.translated as number) + (value.failed as number) <= (value.discovered as number));
  valid((value.fromCache as number) <= (value.translated as number));
  valid((value.inFlight as number) <= (value.discovered as number));
  valid(typeof value.limited === 'boolean');
  let error: PublicError | undefined;
  if (value.error !== undefined) {
    valid(record(value.error) && errorCodes.has(value.error.code as ErrorCode) && typeof value.error.retryable === 'boolean');
    error = safeError(new LinguistyError(value.error.code as ErrorCode,
      typeof value.error.message === 'string' ? value.error.message : undefined, value.error.retryable));
  }
  return {
    ...(tabId === undefined && value.tabId === undefined ? {} : { tabId: tabId ?? value.tabId as number }),
    sessionId: value.sessionId as string | null, status: value.status as TabTranslationState['status'],
    displayMode: value.displayMode, discovered: value.discovered as number, translated: value.translated as number,
    failed: value.failed as number, inFlight: value.inFlight as number, fromCache: value.fromCache as number,
    limited: value.limited, ...(error === undefined ? {} : { error }),
  };
}

function pageContext(value: unknown): PageContext {
  valid(record(value));
  keys(value, ['title', 'domain', 'contentType']);
  valid(text(value.title, 300) && text(value.domain, 300, true));
  valid(!/[\s/?#@]/u.test(value.domain));
  valid(value.contentType === undefined || text(value.contentType, 100, true));
  return {
    title: value.title, domain: value.domain,
    ...(value.contentType === undefined ? {} : { contentType: value.contentType as string }),
  };
}

function nodes(value: unknown): TranslationNode[] {
  valid(Array.isArray(value) && value.length > 0 && value.length <= 40);
  let chars = 0;
  const ids = new Set<string>();
  return value.map((node: unknown) => {
    valid(record(node));
    keys(node, ['id', 'text', 'group', 'priority']);
    valid(text(node.id, 128, true) && !ids.has(node.id) && text(node.text, 10_000, true));
    valid(node.group === undefined || text(node.group, 256));
    valid(node.priority === undefined || integer(node.priority, 0, MAX_PAGE_NODES));
    ids.add(node.id);
    chars += node.text.length;
    valid(chars <= 10_000);
    return {
      id: node.id, text: node.text,
      ...(node.group === undefined ? {} : { group: node.group as string }),
      ...(node.priority === undefined ? {} : { priority: node.priority as number }),
    };
  });
}

/** @spec spec://common/PROP-001-contracts#messages */
export function validateMessage(value: unknown): InboundMessage {
  valid(record(value) && value.channel === 'linguisty' && typeof value.type === 'string');
  const common = ['channel', 'type'];
  const base = { channel: 'linguisty' as const };
  switch (value.type) {
    case 'GET_SETTINGS': case 'GET_SECRET_STATUS': case 'REMOVE_API_KEY': case 'GET_CACHE_STATS': case 'CLEAR_CACHE': case 'GET_ERROR_LOG': case 'CLEAR_ERROR_LOG': case 'OPEN_CODEX_CONNECTION': case 'GET_CODEX_STATUS':
      keys(value, common);
      return { ...base, type: value.type };
    case 'SAVE_SETTINGS': case 'TEST_CONNECTION': case 'LIST_MODELS': {
      keys(value, [...common, 'settings', 'apiKey', ...(value.type === 'SAVE_SETTINGS' ? ['preserveKeyMode', 'languagesOnly'] : [])]);
      valid(value.apiKey === undefined || (text(value.apiKey, 4_096) && ![...value.apiKey].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)));
      const settings = value.settings === undefined ? undefined : validateSettings(value.settings);
      const apiKey = value.apiKey as string | undefined;
      if (value.type === 'SAVE_SETTINGS') {
        valid(settings !== undefined);
        valid(value.preserveKeyMode === undefined || typeof value.preserveKeyMode === 'boolean');
        valid(value.languagesOnly === undefined || typeof value.languagesOnly === 'boolean');
        valid(value.languagesOnly !== true || value.apiKey === undefined);
        return { ...base, type: value.type, settings, ...(apiKey === undefined ? {} : { apiKey }),
          ...(value.preserveKeyMode === undefined ? {} : { preserveKeyMode: value.preserveKeyMode }),
          ...(value.languagesOnly === undefined ? {} : { languagesOnly: value.languagesOnly }) };
      }
      return { ...base, type: value.type, ...(settings === undefined ? {} : { settings }), ...(apiKey === undefined ? {} : { apiKey }) };
    }
    case 'START_TRANSLATION': case 'CANCEL_TRANSLATION': case 'GET_TAB_STATE': case 'SET_DISPLAY_MODE': {
      keys(value, [...common, 'tabId', ...(value.type === 'SET_DISPLAY_MODE' ? ['mode'] : [])]);
      valid(value.tabId === undefined || validTabId(value.tabId));
      const tab = value.tabId === undefined ? {} : { tabId: value.tabId as number };
      if (value.type === 'SET_DISPLAY_MODE') {
        valid(value.mode === 'original' || value.mode === 'translated');
        return { ...base, type: value.type, ...tab, mode: value.mode };
      }
      return { ...base, type: value.type, ...tab };
    }
    case 'TRANSLATE_BATCH':
      keys(value, [...common, 'sessionId', 'batchId', 'nodes', 'pageContext']);
      valid(validSessionId(value.sessionId) && text(value.batchId, 128, true));
      return { ...base, type: value.type, sessionId: value.sessionId, batchId: value.batchId, nodes: nodes(value.nodes), pageContext: pageContext(value.pageContext) };
    case 'PAGE_PROGRESS': {
      keys(value, [...common, 'sessionId', 'state']);
      valid(validSessionId(value.sessionId));
      const state = validateState(value.state);
      valid(state.sessionId === value.sessionId);
      return { ...base, type: value.type, sessionId: value.sessionId, state };
    }
    case 'BEGIN_PAGE_SESSION':
      keys(value, [...common, 'previousSessionId', 'pageContext']);
      valid(validSessionId(value.previousSessionId));
      return { ...base, type: value.type, previousSessionId: value.previousSessionId, pageContext: pageContext(value.pageContext) };
    case 'CONTENT_COMMAND': case 'TAB_STATE_CHANGED':
      throw new LinguistyError('PERMISSION_REQUIRED');
    default:
      throw new LinguistyError('INVALID_SETTINGS');
  }
}

/** @spec spec://modules/platform/INFRA-001-extension#permissions */
export function isTranslatableUrl(value: unknown, firefox = false): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    // Browser stores and restricted Mozilla domains refuse script injection even over HTTPS.
    if (!firefox && (host === 'chromewebstore.google.com' || (host === 'chrome.google.com' && url.pathname.startsWith('/webstore')))) return false;
    if (firefox && ['accounts-static.cdn.mozilla.net', 'accounts.firefox.com', 'addons.cdn.mozilla.net', 'addons.mozilla.org', 'api.accounts.firefox.com',
      'content.cdn.mozilla.net', 'discovery.addons.mozilla.org', 'install.mozilla.org', 'oauth.accounts.firefox.com',
      'profile.accounts.firefox.com', 'support.mozilla.org', 'sync.services.mozilla.com'].includes(host)) return false;
    return !/\.pdf$/iu.test(url.pathname);
  } catch {
    return false;
  }
}
