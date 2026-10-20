/** @spec spec://modules/page/FEAT-002-page-translation#queue */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { createPageController } from '../../src/content/controller';
import type { PageController, RuntimeMessage, TranslationResult } from '../../src/shared/contracts';
import { batchTimeoutMs } from '../../src/translation/segments';
import { flushMicrotasks, measureText, pageSettings } from './helpers';

vi.mock('wxt/browser', () => ({ browser: { runtime: { id: 'test-extension', sendMessage: vi.fn() } } }));

const controllers: PageController[] = [];
const replies: Array<{ message: Extract<RuntimeMessage, { type: 'TRANSLATE_BATCH' }>; resolve: (value: unknown) => void }> = [];

function start(text: string, timeoutMs = 120_000, maxCharsPerBatch = 10_000) {
  document.body.innerHTML = `<p></p>`;
  document.querySelector('p')!.textContent = text;
  const controller = createPageController({ document, window, measureText });
  controllers.push(controller);
  return controller.start('session', pageSettings({ requestTimeoutMs: timeoutMs, maxCharsPerBatch, streaming: false })).then(() => controller);
}

function reply(index: number, translated: string) {
  const pending = replies[index]!;
  const result: TranslationResult = {
    translations: pending.message.nodes.map(node => ({ id: node.id, text: translated })),
    fromCache: 0,
  };
  pending.resolve({ ok: true, data: result });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState({}, '', '/');
  replies.length = 0;
  vi.mocked(browser.runtime.sendMessage).mockReset().mockImplementation((raw: unknown) => {
    const message = raw as RuntimeMessage;
    if (message.type === 'TRANSLATE_BATCH') return new Promise(resolve => { replies.push({ message, resolve }); });
    return Promise.resolve({ ok: true, data: undefined });
  });
});
afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.dispose();
  await flushMicrotasks();
  document.body.replaceChildren();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

it('accepts a real transport reply after 35 seconds when the batch budget allows it', async () => {
  const controller = await start('Bonjour');
  await flushMicrotasks();
  expect(replies).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(40_000);
  expect(controller.getState()).toMatchObject({ status: 'translating', failed: 0, inFlight: 1 });
  reply(0, 'Hello');
  await flushMicrotasks();
  expect(document.body.textContent).toBe('Hello');
  expect(controller.getState()).toMatchObject({ status: 'completed', translated: 1, failed: 0 });
});

it('allows each part of a long node its own full budget', async () => {
  const controller = await start('Bonjour monde. Salut Paris.', 120_000, 15);
  await flushMicrotasks();
  expect(replies).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(40_000);
  expect(controller.getState().failed).toBe(0);
  reply(0, 'Hello world. ');
  await flushMicrotasks();
  expect(replies.length).toBeGreaterThan(1);
  for (let index = 1; index < replies.length; index += 1) {
    await vi.advanceTimersByTimeAsync(40_000);
    expect(controller.getState().failed).toBe(0);
    reply(index, 'Hello');
    await flushMicrotasks();
  }
  expect(controller.getState()).toMatchObject({ translated: 1, failed: 0 });
  expect(document.body.textContent).toContain('Hello');
});

it('ends a hung real transport at the bounded batch deadline and ignores a late reply', async () => {
  const controller = await start('Bonjour');
  await flushMicrotasks();
  await vi.advanceTimersByTimeAsync(batchTimeoutMs(120_000) + 5_000);
  expect(controller.getState()).toMatchObject({ status: 'error', failed: 1, inFlight: 0, error: { code: 'REQUEST_TIMEOUT' } });
  reply(0, 'Hello');
  await flushMicrotasks();
  expect(document.body.textContent).toBe('Bonjour');
});

it.each(['cancel', 'original', 'dispose'] as const)('%s releases pending transport and ignores a late reply', async action => {
  const controller = await start('Bonjour');
  await flushMicrotasks();
  if (action === 'cancel') await controller.cancel();
  else if (action === 'original') await controller.setDisplayMode('original');
  else controller.dispose();
  await flushMicrotasks();
  const snapshot = controller.getState();
  expect(vi.getTimerCount()).toBe(action === 'original' ? 1 : 0);
  reply(0, 'Hello');
  await flushMicrotasks();
  expect(document.body.textContent).toBe('Bonjour');
  expect(controller.getState()).toEqual(snapshot);
});
