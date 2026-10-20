/** @spec spec://modules/page/FEAT-002-page-translation#scan */
const EXCLUDED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'SVG', 'CANVAS',
  'INPUT', 'SELECT', 'OPTION', 'IFRAME', 'OBJECT', 'TEMPLATE', 'HEAD',
]);
const SEMANTIC_CONTAINER = 'p,li,tr,article,section,figure,figcaption,blockquote,h1,h2,h3,h4,h5,h6,button';

export interface TextCandidate {
  node: Text;
  priority: number;
  container: Element;
}

export interface ScannerOptions {
  document: Document;
  window: Window;
  measureText?: (node: Text) => readonly DOMRectReadOnly[];
}

export function isEditableText(node: Text): boolean {
  if (node.ownerDocument.designMode?.toLowerCase() === 'on') return true;
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const editable = parent.getAttribute('contenteditable')?.toLowerCase();
    if (editable === '' || editable === 'true' || editable === 'plaintext-only') return true;
  }
  return false;
}

export function isMeaningfulText(value: string): boolean {
  const text = value.trim();
  if (!text || !/[\p{L}\p{N}]/u.test(text)) return false;
  if (/^(?:(?:https?:\/\/|ftp:\/\/|www\.)\S+|[^\s@]+@[^\s@]+\.[^\s@]+|#[\w-]+|(?:0x)?[a-f\d]{16,})$/iu.test(text)) return false;
  return true;
}

export function getTextRects(node: Text): readonly DOMRectReadOnly[] {
  const range = node.ownerDocument.createRange();
  range.selectNodeContents(node);
  // jsdom has no Range layout; real browsers use the text's own rects (also
  // handles display:contents parents, which have no element box).
  if (typeof range.getClientRects === 'function') return Array.from(range.getClientRects());
  return Array.from(node.parentElement?.getClientRects() ?? []);
}

export function viewportPriority(rects: readonly DOMRectReadOnly[], window: Window): number {
  const height = window.innerHeight || 768;
  const width = window.innerWidth || 1024;
  const intersects = (margin: number) => rects.some(rect =>
    rect.bottom > -margin && rect.top < height + margin && rect.right > -margin && rect.left < width + margin,
  );
  return intersects(0) ? 0 : intersects(height) ? 1 : 2;
}

function excludesElement(element: Element, window: Window): boolean {
  if (EXCLUDED_TAGS.has(element.tagName.toUpperCase())) return true;
  if (element.hasAttribute('hidden') || element.hasAttribute('inert')) return true;
  if (element.getAttribute('aria-hidden')?.toLowerCase() === 'true') return true;
  if (element.getAttribute('translate')?.toLowerCase() === 'no') return true;
  const editable = element.getAttribute('contenteditable')?.toLowerCase();
  if (editable === '' || editable === 'true' || editable === 'plaintext-only') return true;
  const style = window.getComputedStyle(element);
  return style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
    || style.contentVisibility === 'hidden' || style.opacity === '0';
}

/** @spec spec://modules/page/FEAT-002-page-translation#scan */
export function* scanTextNodes(root: Node, options: ScannerOptions): Generator<TextCandidate> {
  const { document, window } = options;
  if (document.designMode?.toLowerCase() === 'on') return;
  const excluded = new WeakMap<Element, boolean>();
  const blocked = (element: Element | null): boolean => {
    if (!element) return false;
    const known = excluded.get(element);
    if (known !== undefined) return known;
    const result = excludesElement(element, window) || blocked(element.parentElement);
    excluded.set(element, result);
    return result;
  };
  if (blocked(root.nodeType === 1 ? root as Element : root.parentElement)) return;
  const measure = options.measureText ?? getTextRects;
  const candidate = (node: Text): TextCandidate | undefined => {
    if (!node.isConnected || node.ownerDocument !== document || !isMeaningfulText(node.data) || blocked(node.parentElement)) return;
    const rects = measure(node).filter(rect => rect.width > 0 && rect.height > 0);
    if (!rects.length || !node.parentElement) return;
    return {
      node, priority: viewportPriority(rects, window),
      container: node.parentElement.closest(SEMANTIC_CONTAINER) ?? node.parentElement,
    };
  };
  if (root.nodeType === 3) {
    const result = candidate(root as Text);
    if (result) yield result;
    return;
  }
  const walker = document.createTreeWalker(root, 1 | 4, {
    acceptNode(node) {
      if (node.nodeType === 1) return blocked(node as Element) ? 2 : 3;
      return 1;
    },
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const result = candidate(node as Text);
    if (result) yield result;
  }
}
