// @vitest-environment node
/** @spec spec://common/PROP-001-contracts#messages */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHANNEL, DEFAULT_SETTINGS } from '../../src/shared/constants';
import { READ_TIMEOUT_MS, sendMessage } from '../../src/shared/messaging';

const runtime = vi.hoisted(() => ({ sendMessage: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { runtime } }));
beforeEach(() => { vi.useFakeTimers(); runtime.sendMessage.mockReset(); });
afterEach(() => { expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); });

/** @spec spec://modules/interface/FEAT-003-controls#errors */
describe('bounded extension transport', () => {
  it('retries one startup transport failure for an idempotent read', async () => {
    runtime.sendMessage.mockRejectedValueOnce(new Error('No receiver')).mockResolvedValueOnce({ ok: true, data: DEFAULT_SETTINGS });
    const result = sendMessage({ channel: CHANNEL, type: 'GET_SETTINGS' });
    await vi.advanceTimersByTimeAsync(150);
    expect(await result).toEqual(DEFAULT_SETTINGS);
    expect(runtime.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('never retries mutations or leaks raw transport messages', async () => {
    runtime.sendMessage.mockRejectedValue(new Error('unsafe-private-test-value'));
    const result = sendMessage({ channel: CHANNEL, type: 'SAVE_SETTINGS', settings: DEFAULT_SETTINGS });
    await expect(result).rejects.toMatchObject({ code: 'INTERNAL_ERROR', retryable: true });
    await expect(result).rejects.not.toThrow('unsafe-private-test-value');
    expect(runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('does not retry a valid rejection returned by the background', async () => {
    runtime.sendMessage.mockResolvedValue({ ok: false, error: { code: 'INVALID_SETTINGS', message: 'Проверьте настройки.', retryable: false } });
    await expect(sendMessage({ channel: CHANNEL, type: 'GET_SETTINGS' })).rejects.toMatchObject({ code: 'INVALID_SETTINGS' });
    expect(runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('times out an unanswered read and ignores its late result', async () => {
    let reply!: (value: unknown) => void;
    runtime.sendMessage.mockReturnValue(new Promise(resolve => { reply = resolve; }));
    const result = sendMessage({ channel: CHANNEL, type: 'GET_SETTINGS' });
    const rejection = expect(result).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT', retryable: true });
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    await rejection;
    reply({ ok: true, data: DEFAULT_SETTINGS });
    await Promise.resolve();
    expect(runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  /** @spec spec://common/PROP-002-quality#resources */
  it.each(['TEST_CONNECTION', 'LIST_MODELS'] as const)('lets %s finish after 35 seconds under its configured request budget', async type => {
    runtime.sendMessage.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({ ok: true, data: type === 'LIST_MODELS' ? [] : { success: true, message: 'OK' } }), 40_000);
    }));
    const message = { channel: CHANNEL, type, settings: { ...DEFAULT_SETTINGS, requestTimeoutMs: 120_000 } } as const;
    const result = sendMessage(message);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(await result).toEqual(type === 'LIST_MODELS' ? [] : { success: true, message: 'OK' });
    expect(runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('keeps an explicit long batch deadline finite and ignores a late reply', async () => {
    let reply!: (value: unknown) => void;
    runtime.sendMessage.mockReturnValue(new Promise(resolve => { reply = resolve; }));
    const result = sendMessage({ channel: CHANNEL, type: 'TRANSLATE_BATCH', sessionId: 'session', batchId: 'batch',
      nodes: [{ id: '1', text: 'Bonjour', group: 'one', priority: 0 }], pageContext: { title: '', domain: 'example.org' } }, { timeoutMs: 900_000 });
    const rejection = expect(result).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(305_000);
    await rejection;
    reply({ ok: true, data: { translations: [{ id: '1', text: 'Hello' }], fromCache: 0 } });
    await Promise.resolve();
    expect(runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('cancels a scheduled retry when the UI closes', async () => {
    runtime.sendMessage.mockResolvedValue(undefined);
    const controller = new AbortController();
    const result = sendMessage({ channel: CHANNEL, type: 'GET_SECRET_STATUS' }, { signal: controller.signal });
    const rejection = expect(result).rejects.toMatchObject({ code: 'CANCELLED' });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await rejection;
    expect(runtime.sendMessage).toHaveBeenCalledTimes(1);
  });
});
