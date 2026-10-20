import type { ConnectionTestResult, ModelInfo, ProviderConfig, TranslationCache, TranslationInput, TranslationNode, TranslationProgress, TranslationResult } from '../shared/contracts';
import { LinguistyError } from '../shared/errors';
import { MAX_RESPONSE_BYTES } from '../shared/constants';
import { buildCacheKey } from '../cache/cacheKey';
import type { ProviderOptions } from '../providers/chatProvider';
import type { TranslationProvider } from '../shared/contracts';
import { credentialScope, digest, normalizeProviderConfig } from '../providers/config';
import { getProvider } from '../providers/registry';
import { throwIfCancelled, withSignal } from './abort';
import { snapshotInput } from './input';
import { RequestQueue } from './queue';
import { joinTranslatedParts, MAX_RECOVERY_DEPTH, splitText } from './segments';

interface FlightBatch {
  controller: AbortController;
  consumers: number;
  entries: FlightEntry[];
  settled: boolean;
  listeners: Set<() => void>;
}
interface FlightEntry {
  key: string;
  cacheKey: string;
  node: TranslationNode;
  batch: FlightBatch;
  promise: Promise<string>;
  resolve(text: string): void;
  reject(error: unknown): void;
  preview?: string;
}

/** @spec spec://modules/translation/FEAT-001-engine#dedup */
export class TranslationEngine {
  private readonly flights = new Map<string, FlightEntry>();
  private readonly queue = new RequestQueue();
  private readonly providers = new Map<ProviderConfig['providerId'], TranslationProvider>();

  constructor(private readonly cache: TranslationCache, private readonly options: ProviderOptions = {}) {}

  /** Lifecycle counters contain neither source text nor credentials. */
  get inFlightCount(): number { return this.flights.size; }
  get activeRequestCount(): number { return this.queue.activeCount; }
  get pendingRequestCount(): number { return this.queue.pendingCount; }
  get progressListenerCount(): number { return [...new Set([...this.flights.values()].map(entry => entry.batch))].reduce((sum, batch) => sum + batch.listeners.size, 0); }

