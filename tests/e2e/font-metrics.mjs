/** @spec spec://modules/page/FEAT-002-page-translation#render */
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchIsolatedChromium } from './browser-runtime.mjs';
import { launchIsolatedFirefox } from './firefox-runtime.mjs';
import { startLocalServer } from './local-server.mjs';

const root = process.cwd();
const artifactRoot = path.join(root, 'test-results/linguisty-fonts');
await mkdir(artifactRoot, { recursive: true });
const server = await startLocalServer();
const script = `return ['heading', 'body', 'caption', 'fixed'].map(id => {
  const element = document.getElementById(id);
  const style = getComputedStyle(element);
  const context = document.createElement('canvas').getContext('2d');
  context.font = style.font;
  const measure = text => { const m = context.measureText(text); return m.actualBoundingBoxAscent + m.actualBoundingBoxDescent; };
  return { id, font: style.font, fontSize: style.fontSize, lineHeight: style.lineHeight,
    cjkInk: measure('日本語'), russianInk: measure('АБВН'), latinInk: measure('HMX'),
    width: element.clientWidth, height: element.clientHeight };
});`;
const results = {};
try {
  const chromium = await launchIsolatedChromium();
  try {
    const page = await chromium.context.newPage();
    await page.goto(`${server.origin}/fonts.html`);
    await page.evaluate(() => document.fonts.ready);
    results.chromium = { metadata: chromium.metadata, baseline: await page.evaluate(new Function(script)), freeMemory: process.memoryUsage() };
    await page.screenshot({ path: path.join(artifactRoot, 'chromium-source.png') });
  } finally { await chromium.cleanup(); }
  const firefox = await launchIsolatedFirefox({ projectRoot: root, extensionPath: path.join(root, '.output/firefox-mv3'), artifactRoot });
  try {
    await firefox.open(`${server.origin}/fonts.html`);
    results.firefox = { metadata: firefox.metadata, baseline: await firefox.execute(script), memory: await firefox.sampleMemory('font-baseline') };
    await firefox.screenshot('firefox-source.png');
  } finally { results.firefoxCleanup = await firefox.cleanup(); }
} finally { await server.close(); }
await writeFile(path.join(artifactRoot, 'baseline.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify({ chromium: results.chromium.baseline, firefox: results.firefox.baseline, cleanup: results.firefoxCleanup.remainingOwnedProcesses }));
