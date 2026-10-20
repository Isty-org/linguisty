/** @spec spec://modules/page/FEAT-002-page-translation#render */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageTypography } from '../../src/content/typography';
import type { NodeEntry } from '../../src/content/registry';

const owners: PageTypography[] = [];
function fixture(html = '<p style="font-size:18px;line-height:27px;color:red">日本語の文章</p>') {
  document.body.innerHTML = html;
  const element = document.body.firstElementChild as HTMLElement;
  const node = element.firstChild as Text;
  const entry: NodeEntry = { id: 'n1', node, order: 1, original: node.data, expected: node.data,
    translation: 'Русский текст', revision: 0, phase: 'translated', priority: 0, group: 'g1', groupOrder: 1, cacheHit: false };
  const typography = new PageTypography(document, window, (style, sample) => Number.parseFloat(style.fontSize) * (sample === '日本語' ? 8 / 9 : 2 / 3));
  owners.push(typography);
  return { entry, typography, element };
}
afterEach(() => { for (const owner of owners.splice(0)) owner.dispose(); document.body.replaceChildren(); });

describe('measured typography ownership', () => {
  it('removes an empty style attribute it created and preserves an originally empty one', () => {
    const f = fixture('<p>人工智能</p>');
    f.element.style.fontSize = '18px';
    // Supply computed metrics without authoring inline styles for the source.
    f.element.removeAttribute('style');
    const computed = window.getComputedStyle.bind(window);
    const spy = vi.spyOn(window, 'getComputedStyle').mockImplementation(element => {
      const style = computed(element);
      return new Proxy(style, { get(target, property) {
        if (property === 'fontSize') return '18px';
        const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
      } });
    });
    f.typography.apply(f.entry);
    expect(f.element.hasAttribute('style')).toBe(true);
    f.typography.restore(f.entry);
    expect(f.element.hasAttribute('style')).toBe(false);
    f.element.setAttribute('style', '');
    f.typography.apply(f.entry); f.typography.restore(f.entry);
    expect(f.element.hasAttribute('style')).toBe(true);
    spy.mockRestore();
  });
  it.each(['<a>人工智能</a>', '<span>人工智能</span>', '<button>人工智能</button>', '<nav><li>人工智能</li></nav>', '<p style="white-space:nowrap">人工智能</p>'])('preserves typography of inline and constrained UI: %s', html => {
    const f = fixture(html);
    const element = document.querySelector('a,span,button,li,p') as HTMLElement;
    const entry = { ...f.entry, node: element.firstChild as Text, original: element.textContent!, expected: element.textContent! };
    const before = element.style.cssText;
    f.typography.apply(entry);
    expect(element.style.cssText).toBe(before);
  });
  it('corrects the reproduced 16/12 px mismatch without accumulating and restores original declarations', () => {
    const f = fixture();
    const before = f.element.style.cssText;
    f.typography.apply(f.entry);
    expect(Number.parseFloat(f.element.style.fontSize)).toBeCloseTo(24, 2);
    expect(Number.parseFloat(f.element.style.lineHeight)).toBeCloseTo(36, 2);
    f.typography.apply(f.entry);
    expect(Number.parseFloat(f.element.style.fontSize)).toBeCloseTo(24, 2);
    for (let i = 0; i < 12; i++) { f.typography.restore(f.entry); f.typography.apply(f.entry); }
    f.typography.restore(f.entry);
    expect(f.element.style.cssText).toBe(before);
  });

  it('leaves reverse CJK at its original larger height, enlarges only the small caption and caps growth', () => {
    const f = fixture();
    f.entry.original = 'Русский текст'; f.entry.translation = '日本語';
    f.typography.apply(f.entry);
    expect(f.element.style.fontSize).toBe('18px');
    const caption = fixture('<small style="font-size:12px;line-height:18px">Русская подпись</small>');
    caption.entry.translation = '写真の説明';
    caption.typography.apply(caption.entry);
    expect(Number.parseFloat(caption.element.style.fontSize)).toBe(13);
    const tiny = fixture('<p style="font-size:10px;line-height:15px">日本語</p>');
    tiny.typography.apply(tiny.entry);
    expect(Number.parseFloat(tiny.element.style.fontSize)).toBe(14);
  });

  it('restores only owned values and preserves a new external style and priority', () => {
    const f = fixture('<p style="font-size:18px!important;line-height:27px">日本語</p>');
    f.typography.apply(f.entry);
    expect(f.element.style.getPropertyPriority('font-size')).toBe('important');
    f.element.style.setProperty('font-size', '22px');
    f.typography.invalidate(f.element);
    expect(f.element.style.fontSize).toBe('22px');
    expect(f.element.style.lineHeight).toBe('27px');
    f.typography.dispose();
    expect(f.element.style.fontSize).toBe('22px');
  });

  it('does not style nested/untranslated children or a site-owned font-size-adjust', () => {
    const nested = fixture('<p style="font-size:18px">日本語 <b translate="no">untouched</b></p>');
    nested.typography.apply(nested.entry);
    expect(nested.element.style.fontSize).toBe('18px');
    const authored = fixture('<p style="font-size:18px;font-size-adjust:.55">日本語</p>');
    authored.typography.apply(authored.entry);
    expect(authored.element.style.fontSize).toBe('18px');
    const same = fixture(); same.entry.original = 'English text';
    same.typography.apply(same.entry);
    expect(same.element.style.fontSize).toBe('18px');
  });

  it('rolls back a correction that increases clipped overflow and releases detached ownership', () => {
    const f = fixture('<p style="font-size:18px;line-height:27px;overflow:hidden">日本語</p>');
    Object.defineProperties(f.element, { clientHeight: { value: 28 }, scrollHeight: { get: () => Number.parseFloat(f.element.style.lineHeight) } });
    f.typography.apply(f.entry);
    expect(f.element.style.fontSize).toBe('18px');
    expect(f.element.style.lineHeight).toBe('27px');
    f.element.style.overflow = 'visible';
    f.typography.apply(f.entry);
    expect(f.element.style.fontSize).toBe('24px');
    f.element.remove();
    f.typography.prune();
    expect(f.element.style.fontSize).toBe('18px');
  });
});
