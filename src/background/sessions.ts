/** @spec spec://modules/platform/INFRA-001-extension#recovery */
import type { browser } from 'wxt/browser';
import type { Settings, TabTranslationState, TranslationResult } from '../shared/contracts';
import { createIdleState } from '../shared/constants';
import { LinguistyError } from '../shared/errors';
import { isTranslatableUrl, record, safeError, validateSettings, validateState, validSessionId, validTabId } from './validation';

export const SESSION_STORAGE_KEY = 'linguisty.tabSessions.v1';
export const MAX_SESSIONS = 32;
export const SESSION_TTL_MS = 8 * 60 * 60 * 1_000;

export interface BatchJob {
  fingerprint: string;
  controller: AbortController;
  promise: Promise<TranslationResult>;
}

export interface PageSession {
  tabId: number;
  sessionId: string;
  settings: Settings;
  state: TabTranslationState;
  updatedAt: number;
  revision: number;
  awaitingNavigation: boolean;
  documentId?: string;
  controller: AbortController;
  batches: Map<string, BatchJob>;
}

/** @spec spec://common/PROP-002-quality#resources */
export class SessionRegistry {
  private readonly sessions = new Map<number, PageSession>();
  private write: Promise<void> | undefined;
  private dirty = false;

  constructor(
    private readonly api: typeof browser,
    private readonly now: () => number = Date.now,
    private readonly normalize: (settings: Settings) => Settings = (settings) => settings,
  ) {}

  async restore(signal?: AbortSignal): Promise<void> {
    const checkActive = () => { if (signal?.aborted) throw new LinguistyError('CANCELLED'); };
    checkActive();
    if (!this.api.storage.session) throw new LinguistyError('INTERNAL_ERROR');
    const stored = (await this.api.storage.session.get(SESSION_STORAGE_KEY))[SESSION_STORAGE_KEY] as unknown;
    checkActive();
    const restored = new Map<number, PageSession>();
    if (record(stored) && stored.version === 1 && Array.isArray(stored.sessions)) {
      for (const value of stored.sessions.slice(0, MAX_SESSIONS)) {
        checkActive();
        try {
          if (!record(value) || !validTabId(value.tabId) || !validSessionId(value.sessionId)) continue;
          if (typeof value.updatedAt !== 'number' || !Number.isSafeInteger(value.updatedAt)
            || value.updatedAt > this.now() + 60_000 || this.now() - value.updatedAt > SESSION_TTL_MS) continue;
          const tab = await this.api.tabs.get(value.tabId);
          checkActive();
          if (!isTranslatableUrl(tab.url, this.api.runtime.getURL('/').startsWith('moz-extension:'))) continue;
          const settings = this.normalize(validateSettings(value.settings));
          const state = validateState(value.state, value.tabId);
          if (state.sessionId !== value.sessionId || restored.has(value.tabId)) continue;
          state.inFlight = 0;
          if (state.status === 'scanning' || state.status === 'translating') {
            // Lost requests must not leave a permanently spinning popup after a worker restart.
            state.status = 'error';
            state.error = safeError(new LinguistyError('REQUEST_TIMEOUT', undefined, true));
          }
          const session: PageSession = {
            tabId: value.tabId, sessionId: value.sessionId, settings, state,
            updatedAt: value.updatedAt, revision: 0, awaitingNavigation: false, controller: new AbortController(), batches: new Map(),
            ...(typeof value.documentId === 'string' && value.documentId.length <= 128 ? { documentId: value.documentId } : {}),
          };
          if (state.status === 'cancelled') session.controller.abort();
          restored.set(session.tabId, session);
        } catch {
          // Corrupt/closed/restricted entries are discarded individually, without logging data.
        }
      }
    }
    checkActive();
    for (const [tabId, session] of restored) this.sessions.set(tabId, session);
    await this.persist();
  }

  get(tabId: number): PageSession | undefined {
    this.prune();
    return this.sessions.get(tabId);
  }

  isCurrent(session: PageSession): boolean {
    return this.sessions.get(session.tabId) === session && !session.controller.signal.aborted;
  }

  create(tabId: number, settings: Settings, displayMode: TabTranslationState['displayMode'] = 'translated', documentId?: string): PageSession {
    this.prune();
    if (!this.sessions.has(tabId) && this.sessions.size >= MAX_SESSIONS) throw new LinguistyError('RATE_LIMIT', undefined, true);
    this.remove(tabId);
    const sessionId = globalThis.crypto.randomUUID();
    const session: PageSession = {
      tabId, sessionId, settings: this.normalize(validateSettings(settings)),
      state: { ...createIdleState(tabId), sessionId, status: 'scanning', displayMode },
      updatedAt: this.now(), revision: 0, awaitingNavigation: false, controller: new AbortController(), batches: new Map(),
      ...(documentId === undefined ? {} : { documentId }),
    };
    this.sessions.set(tabId, session);
    return session;
  }

  update(session: PageSession, state: TabTranslationState): void {
    if (this.sessions.get(session.tabId) !== session) throw new LinguistyError('CANCELLED');
    session.state = validateState(state, session.tabId);
    session.updatedAt = this.now();
    session.revision += 1;
  }

  abortBatches(session: PageSession): void {
    for (const batch of session.batches.values()) batch.controller.abort();
    session.batches.clear();
    session.state.inFlight = 0;
  }

  cancel(session: PageSession): TabTranslationState {
    session.controller.abort();
    this.abortBatches(session);
    this.update(session, { ...session.state, status: 'cancelled', inFlight: 0 });
    return this.snapshot(session);
  }

  remove(tabId: number): void {
    const session = this.sessions.get(tabId);
    if (!session) return;
    session.controller.abort();
    this.abortBatches(session);
    this.sessions.delete(tabId);
  }

  snapshot(session: PageSession): TabTranslationState {
    return validateState(session.state, session.tabId);
  }

  persist(): Promise<void> {
    // Coalesce progress writes. At most one flush and one dirty flag exist, rather than
    // an ever-growing promise queue. A removal is always reflected in the next snapshot.
    this.dirty = true;
    if (this.write) return this.write;
    this.write = Promise.resolve().then(async () => {
      while (this.dirty) {
        this.dirty = false;
        const snapshots = [...this.sessions.values()].map((session) => ({
          tabId: session.tabId, sessionId: session.sessionId,
          settings: validateSettings(session.settings), state: this.snapshot(session), updatedAt: session.updatedAt,
          ...(session.documentId === undefined ? {} : { documentId: session.documentId }),
        }));
        await this.api.storage.session.set({ [SESSION_STORAGE_KEY]: { version: 1, sessions: snapshots } });
      }
    }).finally(() => {
      this.write = undefined;
      if (this.dirty) return this.persist();
    });
    return this.write;
  }

  values(): PageSession[] {
    this.prune();
    return [...this.sessions.values()];
  }

  resources(): { sessions: number; batches: number } {
    this.prune();
    return { sessions: this.sessions.size, batches: [...this.sessions.values()].reduce((total, session) => total + session.batches.size, 0) };
  }

  async dispose(preserveSnapshots = false): Promise<void> {
    for (const tabId of this.sessions.keys()) this.remove(tabId);
    await this.write?.catch(() => undefined);
    if (!preserveSnapshots) await this.api.storage.session.remove(SESSION_STORAGE_KEY);
  }

  private prune(): void {
    let changed = false;
    for (const session of this.sessions.values()) {
      if (this.now() - session.updatedAt <= SESSION_TTL_MS) continue;
      this.remove(session.tabId);
      changed = true;
    }
    if (changed) void this.persist().catch(() => undefined);
  }
}