  /** @spec spec://common/PROP-001-contracts#modules */
  async translate(rawInput: TranslationInput, rawConfig: ProviderConfig, signal?: AbortSignal, onProgress?: (progress: TranslationProgress) => void): Promise<TranslationResult> {
    throwIfCancelled(signal);
    const input = snapshotInput(rawInput);
    const config = normalizeProviderConfig(rawConfig, rawConfig?.providerId);
    const provider = this.provider(config);
    if (!input.nodes.length) return { translations: [], fromCache: 0, cacheHitIds: [] };
    const keyPromises = new Map<string, Promise<string>>();
    const [keys, scope] = await withSignal(Promise.all([
      Promise.all(input.nodes.map(node => {
        const identity = JSON.stringify([node.text, node.group ?? null]);
        let pendingKey = keyPromises.get(identity);
        if (pendingKey) return pendingKey;
        pendingKey = (async () => {
          const key = await buildCacheKey(node.text, input, config);
          // Identical phrases in different semantic groups must also stay distinct
          // within the very same batch; the common key includes the whole batch.
          return node.group === undefined ? key : digest(JSON.stringify([key, node.group]));
        })();
        keyPromises.set(identity, pendingKey);
        return pendingKey;
      })),
      credentialScope(config),
    ]), signal);
    const reads = new Map<string, Promise<string | undefined>>();
    const cached = await withSignal(Promise.all(keys.map(key => {
      let read = reads.get(key);
      if (!read) { read = this.cache.get(key).catch(() => undefined); reads.set(key, read); }
      return read;
    })), signal);
    throwIfCancelled(signal);
    const subscriptions = new Set<FlightBatch>();
    const fresh: FlightEntry[] = [];
    const batch: FlightBatch = { controller: new AbortController(), consumers: 0, entries: fresh, settled: false, listeners: new Set() };
    const cacheHitIds: string[] = [];
    const previews = new Map<FlightEntry, TranslationNode[]>();
    const emit = () => {
      if (!onProgress || signal?.aborted) return;
      const translations = [...previews].flatMap(([entry, nodes]) => entry.preview === undefined ? [] : nodes.map(node => ({ id: node.id, text: entry.preview! })));
      onProgress(translations.length ? { kind: 'segments', translations } : { kind: 'reset' });
    };
    try {
      const pending = input.nodes.map((node, index) => {
        const cachedText = cached[index];
        if (typeof cachedText === 'string' && (!node.text.trim() || cachedText.trim())) {
          cacheHitIds.push(node.id);
          return Promise.resolve({ id: node.id, text: cachedText });
        }
        const cacheKey = keys[index]!;
        const key = JSON.stringify([cacheKey, scope, config.timeoutMs, config.streaming === true]);
        let entry = this.flights.get(key);
        if (!entry) {
          if (this.flights.size >= 1_440) throw new LinguistyError('RATE_LIMIT');
          let resolve!: (value: string) => void;
          let reject!: (error: unknown) => void;
          const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
          // Reservations exist before launching the request; every rejection is observed.
          void promise.catch(() => undefined);
          entry = { key, cacheKey, node, batch, promise, resolve, reject };
          fresh.push(entry);
          this.flights.set(key, entry);
        }
        if (!subscriptions.has(entry.batch)) {
          subscriptions.add(entry.batch);
          entry.batch.consumers++;
          if (onProgress) entry.batch.listeners.add(emit);
        }
        if (onProgress) {
          const nodes = previews.get(entry) ?? [];
          nodes.push(node); previews.set(entry, nodes);
        }
        const remapped = entry.promise.then(text => ({ id: node.id, text }));
        void remapped.catch(() => undefined);
        return remapped;
      });
      const all = Promise.all(pending);
      void all.catch(() => undefined);
      if ([...previews.keys()].some(entry => entry.preview !== undefined)) emit();
      if (fresh.length) void this.runBatch(batch, input, config, provider);
      const translations = await withSignal(all, signal);
      throwIfCancelled(signal);
      return { translations, fromCache: cacheHitIds.length, cacheHitIds };
    } finally {
      for (const subscribed of subscriptions) {
        subscribed.listeners.delete(emit);
        subscribed.consumers--;
        if (subscribed.consumers === 0 && !subscribed.settled) {
          subscribed.controller.abort();
          this.finishBatch(subscribed, new LinguistyError('CANCELLED'));
        }
      }
      previews.clear();
    }
  }

  /** @spec spec://modules/translation/FEAT-001-engine#providers */
  async testConnection(rawConfig: ProviderConfig, signal?: AbortSignal): Promise<ConnectionTestResult> {
    throwIfCancelled(signal);
    const config = normalizeProviderConfig(rawConfig, rawConfig?.providerId);
    return this.queue.run(() => this.provider(config).testConnection(config, signal), signal);
  }

  async listModels(rawConfig: ProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]> {
    throwIfCancelled(signal);
    const config = normalizeProviderConfig(rawConfig, rawConfig?.providerId, false);
    return this.queue.run(() => this.provider(config).listModels(config, signal), signal);
  }

  private provider(config: ProviderConfig): TranslationProvider {
    let provider = this.providers.get(config.providerId);
    if (!provider) { provider = getProvider(config.providerId, this.options); this.providers.set(config.providerId, provider); }
    return provider;
  }

