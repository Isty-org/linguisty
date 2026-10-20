/** @spec spec://common/PROP-001-contracts#types */
export type CliProviderId = 'codex-cli' | 'claude-code' | 'antigravity-cli' | 'grok-build';
export type ProviderId = 'openrouter' | 'openai-compatible' | 'codex' | CliProviderId;
export type TranslationStyle = 'natural' | 'accurate' | 'literal';
export type Theme = 'system' | 'light' | 'dark';
export type KeyMode = 'session' | 'persistent';
export type DisplayMode = 'original' | 'translated';
export type TranslationStatus = 'idle' | 'scanning' | 'translating' | 'completed' | 'cancelled' | 'error';

export interface Settings {
  schemaVersion: 1;
  providerId: ProviderId;
  baseUrl: string;
  model: string;
  sourceLanguage: string;
  targetLanguage: string;
  targetLanguageMode: 'browser' | 'manual';
  uiLanguage: string;
  style: TranslationStyle;
  customInstructions: string;
  theme: Theme;
  keyMode: KeyMode;
  concurrency: number;
  maxNodesPerBatch: number;
  maxCharsPerBatch: number;
  requestTimeoutMs: number;
  streaming: boolean;
}

export interface PageContext {
  title: string;
  domain: string;
  contentType?: string;
}

export interface TranslationNode {
  id: string;
  text: string;
  group?: string;
  priority?: number;
}

export interface TranslationInput {
  nodes: TranslationNode[];
  pageContext: PageContext;
  sourceLanguage: string;
  targetLanguage: string;
  style: TranslationStyle;
  customInstructions: string;
}

export interface ProviderConfig {
  providerId: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  streaming?: boolean;
  /** Opaque verified account scope for Codex cache isolation; never an OAuth token. */
  accountScope?: string;
}

export interface TranslationItem { id: string; text: string }
export type TranslationProgress = { kind: 'reset' } | { kind: 'segments'; translations: TranslationItem[] };
export type BatchProgressCommand = { command: 'batch-progress'; sessionId: string; batchId: string; sequence: number; progress: TranslationProgress };
export interface TranslationResult {
  translations: TranslationItem[];
  fromCache: number;
  /** Engine returns source IDs for exact progress after a DOM node changes or disappears. */
  cacheHitIds?: string[];
}
export interface ModelInfo { id: string; name: string; contextLength?: number; supportsStructuredOutput?: boolean }
export interface ConnectionTestResult { success: boolean; message: string }

export interface TranslationProvider {
  readonly id: ProviderId;
  translate(input: TranslationInput, config: ProviderConfig, signal?: AbortSignal, sourceContext?: TranslationNode[], onProgress?: (progress: TranslationProgress) => void): Promise<TranslationResult>;
  testConnection(config: ProviderConfig, signal?: AbortSignal): Promise<ConnectionTestResult>;
  listModels(config: ProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]>;
}

export interface CacheStats { entries: number; estimatedBytes: number; hits: number; misses: number }
export interface TranslationCache {
  get(key: string): Promise<string | undefined>;
  set(key: string, text: string): Promise<void>;
  clear(): Promise<void>;
  stats(): Promise<CacheStats>;
  prune(): Promise<void>;
  dispose(): Promise<void>;
}

export type ErrorCode =
  | 'INVALID_API_KEY' | 'PERMISSION_REQUIRED' | 'RATE_LIMIT' | 'PROVIDER_UNAVAILABLE'
  | 'MODEL_NOT_FOUND' | 'REQUEST_TIMEOUT' | 'INVALID_MODEL_RESPONSE' | 'NETWORK_ERROR'
  | 'CONTEXT_TOO_LARGE' | 'CANCELLED' | 'INVALID_SETTINGS' | 'RESTRICTED_PAGE' | 'INTERNAL_ERROR'
  | 'CLI_HOST_MISSING' | 'CLI_NOT_FOUND' | 'CLI_LOGIN_REQUIRED' | 'CLI_EXECUTION_FAILED'
  | 'CODEX_NOT_CONNECTED' | 'CODEX_AUTH_FAILED' | 'CODEX_PLAN_REQUIRED';

export interface PublicError { code: ErrorCode; message: string; retryable: boolean }
export type ApiOperation = 'translate' | 'test-connection' | 'list-models';
export interface ApiDiagnostic {
  source: 'api' | 'network' | 'timeout' | 'invalid-response';
  httpStatus?: number;
  apiCode?: string;
  apiType?: string;
  message?: string;
  providerMessage?: string;
  requestId?: string;
}
export interface ApiErrorInput extends ApiDiagnostic {
  operation: ApiOperation;
  providerId: ProviderId;
  model: string;
  errorCode: ErrorCode;
  attempts: number;
}
export interface ApiErrorEntry extends ApiErrorInput { id: string; createdAt: number }
export type ApiResult<T = unknown> = { ok: true; data: T } | { ok: false; error: PublicError };
export interface SecretStatus { hasKey: boolean; mode: KeyMode }

export interface TabTranslationState {
  tabId?: number;
  sessionId: string | null;
  status: TranslationStatus;
  displayMode: DisplayMode;
  discovered: number;
  translated: number;
  failed: number;
  inFlight: number;
  fromCache: number;
  limited: boolean;
  error?: PublicError;
}

export type ContentCommand =
  | BatchProgressCommand
  | { command: 'start'; sessionId: string; settings: Settings }
  | { command: 'cancel' }
  | { command: 'set-display'; mode: DisplayMode }
  | { command: 'get-state' };

export type RuntimeMessage = { channel: 'linguisty' } & (
  | { type: 'GET_SETTINGS' }
  | { type: 'OPEN_CODEX_CONNECTION' }
  | { type: 'GET_CODEX_STATUS' }
  | { type: 'SAVE_SETTINGS'; settings: Settings; apiKey?: string; preserveKeyMode?: boolean; languagesOnly?: boolean }
  | { type: 'GET_SECRET_STATUS' }
  | { type: 'REMOVE_API_KEY' }
  | { type: 'TEST_CONNECTION'; settings?: Settings; apiKey?: string }
  | { type: 'LIST_MODELS'; settings?: Settings; apiKey?: string }
  | { type: 'GET_CACHE_STATS' }
  | { type: 'CLEAR_CACHE' }
  | { type: 'GET_ERROR_LOG' }
  | { type: 'CLEAR_ERROR_LOG' }
  | { type: 'START_TRANSLATION'; tabId?: number }
  | { type: 'CANCEL_TRANSLATION'; tabId?: number }
  | { type: 'SET_DISPLAY_MODE'; tabId?: number; mode: DisplayMode }
  | { type: 'GET_TAB_STATE'; tabId?: number }
  | { type: 'TRANSLATE_BATCH'; sessionId: string; batchId: string; nodes: TranslationNode[]; pageContext: PageContext }
  | { type: 'PAGE_PROGRESS'; sessionId: string; state: TabTranslationState }
  | { type: 'BEGIN_PAGE_SESSION'; previousSessionId: string; pageContext: PageContext }
  | { type: 'CONTENT_COMMAND'; payload: ContentCommand }
  | { type: 'TAB_STATE_CHANGED'; state: TabTranslationState }
);

export interface PageController {
  progress(command: BatchProgressCommand): TabTranslationState;
  start(sessionId: string, settings: Settings): Promise<TabTranslationState>;
  cancel(): Promise<TabTranslationState>;
  setDisplayMode(mode: DisplayMode): Promise<TabTranslationState>;
  getState(): TabTranslationState;
  dispose(): void;
}

