/** @spec spec://modules/platform/INFRA-001-extension#runtime */
import { browser } from 'wxt/browser';
import type {
  ApiResult, ContentCommand, KeyMode, PageContext, ProviderConfig, RuntimeMessage,
  SecretStatus, Settings, TabTranslationState, TranslationCache, TranslationResult,
} from '../shared/contracts';
import { CHANNEL, MODEL_MAX_ENTRIES, OPENROUTER_BASE_URL, createIdleState } from '../shared/constants';
import { LinguistyError } from '../shared/errors';
import { loadSettings, normalizeBaseUrl, normalizeSettings } from '../storage/settings';
import { getApiKey, getSecretStatus, removeApiKey, saveConfiguration } from '../storage/secrets';
import { ErrorJournal } from '../storage/errorLog';
import { getTranslationCache } from '../cache/translationCache';
import { TranslationEngine } from '../translation/engine';
import { batchTimeoutMs } from '../translation/segments';
import { SessionRegistry } from './sessions';
import type { PageSession } from './sessions';
import { isTranslatableUrl, record, safeError, validateMessage, validateSettings, validateState, validTabId } from './validation';
import type { InboundMessage } from './validation';
import { StreamProgress } from './streamProgress';
import { RequestActivity } from './requestActivity';
import { CLI_BASE_URL, CODEX_BASE_URL, isCliProvider, isKeylessProvider } from '../shared/providers';
import { codexRequest } from '../codex/client';
import { object, type CodexRequester } from '../codex/protocol';
import { codexPageOpener } from './codexPage';
import { cleanupCodexAuth } from './codexAuthCleanup';

type BrowserApi = typeof browser;
type Sender = Parameters<Parameters<BrowserApi['runtime']['onMessage']['addListener']>[0]>[1];
type Engine = Pick<TranslationEngine, 'translate' | 'testConnection' | 'listModels'>;

export interface BackgroundDependencies {
  api?: BrowserApi;
  cache?: TranslationCache;
  engine?: Engine;
  loadSettings?: () => Promise<Settings>;
  saveConfiguration?: (settings: Settings, key?: string) => Promise<void>;
  getApiKey?: (mode: KeyMode) => Promise<string | undefined>;
  removeApiKey?: () => Promise<void>;
  getSecretStatus?: (mode: KeyMode) => Promise<SecretStatus>;
  errorJournal?: Pick<ErrorJournal, 'list' | 'clear' | 'append'>;
  now?: () => number;
  codexRequest?: CodexRequester;
}

export interface BackgroundRegistration {
  readonly ready: Promise<void>;
  handleMessage(message: unknown, sender: Sender): Promise<ApiResult>;
  resources(): { sessions: number; batches: number; requests: number; messages: number; mutations: number; commands: number; starts: number; navigationChecks: number };
  dispose(preserveSnapshots?: boolean): Promise<void>;
}

export const MAX_API_REQUESTS = 4;
const MAX_MESSAGES = 64;
const MAX_MUTATIONS = 4;
const COMMAND_TIMEOUT_MS = 5_000;
const registrations = new WeakMap<object, BackgroundRegistration>();

function checkedSettings(value: unknown): Settings {
  const settings = validateSettings(normalizeSettings(value));
  settings.baseUrl = normalizeBaseUrl(settings.baseUrl);
  const url = new URL(settings.baseUrl);
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new LinguistyError('INVALID_SETTINGS');
  }
  if (settings.providerId === 'openrouter' && settings.baseUrl !== OPENROUTER_BASE_URL) {
    throw new LinguistyError('INVALID_SETTINGS');
  }
  return settings;
}

/** @spec spec://modules/platform/INFRA-001-extension#permissions */
export function apiPermissionPattern(baseUrl: string): string {
  const url = new URL(normalizeBaseUrl(baseUrl));
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new LinguistyError('INVALID_SETTINGS');
  }
  // Firefox match patterns cannot contain ports. Fetch still uses the exact configured origin/port.
  return `${url.protocol}//${url.hostname}/*`;
}

function isUiSender(api: BrowserApi, sender: Sender): boolean {
  if (sender.id !== api.runtime.id || typeof sender.url !== 'string') return false;
  try {
    const own = new URL(api.runtime.getURL('/'));
    const url = new URL(sender.url);
    return url.protocol === own.protocol && url.host === own.host && !url.username && !url.password;
  } catch {
    return false;
  }
}

