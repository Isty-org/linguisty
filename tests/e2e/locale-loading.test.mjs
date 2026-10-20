/** @spec spec://modules/interface/FEAT-003-controls#languages */
import assert from 'node:assert/strict';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { expect } from '@playwright/test';
import { inspectBuild } from '../../scripts/check-manifests.mjs';
import { launchIsolatedChromium } from './browser-runtime.mjs';
import { eventually, launchIsolatedFirefox } from './firefox-runtime.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = path.join(root, 'test-results/linguisty-acceptance-2026-10-12');
const lazyLocales = ['uk', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'tr', 'ja', 'ko', 'zh-CN', 'zh-TW', 'ar', 'hi'];

function localeFromChunk(filename) {
  return lazyLocales.find(locale => new RegExp(`(?:^|[-_.])${locale}(?:[-_.])`, 'i').test(filename));
}

async function packageLocaleChunks(browser) {
  const build = path.join(root, `.output/${browser}-mv3`);
  const inspection = await inspectBuild(build, browser);
  assert.equal(inspection.ok, true, inspection.errors.join('\n'));
  const names = (await readdir(path.join(build, 'chunks'))).filter(name => name.endsWith('.js'));
  const chunks = new Map(names.filter(localeFromChunk).map(name => [name, localeFromChunk(name)]));
  for (const locale of lazyLocales) {
    assert.ok([...chunks.values()].includes(locale), `Packaged ${locale} locale chunk is missing.`);
  }
  return { build, chunks, inspection: { files: inspection.files, bytes: inspection.bytes } };
}

function loadedLocaleChunks(resources, chunks) {
  return [...new Set(resources.map(resource => path.basename(new URL(resource).pathname))
    .filter(name => chunks.has(name)).map(name => chunks.get(name)))].sort();
}

function checkResources(resources, chunks, locale, { requireSelected = true } = {}) {
  assert.ok(resources.some(url => url.endsWith('.js')), 'The page exposed no JavaScript resource timing entries.');
  const loaded = loadedLocaleChunks(resources, chunks);
  if (requireSelected) assert.deepEqual(loaded, locale ? [locale] : [], `Unexpected locale chunks: ${loaded.join(', ')}; observed JS: ${JSON.stringify(resources.filter(url => url.endsWith('.js')))}`);
  else assert.ok(loaded.every(value => value === locale), `Unselected locale chunk appeared: ${loaded.join(', ')}`);
  return { locale: locale ?? 'eager en/ru', loaded, jsResources: resources.filter(url => url.endsWith('.js')).length,
    directImportObservation: requireSelected || loaded.length > 0 };
}

async function chromeResources(page) {
  return page.evaluate(() => [
    ...performance.getEntriesByType('resource').map(entry => entry.name),
    ...[...document.querySelectorAll('script[src], link[rel="modulepreload"][href]')].map(node => node.src || node.href),
  ]);
}

async function firefoxResources(runtime) {
  return runtime.execute('return [...performance.getEntriesByType("resource").map(entry => entry.name), ...Array.from(document.querySelectorAll("script[src],link[rel=modulepreload][href]"), node => node.src || node.href)];');
}

