/** @spec spec://modules/page/FEAT-002-page-translation#scan */
import { afterEach, describe, expect, it } from 'vitest';
import { scanTextNodes } from '../../src/content/scanner';
import { NodeRegistry } from '../../src/content/registry';
import { measureText } from './helpers';

afterEach(() => { document.body.replaceChildren(); });

describe('page scanner and bounded registry', () => {
  it('filters excluded ancestors, layout, editable content and technical-only strings while keeping semantic numbers', () => {
    document.body.innerHTML = `
      <p> Loyer 1 420 € charges comprises </p><p data-top="4000">Far but laid out</p>
      <script>Ignore script</script><style>Ignore style</style><noscript>Ignore noscript</noscript>
      <code><b>Ignore code</b></code><pre>Ignore pre</pre><textarea>Ignore textarea</textarea>
      <svg><text>Ignore svg</text></svg><canvas>Ignore canvas</canvas><input value="Ignore input">
      <select><option>Ignore option</option></select><div contenteditable><span>Ignore editable</span></div>
      <div contenteditable="plaintext-only">Ignore plaintext editor</div><div translate="no"><b>Ignore no translate</b></div>
      <div hidden><b>Ignore hidden</b></div><div inert>Ignore inert</div><div aria-hidden="true">Ignore aria</div>
      <div style="display:none">Ignore display</div><div style="visibility:hidden">Ignore visibility</div>
      <div style="opacity:0">Ignore opacity</div><div data-no-layout>Ignore no layout</div>
      <p> \n \t </p><p> ... !? — </p><p>https://example.test/path?x=1</p><p>www.example.test</p>
      <p>person@example.test</p><p>#fragment</p><p>e3b0c44298fc1c149afbf4c8996fb924</p>
      <p>Visit https://example.test for details</p><p>42 m²</p>
    `;
    const found = [...scanTextNodes(document.body, { document, window, measureText })];
    expect(found.map(item => item.node.data.trim())).toEqual([
      'Loyer 1 420 € charges comprises', 'Far but laid out', 'Visit https://example.test for details', '42 m²',
    ]);
    expect(found[1]?.priority).toBe(2);
  });

  it('groups inline text by semantic container and includes a root that is itself Text', () => {
    document.body.innerHTML = '<p>One <b>two</b> three</p><p>Four</p>';
    const found = [...scanTextNodes(document.body, { document, window, measureText })];
    expect(found[0]?.container).toBe(found[1]?.container);
    expect(found[1]?.container).toBe(found[2]?.container);
    expect(found[3]?.container).not.toBe(found[0]?.container);
    expect([...scanTextNodes(found[1]!.node, { document, window, measureText })]).toHaveLength(1);
  });

  it('caps iterable and weak registry at 5 000 nodes, deduplicates references and frees detached nodes', () => {
    const registry = new NodeRegistry();
    const parent = document.createElement('p');
    document.body.append(parent);
    for (let i = 0; i < 5_001; i += 1) {
      const node = document.createTextNode(`Text ${i}`);
      parent.append(node);
      registry.track({ node, container: parent, priority: 0 });
    }
    expect(registry.size).toBe(5_000);
    expect(registry.limited).toBe(true);
    const first = parent.firstChild as Text;
    const entry = registry.get(first)!;
    expect(registry.track({ node: first, container: parent, priority: 1 })).toBe(entry);
    expect(registry.size).toBe(5_000);
    first.remove();
    expect(registry.prune()).toEqual([entry]);
    expect(registry.get(first)).toBeUndefined();
    expect(registry.size).toBe(4_999);
    const last = parent.lastChild as Text;
    expect(registry.track({ node: last, container: parent, priority: 0 })).toBeDefined();
    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.get(last)).toBeUndefined();
    expect(registry.limited).toBe(false);
  });
});
