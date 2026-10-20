/** @spec spec://modules/platform/INFRA-001-extension#build */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { disableReactRawHtml } from '../../scripts/react-dom-guard';

const nodeRequire = createRequire(import.meta.url);
const reactRoot = path.dirname(nodeRequire.resolve('react/package.json'));
const domRoot = path.dirname(nodeRequire.resolve('react-dom/package.json'));
const rendererSource = readFileSync(path.join(domRoot, 'cjs/react-dom-client.production.js'), 'utf8');
const payload = '<img data-probe="raw-html" onerror="window.linguistyRawHtml = true"><b>Provider text</b>';

// Execute the installed production renderer, with the same guard used by Vite.
// An isolated module graph keeps React's production internals consistent.
function productionRuntime(guarded: boolean) {
  const dependencies = new Map<string, unknown>();
  function load<T>(file: string, source = readFileSync(file, 'utf8')): T {
    const exports = {};
    runInNewContext(source, {
      exports,
      require: (id: string) => dependencies.has(id) ? dependencies.get(id) : nodeRequire(id),
      window, document, navigator, console, setTimeout, clearTimeout, queueMicrotask,
      performance, AbortController,
    }, { filename: file });
    return exports as T;
  }
  const react = load<typeof import('react')>(path.join(reactRoot, 'cjs/react.production.js'));
  dependencies.set('react', react);
  const dom = load<typeof import('react-dom')>(path.join(domRoot, 'cjs/react-dom.production.js'));
  dependencies.set('react-dom', dom);
  const client = load<typeof import('react-dom/client')>(
    path.join(domRoot, 'cjs/react-dom-client.production.js'),
    guarded ? disableReactRawHtml(rendererSource) : rendererSource,
  );
  return { react, dom, client };
}

function renderRawHtml(tag: string, guarded: boolean) {
  const { react, dom, client } = productionRuntime(guarded);
  const container = document.createElement('div');
  document.body.append(container);
  const errors: string[] = [];
  const root = client.createRoot(container, { onUncaughtError: error => errors.push(String(error)) });
  try {
    dom.flushSync(() => root.render(react.createElement(tag, { dangerouslySetInnerHTML: { __html: payload } })));
    return { errors, rawNodes: container.querySelectorAll('img,b').length, text: container.textContent };
  } finally {
    dom.flushSync(() => root.unmount());
    container.remove();
  }
}

describe('production React raw-HTML guard', () => {
  it.each(['div', 'linguisty-probe'])('reproduces upstream HTML parsing for %s', tag => {
    const result = renderRawHtml(tag, false);
    expect(result.errors).toEqual([]);
    expect(result.rawNodes).toBe(2);
    expect(result.text).toBe('Provider text');
  });

  it.each(['div', 'linguisty-probe'])('rejects raw HTML for %s with an explicit error', tag => {
    const result = renderRawHtml(tag, true);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Linguisty: raw HTML rendering is disabled');
    expect(result.rawNodes).toBe(0);
    expect(result.text).toBe('');
  });

  it.each(['div', 'linguisty-probe'])('preserves text children and updates for %s', tag => {
    const { react, dom, client } = productionRuntime(true);
    const container = document.createElement('div');
    document.body.append(container);
    const errors: string[] = [];
    const root = client.createRoot(container, { onUncaughtError: error => errors.push(String(error)) });
    try {
      dom.flushSync(() => root.render(react.createElement(tag, null, payload)));
      expect(container.textContent).toBe(payload);
      expect(container.querySelectorAll('img,b')).toHaveLength(0);
      dom.flushSync(() => root.render(react.createElement(tag, null, react.createElement('button', null, 'Save'))));
      expect(container.querySelector('button')?.textContent).toBe('Save');
      expect(errors).toEqual([]);
    } finally {
      dom.flushSync(() => root.unmount());
      expect(container.childNodes).toHaveLength(0);
      container.remove();
    }
  });

  it('stops on an upstream setter change instead of silently shipping unsafe HTML', () => {
    expect(() => disableReactRawHtml(rendererSource.replace('domElement.innerHTML = key', 'domElement.innerHTML = newHtml'))).toThrow('setters changed');
    expect(() => disableReactRawHtml(`${rendererSource}\ndomElement.innerHTML = unexpected;`)).toThrow('setters changed');
  });
});
