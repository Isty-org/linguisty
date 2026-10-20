import type { CacheStats, TranslationCache } from '../shared/contracts';
import { CACHE_MAX_BYTES, CACHE_MAX_ENTRIES, CACHE_TTL_MS, MAX_RESPONSE_BYTES } from '../shared/constants';
import { LinguistyError } from '../shared/errors';

export const TRANSLATION_CACHE_DATABASE = 'linguisty.translations';
const ENTRIES = 'translations';
const METADATA = 'metadata';
const TOTALS_KEY = 'totals';
const MAX_QUEUED_OPERATIONS = 128;
const MAX_QUEUED_BYTES = 8 * 1024 * 1024;

interface CacheEntry {
  key: string;
  text: string;
  createdAt: number;
  accessedAt: number;
  estimatedBytes: number;
  accessOrder: number;
}

interface CacheTotals {
  key: typeof TOTALS_KEY;
  entries: number;
  estimatedBytes: number;
  lastAccessOrder: number;
}

export interface TranslationCacheOptions {
  databaseName?: string;
  indexedDB?: IDBFactory;
  now?: () => number;
  maxEntries?: number;
  maxBytes?: number;
  ttlMs?: number;
  openTimeoutMs?: number;
  transactionTimeoutMs?: number;
}

type Guard = (operation: () => void) => () => void;
type TransactionWork<T> = (
  entries: IDBObjectStore, metadata: IDBObjectStore,
  setResult: (result: T) => void, guard: Guard,
) => void;

function isEntry(value: unknown): value is CacheEntry {
  if (!value || typeof value !== 'object') return false;
  const row = value as CacheEntry;
  return typeof row.key === 'string' && typeof row.text === 'string'
    && Number.isFinite(row.createdAt) && row.createdAt >= 0
    && Number.isFinite(row.accessedAt) && row.accessedAt >= 0
    && Number.isSafeInteger(row.estimatedBytes) && row.estimatedBytes >= 0
    && Number.isSafeInteger(row.accessOrder) && row.accessOrder > 0;
}

function emptyTotals(): CacheTotals {
  return { key: TOTALS_KEY, entries: 0, estimatedBytes: 0, lastAccessOrder: 0 };
}

function readTotals(value: unknown): CacheTotals {
  const row = value as CacheTotals | undefined;
  if (!row || row.key !== TOTALS_KEY || !Number.isSafeInteger(row.entries) || row.entries < 0
    || !Number.isSafeInteger(row.estimatedBytes) || row.estimatedBytes < 0
    || !Number.isSafeInteger(row.lastAccessOrder) || row.lastAccessOrder < 0) {
    throw new Error('Invalid cache metadata');
  }
  return { ...row };
}

function byteSize(key: string, text: string): number {
  const encoder = new TextEncoder();
  return encoder.encode(key).byteLength + encoder.encode(text).byteLength;
}

function bound(value: number | undefined, fallback: number, maximum: number): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) throw new Error('Invalid cache limit');
  return result;
}

function closeLateDatabase(this: IDBRequest<IDBDatabase>): void { this.result.close(); }
function abortLateUpgrade(this: IDBOpenDBRequest): void { this.transaction?.abort(); }
function ignoreLateError(event: Event): void { event.preventDefault(); }

/** @spec spec://modules/storage/INFRA-002-local-data#cache.data */
export class IndexedDbTranslationCache implements TranslationCache {
  private readonly factory: IDBFactory | undefined;
  private readonly databaseName: string;
  private readonly now: () => number;
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly ttlMs: number;
  private readonly openTimeoutMs: number;
  private readonly transactionTimeoutMs: number;
  private database: IDBDatabase | undefined;
  private opening: Promise<IDBDatabase | undefined> | undefined;
  private cancelOpening: (() => void) | undefined;
  private queue: Promise<void> = Promise.resolve();
  private queuedOperations = 0;
  private queuedBytes = 0;
  private unavailable = false;
  private disposed = false;
  private hits = 0;
  private misses = 0;

