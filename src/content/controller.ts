/** @spec spec://modules/page/FEAT-002-page-translation#sessions */
import { CHANNEL, MAX_RESPONSE_BYTES, createIdleState } from '../shared/constants';
import type { BatchProgressCommand, DisplayMode, PageContext, PageController, PublicError, RuntimeMessage, Settings, TabTranslationState, TranslationResult } from '../shared/contracts';
import { LinguistyError, toPublicError } from '../shared/errors';
import { sendMessage as runtimeSendMessage } from '../shared/messaging';
import { takeBatch } from './batcher';
import { NodeRegistry, syncExternalText, type CacheHitGroup, type NodeEntry } from './registry';
import { acceptTranslation, previewTranslation, rollbackPreview, writeDisplay, type NodeSnapshot } from './renderer';
import { getTextRects, scanTextNodes, viewportPriority, type ScannerOptions } from './scanner';
import { PageTypography, type MeasureFontInk } from './typography';
import { batchTimeoutMs, joinTranslatedParts, MAX_LONG_NODE_CHARS, splitText, TARGET_BATCH_COST } from '../translation/segments';
import { isProviderId } from '../shared/providers';

type MessageTransport = <T>(message: RuntimeMessage, options?: { signal?: AbortSignal; timeoutMs?: number }) => Promise<T>;
export type MutationObserverHandle = Pick<MutationObserver, 'observe' | 'disconnect' | 'takeRecords'>;
export type IntersectionObserverHandle = Pick<IntersectionObserver, 'observe' | 'unobserve' | 'disconnect'>;

export interface PageControllerOptions {
  document?: Document;
  window?: Window;
  sendMessage?: MessageTransport;
  createMutationObserver?: (callback: MutationCallback) => MutationObserverHandle;
  createIntersectionObserver?: (callback: IntersectionObserverCallback) => IntersectionObserverHandle;
  measureText?: ScannerOptions['measureText'];
  measureFontInk?: MeasureFontInk;
  mutationDebounceMs?: number;
  navigationIntervalMs?: number;
  now?: () => number;
}

interface BatchJob {
  snapshots: NodeSnapshot[];
  ids: Set<string>;
  generation: number;
  sessionId: string;
  timer: number;
  controller: AbortController;
  progressSequence: number;
}

/** @spec spec://common/PROP-001-contracts#messages */
export function assertPageSettings(value: unknown): asserts value is Settings {
  if (!value || typeof value !== 'object') throw new LinguistyError('INVALID_SETTINGS');
  const s = value as Partial<Settings>;
  if (s.schemaVersion !== 1 || !isProviderId(s.providerId)
    || !['natural', 'accurate', 'literal'].includes(s.style ?? '') || !['system', 'light', 'dark'].includes(s.theme ?? '')
    || !['session', 'persistent'].includes(s.keyMode ?? '')
    || typeof s.streaming !== 'boolean'
    || !['baseUrl', 'model', 'sourceLanguage', 'targetLanguage', 'customInstructions'].every(key => typeof (s as Record<string, unknown>)[key] === 'string')
    || !Number.isInteger(s.concurrency) || (s.concurrency ?? 0) < 1 || (s.concurrency ?? 0) > 4
    || !Number.isInteger(s.maxNodesPerBatch) || (s.maxNodesPerBatch ?? 0) < 1 || (s.maxNodesPerBatch ?? 0) > 40
    || !Number.isInteger(s.maxCharsPerBatch) || (s.maxCharsPerBatch ?? 0) < 1 || (s.maxCharsPerBatch ?? 0) > 10_000
    || !Number.isInteger(s.requestTimeoutMs) || (s.requestTimeoutMs ?? 0) < 1_000 || (s.requestTimeoutMs ?? 0) > 120_000) {
    throw new LinguistyError('INVALID_SETTINGS');
  }
}

function copySettings(settings: Settings): Settings {
  // Copy only the public contract, including when an untyped runtime caller
  // supplied extra properties. No secret is stored in the page controller.
  const { schemaVersion, providerId, baseUrl, model, sourceLanguage, targetLanguage, targetLanguageMode, uiLanguage, style,
    customInstructions, theme, keyMode, concurrency, maxNodesPerBatch, maxCharsPerBatch, requestTimeoutMs, streaming } = settings;
  return { schemaVersion, providerId, baseUrl, model, sourceLanguage, targetLanguage, targetLanguageMode, uiLanguage, style,
    customInstructions, theme, keyMode, concurrency, maxNodesPerBatch, maxCharsPerBatch, requestTimeoutMs, streaming };
}

