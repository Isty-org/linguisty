/** @spec spec://common/PROP-002-quality#checks */
import assert from 'node:assert/strict';
import { launchIsolatedChromium } from '../tests/e2e/browser-runtime.mjs';
import { startLocalServer } from '../tests/e2e/local-server.mjs';

const server = await startLocalServer();
let runtime;
try {
  runtime = await launchIsolatedChromium();
  const page = await runtime.context.newPage();
  await page.goto(`${server.origin}/real-estate.html`);
  assert.equal(await page.locator('#listing-title').textContent(), 'Appartement lumineux à Lyon');
  await page.locator('#gallery-next').click();
  assert.equal(await page.locator('#gallery-count').textContent(), '2 / 3');
  await page.locator('#contact-name').fill('Testeur QA');
  await page.locator('#contact-submit').click();
  assert.equal(await page.locator('#form-result').textContent(), 'submitted:1');
  console.log(JSON.stringify({ ok: true, ...runtime.metadata, note: 'Browser/fixture preflight only. Extension was not loaded; translation is not verified.' }, null, 2));
} finally {
  try { await runtime?.cleanup(); }
  finally { await server.close(); }
}