  constructor(options: TranslationCacheOptions = {}) {
    this.factory = options.indexedDB ?? globalThis.indexedDB;
    this.databaseName = options.databaseName ?? TRANSLATION_CACHE_DATABASE;
    this.now = options.now ?? Date.now;
    this.maxEntries = bound(options.maxEntries, CACHE_MAX_ENTRIES, CACHE_MAX_ENTRIES);
    this.maxBytes = bound(options.maxBytes, CACHE_MAX_BYTES, CACHE_MAX_BYTES);
    this.ttlMs = bound(options.ttlMs, CACHE_TTL_MS, CACHE_TTL_MS);
    this.openTimeoutMs = bound(options.openTimeoutMs, 2_000, 30_000);
    this.transactionTimeoutMs = bound(options.transactionTimeoutMs, 5_000, 30_000);
  }

  get isDisposed(): boolean { return this.disposed; }

  /** @spec spec://modules/storage/INFRA-002-local-data#cache.data */
  async get(key: string): Promise<string | undefined> {
    if (this.disposed) return undefined;
    if (this.queuedOperations >= MAX_QUEUED_OPERATIONS) { this.misses++; return undefined; }
    return this.enqueue(async () => {
      const database = await this.ensureDatabase();
      if (!database) { this.misses++; return undefined; }
      try {
        const now = this.now();
        const text = await this.transaction<string | undefined>(database, (entries, metadata, result, guard) => {
          const request = entries.get(key);
          request.onsuccess = guard(() => {
            const entry: unknown = request.result;
            if (entry === undefined) return;
            if (!isEntry(entry) || entry.key !== key || now - entry.createdAt >= this.ttlMs) {
              entries.delete(key);
              this.reconcile(entries, metadata, now, () => undefined, guard);
              return;
            }
            const totalsRequest = metadata.get(TOTALS_KEY);
            totalsRequest.onsuccess = guard(() => {
              const totals = readTotals(totalsRequest.result);
              totals.lastAccessOrder++;
              entries.put({ ...entry, accessedAt: now, accessOrder: totals.lastAccessOrder });
              metadata.put(totals);
              result(entry.text);
            });
          });
        });
        if (text === undefined) this.misses++;
        else this.hits++;
        return text;
      } catch {
        this.disable();
        this.misses++;
        return undefined;
      }
    });
  }

  /** @spec spec://modules/storage/INFRA-002-local-data#cache.data */
  async set(key: string, text: string): Promise<void> {
    if (this.disposed || this.queuedOperations >= MAX_QUEUED_OPERATIONS
      || key.length > 512 || text.length > MAX_RESPONSE_BYTES) return;
    const estimatedBytes = byteSize(key, text);
    if (estimatedBytes > this.maxBytes || estimatedBytes > MAX_RESPONSE_BYTES
      || this.queuedBytes + estimatedBytes > MAX_QUEUED_BYTES) return;
    this.queuedBytes += estimatedBytes;
    await this.enqueue(async () => {
      try {
        const database = await this.ensureDatabase();
        if (!database) return;
        const now = this.now();
        await this.transaction<void>(database, (entries, metadata, _result, guard) => {
          const totalsRequest = metadata.get(TOTALS_KEY);
          totalsRequest.onsuccess = guard(() => {
            const totals = readTotals(totalsRequest.result);
            this.removeExpired(entries, totals, now, () => {
              const existingRequest = entries.get(key);
              existingRequest.onsuccess = guard(() => {
                const existing: unknown = existingRequest.result;
                if (existing !== undefined && !isEntry(existing)) throw new Error('Invalid cache entry');
                if (existing) totals.estimatedBytes -= existing.estimatedBytes;
                else totals.entries++;
                totals.estimatedBytes += estimatedBytes;
                totals.lastAccessOrder++;
                const entry: CacheEntry = {
                  key, text, createdAt: now, accessedAt: now, estimatedBytes, accessOrder: totals.lastAccessOrder,
                };
                entries.put(entry);
                this.evict(entries, totals, () => { metadata.put(totals); }, guard);
              });
            }, guard);
          });
        });
      } catch {
        this.disable();
      } finally {
        this.queuedBytes -= estimatedBytes;
      }
    });
  }

