/** @spec spec://modules/page/FEAT-002-page-translation#render */
import type { NodeEntry, NodeRegistry } from './registry';
import { firstCharacter, hasCjkBoundary, lastCharacter } from '../translation/segments';

const word = /[\p{Script=Latin}\p{Script=Cyrillic}\p{Number}]/u;
const inline = /^(A|SPAN|B|I|EM|STRONG|ABBR|BDI|BDO|CITE|CODE|DEL|INS|MARK|Q|S|U|WBR)$/u;

/** Stop at layout boundaries; skip reference markers without editing their text. */
function adjacentText(text: Text, backwards: boolean): Text | undefined {
  const scope = text.parentElement?.closest('p,li,dt,dd,blockquote,h1,h2,h3,h4,h5,h6,td,th,figcaption,caption') ?? text.parentElement;
  let current: Node = text;
  for (let steps = 0; steps < 64 && current !== scope; steps++) {
    const sibling = backwards ? current.previousSibling : current.nextSibling;
    if (!sibling) {
      const parent = current.parentNode;
      if (!parent || parent === scope || parent.nodeType !== 1 || !inline.test((parent as Element).tagName)) return;
      const style = text.ownerDocument.defaultView?.getComputedStyle(parent as Element);
      if (style?.display && !['inline', 'contents'].includes(style.display)) return;
      current = parent;
      continue;
    }
    current = sibling;
    for (let depth = 0; depth < 8 && current.nodeType === 1; depth++) {
      const element = current as Element;
      if (/^(SUP|SUB)$/u.test(element.tagName)) break;
      if (!inline.test(element.tagName)) return;
      const style = text.ownerDocument.defaultView?.getComputedStyle(element);
      if (style && (style.display && !['inline', 'contents'].includes(style.display)
        || style.visibility === 'hidden' || element.hasAttribute('hidden'))) return;
      const child = backwards ? current.lastChild : current.firstChild;
      if (!child) break;
      current = child;
    }
    if (current.nodeType === 3 && (current as Text).data) return current as Text;
  }
}

function rawTranslation(entry: NodeEntry): string | undefined { return entry.preview ?? entry.translation; }

function displayValue(entry: NodeEntry, translated: boolean, registry: NodeRegistry): string {
  const value = translated ? rawTranslation(entry) ?? entry.original : entry.original;
  if (!translated || !rawTranslation(entry) || entry.node.parentElement?.closest('sup,sub')) return value;
  const previous = adjacentText(entry.node, true);
  if (!previous || /\s$/u.test(previous.data) || /^\s/u.test(value)) return value;
  const previousEntry = registry.get(previous);
  if (!hasCjkBoundary(previousEntry?.original ?? previous.data, entry.original)) return value;
  const last = lastCharacter(previous.data);
  const first = firstCharacter(value);
  return word.test(first) && (word.test(last) || /[.!?]/u.test(last)) ? ` ${value}` : value;
}

function update(entry: NodeEntry, translated: boolean, registry: NodeRegistry): void {
  // The renderer already checked its own entry. Neighbors must still contain
  // our expected value; intervening site edits are never overwritten.
  if (!entry.node.isConnected || entry.node.data !== entry.expected) return;
  const value = displayValue(entry, translated, registry);
  if (entry.node.data !== value) entry.node.data = value;
  entry.expected = value;
}

export function applyInlineSpacing(entry: NodeEntry, translated: boolean, registry: NodeRegistry): void {
  update(entry, translated, registry);
  const next = adjacentText(entry.node, false);
  const neighbor = next && registry.get(next);
  if (neighbor) update(neighbor, neighbor.expected !== neighbor.original, registry);
}
