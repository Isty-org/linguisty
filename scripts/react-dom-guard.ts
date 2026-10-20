/** @spec spec://modules/platform/INFRA-001-extension#build */
import type { Plugin } from 'vite';

// Match the two reviewed React DOM 19.3.0 setters before CommonJS conversion.
// Keep upstream code on disk intact. An upstream change requires a new review.
const rawHtmlCase = `case "dangerouslySetInnerHTML":
      if (null != value) {
        if ("object" !== typeof value || !("__html" in value))
          throw Error(formatProdErrorMessage(61));
        key = value.__html;
        if (null != key) {
          if (null != props.children) throw Error(formatProdErrorMessage(60));
          (null != prevValue ? prevValue.__html : void 0) !== key &&
            (domElement.innerHTML = key);
        }
      }
      break;`;

const guardedHtmlCase = `case "dangerouslySetInnerHTML":
      if (null != value) {
        throw Error("Linguisty: raw HTML rendering is disabled; use React children.");
      }
      break;`;

export function disableReactRawHtml(source: string): string {
  const normalized = source.replaceAll('\r\n', '\n');
  if (normalized.split(rawHtmlCase).length - 1 !== 2 ||
      [...normalized.matchAll(/domElement\.innerHTML\s*=/g)].length !== 2) {
    throw new Error('React DOM raw-HTML setters changed; review the Linguisty build guard before shipping.');
  }
  return normalized.replaceAll(rawHtmlCase, guardedHtmlCase);
}

export function reactDomGuard(): Plugin {
  return {
    name: 'linguisty-react-dom-guard',
    enforce: 'pre',
    apply: 'build',
    transform(source, id) {
      const file = id.replaceAll('\\', '/').split('?')[0];
      if (!file?.endsWith('/react-dom/cjs/react-dom-client.production.js')) return;
      return { code: disableReactRawHtml(source), map: null };
    },
  };
}
