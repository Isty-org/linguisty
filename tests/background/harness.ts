import { vi } from 'vitest';
import type { browser } from 'wxt/browser';
import type { ContentCommand, KeyMode, ProviderConfig, Settings, TabTranslationState, TranslationCache, TranslationInput, TranslationProgress, TranslationResult } from '../../src/shared/contracts';
import { createIdleState, DEFAULT_SETTINGS } from '../../src/shared/constants';

export type BrowserApi = typeof browser;
export type MessageListener = Parameters<BrowserApi['runtime']['onMessage']['addListener']>[0];
export type Sender = Parameters<MessageListener>[1];
type RemovedListener = Parameters<BrowserApi['tabs']['onRemoved']['addListener']>[0];
type UpdatedListener = Parameters<BrowserApi['tabs']['onUpdated']['addListener']>[0];

function event<Listener>() {
  const listeners = new Set<Listener>();
  return {
    listeners,
    addListener: vi.fn((listener: Listener) => { listeners.add(listener); }),
    removeListener: vi.fn((listener: Listener) => { listeners.delete(listener); }),
  };
}

export function fakeBrowser(scheme = 'chrome-extension') {
  const tabData = new Map([
    [1, { id: 1, url: 'https://example.org/article' }],
    [2, { id: 2, url: 'https://other.example/second' }],
  ]);
  const pageStates = new Map<number, TabTranslationState>();
  const documentIds = new Map([[1, 'doc-1'], [2, 'doc-2']]);
  const sessionData: Record<string, unknown> = {};
  const onMessage = event<MessageListener>();
  const onRemoved = event<RemovedListener>();
  const onUpdated = event<UpdatedListener>();
  const storage = {
    get: vi.fn(async (key: string) => ({ [key]: structuredClone(sessionData[key]) })),
    set: vi.fn(async (values: Record<string, unknown>) => { Object.assign(sessionData, structuredClone(values)); }),
    remove: vi.fn(async (key: string) => { delete sessionData[key]; }),
  };
  const runtime = {
    id: 'linguisty-test',
    getURL: vi.fn((path: string) => `${scheme}://linguisty-test/${path.replace(/^\/+/, '')}`),
    getPlatformInfo: vi.fn(async () => ({ os: 'win', arch: 'x86-64' })),
    sendMessage: vi.fn(async (_message: unknown) => undefined),
    onMessage,
  };
  const tabs = {
    query: vi.fn(async (_query: unknown) => [...tabData.values()]),
    get: vi.fn(async (tabId: number) => {
      const tab = tabData.get(tabId);
      if (!tab) throw new Error('Tab gone');
      return { ...tab };
    }),
    sendMessage: vi.fn(async (tabId: number, message: { payload: ContentCommand }, _options?: unknown) => {
      let state = pageStates.get(tabId);
      if (!state) throw new Error('No receiver');
      const command = message.payload;
      if (command.command === 'start') state = { ...createIdleState(tabId), sessionId: command.sessionId, status: 'scanning', displayMode: 'translated' };
      if (command.command === 'cancel') state = { ...state, status: 'cancelled', inFlight: 0 };
      if (command.command === 'set-display') state = { ...state, displayMode: command.mode };
      pageStates.set(tabId, state);
      return { ok: true, data: structuredClone(state) };
    }),
    onRemoved, onUpdated,
  };
  const scripting = {
    executeScript: vi.fn(async (details: { target: { tabId: number }; files?: string[]; func?: () => unknown }) => {
      if (details.files) pageStates.set(details.target.tabId, createIdleState(details.target.tabId));
      return [{ frameId: 0, documentId: documentIds.get(details.target.tabId) }];
    }),
  };
  const permissions = { contains: vi.fn(async (_request: unknown) => true) };
  const api = { runtime, tabs, scripting, permissions, storage: { session: storage } } as unknown as BrowserApi;
  const ui: Sender = { id: runtime.id, url: runtime.getURL('popup.html') };
  const content = (tabId = 1): Sender => ({
    id: runtime.id, url: tabData.get(tabId)?.url, tab: { id: tabId } as Sender['tab'], frameId: 0, documentId: documentIds.get(tabId),
  });
  return { api, runtime, tabs, scripting, permissions, storage, tabData, documentIds, pageStates, sessionData, ui, content };
}

export function fakeDependencies() {
  let storedSettings: Settings = { ...DEFAULT_SETTINGS, model: 'test/model' };
  const keys = new Map<KeyMode, string>([['session', 'fake-unit-test-key']]);
  const cache: TranslationCache = {
    get: vi.fn(async (_key: string) => undefined),
    set: vi.fn(async (_key: string, _text: string) => undefined),
    clear: vi.fn(async () => undefined),
    stats: vi.fn(async () => ({ entries: 0, estimatedBytes: 0, hits: 0, misses: 0 })),
    prune: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
  };
  const engine = {
    translate: vi.fn(async (input: TranslationInput, _config: ProviderConfig, _signal?: AbortSignal, _onProgress?: (progress: TranslationProgress) => void): Promise<TranslationResult> => ({ translations: input.nodes.map(({ id, text }) => ({ id, text: `Перевод ${text}` })), fromCache: 0 })),
    testConnection: vi.fn(async (_config: ProviderConfig, _signal?: AbortSignal) => ({ success: true, message: 'Mock connected' })),
    listModels: vi.fn(async (_config: ProviderConfig, _signal?: AbortSignal) => [{ id: 'test/model', name: 'Test model' }]),
  };
  const dependencies = {
    cache, engine,
    loadSettings: vi.fn(async () => ({ ...storedSettings })),
    saveSettings: vi.fn(async (settings: Settings) => { storedSettings = { ...settings }; }),
    getApiKey: vi.fn(async (mode: KeyMode) => keys.get(mode)),
    setApiKey: vi.fn(async (key: string | undefined, mode: KeyMode) => {
      const next = key?.trim() || keys.get(mode) || keys.get(mode === 'session' ? 'persistent' : 'session');
      keys.clear();
      if (next) keys.set(mode, next);
    }),
    removeApiKey: vi.fn(async () => { keys.clear(); }),
    getSecretStatus: vi.fn(async (mode: KeyMode) => ({ hasKey: keys.has(mode), mode })),
    saveConfiguration: vi.fn(async (settings: Settings, key?: string): Promise<void> => {
      const previous = { ...storedSettings };
      const previousKey = keys.get(previous.keyMode);
      await dependencies.setApiKey(key, settings.keyMode);
      try { await dependencies.saveSettings(settings); }
      catch (error) {
        if (previousKey) await dependencies.setApiKey(previousKey, previous.keyMode);
        else await dependencies.removeApiKey();
        throw error;
      }
    }),
  };
  return { dependencies, keys, settings: () => storedSettings };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((success, failure) => { resolve = success; reject = failure; });
  return { promise, resolve, reject };
}