test('Chrome loads only the selected packaged locale and works offline', { timeout: 60_000 }, async () => {
  const packaged = await packageLocaleChunks('chrome');
  const report = { browser: 'chrome', package: packaged.inspection, lazyChunkCount: packaged.chunks.size, phases: [] };
  let runtime;
  try {
    runtime = await launchIsolatedChromium(packaged.build);
    report.runtime = runtime.metadata;
    const { context } = runtime;
    const requests = [];
    context.on('request', request => requests.push(request.url()));
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    const page = await context.newPage();
    const url = `chrome-extension://${id}/options.html`;
    await page.goto(url);
    await expect(page.locator('#providerId')).toBeVisible();
    assert.ok(['en', 'ru'].includes(await page.locator('html').getAttribute('lang')), 'Unexpected default UI locale.');
    report.phases.push(checkResources([...requests, ...await chromeResources(page)], packaged.chunks));

    async function choose(locale) {
      await page.evaluate(async value => {
        const key = 'linguisty.settings';
        const settings = (await globalThis.chrome.storage.local.get(key))[key] ?? {};
        await globalThis.chrome.storage.local.set({ [key]: { ...settings, uiLanguage: value } });
        localStorage.setItem('linguisty.uiLanguage', value);
      }, locale);
      await page.reload();
      await expect(page.locator('#providerId')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
    }

    requests.length = 0;
    await choose('de');
    await expect(page.locator('h1').first()).toHaveText('Ihr Dienst. Ihre Sprache.');
    report.phases.push(checkResources([...requests, ...await chromeResources(page)], packaged.chunks, 'de'));
    await context.setOffline(true);
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    requests.length = 0;
    await choose('fr');
    await expect(page.locator('h1').first()).toHaveText('Votre service. Votre langue.');
    report.phases.push(checkResources([...requests, ...await chromeResources(page)], packaged.chunks, 'fr'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    report.offlineLocalPack = true;
    report.ok = true;
  } catch (error) {
    report.ok = false;
    report.error = error.message;
    throw error;
  } finally {
    if (runtime) await runtime.cleanup();
    await mkdir(artifacts, { recursive: true });
    await writeFile(path.join(artifacts, 'locale-loading-chrome.json'), JSON.stringify(report, null, 2));
  }
});

test('Firefox localizes selected packaged locales and works offline', { timeout: 90_000 }, async () => {
  const packaged = await packageLocaleChunks('firefox');
  const report = { browser: 'firefox', package: packaged.inspection, lazyChunkCount: packaged.chunks.size, phases: [] };
  let runtime;
  try {
    runtime = await launchIsolatedFirefox({ projectRoot: root, extensionPath: packaged.build, artifactRoot: artifacts,
      preferences: { 'intl.accept_languages': 'en-US' } });
    report.runtime = runtime.metadata;
    const url = `${runtime.metadata.extensionOrigin}/options.html`;
    await runtime.open(url);
    await eventually(() => runtime.execute('return ["en","ru"].includes(document.documentElement.lang) && !!document.getElementById("providerId");'), Boolean, 'Eager-locale options missing');
    report.phases.push(checkResources(await firefoxResources(runtime), packaged.chunks, undefined, { requireSelected: false }));

    async function choose(locale) {
      await runtime.executeAsync('const done=arguments[arguments.length-1];const key="linguisty.settings";browser.storage.local.get(key).then(data=>browser.storage.local.set({[key]:{...(data[key]??{}),uiLanguage:arguments[0]}})).then(()=>{localStorage.setItem("linguisty.uiLanguage",arguments[0]);done(true)},error=>done({error:error.name}));', [locale]);
      await runtime.navigate(url);
      await eventually(() => runtime.execute('return document.documentElement.lang === arguments[0] && !!document.getElementById("providerId");', [locale]), Boolean, `${locale} options missing`);
    }

    await choose('de');
    assert.equal(await runtime.execute('return document.querySelector("h1").textContent;'), 'Ihr Dienst. Ihre Sprache.');
    report.phases.push(checkResources(await firefoxResources(runtime), packaged.chunks, 'de', { requireSelected: false }));
    await runtime.execute('Services.io.offline = true;', [], 'chrome');
    assert.equal(await runtime.execute('return navigator.onLine;'), false);
    await choose('fr');
    assert.equal(await runtime.execute('return document.querySelector("h1").textContent;'), 'Votre service. Votre langue.');
    report.phases.push(checkResources(await firefoxResources(runtime), packaged.chunks, 'fr', { requireSelected: false }));
    assert.equal(await runtime.execute('return document.documentElement.scrollWidth <= innerWidth;'), true);
    report.offlineLocalPack = true;
    report.limitations = ['Firefox Resource Timing exposes static links but no dynamic extension module requests in this WebDriver session; selected-chunk request count is unverified here.'];
    report.ok = true;
  } catch (error) {
    report.ok = false;
    report.error = error.message;
    throw error;
  } finally {
    if (runtime) {
      try { await runtime.execute('Services.io.offline = false;', [], 'chrome'); } catch { /* The isolated process is closing. */ }
      report.cleanup = await runtime.cleanup();
    }
    await mkdir(artifacts, { recursive: true });
    await writeFile(path.join(artifacts, 'locale-loading-firefox.json'), JSON.stringify(report, null, 2));
  }
});
