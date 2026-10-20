/** @spec spec://common/PROP-002-quality#checks */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { startLocalServer } from '../tests/e2e/local-server.mjs';

const server = await startLocalServer();
try {
  for (const name of ['real-estate', 'dynamic', 'table', 'forms', 'dom-edge-cases']) {
    const response = await fetch(`${server.origin}/${name}.html`);
    assert.equal(response.status, 200);
    const dom = new JSDOM(await response.text(), { url: `${server.origin}/${name}.html`, runScripts: 'outside-only' });
    try {
      const { document } = dom.window;
      assert.equal(document.documentElement.lang, 'fr');
      assert.ok(document.querySelector('h1'));
      assert.equal(document.querySelector('[src^="https:"], [href^="https:"]'), null);
      if (document.querySelector('script[src="fixture.js"]')) {
        dom.window.eval(await readFile(new URL('../tests/fixtures/fixture.js', import.meta.url), 'utf8'));
        assert.equal(dom.window.linguistyFixture.inspect().referencesPreserved, true);
        if (document.getElementById('dynamic-region')) {
          dom.window.linguistyFixture.addListing();
          assert.equal(dom.window.linguistyFixture.inspect().dynamicNodes, 1);
          dom.window.linguistyFixture.removeListing();
          assert.equal(dom.window.linguistyFixture.inspect().dynamicNodes, 0);
        }
        document.getElementById('gallery-next')?.click();
        if (document.getElementById('gallery-count')) assert.equal(document.getElementById('gallery-count').textContent, '2 / 3');
        document.getElementById('contact-submit')?.click();
        if (document.getElementById('form-result')) assert.equal(document.getElementById('form-result').textContent, 'submitted:1');
      }
      console.log(`${name}.html: PASS (structure/fixture interactions; jsdom, no extension translation)`);
    } finally { dom.window.close(); }
  }
} finally { await server.close(); }
