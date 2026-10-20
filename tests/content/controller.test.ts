/** @spec spec://modules/page/FEAT-002-page-translation#acceptance */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPageController, type PageControllerOptions } from '../../src/content/controller';
import type { PageController, RuntimeMessage, TranslationResult } from '../../src/shared/contracts';
import { LinguistyError } from '../../src/shared/errors';
import { batchTimeoutMs } from '../../src/translation/segments';
import { flushMicrotasks, makeTransport, measureText, pageSettings } from './helpers';

vi.mock('wxt/browser', () => ({ browser: { runtime: { id: 'test-extension', sendMessage: vi.fn() } } }));

const controllers: PageController[] = [];
function fixture(html: string, options: PageControllerOptions = {}) {
  document.body.innerHTML = html;
  const transport = makeTransport();
  const controller = createPageController({ document, window, measureText, sendMessage: transport.sendMessage, ...options });
  controllers.push(controller);
  return { controller, ...transport };
}

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState({}, '', '/');
  document.title = 'Listing title';
});
afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.dispose();
  await flushMicrotasks();
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('page queue, rendering and lifecycle', () => {
  /** @spec spec://modules/page/FEAT-002-page-translation#render */
  it('owns font correction through toggles, external changes and dispose without translation loops', async () => {
    const f = fixture('<p style="font-size:18px;line-height:27px">日本語の文章</p><input value="User input">', {
      measureFontInk: (style, sample) => Number.parseFloat(style.fontSize) * (sample === '日本語' ? 8 / 9 : 2 / 3),
    });
    await f.controller.start('fonts', pageSettings());
    const element = document.querySelector('p')!;
    f.batches[0]!.resolve({ translations: [{ id: f.batches[0]!.message.nodes[0]!.id, text: 'Русский текст' }], fromCache: 0 });
    await flushMicrotasks();
    expect(element.style.fontSize).toBe('24px');
    for (let i = 0; i < 6; i++) {
      await f.controller.setDisplayMode('original'); expect(element.style.fontSize).toBe('18px');
      await f.controller.setDisplayMode('translated'); expect(element.style.fontSize).toBe('24px');
    }
    await vi.advanceTimersByTimeAsync(500);
    expect(f.batches).toHaveLength(1);
    element.style.fontSize = '22px';
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(500);
    expect(element.style.fontSize).toBe('22px');
    expect(element.style.lineHeight).toBe('27px');
    element.firstChild!.textContent = '新しい文章';
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(500);
    expect(f.batches).toHaveLength(2);
    f.batches[1]!.resolve({ translations: [{ id: f.batches[1]!.message.nodes[0]!.id, text: 'Новая фраза' }], fromCache: 0 });
    await flushMicrotasks();
    f.controller.dispose();
    expect(element.textContent).toBe('新しい文章');
    expect(element.style.fontSize).toBe('22px');
    expect(element.style.lineHeight).toBe('27px');
    expect(document.querySelector('input')!.value).toBe('User input');
    expect(vi.getTimerCount()).toBe(0);
  });

  /** @spec spec://modules/page/FEAT-002-page-translation#queue */
  it('prioritizes viewport then nearby then far text, groups inline nodes, and bounds page context', async () => {
    const f = fixture('<p data-top="4000">Far text</p><p data-top="900">Nearby text</p><p>Visible <b>important</b></p>');
    document.title = 'a'.repeat(400);
    await f.controller.start('session', pageSettings({ concurrency: 1, maxNodesPerBatch: 2 }));
    expect(f.batches).toHaveLength(1);
    const first = f.batches[0]!.message;
    expect(first.nodes.map(node => node.text)).toEqual(['Visible', 'important']);
    expect(first.nodes[0]?.group).toBe(first.nodes[1]?.group);
    expect(first.nodes.map(node => node.priority)).toEqual([0, 0]);
    expect(first.pageContext.title).toHaveLength(300);
    expect(first.pageContext.domain).toBe(window.location.hostname);
    expect(JSON.stringify(first)).not.toContain('apiKey');
    f.batches[0]!.resolve();
    await flushMicrotasks();
    expect(f.batches[1]!.message.nodes.map(node => node.text)).toEqual(['Nearby text', 'Far text']);
    f.batches[1]!.resolve();
    await flushMicrotasks();
    expect(f.controller.getState()).toMatchObject({ discovered: 4, translated: 4, inFlight: 0, status: 'completed' });
  });

  it('honors node/character/concurrency limits with ID-based grouped requests and cache-hit counts', async () => {
    const f = fixture(Array.from({ length: 9 }, (_, i) => `<p>Item ${i}</p>`).join(''));
    await f.controller.start('session', pageSettings({ concurrency: 2, maxNodesPerBatch: 3, maxCharsPerBatch: 12 }));
    expect(f.batches).toHaveLength(2);
    expect(f.controller.getState().inFlight).toBe(4);
    for (const batch of f.batches) expect(batch.message.nodes).toHaveLength(2);
    f.batches[0]!.resolve({ translations: f.batches[0]!.message.nodes.map(node => ({ id: node.id, text: 'Готово' })), fromCache: 2, cacheHitIds: f.batches[0]!.message.nodes.map(node => node.id) });
    await flushMicrotasks();
    expect(f.batches).toHaveLength(3);
    expect(f.controller.getState()).toMatchObject({ fromCache: 2, translated: 2, inFlight: 4 });
    for (let i = 1; i < f.batches.length; i += 1) {
      f.batches[i]!.resolve();
      await flushMicrotasks();
    }
    expect(f.batches).toHaveLength(5);
    expect(f.controller.getState()).toMatchObject({ translated: 9, failed: 0, inFlight: 0 });
    expect(f.batches.every(b => b.message.nodes.length <= 3 && b.message.nodes.reduce((n, node) => n + node.text.length, 0) <= 12)).toBe(true);
  });

  it('rejects an unreasonable oversized node without truncation and keeps partial progress accurate', async () => {
    const source = 'x'.repeat(100_001);
    const f = fixture(`<p>${source}</p><p>Small</p>`);
    await f.controller.start('session', pageSettings({ maxCharsPerBatch: 10 }));
    expect(f.batches).toHaveLength(1);
    expect(f.batches[0]!.message.nodes.map(node => node.text)).toEqual(['Small']);
    expect(f.controller.getState()).toMatchObject({ failed: 1, error: { code: 'CONTEXT_TOO_LARGE' } });
    f.batches[0]!.resolve();
    await flushMicrotasks();
    expect(document.querySelector('p')?.textContent).toBe(source);
    expect(f.controller.getState()).toMatchObject({ discovered: 2, translated: 1, failed: 1 });
  });

  /** @spec spec://modules/page/FEAT-002-page-translation#render */
  it('writes only Text.data, preserves whitespace, handlers/form state and toggles ready text without requests', async () => {
    const f = fixture('<button> \tHello\n </button><input value="Initial"><p>Repeated</p><p>Repeated</p>');
    const button = document.querySelector('button')!;
    const input = document.querySelector('input')!;
    const text = button.firstChild as Text;
    const click = vi.fn();
    button.addEventListener('click', click);
    input.value = 'User typed value';
    await f.controller.start('session', pageSettings());
    expect(f.batches).toHaveLength(1);
    expect(f.batches[0]!.message.nodes.map(node => node.text)).toEqual(['Hello', 'Repeated', 'Repeated']);
    expect(new Set(f.batches[0]!.message.nodes.map(node => node.id)).size).toBe(3);
    f.batches[0]!.resolve({ translations: f.batches[0]!.message.nodes.map(node => ({ id: node.id, text: ' <b>Привет</b> ' })), fromCache: 0 });
    await flushMicrotasks();
    expect(button).toBe(document.querySelector('button'));
    expect(button.firstChild).toBe(text);
    expect(button.innerHTML).not.toContain('<b>');
    expect(text.data).toBe(' \t<b>Привет</b>\n ');
    button.click();
    expect(click).toHaveBeenCalledOnce();
    expect(input.value).toBe('User typed value');
    await f.controller.setDisplayMode('original');
    expect(text.data).toBe(' \tHello\n ');
    await f.controller.setDisplayMode('translated');
    expect(text.data).toBe(' \t<b>Привет</b>\n ');
    await vi.advanceTimersByTimeAsync(800);
    expect(f.batches).toHaveLength(1);
  });

  it('does not observe its own writes or translate a translation during repeated toggles', async () => {
    const delivered = vi.fn();
    const f = fixture('<p>Original</p>', {
      createMutationObserver(callback) {
        return new MutationObserver((records, observer) => { delivered(records); callback(records, observer); });
      },
    });
    await f.controller.start('session', pageSettings());
    f.batches[0]!.resolve();
    await flushMicrotasks();
    for (let i = 0; i < 5; i += 1) {
      await f.controller.setDisplayMode('original');
      await f.controller.setDisplayMode('translated');
    }
    await vi.advanceTimersByTimeAsync(800);
    expect(delivered).not.toHaveBeenCalled();
    expect(f.batches).toHaveLength(1);
  });

  it('debounces only dynamic subtrees, deduplicates repeated discovery and translates newly visible content', async () => {
    const f = fixture('<p>Existing</p><p hidden>Initially hidden</p>');
    await f.controller.start('session', pageSettings());
    f.batches[0]!.resolve();
    await flushMicrotasks();
    const wrapper = document.createElement('section');
    wrapper.innerHTML = '<p>Added <b>inline</b></p>';
    document.body.append(wrapper);
    wrapper.className = 'changed-twice';
    document.querySelector('[hidden]')!.removeAttribute('hidden');
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(399);
    expect(f.batches).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.batches).toHaveLength(2);
    expect(f.batches[1]!.message.nodes.map(node => node.text).sort()).toEqual(['Added', 'Initially hidden', 'inline'].sort());
    f.batches[1]!.resolve();
    await flushMicrotasks();
    expect(f.controller.getState().discovered).toBe(4);
    await vi.advanceTimersByTimeAsync(800);
    expect(f.batches).toHaveLength(2);
  });

  it('rejects a late response after external Text.data changes and restores the latest source', async () => {
    const f = fixture('<p>Original</p>');
    const text = document.querySelector('p')!.firstChild as Text;
    await f.controller.start('session', pageSettings({ concurrency: 1 }));
    text.data = 'New external source';
    f.batches[0]!.resolve();
    await flushMicrotasks();
    expect(text.data).toBe('New external source');
    await vi.advanceTimersByTimeAsync(400);
    expect(f.batches).toHaveLength(2);
    expect(f.batches[1]!.message.nodes[0]?.text).toBe('New external source');
    f.batches[1]!.resolve();
    await flushMicrotasks();
    expect(text.data).toBe('Перевод New external source');
    await f.controller.setDisplayMode('original');
    expect(text.data).toBe('New external source');
  });

  it('keeps undelivered external mutations when toggling before the observer callback', async () => {
    const f = fixture('<p>Original</p>');
    const text = document.querySelector('p')!.firstChild as Text;
    await f.controller.start('session', pageSettings());
    f.batches[0]!.resolve();
    await flushMicrotasks();
    text.data = 'External source';
    await f.controller.setDisplayMode('original');
    expect(text.data).toBe('External source');
    await f.controller.setDisplayMode('translated');
    expect(f.batches[1]!.message.nodes[0]?.text).toBe('External source');
  });

  it('does not apply a pending response to text that becomes an editor, and leaves ready editor values intact on toggle', async () => {
    const f = fixture('<p>Ready</p><p>Pending editor</p>');
    await f.controller.start('session', pageSettings({ concurrency: 1, maxNodesPerBatch: 1 }));
    f.batches[0]!.resolve();
    await flushMicrotasks();
    const ready = document.querySelectorAll('p')[0]!;
    const pending = document.querySelectorAll('p')[1]!;
    pending.setAttribute('contenteditable', 'true');
    f.batches[1]!.resolve();
    await flushMicrotasks();
    expect(pending.textContent).toBe('Pending editor');
    expect(f.controller.getState().inFlight).toBe(0);
    ready.setAttribute('contenteditable', 'true');
    await f.controller.setDisplayMode('original');
    expect(ready.textContent).toBe('Перевод Ready');
    expect(pending.textContent).toBe('Pending editor');
  });

  it('pauses new batches in original mode, releases in-flight work and resumes unfinished nodes', async () => {
    const f = fixture('<p>Original</p>');
    await f.controller.start('session', pageSettings());
    await f.controller.setDisplayMode('original');
    f.batches[0]!.resolve();
    await flushMicrotasks();
    const added = document.createElement('p');
    added.textContent = 'Dynamic source';
    document.body.append(added);
    await vi.advanceTimersByTimeAsync(800);
    expect(f.batches).toHaveLength(1);
    expect(document.querySelector('p')?.textContent).toBe('Original');
    await f.controller.setDisplayMode('translated');
    expect(document.querySelector('p')?.textContent).toBe('Original');
    expect(f.batches).toHaveLength(2);
    expect(f.batches[1]!.message.nodes.map(node => node.text)).toEqual(['Original', 'Dynamic source']);
    f.batches[1]!.resolve();
    await flushMicrotasks();
    expect(document.querySelector('p')?.textContent).toBe('Перевод Original');
  });

  it('resumes unfinished nodes after background cancellation in original mode while ready translations stay offline', async () => {
    const f = fixture('<p>Ready</p><p>Unfinished</p><p>Queued</p>');
    await f.controller.start('session', pageSettings({ concurrency: 1, maxNodesPerBatch: 1 }));
    f.batches[0]!.resolve();
    await flushMicrotasks();
    await f.controller.setDisplayMode('original');
    f.batches[1]!.reject(new LinguistyError('CANCELLED'));
    await flushMicrotasks();
    expect(f.controller.getState()).toMatchObject({ translated: 1, failed: 0, inFlight: 0, displayMode: 'original' });
    expect(f.controller.getState().error).toBeUndefined();
    expect(f.batches).toHaveLength(2);
    await f.controller.setDisplayMode('translated');
    expect(document.querySelector('p')?.textContent).toBe('Перевод Ready');
    expect(f.batches[2]!.message.nodes.map(node => node.text)).toEqual(['Unfinished']);
    f.batches[2]!.resolve();
    await flushMicrotasks();
    expect(f.batches[3]!.message.nodes.map(node => node.text)).toEqual(['Queued']);
  });

  it('does not enter a cancellation retry loop when background abort arrives before the original-mode command', async () => {
    const f = fixture('<p>Unfinished</p>');
    await f.controller.start('session', pageSettings());
    f.batches[0]!.reject(new LinguistyError('CANCELLED'));
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(f.batches).toHaveLength(1);
    expect(f.controller.getState().failed).toBe(0);
    await f.controller.setDisplayMode('original');
    await f.controller.setDisplayMode('translated');
    expect(f.batches).toHaveLength(2);
  });

  it('starts the same document with fresh IDs and stable semantic group/cache context', async () => {
    const f = fixture('<p>First <b>inline</b></p><p>Second</p>');
    await f.controller.start('first-session', pageSettings());
    const first = f.batches[0]!.message;
    f.batches[0]!.resolve();
    await flushMicrotasks();
    await f.controller.start('second-session', pageSettings());
    const second = f.batches[1]!.message;
    expect(second.nodes.map(node => ({ text: node.text, group: node.group }))).toEqual(first.nodes.map(node => ({ text: node.text, group: node.group })));
    expect(second.nodes.map(node => node.id)).not.toEqual(first.nodes.map(node => node.id));
  });

  /** @spec spec://modules/page/FEAT-002-page-translation#sessions */
  it('resets a pushState SPA session through background, preserves source in retained shell and rejects old batches', async () => {
    const f = fixture('<header>Shared header</header><main><p>Old route</p></main>');
    await f.controller.start('old-session', pageSettings({ maxNodesPerBatch: 1, concurrency: 1 }));
    f.batches[0]!.resolve();
    await flushMicrotasks();
    const old = f.batches[1]!;
    window.history.pushState({}, '', '/new-route?query=value');
    document.title = 'New route title';
    document.querySelector('main')!.innerHTML = '<p>New route</p>';
    await flushMicrotasks();
    const begin = f.messages.find(message => message.type === 'BEGIN_PAGE_SESSION');
    expect(begin).toMatchObject({ previousSessionId: 'old-session', pageContext: { title: 'New route title', domain: location.hostname } });
    expect(f.controller.getState().sessionId).toBe('route-session');
    expect(f.batches[2]!.message.nodes.map(node => node.text)).toEqual(['Shared header', 'New route']);
    old.resolve();
    await flushMicrotasks();
    expect(document.querySelector('main')?.textContent).toBe('New route');
    f.batches[2]!.resolve();
    await flushMicrotasks();
    expect(document.querySelector('main')?.textContent).toBe('Перевод New route');
  });

  it('detects URL changes without a DOM mutation or popstate and whole-body replacement at the same URL', async () => {
    const f = fixture('<p>Old route</p>');
    await f.controller.start('session', pageSettings());
    window.history.pushState({}, '', '/url-only');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(f.messages.filter(message => message.type === 'BEGIN_PAGE_SESSION')).toHaveLength(1);
    const body = document.createElement('body');
    body.innerHTML = '<p>Replacement body</p>';
    document.body.replaceWith(body);
    await flushMicrotasks();
    expect(f.messages.filter(message => message.type === 'BEGIN_PAGE_SESSION')).toHaveLength(2);
    expect(f.batches.at(-1)!.message.nodes.map(node => node.text)).toEqual(['Replacement body']);
  });

  it('preserves paused display through SPA reset and discards a session returned after cancellation', async () => {
    const f = fixture('<p>Old route</p>');
    let resolveBegin!: (response: { sessionId: string; settings: ReturnType<typeof pageSettings> }) => void;
    f.onBegin(() => new Promise(resolve => { resolveBegin = resolve; }));
    await f.controller.start('session', pageSettings());
    await f.controller.setDisplayMode('original');
    window.history.pushState({}, '', '/paused-route');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await f.controller.cancel();
    resolveBegin({ sessionId: 'late-route-session', settings: pageSettings() });
    await flushMicrotasks();
    expect(f.batches).toHaveLength(1);
    expect(f.controller.getState()).toMatchObject({ status: 'cancelled', displayMode: 'original' });
    expect(f.messages).toContainEqual(expect.objectContaining({ type: 'PAGE_PROGRESS', sessionId: 'late-route-session', state: expect.objectContaining({ status: 'cancelled' }) }));
  });

  /** @spec spec://common/PROP-002-quality#resources */
  it('cancels queued/in-flight work, frees pending nodes and timers, retains offline restore, and ignores late results', async () => {
    const disconnect = vi.fn();
    const f = fixture('<p>Ready</p><p>Pending</p><p>Queued</p>', {
      createMutationObserver(callback) {
        const observer = new MutationObserver(callback);
        return { observe: observer.observe.bind(observer), takeRecords: observer.takeRecords.bind(observer), disconnect() { disconnect(); observer.disconnect(); } };
      },
    });
    await f.controller.start('session', pageSettings({ concurrency: 1, maxNodesPerBatch: 1 }));
    f.batches[0]!.resolve();
    await flushMicrotasks();
    await f.controller.cancel();
    expect(disconnect).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(f.controller.getState()).toMatchObject({ status: 'cancelled', translated: 1, inFlight: 0, discovered: 1 });
    expect(document.querySelector('p')?.textContent).toBe('Перевод Ready');
    f.batches[1]!.resolve();
    await flushMicrotasks();
    expect(document.querySelectorAll('p')[1]?.textContent).toBe('Pending');
    await f.controller.setDisplayMode('original');
    expect(document.querySelector('p')?.textContent).toBe('Ready');
    expect(f.batches).toHaveLength(2);
    f.controller.dispose();
    expect(f.controller.getState()).toMatchObject({ sessionId: null, discovered: 0, inFlight: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('prunes detached pending nodes without corrupting the response ID set', async () => {
    const f = fixture('<p>Detached</p>');
    await f.controller.start('session', pageSettings());
    const p = document.querySelector('p')!;
    p.remove();
    await flushMicrotasks();
    expect(f.controller.getState().discovered).toBe(0);
    f.batches[0]!.resolve();
    await flushMicrotasks();
    expect(p.textContent).toBe('Detached');
    expect(f.controller.getState()).toMatchObject({ discovered: 0, translated: 0, inFlight: 0 });
    expect(f.controller.getState().error).toBeUndefined();
  });

  it('keeps a safe fallback for legacy mixed mocks without cache-hit IDs', async () => {
    const f = fixture('<p>One</p><p>Two</p><p>Three</p>');
    await f.controller.start('session', pageSettings());
    f.batches[0]!.resolve({ translations: f.batches[0]!.message.nodes.map(node => ({ id: node.id, text: 'Готово' })), fromCache: 2 });
    await flushMicrotasks();
    expect(f.controller.getState().fromCache).toBe(2);
    const first = document.querySelector('p')!;
    (first.firstChild as Text).data = 'New source';
    await flushMicrotasks();
    expect(f.controller.getState()).toMatchObject({ translated: 2, fromCache: 1 });
    first.remove();
    document.querySelector('p')!.remove();
    await flushMicrotasks();
    expect(f.controller.getState()).toMatchObject({ translated: 1, fromCache: 0 });
  });

  /** @spec spec://modules/page/FEAT-002-page-translation#queue */
  it('counts exact live cache hits through deletion and external writes of both cached and uncached nodes', async () => {
    const f = fixture('<p>Uncached deleted</p><p>Cached changed</p><p>Uncached changed</p><p>Cached deleted</p>');
    const paragraphs = [...document.querySelectorAll('p')];
    await f.controller.start('session', pageSettings());
    const nodes = f.batches[0]!.message.nodes;
    f.batches[0]!.resolve({
      translations: nodes.map(node => ({ id: node.id, text: `Готово ${node.text}` })),
      fromCache: 2, cacheHitIds: [nodes[1]!.id, nodes[3]!.id],
    });
    await flushMicrotasks();
    expect(f.controller.getState()).toMatchObject({ translated: 4, fromCache: 2 });
    await f.controller.setDisplayMode('original');
    expect(f.controller.getState().fromCache).toBe(2);
    await f.controller.setDisplayMode('translated');
    expect(f.batches).toHaveLength(1);
    paragraphs[0]!.remove();
    await flushMicrotasks();
    expect(f.controller.getState()).toMatchObject({ translated: 3, fromCache: 2 });
    (paragraphs[2]!.firstChild as Text).data = 'New uncached source';
    await flushMicrotasks();
    expect(f.controller.getState()).toMatchObject({ translated: 2, fromCache: 2 });
    (paragraphs[1]!.firstChild as Text).data = 'New cached source';
    await flushMicrotasks();
    expect(f.controller.getState()).toMatchObject({ translated: 1, fromCache: 1 });
    paragraphs[3]!.remove();
    await flushMicrotasks();
    expect(f.controller.getState()).toMatchObject({ translated: 0, fromCache: 0, discovered: 2 });
    await f.controller.cancel();
    expect(f.controller.getState().fromCache).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  /** @spec spec://modules/page/FEAT-002-page-translation#queue */
  it.each([
    { change: 'delete cached node', index: 1, remove: true, expectedHits: 1 },
    { change: 'delete uncached node', index: 0, remove: true, expectedHits: 2 },
    { change: 'change cached node', index: 1, remove: false, expectedHits: 1 },
    { change: 'change uncached node', index: 0, remove: false, expectedHits: 2 },
  ])('counts exact applied cache hits when a pending response arrives after $change', async ({ index, remove, expectedHits }) => {
    const f = fixture('<p>Uncached one</p><p>Cached one</p><p>Uncached two</p><p>Cached two</p>');
    const paragraphs = [...document.querySelectorAll('p')];
    await f.controller.start('session', pageSettings());
    const nodes = f.batches[0]!.message.nodes;
    if (remove) paragraphs[index]!.remove();
    else (paragraphs[index]!.firstChild as Text).data = 'New external source';
    await flushMicrotasks();
    f.batches[0]!.resolve({
      translations: nodes.map(node => ({ id: node.id, text: `Готово ${node.text}` })),
      fromCache: 2, cacheHitIds: [nodes[1]!.id, nodes[3]!.id],
    });
    await flushMicrotasks();
    expect(f.controller.getState()).toMatchObject({ translated: 3, fromCache: expectedHits, inFlight: 0 });
    if (!remove) expect(paragraphs[index]!.textContent).toBe('New external source');
    await f.controller.cancel();
    expect(f.controller.getState().fromCache).toBe(expectedHits);
    f.controller.dispose();
    expect(f.controller.getState().fromCache).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  /** @spec spec://common/PROP-001-contracts#modules */
  it.each([
    { name: 'unknown cache hit ID', fromCache: 1, ids: (_ids: string[]) => ['unknown'] },
    { name: 'duplicate cache hit IDs', fromCache: 2, ids: (ids: string[]) => [ids[0], ids[0]] },
    { name: 'cache hit count mismatch', fromCache: 1, ids: (ids: string[]) => ids },
    { name: 'cache hits with zero count', fromCache: 0, ids: (ids: string[]) => [ids[0]] },
    { name: 'non-string cache hit ID', fromCache: 1, ids: (_ids: string[]) => [42] },
    { name: 'non-array cache hit IDs', fromCache: 1, ids: (ids: string[]) => ids[0] },
    { name: 'null cache hit IDs', fromCache: 1, ids: (_ids: string[]) => null },
  ])('rejects $name atomically before DOM changes', async ({ fromCache, ids }) => {
    const f = fixture('<p>One</p><p>Two</p>');
    await f.controller.start('session', pageSettings());
    const nodes = f.batches[0]!.message.nodes;
    const malformed = {
      translations: nodes.map(node => ({ id: node.id, text: 'Готово' })),
      fromCache, cacheHitIds: ids(nodes.map(node => node.id)),
    } as unknown as TranslationResult;
    f.batches[0]!.resolve(malformed);
    await flushMicrotasks();
    expect(document.body.textContent).toBe('OneTwo');
    expect(f.controller.getState()).toMatchObject({ failed: 2, translated: 0, fromCache: 0, error: { code: 'INVALID_MODEL_RESPONSE' } });
  });

  it('rejects malformed responses atomically and exposes safe snapshots/errors', async () => {
    const f = fixture('<p>One</p><p>Two</p>');
    await f.controller.start('session', pageSettings());
    f.batches[0]!.resolve({ translations: [{ id: f.batches[0]!.message.nodes[0]!.id, text: 'Готово' }, { id: 'unknown', text: 'Wrong' }], fromCache: 0 });
    await flushMicrotasks();
    expect(document.body.textContent).toBe('OneTwo');
    expect(f.controller.getState()).toMatchObject({ failed: 2, translated: 0, error: { code: 'INVALID_MODEL_RESPONSE' } });
    const state = f.controller.getState();
    state.translated = 999;
    state.error!.message = 'Mutated externally';
    expect(f.controller.getState().translated).toBe(0);
    expect(f.controller.getState().error?.message).not.toBe('Mutated externally');
  });

  it('rejects an oversized combined response before applying any node', async () => {
    const f = fixture('<p>One</p><p>Two</p>');
    await f.controller.start('session', pageSettings());
    f.batches[0]!.resolve({ translations: f.batches[0]!.message.nodes.map(node => ({ id: node.id, text: 'x'.repeat(600_000) })), fromCache: 0 });
    await flushMicrotasks();
    expect(document.body.textContent).toBe('OneTwo');
    expect(f.controller.getState()).toMatchObject({ translated: 0, failed: 2, error: { code: 'INVALID_MODEL_RESPONSE' } });
  });

  it('releases a non-settling batch after the local watchdog and ignores its late response', async () => {
    const f = fixture('<p>Source</p>');
    await f.controller.start('session', pageSettings({ requestTimeoutMs: 1_000 }));
    await vi.advanceTimersByTimeAsync(batchTimeoutMs(1_000) + 5_000);
    expect(f.controller.getState()).toMatchObject({ status: 'error', failed: 1, inFlight: 0, error: { code: 'REQUEST_TIMEOUT' } });
    f.batches[0]!.resolve();
    await flushMicrotasks();
    expect(document.body.textContent).toBe('Source');
  });

  it('keeps repeated start/cancel cycles bounded and rejects invalid resource settings', async () => {
    const f = fixture('<p>Source</p>');
    await expect(f.controller.start('invalid', pageSettings({ concurrency: 5 }))).rejects.toBeInstanceOf(LinguistyError);
    expect(f.batches).toHaveLength(0);
    for (let i = 0; i < 20; i += 1) {
      await f.controller.start(`session-${i}`, pageSettings());
      await f.controller.cancel();
      expect(f.controller.getState().discovered).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    }
    expect(f.batches).toHaveLength(20);
    for (const batch of f.batches) batch.resolve();
    await flushMicrotasks();
    expect(document.body.textContent).toBe('Source');
  });

  it('releases old IntersectionObserver targets when a Text node is repeatedly moved to new parents', async () => {
    const targets = new Set<Element>();
    const f = fixture('<p>Moving source</p>', {
      createIntersectionObserver: () => ({ observe: element => { targets.add(element); }, unobserve: element => { targets.delete(element); }, disconnect: () => { targets.clear(); } }),
    });
    await f.controller.start('session', pageSettings());
    f.batches[0]!.resolve();
    await flushMicrotasks();
    const text = document.querySelector('p')!.firstChild!;
    for (let i = 0; i < 10; i += 1) {
      const parent = document.createElement('p');
      parent.append(text);
      document.body.replaceChildren(parent);
      await vi.advanceTimersByTimeAsync(400);
      expect(targets.size).toBe(1);
      expect(f.controller.getState().discovered).toBe(1);
    }
    expect(f.batches).toHaveLength(1);
    f.controller.dispose();
    expect(targets.size).toBe(0);
    expect(document.body.textContent).toBe('Moving source');
  });

  it('reports a 5 000-node page limit and never queues overflow nodes', async () => {
    const f = fixture(Array.from({ length: 5_002 }, (_, i) => `<p>Text ${i}</p>`).join(''));
    await f.controller.start('session', pageSettings());
    expect(f.controller.getState()).toMatchObject({ discovered: 5_000, limited: true, error: { code: 'CONTEXT_TOO_LARGE' } });
    expect(f.batches).toHaveLength(2);
    await f.controller.cancel();
    expect(f.controller.getState().discovered).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps provider failures local and does not expose provider response bodies', async () => {
    const f = fixture('<p>Source</p>');
    await f.controller.start('session', pageSettings());
    f.batches[0]!.reject(new Error('secret-provider-body'));
    await flushMicrotasks();
    expect(f.controller.getState()).toMatchObject({ failed: 1, error: { code: 'INTERNAL_ERROR' } });
    expect(JSON.stringify(f.controller.getState())).not.toContain('secret-provider-body');
    const cancelProgress = f.messages.filter((message: RuntimeMessage) => message.type === 'PAGE_PROGRESS');
    expect(cancelProgress.length).toBeGreaterThan(0);
  });
});