function abortable<T>(operation: () => Promise<T>, controller: AbortController, timeoutMs: number): Promise<T> {
  if (controller.signal.aborted) return Promise.reject(new LinguistyError('CANCELLED'));
  let timedOut = false;
  let onAbort: () => void = () => undefined;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const interrupted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new LinguistyError(timedOut ? 'REQUEST_TIMEOUT' : 'CANCELLED', undefined, timedOut));
    controller.signal.addEventListener('abort', onAbort, { once: true });
  });
  const work = Promise.resolve().then(() => {
    if (controller.signal.aborted) throw new LinguistyError('CANCELLED');
    return operation();
  });
  // Promise.race consumes late work rejection; finally always releases this timer/listener.
  return Promise.race([work, interrupted]).finally(() => {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', onAbort);
  });
}

/** @spec spec://modules/platform/INFRA-001-extension#runtime */
export function registerBackgroundController(options: BackgroundDependencies = {}): BackgroundRegistration {
  const api = options.api ?? browser;
  const existing = registrations.get(api);
  if (existing) return existing;
  const registry = new SessionRegistry(api, options.now, checkedSettings);
  const firefox = api.runtime.getURL('/').startsWith('moz-extension:');
  const requestActivity = new RequestActivity(() => api.runtime.getPlatformInfo());
  const readSettings = options.loadSettings ?? loadSettings;
  const writeConfiguration = options.saveConfiguration ?? saveConfiguration;
  const readKey = options.getApiKey ?? getApiKey;
  const deleteKey = options.removeApiKey ?? removeApiKey;
  const secretStatus = options.getSecretStatus ?? getSecretStatus;
  const requestCodex = options.codexRequest ?? codexRequest;
  const openCodex = codexPageOpener(api);
  const errorJournal = options.errorJournal ?? new ErrorJournal();
  let cache = options.cache;
  let engine = options.engine;
  let requests = 0;
  let messages = 0;
  let mutations = 0;
  let mutationQueue = Promise.resolve();
  let disposed = false;
  const uiRequests = new Set<AbortController>();
  const commandRequests = new Set<AbortController>();
  const tabCommands = new Map<number, AbortController>();
  const starts = new Map<AbortController, number | undefined>();
  const navigationChecks = new Map<number, AbortController>();
  let recovery: Promise<void> | undefined;

  /** @spec spec://modules/platform/INFRA-001-extension#runtime */
  function activeRequest<T>(operation: () => Promise<T>, controller: AbortController, timeoutMs: number): Promise<T> {
    return requestActivity.track(abortable(operation, controller, timeoutMs), controller.signal);
  }

  /** @spec spec://modules/platform/INFRA-001-extension#recovery */
  function recoverSessions(): Promise<void> {
    if (recovery) return recovery;
    const controller = new AbortController();
    commandRequests.add(controller);
    const attempt = abortable(() => registry.restore(controller.signal), controller, COMMAND_TIMEOUT_MS).catch((error: unknown) => {
      if (disposed && error instanceof LinguistyError && error.code === 'CANCELLED') throw error;
      throw new LinguistyError('INTERNAL_ERROR', 'Не удалось восстановить статус страницы. Повторите загрузку или откройте страницу заново.', true);
    });
    recovery = attempt;
    // A settled failure is released for the next request; all current callers share this attempt.
    void attempt.then(
      () => { commandRequests.delete(controller); },
      () => {
        commandRequests.delete(controller);
        if (recovery === attempt) recovery = undefined;
      },
    );
    return attempt;
  }

  const translationCache = (): TranslationCache => cache ??= getTranslationCache();
  const translationEngine = (): Engine => engine ??= new TranslationEngine(translationCache(), { codexRequest: requestCodex, onError: entry => errorJournal.append(entry) });
  const ensureCurrent = (session: PageSession): void => {
    if (disposed || !registry.isCurrent(session)) throw new LinguistyError('CANCELLED');
  };
  const ensureAttached = (session: PageSession): void => {
    if (disposed || registry.get(session.tabId) !== session) throw new LinguistyError('CANCELLED');
  };

  function publish(state: TabTranslationState): void {
    const message: RuntimeMessage = { channel: CHANNEL, type: 'TAB_STATE_CHANGED', state: validateState(state) };
    void api.runtime.sendMessage(message).catch(() => undefined);
  }

  async function persistAndPublish(session: PageSession): Promise<TabTranslationState> {
    await registry.persist();
    ensureAttached(session);
    const state = registry.snapshot(session);
    publish(state);
    return state;
  }

  function contentSession(sender: Sender, sessionId: string, context?: PageContext): PageSession {
    if (sender.id !== api.runtime.id || sender.frameId !== 0 || !validTabId(sender.tab?.id)
      || !isTranslatableUrl(sender.url, firefox)) throw new LinguistyError('PERMISSION_REQUIRED');
    const session = registry.get(sender.tab.id);
    if (!session || session.sessionId !== sessionId || session.controller.signal.aborted) throw new LinguistyError('CANCELLED');
    if (sender.documentId !== undefined) {
      if (typeof sender.documentId !== 'string' || sender.documentId.length > 128
        || (session.documentId !== undefined && session.documentId !== sender.documentId)) throw new LinguistyError('CANCELLED');
      session.documentId ??= sender.documentId;
    }
    if (context) {
      const url = new URL(sender.url);
      if (context.domain.toLowerCase() !== url.hostname.toLowerCase() && context.domain.toLowerCase() !== url.host.toLowerCase()) {
        throw new LinguistyError('PERMISSION_REQUIRED');
      }
    }
    return session;
  }

  async function tabFor(tabId?: number): Promise<{ id: number; url: string }> {
    if (tabId === undefined) tabId = (await api.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    if (!validTabId(tabId)) throw new LinguistyError('RESTRICTED_PAGE');
    try {
      const tab = await api.tabs.get(tabId);
      if (!isTranslatableUrl(tab.url, firefox)) throw new LinguistyError('RESTRICTED_PAGE');
      return { id: tabId, url: tab.url };
    } catch {
      registry.remove(tabId);
      await registry.persist();
      throw new LinguistyError('RESTRICTED_PAGE');
    }
  }

  async function providerConfig(settings: Settings, apiKey?: string): Promise<ProviderConfig> {
    const normalized = checkedSettings(settings);
    if (isCliProvider(normalized.providerId)) {
      if (!await api.permissions.contains({ permissions: ['nativeMessaging'] })) throw new LinguistyError('PERMISSION_REQUIRED');
      return { providerId: normalized.providerId, baseUrl: CLI_BASE_URL, model: normalized.model || 'default',
        apiKey: '', timeoutMs: normalized.requestTimeoutMs, streaming: false };
    }
    if (!await api.permissions.contains({ origins: [apiPermissionPattern(normalized.baseUrl)] })) {
      throw new LinguistyError('PERMISSION_REQUIRED');
    }
    if (normalized.providerId === 'codex') {
      const status = await requestCodex({ type: 'status', timeoutMs: 5_000 });
      if (!object(status) || status.connected !== true || typeof status.accountScope !== 'string' || !/^[a-f0-9]{64}$/.test(status.accountScope)) {
        throw new LinguistyError('CODEX_NOT_CONNECTED');
      }
      return { providerId: 'codex', baseUrl: CODEX_BASE_URL, model: normalized.model || 'default', apiKey: '',
        accountScope: status.accountScope, timeoutMs: normalized.requestTimeoutMs, streaming: false };
    }
    const key = apiKey?.trim() || await readKey(normalized.keyMode);
    if (!key) throw new LinguistyError('INVALID_API_KEY');
    return {
      providerId: normalized.providerId, baseUrl: normalized.baseUrl, model: normalized.model,
      apiKey: key, timeoutMs: normalized.requestTimeoutMs,
      streaming: normalized.streaming,
    };
  }

  async function contentCommand(tabId: number, payload: ContentCommand, parent?: AbortController): Promise<TabTranslationState> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (parent?.signal.aborted) controller.abort();
    parent?.signal.addEventListener('abort', abort, { once: true });
    commandRequests.add(controller);
    let response: unknown;
    try {
      response = await abortable(() => api.tabs.sendMessage(tabId, { channel: CHANNEL, type: 'CONTENT_COMMAND', payload }, { frameId: 0 }), controller, COMMAND_TIMEOUT_MS);
    } finally {
      commandRequests.delete(controller);
      parent?.signal.removeEventListener('abort', abort);
    }
    if (!record(response) || response.ok !== true) {
      if (record(response) && response.ok === false && record(response.error)) {
        const validated = validateState({ ...createIdleState(tabId), error: response.error }, tabId);
        throw new LinguistyError(validated.error?.code ?? 'INTERNAL_ERROR', undefined, validated.error?.retryable);
      }
      throw new LinguistyError('RESTRICTED_PAGE');
    }
    return validateState(response.data, tabId);
  }

  /** @spec spec://modules/platform/INFRA-001-extension#permissions */
  async function start(tabId?: number): Promise<TabTranslationState> {
    const controller = new AbortController();
    starts.set(controller, tabId);
    uiRequests.add(controller);
    let tab: { id: number; url: string } | undefined;
    let session: PageSession | undefined;
    let abortSession: (() => void) | undefined;
    const abortStart = () => controller.abort();
    try {
      tab = await abortable(() => tabFor(tabId), controller, COMMAND_TIMEOUT_MS);
      starts.set(controller, tab.id);
      if (tabCommands.has(tab.id)) throw new LinguistyError('RATE_LIMIT', undefined, true);
      tabCommands.set(tab.id, controller);
      const settings = checkedSettings(await abortable(readSettings, controller, COMMAND_TIMEOUT_MS));
      if (!settings.model && !isKeylessProvider(settings.providerId)) throw new LinguistyError('INVALID_SETTINGS');
      await abortable(() => providerConfig(settings), controller, COMMAND_TIMEOUT_MS);
      if (disposed || controller.signal.aborted) throw new LinguistyError('CANCELLED');
      const currentTab = await abortable(() => tabFor(tab!.id), controller, COMMAND_TIMEOUT_MS);
      if (currentTab.url !== tab.url) throw new LinguistyError('CANCELLED');
      session = registry.create(tab.id, settings);
      abortSession = () => session?.controller.abort();
      controller.signal.addEventListener('abort', abortSession, { once: true });
      session.controller.signal.addEventListener('abort', abortStart, { once: true });
      await registry.persist();
      ensureCurrent(session);
      try {
        await contentCommand(tab.id, { command: 'get-state' }, session.controller);
      } catch (error) {
        ensureCurrent(session);
        if (error instanceof LinguistyError && error.code === 'REQUEST_TIMEOUT') throw error;
        try {
          const results = await abortable(() => api.scripting.executeScript({ target: { tabId: tab!.id, frameIds: [0] }, files: ['/translate.js'] }), controller, COMMAND_TIMEOUT_MS);
          if (!results.some((result) => result.frameId === 0) || results.some((result) => 'error' in result && result.error !== undefined)) {
            throw new LinguistyError('RESTRICTED_PAGE');
          }
          const documentId = results.find((result) => result.frameId === 0)?.documentId;
          if (documentId) session.documentId = documentId;
        } catch (error) {
          if (error instanceof LinguistyError && (error.code === 'CANCELLED' || error.code === 'REQUEST_TIMEOUT')) throw error;
          throw new LinguistyError('RESTRICTED_PAGE');
        }
      }
      ensureCurrent(session);
      const revision = session.revision;
      const state = await contentCommand(tab.id, { command: 'start', sessionId: session.sessionId, settings: session.settings }, session.controller);
      ensureCurrent(session);
      if (state.sessionId !== session.sessionId) throw new LinguistyError('CANCELLED');
      if (session.revision === revision) registry.update(session, state);
      return await persistAndPublish(session);
    } catch (error) {
      if (session && registry.get(session.tabId) === session && session.state.status !== 'cancelled') {
        session.controller.abort();
        registry.abortBatches(session);
        registry.update(session, { ...session.state, status: 'error', inFlight: 0, error: safeError(error) });
        await persistAndPublish(session);
      }
      throw error;
    } finally {
      if (tab && tabCommands.get(tab.id) === controller) tabCommands.delete(tab.id);
      starts.delete(controller);
      uiRequests.delete(controller);
      if (abortSession) controller.signal.removeEventListener('abort', abortSession);
      session?.controller.signal.removeEventListener('abort', abortStart);
    }
  }

  /** @spec spec://common/PROP-001-contracts#sessions */
  async function cancel(tabId?: number): Promise<TabTranslationState> {
    const tab = await tabFor(tabId);
    for (const [controller, pendingTab] of starts) {
      if (pendingTab === undefined || pendingTab === tab.id) controller.abort();
    }
    const session = registry.get(tab.id);
    if (!session) return createIdleState(tab.id);
    const state = registry.cancel(session);
    await persistAndPublish(session);
    // Release background requests even when the page is gone or a content handler stalls.
    try { await contentCommand(tab.id, { command: 'cancel' }); } catch { /* State already cancelled. */ }
    return state;
  }

  async function setDisplay(tabId: number | undefined, mode: TabTranslationState['displayMode']): Promise<TabTranslationState> {
    const tab = await tabFor(tabId);
    const session = registry.get(tab.id);
    if (!session) return createIdleState(tab.id);
    ensureAttached(session);
    if (mode === 'original') registry.abortBatches(session);
    registry.update(session, { ...session.state, displayMode: mode });
    await registry.persist();
    const revision = session.revision;
    const state = await contentCommand(tab.id, { command: 'set-display', mode }, session.controller.signal.aborted ? undefined : session.controller);
    ensureAttached(session);
    if (state.sessionId !== session.sessionId || state.displayMode !== mode) throw new LinguistyError('CANCELLED');
    if (session.revision === revision) registry.update(session, state);
    return persistAndPublish(session);
  }

  /** @spec spec://common/PROP-002-quality#resources */
  function translateBatch(message: Extract<InboundMessage, { type: 'TRANSLATE_BATCH' }>, sender: Sender): Promise<TranslationResult> {
    const session = contentSession(sender, message.sessionId, message.pageContext);
    if (session.state.displayMode !== 'translated') throw new LinguistyError('CANCELLED');
    if (message.nodes.length > session.settings.maxNodesPerBatch
      || message.nodes.reduce((sum, node) => sum + node.text.length, 0) > session.settings.maxCharsPerBatch) {
      throw new LinguistyError('CONTEXT_TOO_LARGE');
    }
    const fingerprint = JSON.stringify([message.nodes, message.pageContext]);
    const existingBatch = session.batches.get(message.batchId);
    if (existingBatch) {
      if (existingBatch.fingerprint !== fingerprint) throw new LinguistyError('INVALID_SETTINGS');
      return existingBatch.promise;
    }
    if (session.batches.size >= session.settings.concurrency || requests >= MAX_API_REQUESTS) throw new LinguistyError('RATE_LIMIT', undefined, true);
    const controller = new AbortController();
    const abort = () => controller.abort();
    session.controller.signal.addEventListener('abort', abort, { once: true });
    requests += 1;
    const progress = new StreamProgress(controller.signal, (update, sequence, sending) => {
      ensureCurrent(session);
      if (controller.signal.aborted || session.state.displayMode !== 'translated') throw new LinguistyError('CANCELLED');
      return contentCommand(session.tabId, { command: 'batch-progress', sessionId: session.sessionId,
        batchId: message.batchId, sequence, progress: update }, sending);
    });
    const promise = activeRequest(async () => {
      const config = await providerConfig(session.settings);
      ensureCurrent(session);
      if (controller.signal.aborted) throw new LinguistyError('CANCELLED');
      const result = await translationEngine().translate({
        nodes: message.nodes, pageContext: message.pageContext, sourceLanguage: session.settings.sourceLanguage,
        targetLanguage: session.settings.targetLanguage, style: session.settings.style, customInstructions: session.settings.customInstructions,
      }, config, controller.signal, update => progress.push(update));
      ensureCurrent(session);
      if (controller.signal.aborted || session.state.displayMode !== 'translated') throw new LinguistyError('CANCELLED');
      // TranslationEngine validates provider responses. Project once more before crossing contexts.
      return {
        translations: result.translations.map(({ id, text }) => ({ id, text })), fromCache: result.fromCache,
        ...(result.cacheHitIds === undefined ? {} : { cacheHitIds: [...result.cacheHitIds] }),
      };
    }, controller, batchTimeoutMs(session.settings.requestTimeoutMs)).finally(() => {
      progress.dispose();
      requests -= 1;
      session.controller.signal.removeEventListener('abort', abort);
      if (session.batches.get(message.batchId)?.controller === controller) session.batches.delete(message.batchId);
    });
    session.batches.set(message.batchId, { fingerprint, controller, promise });
    return promise;
  }

  function mutate<T>(operation: () => Promise<T>): Promise<T> {
    if (mutations >= MAX_MUTATIONS) throw new LinguistyError('RATE_LIMIT', undefined, true);
    mutations += 1;
    const result = mutationQueue.then(async () => {
      if (disposed) throw new LinguistyError('CANCELLED');
      return operation();
    }).finally(() => { mutations -= 1; });
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  /** @spec spec://modules/storage/INFRA-002-local-data#secrets */
  /** @spec spec://common/PROP-001-contracts#messages */
  async function save(message: Extract<InboundMessage, { type: 'SAVE_SETTINGS' }>): Promise<Settings> {
    const candidate = checkedSettings(message.settings);
    return mutate(async () => {
      const previous = checkedSettings(await readSettings());
      const settings = message.languagesOnly ? checkedSettings({ ...previous,
        sourceLanguage: candidate.sourceLanguage, targetLanguage: candidate.targetLanguage,
        targetLanguageMode: candidate.targetLanguageMode,
      }) : message.preserveKeyMode ? { ...candidate, keyMode: previous.keyMode } : candidate;
      const apiKey = isKeylessProvider(settings.providerId) ? undefined : message.apiKey;
      await writeConfiguration(settings, apiKey);
      if (settings.keyMode !== previous.keyMode || apiKey?.trim()) await cancelAll();
      return settings;
    });
  }

  async function cancelAll(): Promise<void> {
    for (const controller of uiRequests) controller.abort();
    const stored = registry.resources();
    if (stored.sessions === 0) return;
    // Only sessions this controller owns are affected, never unrelated browser processes/data.
    for (const session of registry.values()) {
      registry.cancel(session);
      publish(registry.snapshot(session));
      void contentCommand(session.tabId, { command: 'cancel' }).catch(() => undefined);
    }
    await registry.persist();
  }

  async function providerAction(message: Extract<InboundMessage, { type: 'TEST_CONNECTION' | 'LIST_MODELS' }>): Promise<unknown> {
    if (requests >= MAX_API_REQUESTS) throw new LinguistyError('RATE_LIMIT', undefined, true);
    requests += 1;
    const controller = new AbortController();
    uiRequests.add(controller);
    try {
      const settings = checkedSettings(message.settings ?? await readSettings());
      return await activeRequest(async () => {
        const config = await providerConfig(settings, message.apiKey);
        if (controller.signal.aborted) throw new LinguistyError('CANCELLED');
        if (message.type === 'TEST_CONNECTION') {
          const result = await translationEngine().testConnection(config, controller.signal);
          if (isKeylessProvider(config.providerId)) return result;
          return { success: result.success, message: result.success ? 'Соединение установлено.' : 'Не удалось проверить соединение.' };
        }
        const models = await translationEngine().listModels(config, controller.signal);
        return models.slice(0, MODEL_MAX_ENTRIES).map(({ id, name, contextLength, supportsStructuredOutput }) => ({
          id, name, ...(contextLength === undefined ? {} : { contextLength }),
          ...(supportsStructuredOutput === undefined ? {} : { supportsStructuredOutput }),
        }));
      }, controller, settings.requestTimeoutMs);
    } finally {
      requests -= 1;
      uiRequests.delete(controller);
    }
  }

  async function dispatch(message: InboundMessage, sender: Sender): Promise<unknown> {
    const ui = isUiSender(api, sender);
    if (message.type === 'TRANSLATE_BATCH' || message.type === 'PAGE_PROGRESS' || message.type === 'BEGIN_PAGE_SESSION') {
      if (ui) throw new LinguistyError('PERMISSION_REQUIRED');
      if (message.type === 'TRANSLATE_BATCH') return translateBatch(message, sender);
      const sessionId = message.type === 'BEGIN_PAGE_SESSION' ? message.previousSessionId : message.sessionId;
      const session = contentSession(sender, sessionId, message.type === 'BEGIN_PAGE_SESSION' ? message.pageContext : undefined);
      if (message.type === 'PAGE_PROGRESS') {
        if (message.state.tabId !== undefined && message.state.tabId !== session.tabId) throw new LinguistyError('PERMISSION_REQUIRED');
        if (message.state.displayMode !== session.state.displayMode) throw new LinguistyError('CANCELLED');
        registry.update(session, { ...message.state, tabId: session.tabId });
        if (message.state.status === 'cancelled') registry.cancel(session);
        return persistAndPublish(session);
      }
      const next = registry.create(session.tabId, session.settings, session.state.displayMode, session.documentId);
      await persistAndPublish(next);
      return { sessionId: next.sessionId, settings: validateSettings(next.settings) };
    }
    if (!ui) throw new LinguistyError('PERMISSION_REQUIRED');
    switch (message.type) {
      case 'GET_SETTINGS': return checkedSettings(await readSettings());
      case 'OPEN_CODEX_CONNECTION': return openCodex();
      case 'GET_CODEX_STATUS': {
        try {
          const status = await requestCodex({ type: 'status', timeoutMs: 3_000 });
          return { connected: object(status) && status.connected === true };
        } catch { return { connected: false }; }
      }
      case 'SAVE_SETTINGS': return save(message);
      case 'GET_SECRET_STATUS': {
        const settings = checkedSettings(await readSettings());
        const status = await secretStatus(settings.keyMode);
        return { hasKey: Boolean(status.hasKey), mode: settings.keyMode };
      }
      case 'REMOVE_API_KEY': return mutate(async () => {
        await cancelAll();
        await deleteKey();
        return { hasKey: false, mode: checkedSettings(await readSettings()).keyMode };
      });
      case 'TEST_CONNECTION': case 'LIST_MODELS': return providerAction(message);
      case 'GET_CACHE_STATS': return translationCache().stats();
      case 'CLEAR_CACHE': await translationCache().clear(); return translationCache().stats();
      case 'GET_ERROR_LOG': return errorJournal.list();
      case 'CLEAR_ERROR_LOG': await errorJournal.clear(); return [];
      case 'START_TRANSLATION': return start(message.tabId);
      case 'CANCEL_TRANSLATION': return cancel(message.tabId);
      case 'SET_DISPLAY_MODE': return setDisplay(message.tabId, message.mode);
      case 'GET_TAB_STATE': {
        const tab = await tabFor(message.tabId);
        const session = registry.get(tab.id);
        return session ? registry.snapshot(session) : createIdleState(tab.id);
      }
    }
  }

  async function handleMessage(value: unknown, sender: Sender): Promise<ApiResult> {
    if (disposed) return { ok: false, error: safeError(new LinguistyError('CANCELLED')) };
    if (messages >= MAX_MESSAGES) return { ok: false, error: safeError(new LinguistyError('RATE_LIMIT', undefined, true)) };
    messages += 1;
    try {
      if (sender.id !== api.runtime.id) throw new LinguistyError('PERMISSION_REQUIRED');
      const message = validateMessage(value);
      if (['START_TRANSLATION', 'CANCEL_TRANSLATION', 'SET_DISPLAY_MODE', 'GET_TAB_STATE',
        'TRANSLATE_BATCH', 'PAGE_PROGRESS', 'BEGIN_PAGE_SESSION'].includes(message.type)) await recoverSessions();
      if (disposed) throw new LinguistyError('CANCELLED');
      return { ok: true, data: await dispatch(message, sender) };
    } catch (error) {
      return { ok: false, error: safeError(error) };
    } finally {
      messages -= 1;
    }
  }

  const onMessage: Parameters<BrowserApi['runtime']['onMessage']['addListener']>[0] = (message: unknown, sender, sendResponse) => {
    if (!record(message) || message.channel !== CHANNEL) return undefined;
    void handleMessage(message, sender).then(sendResponse);
    return true; // Compatible with Chrome 120 and Firefox; do not make this listener async.
  };
  const cleanupTab = (tabId: number): void => {
    navigationChecks.get(tabId)?.abort();
    navigationChecks.delete(tabId);
    for (const [controller, pendingTab] of starts) {
      if (pendingTab === tabId) controller.abort();
    }
    registry.remove(tabId);
    void (recovery ?? ready).then(async () => {
      if (disposed) return;
      registry.remove(tabId);
      await registry.persist();
      publish(createIdleState(tabId));
    }).catch(() => undefined);
  };
  const onRemoved: Parameters<BrowserApi['tabs']['onRemoved']['addListener']>[0] = (tabId) => { cleanupTab(tabId); void cleanupCodexAuth(api, tabId); };

  /** @spec spec://modules/platform/INFRA-001-extension#runtime */
  function checkNavigation(tabId: number, completed = false): void {
    const session = registry.get(tabId);
    if (!session) return;
    navigationChecks.get(tabId)?.abort();
    const controller = new AbortController();
    navigationChecks.set(tabId, controller);
    commandRequests.add(controller);
    if (!completed) registry.abortBatches(session);
    void registry.persist().catch(() => undefined);
    void abortable(async () => {
      const results = await api.scripting.executeScript({ target: { tabId, frameIds: [0] }, func: () => null });
      if (disposed || registry.get(tabId) !== session || controller.signal.aborted) return;
      const documentId = results.find((result) => result.frameId === 0)?.documentId;
      if (documentId && session.documentId) {
        if (documentId !== session.documentId) cleanupTab(tabId);
        return;
      }
      // Older documentId implementations can still prove that the old injected
      // controller is present. A complete event repeats the check after a real load.
      const state = await contentCommand(tabId, { command: 'get-state' }, controller);
      if (registry.get(tabId) === session && state.sessionId !== session.sessionId) cleanupTab(tabId);
    }, controller, COMMAND_TIMEOUT_MS).catch((error: unknown) => {
      if (disposed || registry.get(tabId) !== session) return;
      if (error instanceof LinguistyError && error.code === 'CANCELLED') return;
      cleanupTab(tabId);
    }).finally(() => {
      commandRequests.delete(controller);
      if (navigationChecks.get(tabId) === controller) {
        navigationChecks.delete(tabId);
        if (completed) session.awaitingNavigation = false;
      }
    });
  }

  const onUpdated: Parameters<BrowserApi['tabs']['onUpdated']['addListener']>[0] = (tabId, change) => {
    if (change.url !== undefined && !isTranslatableUrl(change.url, firefox)) {
      cleanupTab(tabId);
    } else if (change.status === 'loading') {
      const session = registry.get(tabId);
      if (!session) {
        if ([...starts.values()].includes(tabId)) cleanupTab(tabId);
        return;
      }
      // Chrome can report loading for a same-document history transition. Preserve
      // its session for BEGIN_PAGE_SESSION; only a different document removes it.
      session.awaitingNavigation = true;
      checkNavigation(tabId);
    } else if (change.status === 'complete' && registry.get(tabId)?.awaitingNavigation) {
      checkNavigation(tabId, true);
    }
  };

  // Registration is synchronous, before the first storage await and before any engine/cache work.
  api.runtime.onMessage.addListener(onMessage);
  api.tabs.onRemoved.addListener(onRemoved);
  api.tabs.onUpdated.addListener(onUpdated);
  void cleanupCodexAuth(api);
  const ready = recoverSessions();
  void ready.catch(() => undefined);

  const registration: BackgroundRegistration = {
    ready, handleMessage,
    resources: () => ({ ...registry.resources(), requests, messages, mutations, commands: commandRequests.size, starts: starts.size, navigationChecks: navigationChecks.size }),
    async dispose(preserveSnapshots = false) {
      if (disposed) return;
      disposed = true;
      requestActivity.dispose();
      api.runtime.onMessage.removeListener(onMessage);
      api.tabs.onRemoved.removeListener(onRemoved);
      api.tabs.onUpdated.removeListener(onUpdated);
      registrations.delete(api);
      for (const controller of uiRequests) controller.abort();
      for (const controller of commandRequests) controller.abort();
      await recovery?.catch(() => undefined);
      await ready.catch(() => undefined);
      await registry.dispose(preserveSnapshots);
      await mutationQueue;
      await cache?.dispose();
    },
  };
  registrations.set(api, registration);
  return registration;
}
