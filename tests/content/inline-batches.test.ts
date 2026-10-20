/** @spec spec://modules/page/FEAT-002-page-translation#render */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPageController } from '../../src/content/controller';
import type { PageController } from '../../src/shared/contracts';
import { textCost } from '../../src/translation/segments';
import { flushMicrotasks, makeTransport, measureText, pageSettings } from './helpers';

vi.mock('wxt/browser', () => ({ browser: { runtime: { id: 'test-extension', sendMessage: vi.fn() } } }));
const controllers: PageController[] = [];
function fixture(html: string) {
  document.body.innerHTML = html;
  const transport = makeTransport();
  const controller = createPageController({ document, window, measureText, measureFontInk: () => 1, sendMessage: transport.sendMessage });
  controllers.push(controller);
  return { controller, ...transport };
}
beforeEach(() => { vi.useFakeTimers(); window.history.replaceState({}, '', '/'); });
afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.dispose();
  await flushMicrotasks();
  expect(vi.getTimerCount()).toBe(0);
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('CJK inline boundaries and bounded page requests', () => {
  it('preserves an alphabetic product-name seam embedded in Chinese source', async () => {
    const f = fixture('<p>请用i<b>Phone</b>阅读。</p>');
    const values = new Map([['请用i', 'Используйте i'], ['Phone', 'Phone'], ['阅读。', 'для чтения.']]);
    await f.controller.start('product', pageSettings());
    f.batches[0]!.resolve({ translations: f.batches[0]!.message.nodes.map(node => ({ id: node.id, text: values.get(node.text)! })), fromCache: 0 });
    await flushMicrotasks();
    expect(document.querySelector('p')!.textContent).toBe('Используйте iPhone для чтения.');
  });
  it('repairs boundaries across links/emphasis even when neighboring batches finish in reverse order', async () => {
    const original = '<p>人工<a href="/intelligence">智能</a>可以<span>学习。</span></p><input value="typed">';
    const f = fixture(original);
    const link = document.querySelector('a')!;
    const click = vi.fn(); link.addEventListener('click', event => { event.preventDefault(); click(); });
    const values = new Map([['人工', 'Искусственный'], ['智能', 'интеллект'], ['可以', 'может'], ['学习。', 'обучаться.']]);
    await f.controller.start('inline', pageSettings({ maxNodesPerBatch: 1, concurrency: 4 }));
    for (const batch of [...f.batches].reverse()) {
      batch.resolve({ translations: batch.message.nodes.map(node => ({ id: node.id, text: values.get(node.text)! })), fromCache: 0 });
      await flushMicrotasks();
    }
    expect(document.querySelector('p')!.textContent).toBe('Искусственный интеллект может обучаться.');
    expect(document.querySelector('a')).toBe(link);
    expect(link.getAttribute('href')).toBe('/intelligence');
    link.click(); expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('input')!.value).toBe('typed');
    for (let i = 0; i < 8; i++) {
      await f.controller.setDisplayMode('original');
      expect(document.querySelector('p')!.textContent).toBe('人工智能可以学习。');
      await f.controller.setDisplayMode('translated');
      expect(document.querySelector('p')!.textContent).toBe('Искусственный интеллект может обучаться.');
    }
    await vi.advanceTimersByTimeAsync(800);
    expect(f.batches).toHaveLength(4);
  });

  it('keeps reference markers attached, preserves punctuation/BR/block boundaries and intentional alphabetic joins', async () => {
    const f = fixture('<p>人工<a>智能</a><sup>[1]</sup>研究。</p><p>人工<br><span>智能</span>。</p><p>micro<b>scope</b></p>');
    const values = new Map([['人工', 'Искусственный'], ['智能', 'интеллект'], ['[1]', '[1]'], ['研究。', 'изучает.'], ['micro', 'микро'], ['scope', 'скоп']]);
    await f.controller.start('boundaries', pageSettings());
    f.batches[0]!.resolve({ translations: f.batches[0]!.message.nodes.map(node => ({ id: node.id, text: values.get(node.text)! })), fromCache: 0 });
    await flushMicrotasks();
    const paragraphs = [...document.querySelectorAll('p')].map(p => p.textContent);
    expect(paragraphs).toEqual(['Искусственный интеллект[1] изучает.', 'Искусственныйинтеллект。', 'микроскоп']);
    expect(document.querySelector('sup')!.textContent).toBe('[1]');
    expect(document.querySelectorAll('br')).toHaveLength(1);
  });

  it('preserves model-supplied CJK boundary spacing and leaves external neighbor edits intact', async () => {
    const f = fixture('<p>人工<a>智能</a>研究。</p>');
    await f.controller.start('external', pageSettings({ maxNodesPerBatch: 1, concurrency: 3 }));
    f.batches[1]!.resolve({ translations: [{ id: f.batches[1]!.message.nodes[0]!.id, text: ' интеллект ' }], fromCache: 0 });
    await flushMicrotasks();
    const link = document.querySelector('a')!;
    link.firstChild!.textContent = 'Внешняя правка';
    f.batches[0]!.resolve({ translations: [{ id: f.batches[0]!.message.nodes[0]!.id, text: 'Искусственный' }], fromCache: 0 });
    await flushMicrotasks();
    expect(link.textContent).toBe('Внешняя правка');
    await f.controller.setDisplayMode('original');
    expect(link.textContent).toBe('Внешняя правка');
  });

  /** @spec spec://modules/page/FEAT-002-page-translation#queue */
  it('translates a long source in bounded parts, atomically committing one node alongside another parallel batch', async () => {
    const source = '人工智能学习。'.repeat(250);
    const f = fixture(`<p>${source}</p><p>Other</p>`);
    await f.controller.start('long', pageSettings({ concurrency: 2 }));
    expect(f.batches).toHaveLength(2);
    expect(f.controller.getState()).toMatchObject({ discovered: 2, inFlight: 2, failed: 0 });
    const parts: string[] = [];
    for (let index = 0; index < f.batches.length; index++) {
      const batch = f.batches[index]!;
      if (batch.message.nodes[0]!.text === 'Other') { batch.resolve(); await flushMicrotasks(); continue; }
      parts.push(batch.message.nodes[0]!.text);
      expect(textCost(batch.message.nodes[0]!.text)).toBeLessThanOrEqual(3_000);
      expect(document.querySelector('p')!.textContent).toBe(source);
      batch.resolve({ translations: [{ id: batch.message.nodes[0]!.id, text: 'Переведённая часть.' }], fromCache: 1, cacheHitIds: [batch.message.nodes[0]!.id] });
      await flushMicrotasks();
    }
    expect(parts.join('')).toBe(source);
    expect(document.querySelector('p')!.textContent).toBe(Array(parts.length).fill('Переведённая часть.').join(' '));
    expect(f.controller.getState()).toMatchObject({ discovered: 2, translated: 2, fromCache: 1, inFlight: 0, failed: 0 });
    await f.controller.setDisplayMode('original');
    expect(document.querySelector('p')!.textContent).toBe(source);
  });

  it.each(['cancel', 'original', 'external', 'detach'])('does not send later long-node parts after %s', async action => {
    const source = '人工智能学习。'.repeat(250);
    const f = fixture(`<p>${source}</p>`);
    await f.controller.start('stop', pageSettings());
    if (action === 'cancel') await f.controller.cancel();
    if (action === 'original') await f.controller.setDisplayMode('original');
    if (action === 'external') document.querySelector('p')!.firstChild!.textContent = 'Сайт изменил текст';
    if (action === 'detach') document.querySelector('p')!.remove();
    f.batches[0]!.resolve();
    await flushMicrotasks();
    expect(f.batches).toHaveLength(1);
    if (action === 'external') expect(document.querySelector('p')!.textContent).toBe('Сайт изменил текст');
    if (action === 'original') expect(document.querySelector('p')!.textContent).toBe(source);
  });
});