/** @spec spec://common/PROP-001-contracts#messages */
export function parseBatchProgress(value: Record<string, unknown>): BatchProgressCommand {
  const { sessionId, batchId, sequence, progress } = value;
  if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 128
    || typeof batchId !== 'string' || !batchId || batchId.length > 512
    || !Number.isSafeInteger(sequence) || (sequence as number) < 1 || !progress || typeof progress !== 'object') throw new LinguistyError('INVALID_MODEL_RESPONSE');
  const update = progress as Record<string, unknown>;
  if (update.kind === 'reset') return { command: 'batch-progress', sessionId, batchId, sequence: sequence as number, progress: { kind: 'reset' } };
  if (update.kind !== 'segments' || !Array.isArray(update.translations) || update.translations.length > 40) throw new LinguistyError('INVALID_MODEL_RESPONSE');
  const ids = new Set<string>();
  let bytes = 0;
  const translations = update.translations.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new LinguistyError('INVALID_MODEL_RESPONSE');
    const { id, text } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !id || id.length > 128 || ids.has(id) || typeof text !== 'string' || !text.trim()
      || text.length > MAX_RESPONSE_BYTES) throw new LinguistyError('INVALID_MODEL_RESPONSE');
    bytes += new TextEncoder().encode(text).byteLength;
    if (bytes > MAX_RESPONSE_BYTES) throw new LinguistyError('INVALID_MODEL_RESPONSE');
    ids.add(id); return { id, text };
  });
  return { command: 'batch-progress', sessionId, batchId, sequence: sequence as number, progress: { kind: 'segments', translations } };
}

/** @spec spec://common/PROP-001-contracts#modules */
function validateResult(result: TranslationResult, requestedIds: ReadonlySet<string>): Set<string> | undefined {
  const ids = new Set(requestedIds);
  let responseBytes = 0;
  if (!result || !Array.isArray(result.translations) || result.translations.length !== ids.size
    || !Number.isInteger(result.fromCache) || result.fromCache < 0 || result.fromCache > ids.size) {
    throw new LinguistyError('INVALID_MODEL_RESPONSE');
  }
  for (const item of result.translations) {
    if (!item || !ids.delete(item.id) || typeof item.text !== 'string' || !item.text.trim()
      || item.text.length > MAX_RESPONSE_BYTES) throw new LinguistyError('INVALID_MODEL_RESPONSE');
    responseBytes += new TextEncoder().encode(item.text).byteLength;
    if (responseBytes > MAX_RESPONSE_BYTES) throw new LinguistyError('INVALID_MODEL_RESPONSE');
  }
  if (result.cacheHitIds === undefined) {
    // Zero/all-hit legacy results are unambiguous. Mixed legacy mocks retain
    // the conservative aggregate fallback; the engine supplies IDs in production.
    if (result.fromCache === 0) return new Set();
    if (result.fromCache === requestedIds.size) return new Set(requestedIds);
    return undefined;
  }
  if (!Array.isArray(result.cacheHitIds) || result.cacheHitIds.length !== result.fromCache) {
    throw new LinguistyError('INVALID_MODEL_RESPONSE');
  }
  const cacheHitIds = new Set<string>();
  for (const id of result.cacheHitIds) {
    if (typeof id !== 'string' || !requestedIds.has(id) || cacheHitIds.has(id)) throw new LinguistyError('INVALID_MODEL_RESPONSE');
    cacheHitIds.add(id);
  }
  return cacheHitIds;
}

