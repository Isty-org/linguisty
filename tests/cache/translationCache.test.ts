// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBDatabase, IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';
import { CACHE_MAX_BYTES, CACHE_MAX_ENTRIES, CACHE_TTL_MS, MAX_RESPONSE_BYTES } from '../../src/shared/constants';
import { getTranslationCache, IndexedDbTranslationCache } from '../../src/cache/translationCache';
import type { TranslationCacheOptions } from '../../src/cache/translationCache';
import type { TranslationCache } from '../../src/shared/contracts';
import type { ProviderConfig, TranslationInput, TranslationNode } from '../../src/shared/contracts';
import { TranslationEngine } from '../../src/translation/engine';

let factory: IDBFactory;
let now: number;
let caches: TranslationCache[];

function makeCache(options: TranslationCacheOptions = {}): IndexedDbTranslationCache {
  const cache = new IndexedDbTranslationCache({ indexedDB: factory, now: () => now, ...options });
  caches.push(cache);
  return cache;
}

function mockProvider() {
  return vi.fn<typeof fetch>(async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { messages: { role: string; content: string }[] };
    const user = JSON.parse(body.messages.find((message) => message.role === 'user')!.content) as { nodes: TranslationNode[] };
    const translations = user.nodes.map((node) => ({ id: node.id, text: `Перевод ${node.group ?? ''}: ${node.text}` }));
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ translations }) } }] }));
  });
}

const providerConfig: ProviderConfig = {
  providerId: 'openai-compatible', baseUrl: 'http://localhost:8099/v1', model: 'mock-model',
  apiKey: 'cache-integration-private-test-value', timeoutMs: 25_000,
};
const translationInput: TranslationInput = {
  nodes: [{ id: 'a', text: 'Bank', group: 'river' }, { id: 'b', text: 'Bank', group: 'finance' }],
  pageContext: { title: 'Context', domain: 'example.test' },
  sourceLanguage: 'auto', targetLanguage: 'ru', style: 'natural', customInstructions: '',
};

