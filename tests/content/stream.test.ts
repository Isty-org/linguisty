/** @spec spec://modules/page/FEAT-002-page-translation#sessions */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPageController } from '../../src/content/controller';
import type { BatchProgressCommand, PageController, TranslationProgress } from '../../src/shared/contracts';
import { LinguistyError } from '../../src/shared/errors';
import { flushMicrotasks, makeTransport, measureText, pageSettings } from './helpers';

vi.mock('wxt/browser', () => ({ browser: { runtime: { id: 'test-extension', sendMessage: vi.fn() } } }));
const controllers: PageController[] = [];
beforeEach(() => { vi.useFakeTimers(); window.history.replaceState({}, '', '/'); });
afterEach(async () => { for (const controller of controllers.splice(0)) controller.dispose(); await flushMicrotasks(); document.body.replaceChildren(); vi.useRealTimers(); });
async function fixture() {
  document.body.innerHTML = '<p style="font-size:18px;line-height:27px">日本語の文章</p><p>Other source</p><input value="Typed value">';
  const transport = makeTransport();
  const controller = createPageController({ document, window, measureText, sendMessage: transport.sendMessage,
    measureFontInk: (style, sample) => Number.parseFloat(style.fontSize) * (sample === '日本語' ? 8 / 9 : 2 / 3) });
  controllers.push(controller);
  await controller.start('stream', pageSettings());
  const batch = transport.batches[0]!;
  const first = document.querySelector('p')!;
  const emit = (sequence = 1, progress: TranslationProgress = { kind: 'segments', translations: [{ id: batch.message.nodes[0]!.id, text: '<b>Русский текст</b>' }] }, extra: Partial<BatchProgressCommand> = {}) => controller.progress({ command: 'batch-progress', sessionId: 'stream', batchId: batch.message.batchId, sequence, progress, ...extra });
  return { controller, ...transport, batch, first, emit };
}

describe('provisional page display', () => {
  it('shows closed items as text, leaves counters uncommitted, and rolls back text/styles on reset and final failure', async () => {
    const f = await fixture(); f.emit();
    expect(f.first.textContent).toBe('<b>Русский текст</b>'); expect(f.first.querySelector('b')).toBeNull();
    expect(f.first.style.fontSize).toBe('24px'); expect(f.controller.getState()).toMatchObject({ translated: 0, inFlight: 2, fromCache: 0 });
    f.emit(2, { kind: 'reset' });
    expect(f.first.textContent).toBe('日本語の文章'); expect(f.first.style.fontSize).toBe('18px');
    f.emit(3); f.batch.reject(new LinguistyError('INVALID_MODEL_RESPONSE'));
    await flushMicrotasks();
    expect(f.first.textContent).toBe('日本語の文章'); expect(f.first.style.fontSize).toBe('18px');
    expect(f.controller.getState()).toMatchObject({ status: 'error', translated: 0, failed: 2 });
    expect(document.querySelector('input')!.value).toBe('Typed value');
  });

  it('commits only a full valid result; subsequent progress cannot change it and dispose restores originals', async () => {
    const f = await fixture(); f.emit(); f.batch.resolve(); await flushMicrotasks();
    expect(f.controller.getState().translated).toBe(2); expect(f.first.textContent).toBe('Перевод 日本語の文章');
    f.emit(8); expect(f.first.textContent).toBe('Перевод 日本語の文章');
    f.controller.dispose(); expect(f.first.textContent).toBe('日本語の文章'); expect(f.first.style.fontSize).toBe('18px'); expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores old sequences/sessions/batches and rejects unknown or duplicate IDs before changing DOM', async () => {
    const f = await fixture(); f.emit(3);
    f.emit(2, { kind: 'reset' }); f.emit(4, { kind: 'reset' }, { sessionId: 'old' }); f.emit(5, { kind: 'reset' }, { batchId: 'old' });
    expect(f.first.textContent).toBe('<b>Русский текст</b>');
    expect(() => f.emit(6, { kind: 'segments', translations: [{ id: 'unknown', text: 'bad' }] })).toThrow();
    const item = { id: f.batch.message.nodes[0]!.id, text: 'bad' };
    expect(() => f.emit(6, { kind: 'segments', translations: [item, item] })).toThrow();
    expect(f.first.textContent).toBe('<b>Русский текст</b>');
  });

  it.each(['cancel', 'original', 'navigation', 'dispose'] as const)('rolls back on %s and blocks late previews/finals', async action => {
    const f = await fixture(); f.emit();
    if (action === 'cancel') await f.controller.cancel();
    if (action === 'original') await f.controller.setDisplayMode('original');
    if (action === 'dispose') f.controller.dispose();
    if (action === 'navigation') { window.history.pushState({}, '', '/other'); window.dispatchEvent(new PopStateEvent('popstate')); await flushMicrotasks(); }
    expect(f.first.textContent).toBe('日本語の文章'); expect(f.first.style.fontSize).toBe('18px');
    f.emit(20); f.batch.reject(new LinguistyError('CANCELLED')); await flushMicrotasks();
    expect(f.first.textContent).toBe('日本語の文章');
    f.controller.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves intervening source/font edits and does not translate its own provisional text', async () => {
    const f = await fixture(); f.emit(); await flushMicrotasks(); await vi.advanceTimersByTimeAsync(450);
    expect(f.batches).toHaveLength(1);
    f.first.firstChild!.textContent = 'Updated by the page'; f.first.style.fontSize = '22px';
    f.emit(2); f.batch.reject(new LinguistyError('INVALID_MODEL_RESPONSE')); await flushMicrotasks();
    expect(f.first.textContent).toBe('Updated by the page'); expect(f.first.style.fontSize).toBe('22px');
    await vi.advanceTimersByTimeAsync(450);
    expect(f.batches[1]!.message.nodes.map(node => node.text)).toContain('Updated by the page');
    expect(f.batches[1]!.message.nodes.map(node => node.text)).not.toContain('<b>Русский текст</b>');
    f.controller.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
});
