// @vitest-environment node
/** @spec spec://common/PROP-002-quality#resources */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StreamProgress } from '../../src/background/streamProgress';
import { deferred } from '../providers/fixtures';
afterEach(() => vi.useRealTimers());
describe('bounded stream forwarding', () => {
  it('coalesces snapshots, serializes sends and releases timers/listeners on abort', async () => {
    vi.useFakeTimers();
    const controller = new AbortController(); const pending = deferred<void>();
    const send = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const stream = new StreamProgress(controller.signal, send);
    for (let i = 0; i < 100; i++) stream.push({ kind: 'segments', translations: [{ id: 'a', text: String(i) }] });
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(send).toHaveBeenCalledOnce(); expect(send.mock.calls[0]!.slice(0, 2)).toEqual([{ kind: 'segments', translations: [{ id: 'a', text: '99' }] }, 1]);
    stream.push({ kind: 'reset' }); stream.push({ kind: 'segments', translations: [{ id: 'a', text: 'replacement' }] });
    await vi.advanceTimersByTimeAsync(500); expect(send).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
    pending.resolve(); await vi.advanceTimersByTimeAsync(100);
    expect(send).toHaveBeenCalledTimes(2); expect(send.mock.calls[1]![1]).toBe(2);
    stream.push({ kind: 'reset' }); controller.abort(); await vi.advanceTimersByTimeAsync(200);
    expect(send).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0); expect(remove).toHaveBeenCalled();
    expect(send.mock.calls[0]![2].signal.aborted).toBe(true);
  });
  it('disposes after a synchronous send failure without a rejection/timer loop', async () => {
    vi.useFakeTimers(); const controller = new AbortController();
    const send = vi.fn(() => { throw new Error('Closed tab'); }); const stream = new StreamProgress(controller.signal, send);
    stream.push({ kind: 'reset' }); await vi.advanceTimersByTimeAsync(100);
    stream.push({ kind: 'reset' }); await vi.advanceTimersByTimeAsync(1000);
    expect(send).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
});
