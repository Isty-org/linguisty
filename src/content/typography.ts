/** @spec spec://modules/page/FEAT-002-page-translation#render */
import type { NodeEntry } from './registry';

type Script = 'cjk' | 'cyrillic' | 'latin';
type Property = 'font-size' | 'line-height';
interface SavedProperty { value: string; priority: string; owned: string }
interface OwnedFont { element: HTMLElement; properties: Record<Property, SavedProperty>; hadStyleAttribute: boolean }
export type MeasureFontInk = (style: CSSStyleDeclaration, sample: string) => number;

function scriptOf(text: string): Script | undefined {
  const letters = text.match(/\p{Letter}/gu) ?? [];
  if (!letters.length) return;
  const counts = { cjk: 0, cyrillic: 0, latin: 0 };
  for (const letter of letters) {
    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(letter)) counts.cjk++;
    else if (/\p{Script=Cyrillic}/u.test(letter)) counts.cyrillic++;
    else if (/\p{Script=Latin}/u.test(letter)) counts.latin++;
  }
  return (Object.keys(counts) as Script[]).find(script => counts[script] / letters.length > 0.6);
}

const samples: Record<Script, string> = { cjk: '日本語', cyrillic: 'АБВН', latin: 'HMX' };

/** @spec spec://modules/page/FEAT-002-page-translation#render */
export class PageTypography {
  private readonly owned = new Map<NodeEntry, OwnedFont>();
  private readonly metrics = new Map<string, number>();
  private context?: CanvasRenderingContext2D | null;
  private readonly onFontsLoaded = () => this.metrics.clear();

  constructor(private readonly document: Document, private readonly window: Window, private readonly measureInk?: MeasureFontInk) {
    document.fonts?.addEventListener('loadingdone', this.onFontsLoaded);
  }

  private ink(style: CSSStyleDeclaration, script: Script): number {
    if (this.measureInk) return this.measureInk(style, samples[script]);
    const font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const key = `${font}\n${script}`;
    const known = this.metrics.get(key);
    if (known !== undefined) return known;
    try {
      this.context ??= this.document.createElement('canvas').getContext('2d');
      if (!this.context) return 0;
      this.context.font = font;
      const measured = this.context.measureText(samples[script]);
      const result = measured.actualBoundingBoxAscent + measured.actualBoundingBoxDescent;
      if (this.metrics.size >= 128) this.metrics.delete(this.metrics.keys().next().value!);
      this.metrics.set(key, result);
      return result;
    } catch { return 0; }
  }

  apply(entry: NodeEntry, translation = entry.translation): void {
    if (this.owned.has(entry) || !translation || !entry.node.isConnected) return;
    const from = scriptOf(entry.original);
    const to = scriptOf(translation);
    if (!from || !to || (from === 'cjk') === (to === 'cjk')) return;
    const element = entry.node.parentElement;
    // Never change an untranslated sibling, icon, form value or nested element.
    if (!element || element.namespaceURI !== 'http://www.w3.org/1999/xhtml' || element.childElementCount
      || [...element.childNodes].some(node => node !== entry.node && !!node.textContent?.trim())) return;
    if (!/^(P|H[1-6]|LI|BLOCKQUOTE|DT|DD|FIGCAPTION|CAPTION|SMALL|SUP|SUB)$/u.test(element.tagName)
      || element.closest('nav,aside,table,form,button,[role="navigation"],[role="button"],[role="menu"],[role="tab"]')) return;
    const html = element as HTMLElement;
    const style = this.window.getComputedStyle(html);
    if (/^(nowrap|pre)$/u.test(style.whiteSpace)) return;
    if (style.fontSizeAdjust && style.fontSizeAdjust !== 'none') return;
    const size = Number.parseFloat(style.fontSize);
    const sourceInk = this.ink(style, from);
    const targetInk = this.ink(style, to);
    if (!Number.isFinite(size) || size <= 0 || !(sourceInk > 0) || !(targetInk > 0)) return;
    const caption = /^(SMALL|FIGCAPTION|CAPTION|SUP|SUB)$/u.test(html.tagName);
    const minimum = to === 'cjk' ? (caption ? 13 : 16) : (caption ? 12 : 14);
    const factor = Math.min(1.4, Math.max(1, minimum / size, sourceInk / targetInk));
    if (factor < 1.05) return;
    const clips: { element: HTMLElement; x: number; y: number; clipX: boolean; clipY: boolean }[] = [];
    let ancestor: HTMLElement | null = html;
    for (let depth = 0; ancestor && depth < 8; depth++, ancestor = ancestor.parentElement) {
      const css = this.window.getComputedStyle(ancestor);
      const clipX = /^(hidden|clip)$/u.test(css.overflowX || css.overflow);
      const clipY = /^(hidden|clip)$/u.test(css.overflowY || css.overflow);
      if (clipX || clipY) clips.push({ element: ancestor, x: ancestor.scrollWidth - ancestor.clientWidth,
        y: ancestor.scrollHeight - ancestor.clientHeight, clipX, clipY });
    }
    const properties = {} as Record<Property, SavedProperty>;
    const hadStyleAttribute = html.hasAttribute('style');
    const line = Number.parseFloat(style.lineHeight);
    const values: Record<Property, string> = { 'font-size': `${(size * factor).toFixed(3)}px`,
      'line-height': Number.isFinite(line) ? `${(line * factor).toFixed(3)}px` : 'normal' };
    for (const property of ['font-size', 'line-height'] as const) {
      properties[property] = { value: html.style.getPropertyValue(property), priority: html.style.getPropertyPriority(property), owned: '' };
      html.style.setProperty(property, values[property], properties[property].priority);
      properties[property].owned = html.style.getPropertyValue(property);
    }
    this.owned.set(entry, { element: html, properties, hadStyleAttribute });
    if (clips.some(clip => (clip.clipX && clip.element.scrollWidth - clip.element.clientWidth > Math.max(0, clip.x) + 1)
      || (clip.clipY && clip.element.scrollHeight - clip.element.clientHeight > Math.max(0, clip.y) + 1))) this.restore(entry);
  }

  restore(entry: NodeEntry): void {
    const record = this.owned.get(entry);
    if (!record) return;
    for (const property of ['font-size', 'line-height'] as const) {
      const saved = record.properties[property];
      if (record.element.style.getPropertyValue(property) !== saved.owned
        || record.element.style.getPropertyPriority(property) !== saved.priority) continue;
      if (saved.value) record.element.style.setProperty(property, saved.value, saved.priority);
      else record.element.style.removeProperty(property);
    }
    if (!record.hadStyleAttribute && !record.element.style.length) record.element.removeAttribute('style');
    this.owned.delete(entry);
  }

  invalidate(root: Node): void {
    for (const [entry, record] of this.owned) {
      if (root === entry.node || root.contains(record.element) || !entry.node.isConnected) this.restore(entry);
    }
    this.metrics.clear();
  }

  prune(): void { for (const entry of this.owned.keys()) if (!entry.node.isConnected) this.restore(entry); }
  clear(): void { for (const entry of this.owned.keys()) this.restore(entry); this.metrics.clear(); }
  dispose(): void {
    this.clear();
    this.document.fonts?.removeEventListener('loadingdone', this.onFontsLoaded);
    this.context = undefined;
  }
}
