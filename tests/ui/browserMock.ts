import { vi } from 'vitest';
import type { ApiErrorEntry, ApiResult, CacheStats, ConnectionTestResult, ModelInfo, PublicError, RuntimeMessage, SecretStatus, Settings, TabTranslationState } from '../../src/shared/contracts';
import { DEFAULT_SETTINGS, createIdleState } from '../../src/shared/constants';
import { setI18nPreference } from '../../src/ui/i18n';

const mockedBrowser = vi.hoisted(() => ({
  sendMessage: vi.fn<(message: RuntimeMessage) => Promise<ApiResult<unknown>>>(),
  request: vi.fn<(permission: { origins?: string[]; permissions?: string[] }) => Promise<boolean>>(),
  query: vi.fn<() => Promise<{ id: number }[]>>(),
  openOptionsPage: vi.fn<() => Promise<void>>(),
  getURL: vi.fn<(path: string) => string>(),
  getSelf: vi.fn<() => Promise<{ installType: string }>>(),
  addListener: vi.fn<(listener: (message: unknown) => void) => void>(),
  removeListener: vi.fn<(listener: (message: unknown) => void) => void>(),
  listeners: new Set<(message: unknown) => void>(),
  messages: [] as RuntimeMessage[],
  flow: [] as string[],
  settings: {} as Settings,
  secret: {} as SecretStatus,
  state: {} as TabTranslationState,
  cache: {} as CacheStats,
  models: [] as ModelInfo[],
  errorLog: [] as ApiErrorEntry[],
  connection: {} as ConnectionTestResult,
  codexConnected: false,
  failures: new Map<RuntimeMessage['type'], PublicError>(),
}));

export const browserMock = mockedBrowser;

vi.mock('wxt/browser', () => ({ browser: {
  permissions: { request: mockedBrowser.request },
  tabs: { query: mockedBrowser.query },
  management: { getSelf: mockedBrowser.getSelf },
  runtime: {
    id: 'abcdefghijklmnopabcdefghijklmnop',
    sendMessage: mockedBrowser.sendMessage, openOptionsPage: mockedBrowser.openOptionsPage,
    getURL: mockedBrowser.getURL,
    onMessage: { addListener: mockedBrowser.addListener, removeListener: mockedBrowser.removeListener },
  },
} }));

export function resetBrowser() {
  browserMock.sendMessage.mockReset();
  browserMock.request.mockReset();
  browserMock.query.mockReset();
  browserMock.openOptionsPage.mockReset();
  browserMock.getURL.mockReset();
  browserMock.getSelf.mockReset();
  browserMock.addListener.mockReset();
  browserMock.removeListener.mockReset();
  browserMock.listeners.clear();
  browserMock.messages = [];
  browserMock.flow = [];
  browserMock.failures.clear();
  browserMock.settings = { ...DEFAULT_SETTINGS, uiLanguage: 'ru', targetLanguage: 'ru', targetLanguageMode: 'manual', model: 'vendor/model' };
  browserMock.secret = { hasKey: true, mode: 'session' };
  browserMock.state = createIdleState(7);
  browserMock.cache = { entries: 5, estimatedBytes: 4_096, hits: 2, misses: 3 };
  browserMock.models = [{ id: 'vendor/model', name: 'Model' }, { id: 'vendor/other', name: 'Other model' }];
  browserMock.connection = { success: true, message: 'Подключение проверено.' };
  browserMock.codexConnected = false;
  browserMock.errorLog = [];
  browserMock.request.mockImplementation(async () => { browserMock.flow.push('permissions'); return true; });
  browserMock.query.mockResolvedValue([{ id: 7 }]);
  browserMock.openOptionsPage.mockResolvedValue(undefined);
  browserMock.getURL.mockImplementation(path => `chrome-extension://test/${path.replace(/^\//, '')}`);
  browserMock.getSelf.mockResolvedValue({ installType: 'normal' });
  browserMock.addListener.mockImplementation((listener) => { browserMock.listeners.add(listener); });
  browserMock.removeListener.mockImplementation((listener) => { browserMock.listeners.delete(listener); });
  browserMock.sendMessage.mockImplementation(async (message) => {
    browserMock.messages.push(message);
    browserMock.flow.push(message.type);
    const failure = browserMock.failures.get(message.type);
    if (failure) return { ok: false, error: failure };
    let data: unknown;
    switch (message.type) {
      case 'GET_SETTINGS': data = { ...browserMock.settings }; break;
      case 'OPEN_CODEX_CONNECTION': data = { tabId: 8 }; break;
      case 'GET_CODEX_STATUS': data = { connected: browserMock.codexConnected }; break;
      case 'GET_SECRET_STATUS': data = { ...browserMock.secret }; break;
      case 'GET_TAB_STATE': data = { ...browserMock.state }; break;
      case 'SAVE_SETTINGS':
        browserMock.settings = message.languagesOnly ? { ...browserMock.settings,
          sourceLanguage: message.settings.sourceLanguage, targetLanguage: message.settings.targetLanguage,
          targetLanguageMode: message.settings.targetLanguageMode,
        } : { ...message.settings, ...(message.preserveKeyMode ? { keyMode: browserMock.settings.keyMode } : {}) };
        browserMock.secret = { hasKey: !!message.apiKey?.trim() || browserMock.secret.hasKey, mode: browserMock.settings.keyMode };
        data = { ...browserMock.settings };
        break;
      case 'REMOVE_API_KEY': browserMock.secret.hasKey = false; data = undefined; break;
      case 'TEST_CONNECTION': data = { ...browserMock.connection }; break;
      case 'LIST_MODELS': data = [...browserMock.models]; break;
      case 'GET_ERROR_LOG': data = [...browserMock.errorLog]; break;
      case 'CLEAR_ERROR_LOG': browserMock.errorLog = []; data = []; break;
      case 'GET_CACHE_STATS': data = { ...browserMock.cache }; break;
      case 'CLEAR_CACHE': browserMock.cache = { entries: 0, estimatedBytes: 0, hits: 0, misses: 0 }; data = { ...browserMock.cache }; break;
      case 'START_TRANSLATION': browserMock.state = { ...browserMock.state, sessionId: 'session-test', status: 'translating', discovered: 10 }; data = { ...browserMock.state }; break;
      case 'CANCEL_TRANSLATION': browserMock.state = { ...browserMock.state, status: 'cancelled', inFlight: 0 }; data = { ...browserMock.state }; break;
      case 'SET_DISPLAY_MODE': browserMock.state = { ...browserMock.state, displayMode: message.mode }; data = { ...browserMock.state }; break;
      default: throw new Error(`Unexpected test message: ${message.type}`);
    }
    return { ok: true, data };
  });
  localStorage.clear();
  setI18nPreference('ru');
}

export function messagesOf<T extends RuntimeMessage['type']>(type: T): Extract<RuntimeMessage, { type: T }>[] {
  return browserMock.messages.filter((message): message is Extract<RuntimeMessage, { type: T }> => message.type === type);
}

export function publish(state: TabTranslationState): void {
  browserMock.state = state;
  for (const listener of browserMock.listeners) listener({ channel: 'linguisty', type: 'TAB_STATE_CHANGED', state });
}