async function openDatabase(name = 'linguisty.translations', version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storedEntries(name?: string): Promise<Record<string, unknown>[]> {
  const database = await openDatabase(name);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('translations', 'readonly');
      const request = transaction.objectStore('translations').getAll();
      transaction.oncomplete = () => resolve(request.result as Record<string, unknown>[]);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

beforeEach(() => {
  factory = new IDBFactory();
  now = 1_000_000;
  caches = [];
  vi.stubGlobal('indexedDB', factory);
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
});

afterEach(async () => {
  await Promise.all(caches.map((cache) => cache.dispose()));
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** @spec spec://modules/storage/INFRA-002-local-data#cache.data */
describe('bounded IndexedDB translation cache', () => {
  it('stores only translated text and actual timestamps, returns hit/miss statistics', async () => {
    const cache = makeCache();
    expect(await cache.get('missing')).toBeUndefined();
    await cache.set('context-digest', 'Перевод');
    now += 20;
    expect(await cache.get('context-digest')).toBe('Перевод');
    const expectedBytes = new TextEncoder().encode('context-digestПеревод').byteLength;
    expect(await cache.stats()).toEqual({ entries: 1, estimatedBytes: expectedBytes, hits: 1, misses: 1 });
    const rows = await storedEntries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: 'context-digest', text: 'Перевод', createdAt: now - 20, accessedAt: now, estimatedBytes: expectedBytes,
    });
    expect(rows[0]).not.toHaveProperty('apiKey');
    expect(rows[0]).not.toHaveProperty('sourceText');
    expect(rows[0]).not.toHaveProperty('pageContext');
  });

  it('expires at the exact TTL boundary; a cache hit does not renew createdAt', async () => {
    const cache = makeCache({ ttlMs: 100 });
    await cache.set('key', 'translation');
    now += 99;
    expect(await cache.get('key')).toBe('translation');
    now += 1;
    expect(await cache.get('key')).toBeUndefined();
    expect(await cache.stats()).toEqual({ entries: 0, estimatedBytes: 0, hits: 1, misses: 1 });
    expect(await storedEntries()).toHaveLength(0);
  });

  it('enforces production 30-day TTL by default', async () => {
    const cache = makeCache();
    await cache.set('key', 'translation');
    now += CACHE_TTL_MS;
    await cache.prune();
    expect(await cache.get('key')).toBeUndefined();
    expect((await cache.stats()).entries).toBe(0);
  });

  it('removes expired rows before adding a fresh row and recomputes byte totals on write', async () => {
    const cache = makeCache({ ttlMs: 100, maxEntries: 2 });
    await cache.set('old-a', 'old value');
    await cache.set('old-b', 'old value');
    now += 100;
    await cache.set('fresh', 'new');
    expect((await storedEntries()).map((row) => row.key)).toEqual(['fresh']);
    expect(await cache.stats()).toEqual({ entries: 1, estimatedBytes: 8, hits: 0, misses: 0 });
  });

  it('evicts the least recently used entry even when all wall-clock timestamps are equal', async () => {
    const cache = makeCache({ maxEntries: 2 });
    await cache.set('z', 'first');
    await cache.set('a', 'second');
    expect(await cache.get('z')).toBe('first');
    await cache.set('b', 'third');
    expect(await cache.get('a')).toBeUndefined();
    expect(await cache.get('z')).toBe('first');
    expect(await cache.get('b')).toBe('third');
    expect((await cache.stats()).entries).toBe(2);
  });

  it('limits UTF-8 bytes, not string character count, and treats overwrites as one entry', async () => {
    const cache = makeCache({ maxBytes: 12 });
    await cache.set('a', '🙂'); // 5 bytes
    await cache.set('b', 'ЖЖ'); // 5 bytes
    await cache.get('a');
    await cache.set('c', 'z'); // 2 bytes
    await cache.set('d', 'z'); // 2 bytes; b is evicted
    expect(await cache.get('b')).toBeUndefined();
    expect((await cache.stats()).estimatedBytes).toBe(9);
    await cache.set('a', 'abc');
    expect(await cache.get('a')).toBe('abc');
    const stats = await cache.stats();
    expect(stats.entries).toBe(3);
    expect(stats.estimatedBytes).toBe(8);
  });

  it('skips an oversized value without evicting an existing useful entry', async () => {
    const cache = makeCache({ maxBytes: 6 });
    await cache.set('a', 'ok');
    await cache.set('b', 'too-large');
    expect(await cache.get('a')).toBe('ok');
    expect(await cache.get('b')).toBeUndefined();
    expect((await cache.stats()).entries).toBe(1);
  });

  it('serializes concurrent writes and keeps only the last bounded entries without duplicates', async () => {
    const cache = makeCache({ maxEntries: 10 });
    await Promise.all(Array.from({ length: 30 }, (_, index) => cache.set(`key-${index}`, `value-${index}`)));
    expect((await cache.stats()).entries).toBe(10);
    expect(await cache.get('key-19')).toBeUndefined();
    expect(await cache.get('key-20')).toBe('value-20');
    await Promise.all(Array.from({ length: 20 }, (_, index) => cache.set('same', `value-${index}`)));
    expect(await cache.get('same')).toBe('value-19');
    const rows = await storedEntries();
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(rows.filter((row) => row.key === 'same')).toHaveLength(1);
    expect((await cache.stats()).estimatedBytes).toBe(rows.reduce((sum, row) => sum + Number(row.estimatedBytes), 0));
  });

  it('keeps metadata and limits consistent across concurrent database connections', async () => {
    const first = makeCache({ maxEntries: 5 });
    const second = makeCache({ maxEntries: 5 });
    await Promise.all(Array.from({ length: 20 }, (_, index) => {
      return (index % 2 ? first : second).set(`key-${index}`, `value-${index}`);
    }));
    const rows = await storedEntries();
    const actualBytes = rows.reduce((sum, row) => sum + Number(row.estimatedBytes), 0);
    expect(rows).toHaveLength(5);
    expect(await first.stats()).toEqual({ entries: 5, estimatedBytes: actualBytes, hits: 0, misses: 0 });
    expect(await second.stats()).toEqual({ entries: 5, estimatedBytes: actualBytes, hits: 0, misses: 0 });
  });

  it('clears committed rows and serializes clear between surrounding writes', async () => {
    const cache = makeCache();
    await Promise.all([cache.set('before', 'one'), cache.clear(), cache.set('after', 'two')]);
    expect(await cache.get('before')).toBeUndefined();
    expect(await cache.get('after')).toBe('two');
    expect((await storedEntries()).map((row) => row.key)).toEqual(['after']);
    await cache.clear();
    expect(await cache.stats()).toEqual({ entries: 0, estimatedBytes: 0, hits: 0, misses: 0 });
    expect(await storedEntries()).toHaveLength(0);
  });

  it('prunes expired entries and applies tighter entry limits at startup', async () => {
    const first = makeCache({ maxEntries: 5, ttlMs: 100 });
    await first.set('a', 'one');
    await first.set('b', 'two');
    await first.set('c', 'three');
    await first.dispose();
    const second = makeCache({ maxEntries: 2, ttlMs: 100 });
    expect((await second.stats()).entries).toBe(2);
    expect(await second.get('a')).toBeUndefined();
    await second.dispose();
    now += 100;
    const third = makeCache({ ttlMs: 100 });
    expect(await third.stats()).toEqual({ entries: 0, estimatedBytes: 0, hits: 0, misses: 0 });
    expect(await storedEntries()).toHaveLength(0);
  });

  it('removes corrupt entries and recomputes inaccurate byte metadata rather than trusting it', async () => {
    const cache = makeCache();
    await cache.set('a', '🙂');
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('translations', 'readwrite');
      transaction.objectStore('translations').put({ key: 'corrupt', text: 'unknown timestamps' });
      transaction.objectStore('translations').put({
        key: 'a', text: '🙂', createdAt: now, accessedAt: now, estimatedBytes: 0, accessOrder: 1,
      });
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    await cache.prune();
    expect(await cache.get('corrupt')).toBeUndefined();
    expect((await cache.stats()).estimatedBytes).toBe(5);
    expect(await cache.get('a')).toBe('🙂');
  });

  it('never allows injected resource limits to exceed production caps', () => {
    expect(() => makeCache({ maxEntries: CACHE_MAX_ENTRIES + 1 })).toThrow();
    expect(() => makeCache({ maxBytes: CACHE_MAX_BYTES + 1 })).toThrow();
    expect(() => makeCache({ ttlMs: CACHE_TTL_MS + 1 })).toThrow();
  });
});

/** @spec spec://modules/storage/INFRA-002-local-data#contracts */
describe('cache degradation and cleanup', () => {
  it('continues with cache misses and harmless writes when IndexedDB is missing', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const cache = new IndexedDbTranslationCache();
    caches.push(cache);
    await expect(cache.set('key', 'translation')).resolves.toBeUndefined();
    expect(await cache.get('key')).toBeUndefined();
    await expect(cache.prune()).resolves.toBeUndefined();
    await expect(cache.stats()).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    await expect(cache.clear()).rejects.toThrow('Не удалось очистить локальный кэш');
  });

  it('degrades after an open error without repeated automatic attempts or raw error leakage', async () => {
    const open = vi.fn(() => { throw new Error('unsafe-private-test-value'); });
    const cache = makeCache({ indexedDB: { open } as unknown as IDBFactory });
    await cache.set('key', 'translation');
    expect(await cache.get('key')).toBeUndefined();
    await cache.prune();
    expect(open).toHaveBeenCalledTimes(1);
    await expect(cache.stats()).rejects.not.toThrow('unsafe-private-test-value');
    await expect(cache.clear()).rejects.toThrow('хранилище недоступно');
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('handles quota failure without failing translation and lets an explicit clear recover', async () => {
    const cache = makeCache();
    await cache.set('existing', 'old');
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('unsafe-private-test-value', 'QuotaExceededError');
    });
    await expect(cache.set('new', 'translation')).resolves.toBeUndefined();
    expect(await cache.get('new')).toBeUndefined();
    await expect(cache.stats()).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    put.mockRestore();
    await cache.clear();
    expect(await cache.stats()).toEqual({ entries: 0, estimatedBytes: 0, hits: 0, misses: 0 });
    await cache.set('recovered', 'translation');
    expect(await cache.get('recovered')).toBe('translation');
  });

  it('does not report request success as a committed write when the transaction later aborts', async () => {
    const cache = makeCache();
    await cache.set('existing', 'old');
    const originalPut = IDBObjectStore.prototype.put;
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = originalPut.call(this, value, key);
      if (this.name === 'translations') {
        request.addEventListener('success', () => { this.transaction.abort(); }, { once: true });
      }
      return request;
    });
    await cache.set('uncommitted', 'translation');
    put.mockRestore();
    expect(await cache.get('uncommitted')).toBeUndefined();
    const recovered = makeCache();
    expect(await recovered.get('uncommitted')).toBeUndefined();
    expect(await recovered.get('existing')).toBe('old');
  });

  it('bounds a stalled open, clears its timer and closes a late successful database handle', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const request = {} as IDBOpenDBRequest;
    const cache = makeCache({ indexedDB: { open: () => request } as unknown as IDBFactory, openTimeoutMs: 10 });
    const operation = cache.get('key');
    await vi.advanceTimersByTimeAsync(11);
    expect(await operation).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
    const close = vi.fn();
    Object.assign(request, { result: { close } });
    request.onsuccess!.call(request, new Event('success'));
    expect(close).toHaveBeenCalledTimes(1);
    await cache.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts a stalled transaction, releases its timer and keeps the read optional', async () => {
    const cache = makeCache({ transactionTimeoutMs: 10 });
    await cache.set('key', 'translation');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const transaction = {
      oncomplete: null, onabort: null, onerror: null,
      objectStore: () => ({ get: () => ({}) }),
      abort: vi.fn(() => undefined),
    } as unknown as IDBTransaction;
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockReturnValueOnce(transaction);
    const read = cache.get('key');
    await vi.advanceTimersByTimeAsync(11);
    expect(await read).toBeUndefined();
    expect(transaction.abort).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await cache.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('disposes a pending open immediately and releases callbacks that would otherwise retain the instance', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const request = {} as IDBOpenDBRequest;
    const cache = makeCache({ indexedDB: { open: () => request } as unknown as IDBFactory });
    const read = cache.get('key');
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(1);
    await cache.dispose();
    expect(await read).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
    const close = vi.fn();
    Object.assign(request, { result: { close } });
    request.onsuccess!.call(request, new Event('success'));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes for a version change and releases the connection on dispose', async () => {
    const cache = makeCache();
    await cache.set('key', 'translation');
    const upgraded = await openDatabase('linguisty.translations', 2);
    upgraded.close();
    expect(await cache.get('key')).toBeUndefined();
    await cache.dispose();
    const request = factory.deleteDatabase('linguisty.translations');
    const blocked = vi.fn();
    request.onblocked = blocked;
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    expect(blocked).not.toHaveBeenCalled();
    await expect(cache.set('ignored', 'translation')).resolves.toBeUndefined();
    expect(await cache.get('ignored')).toBeUndefined();
  });

  it('returns one background instance and releases it after disposal without deleting persisted translations', async () => {
    const first = getTranslationCache();
    caches.push(first);
    expect(getTranslationCache()).toBe(first);
    await first.set('key', 'translation');
    await first.dispose();
    const second = getTranslationCache();
    caches.push(second);
    expect(second).not.toBe(first);
    expect(await second.get('key')).toBe('translation');
  });

  /** @spec spec://common/PROP-002-quality#resources */
  it('bounds queued write count and releases pending payloads after completing or disposing', async () => {
    const cache = makeCache();
    await Promise.all(Array.from({ length: 200 }, (_, index) => cache.set(`key-${index}`, 'translation')));
    expect((await cache.stats()).entries).toBe(128);
    await cache.set('after-queue-drained', 'translation');
    expect((await cache.stats()).entries).toBe(129);
    await cache.dispose();
    const reopened = makeCache();
    expect((await reopened.stats()).entries).toBe(129);
  });

  /** @spec spec://common/PROP-002-quality#resources */
  it('caps queued UTF-8 payloads at 8 MiB without exceeding the persistent cache bound', async () => {
    const cache = makeCache();
    const text = 'x'.repeat(MAX_RESPONSE_BYTES - 2);
    await Promise.all(Array.from({ length: 9 }, (_, index) => cache.set(String(index), text)));
    const stats = await cache.stats();
    expect(stats.entries).toBe(8);
    expect(stats.estimatedBytes).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(stats.estimatedBytes).toBeLessThanOrEqual(CACHE_MAX_BYTES);
    await Promise.all(Array.from({ length: 8 }, (_, index) => cache.set(`b${index}`, text.slice(1))));
    expect((await cache.stats()).entries).toBe(16);
  });
});

