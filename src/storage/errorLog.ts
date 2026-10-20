/** @spec spec://modules/storage/INFRA-002-local-data#contracts */
import type { ApiErrorEntry, ApiErrorInput } from '../shared/contracts';
import { isErrorCode } from '../shared/errors';
import { waitForBrowser } from '../shared/messaging';
import { safeApiToken, safeConfiguredModel } from '../providers/diagnostics';
import { getStorageArea } from './areas';
import { isProviderId } from '../shared/providers';

export const ERROR_LOG_KEY = 'linguisty.apiErrors';
export const ERROR_LOG_LIMIT = 100;
export const ERROR_LOG_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ERROR_LOG_MAX_BYTES = 256 * 1024;
export const ERROR_ENTRY_MAX_BYTES = 4096;
type Area = Awaited<ReturnType<typeof getStorageArea>>;
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;

/** Allowlist again at the storage boundary, including untrusted persisted values. */
function normalize(value: unknown, now: number): ApiErrorEntry | undefined {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  if (typeof data.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(data.id)
    || typeof data.createdAt !== 'number' || !Number.isFinite(data.createdAt) || data.createdAt < now - ERROR_LOG_TTL_MS || data.createdAt > now + 300_000
    || !['translate', 'test-connection', 'list-models'].includes(String(data.operation))
    || !isProviderId(data.providerId)
    || !['api', 'network', 'timeout', 'invalid-response'].includes(String(data.source))) return;
  const entry: ApiErrorEntry = {
    id: data.id, createdAt: data.createdAt, operation: data.operation as ApiErrorEntry['operation'],
    providerId: data.providerId as ApiErrorEntry['providerId'], source: data.source as ApiErrorEntry['source'],
    model: safeConfiguredModel(data.model) ?? '', errorCode: isErrorCode(data.errorCode) ? data.errorCode : 'INTERNAL_ERROR',
    attempts: typeof data.attempts === 'number' && Number.isInteger(data.attempts) ? Math.max(1, Math.min(3, data.attempts)) : 1,
  };
  if (typeof data.httpStatus === 'number' && Number.isInteger(data.httpStatus) && data.httpStatus >= 100 && data.httpStatus <= 599) entry.httpStatus = data.httpStatus;
  for (const field of ['apiCode', 'apiType'] as const) {
    const clean = safeApiToken(data[field]);
    if (clean) entry[field] = clean;
  }
  return bytes(entry) <= ERROR_ENTRY_MAX_BYTES ? entry : undefined;
}

/** @spec spec://common/PROP-002-quality#resources */
export class ErrorJournal {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly area: () => Promise<Area> = () => getStorageArea('local'), private readonly now = () => Date.now()) {}

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.catch(() => undefined);
    return result;
  }
  private async read(area: Area): Promise<ApiErrorEntry[]> {
    const data = await waitForBrowser(() => area.get(ERROR_LOG_KEY), { timeoutMs: 1500 });
    const raw: unknown = data[ERROR_LOG_KEY];
    const ids = new Set<string>();
    const entries = (Array.isArray(raw) ? raw.slice(-ERROR_LOG_LIMIT) : []).flatMap(value => {
      const entry = normalize(value, this.now());
      if (!entry || ids.has(entry.id)) return [];
      ids.add(entry.id); return [entry];
    }).sort((a, b) => a.createdAt - b.createdAt);
    while (entries.length && bytes(entries) > ERROR_LOG_MAX_BYTES) entries.shift();
    return entries;
  }
  list(): Promise<ApiErrorEntry[]> {
    return this.serial(async () => {
      const area = await waitForBrowser(this.area, { timeoutMs: 1500 });
      const entries = await this.read(area);
      await waitForBrowser(() => area.set({ [ERROR_LOG_KEY]: entries }), { timeoutMs: 1500 });
      return entries.reverse();
    });
  }
  append(input: ApiErrorInput): Promise<void> {
    return this.serial(async () => {
      const entry = normalize({ ...input, id: crypto.randomUUID(), createdAt: this.now() }, this.now());
      if (!entry) return;
      const area = await waitForBrowser(this.area, { timeoutMs: 1500 });
      const entries = await this.read(area);
      entries.push(entry);
      while (entries.length > ERROR_LOG_LIMIT || bytes(entries) > ERROR_LOG_MAX_BYTES) entries.shift();
      await waitForBrowser(() => area.set({ [ERROR_LOG_KEY]: entries }), { timeoutMs: 1500 });
    });
  }
  clear(): Promise<void> {
    return this.serial(async () => {
      const area = await waitForBrowser(this.area, { timeoutMs: 1500 });
      await waitForBrowser(() => area.remove(ERROR_LOG_KEY), { timeoutMs: 1500 });
    });
  }
}
