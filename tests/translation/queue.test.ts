// @vitest-environment node
/** @spec spec://common/PROP-002-quality#resources */
import { describe, expect, it, vi } from 'vitest';
import { RequestQueue } from '../../src/translation/queue';
import { deferred } from '../providers/fixtures';

describe('bounded request queue', () => {
  it('never starts a cancelled queued task and releases listeners and slots', async () => {
    const queue = new RequestQueue(1, 1);
    const running = deferred<void>();
    const first = queue.run(() => running.promise);
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const task = vi.fn(async () => undefined);
    const second = queue.run(task, controller.signal).catch(error => error);
    expect(queue.pendingCount).toBe(1);
    controller.abort();
    expect(await second).toMatchObject({ code: 'CANCELLED' });
    expect(queue.pendingCount).toBe(0);
    expect(task).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(add.mock.calls.length);
    running.resolve();
    await first;
    await vi.waitFor(() => expect(queue.activeCount).toBe(0));
  });

  it('rejects overload and resumes FIFO work after a failure', async () => {
    const queue = new RequestQueue(1, 1);
    const gate = deferred<void>();
    const first = queue.run(() => gate.promise).catch(error => error);
    const second = queue.run(async () => 'next');
    await expect(queue.run(async () => 'overflow')).rejects.toMatchObject({ code: 'RATE_LIMIT' });
    gate.reject(new Error('test failure'));
    await first;
    expect(await second).toBe('next');
    await vi.waitFor(() => expect(queue.activeCount).toBe(0));
    expect(queue.pendingCount).toBe(0);
  });
});