  /** @spec spec://modules/storage/INFRA-002-local-data#cache.data */
  async clear(): Promise<void> {
    return this.enqueue(async () => {
      if (this.disposed) throw this.unavailableError('очистить');
      // An explicit user action may recover a previously failed/quota-limited cache.
      this.unavailable = false;
      const database = await this.ensureDatabase();
      if (!database) throw this.unavailableError('очистить');
      try {
        await this.transaction<void>(database, (entries, metadata) => {
          entries.clear();
          metadata.put(emptyTotals());
        });
        this.hits = 0;
        this.misses = 0;
      } catch {
        this.disable();
        throw this.unavailableError('очистить');
      }
    });
  }

  /** @spec spec://modules/storage/INFRA-002-local-data#cache.data */
  async stats(): Promise<CacheStats> {
    return this.enqueue(async () => {
      const database = await this.ensureDatabase();
      if (!database) throw this.unavailableError('прочитать статистику');
      try {
        const totals = await this.transaction<CacheTotals>(database, (entries, metadata, result, guard) => {
          this.reconcile(entries, metadata, this.now(), result, guard);
        });
        return { entries: totals.entries, estimatedBytes: totals.estimatedBytes, hits: this.hits, misses: this.misses };
      } catch {
        this.disable();
        throw this.unavailableError('прочитать статистику');
      }
    });
  }

  /** @spec spec://common/PROP-002-quality#resources */
  async prune(): Promise<void> {
    if (this.disposed || this.queuedOperations >= MAX_QUEUED_OPERATIONS) return;
    return this.enqueue(async () => {
      const database = await this.ensureDatabase();
      if (!database) return;
      try {
        await this.transaction<void>(database, (entries, metadata, _result, guard) => {
          this.reconcile(entries, metadata, this.now(), () => undefined, guard);
        });
      } catch {
        this.disable();
      }
    });
  }

  /** @spec spec://modules/storage/INFRA-002-local-data#contracts */
  async dispose(): Promise<void> {
    this.disposed = true;
    this.cancelOpening?.();
    await this.queue;
    this.disable();
    this.opening = undefined;
    this.cancelOpening = undefined;
    if (instance === this) instance = undefined;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    this.queuedOperations++;
    const result = this.queue.then(operation);
    this.queue = result.then(() => undefined, () => undefined).finally(() => { this.queuedOperations--; });
    return result;
  }

  private disable(): void {
    this.unavailable = true;
    if (this.database) {
      this.database.onversionchange = null;
      this.database.onclose = null;
      this.database.close();
      this.database = undefined;
    }
  }

  private unavailableError(action: string): LinguistyError {
    const message = action === 'очистить' ? 'очистить локальный кэш' : 'прочитать статистику локального кэша';
    return new LinguistyError('INTERNAL_ERROR', `Не удалось ${message}: хранилище недоступно.`);
  }

