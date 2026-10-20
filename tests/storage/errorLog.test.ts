/** @spec spec://modules/storage/INFRA-002-local-data#contracts */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiErrorInput } from '../../src/shared/contracts';
import { ErrorJournal, ERROR_LOG_KEY, ERROR_LOG_TTL_MS, ERROR_LOG_MAX_BYTES, ERROR_ENTRY_MAX_BYTES } from '../../src/storage/errorLog';
vi.mock('wxt/browser', () => ({ browser: {} }));
const input: ApiErrorInput = { operation: 'translate', providerId: 'openrouter', model: 'mock/model', source: 'api', message: 'Actual reason', errorCode: 'INVALID_API_KEY', attempts: 1 };
function fixture() {
  const values: Record<string, unknown> = {};
  const area = { get: vi.fn(async () => ({ ...values })), set: vi.fn(async (updates: Record<string, unknown>) => { Object.assign(values, updates); }), remove: vi.fn(async () => { delete values[ERROR_LOG_KEY]; }) };
  let now = 1_800_000_000_000;
  return { journal: new ErrorJournal(async () => area, () => now), area, values, advance: (ms: number) => { now += ms; } };
}
afterEach(() => vi.useRealTimers());
describe('bounded local API journal', () => {
  it('keeps 100 records, prunes expired data, serializes append/clear and allowlists fields', async () => {
    const f = fixture();
    for (let i = 0; i < 110; i++) await f.journal.append({ ...input, message: `Failure ${i}`, apiKey: 'excluded', raw: 'excluded' } as ApiErrorInput);
    const records = await f.journal.list();
    expect(records).toHaveLength(100);
    expect(records[0]!.message).toBeUndefined();
    expect(records[0]!.model).toBe('mock/model');
    expect(new Set(records.map(entry => entry.id)).size).toBe(100);
    expect(JSON.stringify(f.values)).not.toContain('excluded');
    f.advance(ERROR_LOG_TTL_MS + 1);
    expect(await f.journal.list()).toEqual([]);
    await Promise.all([f.journal.append(input), f.journal.clear(), f.journal.append({ ...input, message: 'After clear' })]);
    expect((await f.journal.list()).map(entry => entry.message)).toEqual([undefined]);
  });
  it('bounds UTF-8 size per entry and total, rejects corrupted storage and scrubs legacy free text on read', async () => {
    const f = fixture();
    for (let i = 0; i < 100; i++) await f.journal.append({ ...input, message: '字'.repeat(1400), providerMessage: '字'.repeat(1400) });
    const entries = await f.journal.list();
    expect(new TextEncoder().encode(JSON.stringify(entries)).byteLength).toBeLessThanOrEqual(ERROR_LOG_MAX_BYTES);
    for (const entry of entries) expect(new TextEncoder().encode(JSON.stringify(entry)).byteLength).toBeLessThanOrEqual(ERROR_ENTRY_MAX_BYTES);
    // Privacy assertions inspect the whole persisted record, so its own ID must not randomly contain the PII sentinel "250".
    const legacyId = '00000000-0000-4000-8000-000000000001';
    f.values[ERROR_LOG_KEY] = [{ ...entries[0], id: legacyId, model: 'Tenant John Smith', apiCode: 'John_250', apiType: 'rate_limit_exceeded',
      message: 'Bearer sk-sensitivecredential John-Smith', providerMessage: 'Tenant John%20Smith owes 250 EUR', requestId: 'John.Smith-250' }, { id: 'invalid', raw: 'excluded' }];
    const cleaned = await f.journal.list();
    expect(cleaned[0]).toMatchObject({ id: legacyId, createdAt: 1_800_000_000_000, model: '', apiType: 'rate_limit_exceeded' });
    expect(JSON.stringify(cleaned)).not.toMatch(/John|Smith|250|sk-sensitivecredential|raw|excluded/);
    expect(JSON.stringify(f.values[ERROR_LOG_KEY])).not.toMatch(/John|Smith|250|sk-sensitivecredential|raw|excluded/);
  });
  it('bounds stalled storage reads and releases timers', async () => {
    vi.useFakeTimers();
    const f = fixture(); f.area.get.mockImplementationOnce(() => new Promise(() => undefined));
    const result = f.journal.list().catch(error => error);
    await vi.advanceTimersByTimeAsync(1501);
    expect(await result).toMatchObject({ code: 'REQUEST_TIMEOUT' });
    expect(await f.journal.list()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