/** @spec spec://modules/storage/INFRA-002-local-data#acceptance */
describe('engine with the actual IndexedDB cache', () => {
  /** @spec spec://modules/translation/FEAT-001-engine#dedup */
  it('shares concurrent identical translations and releases flight state after the response', async () => {
    const cache = makeCache();
    const provider = mockProvider();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const fetchImpl = vi.fn<typeof fetch>(async (...args) => {
      await gate;
      return provider(...args);
    });
    const engine = new TranslationEngine(cache, { fetchImpl });
    const first = engine.translate(translationInput, providerConfig);
    const second = engine.translate(translationInput, providerConfig);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    release();
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(secondResult.translations).toEqual(firstResult.translations);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((await cache.stats()).entries).toBe(2);
    expect(engine.inFlightCount).toBe(0);
    expect(engine.activeRequestCount).toBe(0);
    expect(engine.pendingRequestCount).toBe(0);
  });

  it('continues translation through an unavailable cache without retries or leaked flight state', async () => {
    const cache = makeCache({ indexedDB: { open: () => { throw new Error('Unavailable'); } } as unknown as IDBFactory });
    const fetchImpl = mockProvider();
    const engine = new TranslationEngine(cache, { fetchImpl });
    const first = await engine.translate(translationInput, providerConfig);
    const second = await engine.translate(translationInput, providerConfig);
    expect(first.translations).toEqual([
      { id: 'a', text: 'Перевод river: Bank' }, { id: 'b', text: 'Перевод finance: Bank' },
    ]);
    expect(first.fromCache).toBe(0);
    expect(second.fromCache).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(engine.inFlightCount).toBe(0);
    expect(engine.activeRequestCount).toBe(0);
    expect(engine.pendingRequestCount).toBe(0);
  });

  /** @spec spec://common/PROP-001-contracts#modules */
  it('reuses persisted context after background restart and key rotation while remapping IDs and retaining group separation', async () => {
    const firstCache = makeCache();
    const fetchImpl = mockProvider();
    const firstEngine = new TranslationEngine(firstCache, { fetchImpl });
    await firstEngine.translate(translationInput, providerConfig);
    expect((await firstCache.stats()).entries).toBe(2);
    expect(JSON.stringify(await storedEntries())).not.toContain(providerConfig.apiKey);
    await firstCache.dispose();
    const secondCache = makeCache();
    const secondEngine = new TranslationEngine(secondCache, { fetchImpl });
    const freshIds = { ...translationInput, nodes: translationInput.nodes.map((node) => ({ ...node, id: `${node.id}-new` })) };
    const result = await secondEngine.translate(freshIds, { ...providerConfig, apiKey: 'rotated-test-value' });
    expect(result).toEqual({
      translations: [{ id: 'a-new', text: 'Перевод river: Bank' }, { id: 'b-new', text: 'Перевод finance: Bank' }], fromCache: 2,
      cacheHitIds: ['a-new', 'b-new'],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const changedNeighbor = { ...freshIds, nodes: [freshIds.nodes[0]!, { ...freshIds.nodes[1]!, text: 'Investments' }] };
    expect((await secondEngine.translate(changedNeighbor, providerConfig)).fromCache).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(secondEngine.inFlightCount).toBe(0);
    expect(secondEngine.activeRequestCount).toBe(0);
    expect(secondEngine.pendingRequestCount).toBe(0);
  });

  it('forces a new provider request after explicit cache clear', async () => {
    const cache = makeCache();
    const fetchImpl = mockProvider();
    const engine = new TranslationEngine(cache, { fetchImpl });
    await engine.translate(translationInput, providerConfig);
    expect((await engine.translate(translationInput, providerConfig)).fromCache).toBe(2);
    await cache.clear();
    expect((await engine.translate(translationInput, providerConfig)).fromCache).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(engine.inFlightCount).toBe(0);
    expect(engine.activeRequestCount).toBe(0);
    expect(engine.pendingRequestCount).toBe(0);
  });
});