  private async ensureDatabase(): Promise<IDBDatabase | undefined> {
    if (this.disposed || this.unavailable || !this.factory) return undefined;
    if (this.database) return this.database;
    if (!this.opening) {
      this.opening = this.openDatabase().then(async (database) => {
        if (this.disposed) { database.close(); return undefined; }
        this.database = database;
        database.onversionchange = () => { this.disable(); };
        database.onclose = () => { this.disable(); };
        await this.transaction<void>(database, (entries, metadata, _result, guard) => {
          this.reconcile(entries, metadata, this.now(), () => undefined, guard);
        });
        return database;
      }).catch(() => { this.disable(); return undefined; });
    }
    try {
      return await this.opening;
    } finally {
      this.opening = undefined;
      this.cancelOpening = undefined;
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let finished = false;
      let request: IDBOpenDBRequest | undefined;
      const fail = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        // IDB.open cannot be cancelled. Late handlers must release the database without retaining this instance.
        if (request) {
          request.onsuccess = closeLateDatabase;
          request.onupgradeneeded = abortLateUpgrade;
          request.onerror = ignoreLateError;
          request.onblocked = null;
        }
        reject(new Error('Cache open failed'));
      };
      const timeout = setTimeout(fail, this.openTimeoutMs);
      this.cancelOpening = fail;
      try {
        request = this.factory!.open(this.databaseName, 1);
        request.onerror = fail;
        request.onblocked = fail;
        request.onupgradeneeded = () => {
          if (finished || this.disposed) { request!.transaction?.abort(); return; }
          const database = request!.result;
          const entries = database.createObjectStore(ENTRIES, { keyPath: 'key' });
          entries.createIndex('createdAt', 'createdAt');
          entries.createIndex('accessOrder', 'accessOrder');
          database.createObjectStore(METADATA, { keyPath: 'key' });
        };
        request.onsuccess = () => {
          if (finished || this.disposed) { request!.result.close(); fail(); return; }
          finished = true;
          clearTimeout(timeout);
          resolve(request!.result);
        };
      } catch {
        fail();
      }
    });
  }

  private transaction<T>(database: IDBDatabase, work: TransactionWork<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([ENTRIES, METADATA], 'readwrite');
      let result: T;
      let settled = false;
      const cleanup = () => {
        clearTimeout(timeout);
        transaction.oncomplete = null;
        transaction.onabort = null;
        transaction.onerror = null;
      };
      const fail = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Cache transaction failed'));
      };
      const guard: Guard = (operation) => () => {
        try { operation(); }
        catch { try { transaction.abort(); } catch { /* Already finished. */ } fail(); }
      };
      const timeout = setTimeout(() => {
        try { transaction.abort(); } catch { /* Already finished. */ }
        fail();
      }, this.transactionTimeoutMs);
      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };
      transaction.onabort = fail;
      transaction.onerror = fail;
      guard(() => work(transaction.objectStore(ENTRIES), transaction.objectStore(METADATA), (value) => { result = value; }, guard))();
    });
  }

  private reconcile(entries: IDBObjectStore, metadata: IDBObjectStore, now: number,
    done: (totals: CacheTotals) => void, guard: Guard): void {
    const totals = emptyTotals();
    const request = entries.openCursor();
    request.onsuccess = guard(() => {
      const cursor = request.result;
      if (!cursor) {
        this.evict(entries, totals, () => { metadata.put(totals); done(totals); }, guard);
        return;
      }
      const entry: unknown = cursor.value;
      if (!isEntry(entry) || entry.key !== cursor.primaryKey || now - entry.createdAt >= this.ttlMs
        || entry.key.length > 512 || entry.text.length > MAX_RESPONSE_BYTES) {
        cursor.delete();
      } else {
        const bytes = byteSize(entry.key, entry.text);
        if (bytes > this.maxBytes || bytes > MAX_RESPONSE_BYTES) cursor.delete();
        else {
          if (bytes !== entry.estimatedBytes) cursor.update({ ...entry, estimatedBytes: bytes });
          totals.entries++;
          totals.estimatedBytes += bytes;
          totals.lastAccessOrder = Math.max(totals.lastAccessOrder, entry.accessOrder);
        }
      }
      cursor.continue();
    });
  }

  private removeExpired(entries: IDBObjectStore, totals: CacheTotals, now: number, done: () => void, guard: Guard): void {
    const request = entries.index('createdAt').openCursor(IDBKeyRange.upperBound(now - this.ttlMs));
    request.onsuccess = guard(() => {
      const cursor = request.result;
      if (!cursor) { done(); return; }
      const entry: unknown = cursor.value;
      if (!isEntry(entry)) throw new Error('Invalid cache entry');
      cursor.delete();
      totals.entries--;
      totals.estimatedBytes -= entry.estimatedBytes;
      cursor.continue();
    });
  }

  private evict(entries: IDBObjectStore, totals: CacheTotals, done: () => void, guard: Guard): void {
    if (totals.entries <= this.maxEntries && totals.estimatedBytes <= this.maxBytes) { done(); return; }
    const request = entries.index('accessOrder').openCursor();
    request.onsuccess = guard(() => {
      const cursor = request.result;
      if (!cursor || (totals.entries <= this.maxEntries && totals.estimatedBytes <= this.maxBytes)) { done(); return; }
      const entry: unknown = cursor.value;
      if (!isEntry(entry)) throw new Error('Invalid cache entry');
      cursor.delete();
      totals.entries--;
      totals.estimatedBytes -= entry.estimatedBytes;
      cursor.continue();
    });
  }
}

let instance: IndexedDbTranslationCache | undefined;

/** @spec spec://modules/storage/INFRA-002-local-data#contracts */
export function getTranslationCache(): TranslationCache {
  if (!instance || instance.isDisposed) instance = new IndexedDbTranslationCache();
  return instance;
}