/** @spec spec://modules/page/FEAT-002-page-translation#sessions */
export function createPageController(options: PageControllerOptions = {}): PageController {
  const document = options.document ?? globalThis.document;
  const window = options.window ?? document.defaultView;
  if (!window) throw new LinguistyError('RESTRICTED_PAGE');
  const transport = options.sendMessage ?? runtimeSendMessage;
  const scanner: ScannerOptions = { document, window, measureText: options.measureText };
  const measure = options.measureText ?? getTextRects;
  const now = options.now ?? (() => Date.now());
  const mutationDelay = Math.max(0, Math.min(1_000, options.mutationDebounceMs ?? 400));
  const navigationDelay = Math.max(250, Math.min(10_000, options.navigationIntervalMs ?? 1_000));
  const registry = new NodeRegistry();
  const typography = new PageTypography(document, window, options.measureFontInk);
  const queue = new Map<string, NodeEntry>();
  const jobs = new Map<string, BatchJob>();
  const dirtyRoots = new Set<Node>();
  const intersectionTargets = new Map<Element, Set<NodeEntry>>();
  let observedParents = new WeakMap<NodeEntry, Element>();
  let state = createIdleState();
  let settings: Settings | undefined;
  let generation = 0;
  let batchSequence = 0;
  let active = false;
  let disposed = false;
  let navigating = false;
  let transportSuspended = false;
  let observing = false;
  let needsRescan = false;
  let lastUrl = '';
  let lastBody: HTMLElement | null = null;
  let mutationObserver: MutationObserverHandle | undefined;
  let intersectionObserver: IntersectionObserverHandle | undefined;
  let mutationTimer: number | undefined;
  let navigationTimer: number | undefined;
  let viewportTimer: number | undefined;
  let progressTimer: number | undefined;
  let handshakeTimer: number | undefined;
  let lastProgressAt = -Infinity;
  let listenersAttached = false;

  const getPageContext = (): PageContext => ({
    title: document.title.slice(0, 300),
    domain: document.location.hostname,
    ...(document.contentType ? { contentType: document.contentType } : {}),
  });
  const snapshot = (): TabTranslationState => ({ ...state, ...(state.error ? { error: { ...state.error } } : {}) });

  function sendProgress(progress = snapshot()): void {
    if (!progress.sessionId) return;
    void transport({ channel: CHANNEL, type: 'PAGE_PROGRESS', sessionId: progress.sessionId, state: progress }).catch(() => {
      // A closed tab/stopped worker must not create unhandled rejections or a
      // retry loop. The next command/progress snapshot can wake the worker.
    });
    lastProgressAt = now();
  }

  function publish(immediate = false): void {
    if (disposed || !state.sessionId) return;
    if (immediate || now() - lastProgressAt >= 100) {
      window!.clearTimeout(progressTimer);
      progressTimer = undefined;
      sendProgress();
    } else if (progressTimer === undefined) {
      progressTimer = window!.setTimeout(() => {
        progressTimer = undefined;
        if (!disposed) sendProgress();
      }, 100);
    }
  }

  /** @spec spec://modules/page/FEAT-002-page-translation#queue */
  function recount(): void {
    state.discovered = registry.size;
    state.translated = 0;
    state.failed = 0;
    state.inFlight = 0;
    state.fromCache = 0;
    const cacheGroups = new Set<CacheHitGroup>();
    for (const entry of registry.entries) {
      if (entry.phase === 'translated') {
        state.translated += 1;
        if (entry.cacheHit) state.fromCache += 1;
      }
      if (entry.phase === 'failed') state.failed += 1;
      if (entry.phase === 'translating') state.inFlight += 1;
      if (entry.cacheGroup) cacheGroups.add(entry.cacheGroup);
    }
    // Only legacy mixed mocks without IDs use aggregate groups. Production
    // counts come from each still-current entry's validated cache-hit membership.
    for (const group of cacheGroups) state.fromCache += Math.max(0, group.hits - (group.total - group.remaining));
    state.limited = registry.limited;
    if (active && !navigating) {
      if (jobs.size || (state.displayMode === 'translated' && !transportSuspended && queue.size)) state.status = 'translating';
      else if ((state.displayMode === 'original' || transportSuspended) && queue.size) state.status = 'idle';
      else state.status = state.failed && !state.translated ? 'error' : 'completed';
    }
  }

  function observeDocument(): void {
    if (!mutationObserver || !active || navigating || disposed) return;
    mutationObserver.observe(document, {
      childList: true, subtree: true, characterData: true, characterDataOldValue: true,
      attributes: true, attributeFilter: ['hidden', 'inert', 'aria-hidden', 'translate', 'contenteditable', 'style', 'class'],
    });
    observing = true;
  }

  /** @spec spec://modules/page/FEAT-002-page-translation#render */
  function ownedWrites(write: () => void): void {
    if (observing && mutationObserver) {
      const observer = mutationObserver;
      handleMutations(observer.takeRecords());
      observer.disconnect();
      observing = false;
    }
    try { write(); } finally { observeDocument(); }
  }

  function forgetIntersection(entry: NodeEntry): void {
    const element = observedParents.get(entry);
    if (!element) return;
    observedParents.delete(entry);
    const entries = intersectionTargets.get(element);
    if (entries?.delete(entry) && !entries.size) {
      intersectionObserver?.unobserve(element);
      intersectionTargets.delete(element);
    }
  }

  function watchEntry(entry: NodeEntry): void {
    if (!intersectionObserver || !entry.node.parentElement) return;
    const element = entry.node.parentElement;
    if (observedParents.get(entry) === element) return;
    forgetIntersection(entry);
    let entries = intersectionTargets.get(element);
    if (!entries) {
      entries = new Set();
      intersectionTargets.set(element, entries);
      intersectionObserver.observe(element);
    }
    entries.add(entry);
    observedParents.set(entry, element);
  }

  /** @spec spec://common/PROP-002-quality#resources */
  function prune(): void {
    typography.prune();
    for (const entry of registry.prune()) {
      queue.delete(entry.id);
      forgetIntersection(entry);
    }
    // Detached nodes are not kept alive by requests that have not resolved.
    for (const job of jobs.values()) job.snapshots = job.snapshots.filter(s => registry.get(s.entry.node) === s.entry);
    for (const root of dirtyRoots) if (!root.isConnected) dirtyRoots.delete(root);
  }

  function scan(root: Node): void {
    for (const candidate of scanTextNodes(root, scanner)) {
      const entry = registry.track(candidate);
      if (!entry) {
        state.error = { code: 'CONTEXT_TOO_LARGE', message: 'Достигнут предел 5 000 текстовых узлов. Часть страницы не переведена.', retryable: false };
        break;
      }
      if (entry.phase === 'pending') queue.set(entry.id, entry);
      watchEntry(entry);
    }
  }

  function stageRoot(root: Node): void {
    if (!active || navigating || !root.isConnected) return;
    if (state.displayMode === 'original') {
      needsRescan = true;
      return;
    }
    if (needsRescan) return;
    for (const known of dirtyRoots) {
      if (known.contains(root)) return;
      if (root.contains(known)) dirtyRoots.delete(known);
    }
    if (dirtyRoots.size >= 128) {
      dirtyRoots.clear();
      needsRescan = true;
    } else dirtyRoots.add(root);
  }

  function scheduleMutations(): void {
    if (!active || navigating || state.displayMode === 'original') return;
    window!.clearTimeout(mutationTimer);
    mutationTimer = window!.setTimeout(() => {
      mutationTimer = undefined;
      if (!active || checkNavigation() || state.displayMode === 'original') return;
      prune();
      if (needsRescan) scan(document.body ?? document.documentElement);
      else for (const root of dirtyRoots) if (root.isConnected) scan(root);
      dirtyRoots.clear();
      needsRescan = false;
      pump();
    }, mutationDelay);
  }

  /** @spec spec://modules/page/FEAT-002-page-translation#sessions */
  function handleMutations(records: MutationRecord[]): void {
    if (!active || navigating || disposed || !records.length || checkNavigation()) return;
    let changed = false;
    for (const record of records) {
      if (record.type === 'characterData' && record.target.nodeType === 3) {
        const entry = registry.get(record.target as Text);
        if (entry && syncExternalText(entry)) {
          ownedWrites(() => typography.restore(entry));
          queue.delete(entry.id);
        }
        stageRoot(record.target);
        changed = true;
      } else if (record.type === 'childList') {
        for (const node of record.addedNodes) stageRoot(node);
        if (record.addedNodes.length || record.removedNodes.length) changed = true;
      } else if (record.type === 'attributes') {
        ownedWrites(() => typography.invalidate(record.target));
        stageRoot(record.target);
        changed = true;
      }
    }
    if (changed) {
      prune();
      recount();
      publish();
      scheduleMutations();
    }
  }

  function clearJobs(): void {
    ownedWrites(() => { for (const job of jobs.values()) for (const saved of job.snapshots) rollbackPreview(saved.entry, typography, registry); });
    for (const job of jobs.values()) {
      window!.clearTimeout(job.timer);
      job.controller.abort();
    }
    jobs.clear();
  }

  /** @spec spec://common/PROP-002-quality#resources */
  function stopResources(): void {
    for (const timer of [mutationTimer, navigationTimer, viewportTimer, progressTimer, handshakeTimer]) window!.clearTimeout(timer);
    mutationTimer = navigationTimer = viewportTimer = progressTimer = handshakeTimer = undefined;
    mutationObserver?.disconnect();
    mutationObserver = undefined;
    observing = false;
    intersectionObserver?.disconnect();
    intersectionObserver = undefined;
    intersectionTargets.clear();
    observedParents = new WeakMap();
    dirtyRoots.clear();
    needsRescan = false;
    if (listenersAttached) {
      window!.removeEventListener('popstate', onNavigation);
      window!.removeEventListener('hashchange', onNavigation);
      window!.removeEventListener('scroll', onViewport);
      window!.removeEventListener('resize', onViewport);
      listenersAttached = false;
    }
    clearJobs();
  }

  function onNavigation(): void { checkNavigation(); }
  function onViewport(): void {
    if (!active || intersectionObserver || viewportTimer !== undefined || state.displayMode === 'original') return;
    viewportTimer = window!.setTimeout(() => {
      viewportTimer = undefined;
      if (!active || checkNavigation()) return;
      for (const entry of queue.values()) entry.priority = viewportPriority(measure(entry.node), window!);
      pump();
    }, 100);
  }

  function scheduleNavigation(): void {
    navigationTimer = window!.setTimeout(() => {
      navigationTimer = undefined;
      if (!active || disposed || checkNavigation()) return;
      prune();
      recount();
      scheduleNavigation();
    }, navigationDelay);
  }

  function attachResources(): void {
    const MutationConstructor = (window as Window & typeof globalThis).MutationObserver;
    mutationObserver = options.createMutationObserver?.(handleMutations)
      ?? new MutationConstructor(handleMutations);
    const IntersectionConstructor = (window as Window & typeof globalThis).IntersectionObserver;
    const onIntersection: IntersectionObserverCallback = records => {
      if (!active || navigating || disposed) return;
      for (const record of records) {
        for (const entry of intersectionTargets.get(record.target) ?? []) {
          entry.priority = viewportPriority(measure(entry.node), window!);
        }
      }
      pump();
    };
    intersectionObserver = options.createIntersectionObserver?.(onIntersection)
      ?? (IntersectionConstructor ? new IntersectionConstructor(onIntersection, { rootMargin: `${window!.innerHeight}px` }) : undefined);
    window!.addEventListener('popstate', onNavigation);
    window!.addEventListener('hashchange', onNavigation);
    window!.addEventListener('scroll', onViewport, { passive: true });
    window!.addEventListener('resize', onViewport);
    listenersAttached = true;
    observeDocument();
    scheduleNavigation();
  }

  function activate(sessionId: string, inputSettings: Settings, mode: DisplayMode): void {
    settings = copySettings(inputSettings);
    state = { ...createIdleState(), sessionId, displayMode: mode, status: 'scanning' };
    active = true;
    navigating = false;
    transportSuspended = false;
    lastUrl = document.location.href;
    lastBody = document.body;
    attachResources();
    if (mode === 'translated') scan(document.body ?? document.documentElement);
    else needsRescan = true;
    pump();
  }

  function abandonReturnedSession(sessionId: string): void {
    sendProgress({ ...createIdleState(), sessionId, status: 'cancelled', displayMode: state.displayMode });
  }

  function requestRouteSession(previousSessionId: string, token: number): void {
    const route = document.location.href;
    const body = document.body;
    handshakeTimer = window!.setTimeout(() => {
      handshakeTimer = undefined;
      if (generation !== token || disposed || !navigating) return;
      generation += 1;
      navigating = false;
      state.status = 'error';
      state.error = toPublicError(new LinguistyError('REQUEST_TIMEOUT'));
      publish(true);
    }, (settings?.requestTimeoutMs ?? 25_000) + 5_000);
    void transport<{ sessionId: string; settings: Settings }>({
      channel: CHANNEL, type: 'BEGIN_PAGE_SESSION', previousSessionId, pageContext: getPageContext(),
    }).then(response => {
      if (!response || typeof response.sessionId !== 'string' || !response.sessionId) throw new LinguistyError('INTERNAL_ERROR');
      assertPageSettings(response.settings);
      if (generation !== token || disposed || !navigating) {
        abandonReturnedSession(response.sessionId);
        return;
      }
      window!.clearTimeout(handshakeTimer);
      handshakeTimer = undefined;
      if (document.location.href !== route || document.body !== body) {
        requestRouteSession(response.sessionId, token);
        return;
      }
      activate(response.sessionId, response.settings, state.displayMode);
    }).catch(error => {
      if (generation !== token || disposed || !navigating) return;
      window!.clearTimeout(handshakeTimer);
      handshakeTimer = undefined;
      navigating = false;
      state.status = 'error';
      state.error = toPublicError(error);
      publish(true);
    });
  }

  /** @spec spec://modules/page/FEAT-002-page-translation#sessions */
  function checkNavigation(): boolean {
    if (!active || disposed || navigating || !state.sessionId) return false;
    if (lastUrl === document.location.href && lastBody === document.body) return false;
    const previousSessionId = state.sessionId;
    const token = ++generation;
    active = false;
    navigating = true;
    stopResources();
    queue.clear();
    // A retained header/footer must not be rescanned as translated source.
    for (const entry of registry.entries) writeDisplay(entry, 'original', typography, registry);
    typography.clear();
    registry.clear();
    state.status = 'scanning';
    recount();
    requestRouteSession(previousSessionId, token);
    return true;
  }

  function markFailed(job: BatchJob, batchId: string, error: PublicError): void {
    let cancelledEntries = 0;
    for (const saved of job.snapshots) {
      const { entry } = saved;
      if (entry.batchId !== batchId || entry.revision !== saved.revision) continue;
      if (syncExternalText(entry)) {
        ownedWrites(() => typography.restore(entry));
        stageRoot(entry.node);
      }
      else {
        ownedWrites(() => rollbackPreview(entry, typography, registry));
        entry.phase = error.code === 'CANCELLED' ? 'pending' : 'failed';
        entry.batchId = undefined;
        if (error.code === 'CANCELLED') { queue.set(entry.id, entry); cancelledEntries++; }
      }
    }
    if (error.code === 'CANCELLED') {
      // The background may abort before the original-mode command reaches us.
      // Wait for an explicit resume instead of retrying that race indefinitely.
      if (state.displayMode === 'translated' && cancelledEntries) transportSuspended = true;
    } else state.error = error;
  }

  function settle(batchId: string, result?: TranslationResult, error?: unknown): void {
    const job = jobs.get(batchId);
    if (!job || !active || disposed || job.generation !== generation || job.sessionId !== state.sessionId || checkNavigation()) return;
    window!.clearTimeout(job.timer);
    job.controller.abort();
    // Preserve all original IDs until validation, including detached entries;
    // validation uses the request ID set below, not retained DOM references.
    if (error !== undefined) markFailed(job, batchId, toPublicError(error));
    else if (result) {
      try {
        const cacheHitIds = validateResult(result, job.ids);
        const cacheGroup: CacheHitGroup | undefined = cacheHitIds === undefined
          ? { hits: result.fromCache, total: job.ids.size, remaining: 0 } : undefined;
        const output = new Map(result.translations.map(item => [item.id, item.text]));
        ownedWrites(() => {
          if (job.generation !== generation || !active) return;
          for (const saved of job.snapshots) {
            if (saved.entry.batchId === batchId && !scanTextNodes(saved.entry.node, scanner).next().value) {
              rollbackPreview(saved.entry, typography, registry);
              registry.remove(saved.entry);
              queue.delete(saved.entry.id);
              forgetIntersection(saved.entry);
              continue;
            }
            const text = output.get(saved.entry.id);
            if (text !== undefined && acceptTranslation(saved, batchId, text, state.displayMode, typography, registry)) {
              saved.entry.cacheHit = cacheHitIds?.has(saved.entry.id) ?? false;
              saved.entry.cacheGroup = cacheGroup;
              if (cacheGroup) cacheGroup.remaining += 1;
              continue;
            }
            if (saved.entry.phase === 'pending') stageRoot(saved.entry.node);
          }
        });
      } catch (failure) { markFailed(job, batchId, toPublicError(failure)); }
    }
    jobs.delete(batchId);
    prune();
    scheduleMutationsIfDirty();
    pump();
  }

  function scheduleMutationsIfDirty(): void {
    if (dirtyRoots.size || needsRescan) scheduleMutations();
  }

  function launch(entries: NodeEntry[]): void {
    if (!settings || !state.sessionId || !entries.length) return;
    const batchId = `${state.sessionId}:b${++batchSequence}`;
    const nodes = entries.map(entry => ({ id: entry.id, text: entry.original.trim(), group: entry.group, priority: entry.priority }));
    const saved = entries.map(entry => {
      entry.phase = 'translating';
      entry.batchId = batchId;
      return { entry, revision: entry.revision, original: entry.original };
    });
    const job: BatchJob = {
      snapshots: saved, ids: new Set(nodes.map(node => node.id)), generation, sessionId: state.sessionId,
      progressSequence: 0,
      controller: new AbortController(),
      timer: window!.setTimeout(() => settle(batchId, undefined, new LinguistyError('REQUEST_TIMEOUT')), batchTimeoutMs(settings.requestTimeoutMs) + 5_000),
    };
    jobs.set(batchId, job);
    dispatch(batchId, { channel: CHANNEL, type: 'TRANSLATE_BATCH', sessionId: state.sessionId, batchId, nodes, pageContext: getPageContext() }, settings);
  }

  /** @spec spec://modules/page/FEAT-002-page-translation#queue */
  function dispatch(batchId: string, message: Extract<RuntimeMessage, { type: 'TRANSLATE_BATCH' }>, jobSettings: Settings): void {
    // The pending operation retains message text and the abort signal, but no
    // job DOM snapshots; clearing jobs releases those references immediately.
    const wait = { signal: jobs.get(batchId)!.controller.signal, timeoutMs: batchTimeoutMs(jobSettings.requestTimeoutMs) + 5_000 };
    const operation = async (): Promise<TranslationResult> => {
      const node = message.nodes[0]!;
      // Ordinary batches retain their ID-based streaming path. A long Text node
      // is committed only once all bounded parts are validated and assembled.
      if (message.nodes.length !== 1) return transport<TranslationResult>(message, wait);
      let parts: string[];
      try { parts = splitText(node.text, jobSettings.maxCharsPerBatch, TARGET_BATCH_COST); }
      catch { throw new LinguistyError('CONTEXT_TOO_LARGE'); }
      if (parts.length <= 1) return transport<TranslationResult>(message, wait);
      const translations: string[] = [];
      let allCached = true;
      let bytes = 0;
      for (let index = 0; index < parts.length; index++) {
        if (!preparePart(batchId, jobSettings.requestTimeoutMs)) throw new LinguistyError('CANCELLED');
        const id = `${node.id}:p${index}`;
        const result = await transport<TranslationResult>({ ...message, batchId: `${batchId}:p${index}`,
          nodes: [{ ...node, id, text: parts[index]! }] }, wait);
        validateResult(result, new Set([id]));
        const text = result.translations[0]!.text;
        bytes += new TextEncoder().encode(text).byteLength;
        if (bytes > MAX_RESPONSE_BYTES) throw new LinguistyError('INVALID_MODEL_RESPONSE');
        translations.push(text);
        allCached &&= result.fromCache === 1;
      }
      return { translations: [{ id: node.id, text: joinTranslatedParts(parts, translations) }],
        fromCache: allCached ? 1 : 0, cacheHitIds: allCached ? [node.id] : [] };
    };
    void operation()
      .then(result => settle(batchId, result), error => settle(batchId, undefined, error));
  }

  function preparePart(batchId: string, timeoutMs: number): boolean {
    // This synchronous scope releases the job's DOM references before await.
    const job = jobs.get(batchId);
    if (!job || !active || disposed || state.displayMode !== 'translated' || job.generation !== generation
      || checkNavigation() || !job.snapshots.some(saved => saved.entry.node.isConnected
        && saved.entry.batchId === batchId && saved.entry.revision === saved.revision
        && saved.entry.node.data === saved.entry.expected)) return false;
    window!.clearTimeout(job.timer);
    job.timer = window!.setTimeout(() => settle(batchId, undefined, new LinguistyError('REQUEST_TIMEOUT')), batchTimeoutMs(timeoutMs) + 5_000);
    return true;
  }

  /** @spec spec://modules/page/FEAT-002-page-translation#queue */
  function pump(): void {
    if (!active || disposed || navigating || !settings || checkNavigation()) return;
    prune();
    if (state.displayMode === 'translated' && !transportSuspended) {
      while (queue.size && jobs.size < settings.concurrency) {
        const batch = takeBatch(queue, settings);
        for (const entry of batch.oversized) {
          entry.phase = 'failed';
          state.error = toPublicError(new LinguistyError('CONTEXT_TOO_LARGE'));
        }
        const ready: NodeEntry[] = [];
        let readyChars = 0;
        for (const entry of batch.entries) {
          if (syncExternalText(entry)) ownedWrites(() => typography.restore(entry));
          const candidate = scanTextNodes(entry.node, scanner).next().value;
          if (candidate && entry.phase === 'pending') {
            entry.priority = candidate.priority;
            const length = entry.original.trim().length;
            if (length > MAX_LONG_NODE_CHARS) {
              entry.phase = 'failed';
              state.error = toPublicError(new LinguistyError('CONTEXT_TOO_LARGE'));
            } else if (!ready.length || readyChars + length <= settings.maxCharsPerBatch) {
              ready.push(entry);
              readyChars += length;
            } else queue.set(entry.id, entry);
          } else if (!candidate) {
            registry.remove(entry);
            forgetIntersection(entry);
          }
        }
        launch(ready);
      }
    }
    recount();
    publish();
  }

  return {
    progress(rawCommand) {
      const command = parseBatchProgress(rawCommand);
      const job = jobs.get(command.batchId);
      if (disposed || !active || state.displayMode !== 'translated' || !settings?.streaming || !job
        || job.generation !== generation || job.sessionId !== command.sessionId || command.sessionId !== state.sessionId
        || command.sequence <= job.progressSequence || checkNavigation()) return snapshot();
      const translations = command.progress.kind === 'segments' ? command.progress.translations : [];
      if (translations.some(item => !job.ids.has(item.id))) throw new LinguistyError('INVALID_MODEL_RESPONSE');
      job.progressSequence = command.sequence;
      const values = new Map(translations.map(item => [item.id, item.text]));
      ownedWrites(() => {
        if (!active || job.generation !== generation) return;
        for (const saved of job.snapshots) {
          const text = values.get(saved.entry.id);
          if (text === undefined || !scanTextNodes(saved.entry.node, scanner).next().value) rollbackPreview(saved.entry, typography, registry);
          else previewTranslation(saved, command.batchId, text, typography, registry);
        }
      });
      prune();
      return snapshot();
    },
    async start(sessionId, inputSettings) {
      if (disposed) throw new LinguistyError('CANCELLED');
      if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 128) throw new LinguistyError('INTERNAL_ERROR');
      assertPageSettings(inputSettings);
      if (!/^https?:$/u.test(document.location.protocol) || window!.top !== window) throw new LinguistyError('RESTRICTED_PAGE');
      generation += 1;
      active = navigating = false;
      stopResources();
      queue.clear();
      for (const entry of registry.entries) writeDisplay(entry, 'original', typography, registry);
      typography.clear();
      registry.clear();
      activate(sessionId, inputSettings, 'translated');
      return snapshot();
    },
    async cancel() {
      if (disposed) return snapshot();
      generation += 1;
      active = navigating = false;
      stopResources();
      queue.clear();
      // Completed originals remain available for an offline toggle after
      // cancellation. All unfinished and detached entries release references.
      for (const entry of registry.entries) {
        syncExternalText(entry);
        if (!entry.node.isConnected || entry.phase !== 'translated') {
          typography.restore(entry);
          registry.remove(entry);
        }
      }
      state.status = 'cancelled';
      state.error = undefined;
      recount();
      publish(true);
      return snapshot();
    },
    async setDisplayMode(mode) {
      if (mode !== 'original' && mode !== 'translated') throw new LinguistyError('INTERNAL_ERROR');
      if (disposed) return snapshot();
      state.displayMode = mode;
      if (mode === 'translated') transportSuspended = false;
      if (mode === 'original') {
        // Restore stops waiting for the current batch and every long-node part.
        for (const batchId of [...jobs.keys()]) settle(batchId, undefined, new LinguistyError('CANCELLED'));
        window!.clearTimeout(mutationTimer);
        mutationTimer = undefined;
        dirtyRoots.clear();
        ownedWrites(() => { for (const entry of registry.entries) rollbackPreview(entry, typography, registry); });
      }
      ownedWrites(() => { for (const entry of registry.entries) writeDisplay(entry, mode, typography, registry); });
      prune();
      if (mode === 'translated' && active && !checkNavigation()) {
        scan(document.body ?? document.documentElement);
        needsRescan = false;
        dirtyRoots.clear();
        pump();
      } else {
        recount();
        publish(true);
      }
      return snapshot();
    },
    getState: snapshot,
    dispose() {
      if (disposed) return;
      generation += 1;
      active = navigating = false;
      stopResources();
      if (state.sessionId) sendProgress({ ...snapshot(), status: 'cancelled', inFlight: 0 });
      queue.clear();
      for (const entry of registry.entries) writeDisplay(entry, 'original', typography, registry);
      typography.dispose();
      registry.clear();
      state = { ...createIdleState(), status: 'cancelled' };
      disposed = true;
    },
  };
}