  private async runBatch(batch: FlightBatch, input: TranslationInput, config: ProviderConfig, provider: TranslationProvider): Promise<void> {
    const signal = batch.controller.signal;
    try {
      const result = await this.queue.run(() => this.translateWithRecovery(provider, { ...input, nodes: batch.entries.map(entry => entry.node) }, config, signal, input.nodes, progress => {
        if (batch.settled || signal.aborted) return;
        const values = new Map(progress.kind === 'segments' ? progress.translations.map(item => [item.id, item.text]) : []);
        for (const entry of batch.entries) entry.preview = values.get(entry.node.id);
        for (const listener of batch.listeners) listener();
      }), signal);
      throwIfCancelled(signal);
      if (result.translations.reduce((bytes, item) => bytes + new TextEncoder().encode(item.text).byteLength, 0) > MAX_RESPONSE_BYTES) {
        throw new LinguistyError('INVALID_MODEL_RESPONSE');
      }
      const values = new Map(result.translations.map(item => [item.id, item.text]));
      // Provider validation is atomic; only a fully valid response may reach the cache.
      await withSignal(Promise.all(batch.entries.map(async entry => {
        throwIfCancelled(signal);
        const text = values.get(entry.node.id);
        if (text === undefined) throw new LinguistyError('INVALID_MODEL_RESPONSE');
        await this.cache.set(entry.cacheKey, text).catch(() => undefined);
      })), signal);
      throwIfCancelled(signal);
      for (const entry of batch.entries) entry.resolve(values.get(entry.node.id)!);
      this.finishBatch(batch);
    } catch (error) { this.finishBatch(batch, error); }
  }

  /** @spec spec://modules/translation/FEAT-001-engine#dedup */
  private async translateWithRecovery(provider: TranslationProvider, input: TranslationInput, config: ProviderConfig,
    signal: AbortSignal, context: TranslationNode[], onProgress?: (progress: TranslationProgress) => void,
    depth = 0): Promise<TranslationResult> {
    try { return await provider.translate(input, config, signal, context, onProgress); }
    catch (error) {
      throwIfCancelled(signal);
      const recoverable = error instanceof LinguistyError && ['CONTEXT_TOO_LARGE', 'REQUEST_TIMEOUT', 'INVALID_MODEL_RESPONSE'].includes(error.code);
      if (!recoverable || depth >= MAX_RECOVERY_DEPTH || !input.nodes.length) throw error;
      const single = input.nodes.length === 1;
      if (single && (error.code === 'INVALID_MODEL_RESPONSE' || input.nodes[0]!.text.length < 64)) throw error;
      onProgress?.({ kind: 'reset' });
      let halves: TranslationNode[][];
      let sources: string[] | undefined;
      if (single) {
        const node = input.nodes[0]!;
        const pieces = splitText(node.text, Math.ceil(node.text.length / 2), Infinity);
        if (pieces.length < 2) throw error;
        sources = [pieces[0]!, pieces.slice(1).join('')];
        halves = sources.map((text, index) => [{ ...node, id: `recovery-${depth}-${index}`, text }]);
      } else {
        const middle = Math.ceil(input.nodes.length / 2);
        halves = [input.nodes.slice(0, middle), input.nodes.slice(middle)];
      }
      const translations: TranslationResult['translations'] = [];
      for (const nodes of halves) {
        throwIfCancelled(signal);
        // Reuse the occupied queue slot. Recursive recovery cannot multiply
        // concurrency, keep the original oversized context, or cache a half.
        const result = await this.translateWithRecovery(provider, { ...input, nodes }, config, signal, nodes, undefined, depth + 1);
        translations.push(...result.translations);
      }
      return { translations: single ? [{ id: input.nodes[0]!.id,
        text: joinTranslatedParts(sources!, translations.map(item => item.text)) }] : translations, fromCache: 0 };
    }
  }

  private finishBatch(batch: FlightBatch, error?: unknown): void {
    if (batch.settled) return;
    batch.settled = true;
    // Keep successful previews until each consumer settles; failures roll back immediately.
    if (error !== undefined) {
      for (const entry of batch.entries) entry.preview = undefined;
      for (const listener of batch.listeners) listener();
    }
    batch.listeners.clear();
    for (const entry of batch.entries) {
      if (error !== undefined) entry.reject(error);
      if (this.flights.get(entry.key) === entry) this.flights.delete(entry.key);
    }
  }
}
