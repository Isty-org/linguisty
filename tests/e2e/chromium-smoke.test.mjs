/** @spec spec://common/PROP-000-product#acceptance */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { expect } from '@playwright/test';
import { inspectBuild } from '../../scripts/check-manifests.mjs';
import { launchIsolatedChromium } from './browser-runtime.mjs';
import { MOCK_KEY, startLocalServer, translatedText } from './local-server.mjs';
import { checkFontScenario } from './font-scenario.mjs';
import { checkJournalScenario } from './journal-scenario.mjs';
import { checkStreamScenario } from './stream-scenario.mjs';
import { checkLargePageScenario } from './large-page-scenario.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const buildRoot = path.join(projectRoot, '.output/chrome-mv3');
const artifactRoot = path.join(projectRoot, 'test-results/linguisty-smoke');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function send(page, message) {
  const result = await page.evaluate(payload => globalThis.chrome.runtime.sendMessage({ channel: 'linguisty', ...payload }), message);
  assert.ok(result && typeof result.ok === 'boolean', `No valid background response to ${message.type}.`);
  return result;
}

async function success(page, message) {
  const result = await send(page, message);
  assert.equal(result.ok, true, `Background ${message.type} failed: ${result.error?.code ?? 'unknown'}.`);
  return result.data;
}

async function openInactivePopup(context, options, extensionId, activePage) {
  await activePage.bringToFront();
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  const opened = context.waitForEvent('page', { timeout: 10_000 });
  await options.evaluate(url => globalThis.chrome.tabs.create({ url, active: false }), popupUrl);
  const popup = await opened;
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup.locator('.language-grid')).toBeVisible();
  return popup;
}

/** Only the isolated profile's loopback host is granted. Native approval/toolbar invocation remains a separate manual check. */
async function grantLoopbackHost(context, extensionId, options) {
  const management = await context.newPage();
  try {
    await management.goto('chrome://extensions');
    await management.evaluate(async id => {
      await globalThis.chrome.developerPrivate.addHostPermission(id, 'http://127.0.0.1/*');
    }, extensionId);
  } finally { await management.close(); }
  const granted = await Promise.race([
    options.evaluate(() => globalThis.chrome.permissions.request({ origins: ['http://127.0.0.1/*'] })),
    wait(3000).then(() => false),
  ]);
  assert.equal(granted, true, 'The isolated Chromium runtime did not grant the declared loopback origin.');
}

test('unmodified Chrome package: options, page pipeline, restore, dynamic DOM, cache, errors and cleanup', { timeout: 240_000 }, async t => {
  const inspection = await inspectBuild(buildRoot, 'chrome');
  assert.equal(inspection.ok, true, inspection.errors.join('\n'));
  const server = await startLocalServer();
  let runtime;
  const pageErrors = [];
  const observations = { checks: [], results: [], limitations: ['Loopback access is configured using chrome://extensions developerPrivate.addHostPermission plus chrome.permissions.request in an isolated profile; native permission approval and activeTab toolbar gesture are not verified.', 'Mock translations do not establish real OpenRouter access or semantic quality.', 'Only Chromium extension runtime is tested; Firefox runtime is separate.'] };
  const filter = process.env.LINGUISTY_SMOKE_FILTER;
  if (filter) observations.focusedFilter = filter;
  const observationName = filter ? `observations-focused-${filter.toLowerCase().replace(/[^a-z\d-]+/g, '-').slice(0, 40)}.json` : 'observations.json';
  async function check(name, body) {
    if (filter && !name.startsWith('onboarding') && !name.toLowerCase().includes(filter.toLowerCase())) {
      observations.results.push({ name, skipped: true });
      await t.test(name, { skip: `Focused smoke filter: ${filter}` }, () => {});
      return;
    }
    await t.test(name, async () => {
      try {
        await body();
        observations.results.push({ name, ok: true });
      } catch (error) {
        observations.results.push({ name, ok: false, error: error.message.replaceAll(MOCK_KEY, '[withheld]').slice(0, 1000) });
        throw error;
      }
    });
  }
  let options;
  try {
    runtime = await launchIsolatedChromium(buildRoot);
    const { context } = runtime;
    observations.runtime = runtime.metadata;
    await mkdir(artifactRoot, { recursive: true });
    context.on('page', page => page.on('pageerror', error => pageErrors.push(error.name)));
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15_000 });
    const extensionId = new URL(worker.url()).hostname;
    options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    // This smoke's Russian selectors and mock translations use an explicit manual preference.
    await options.evaluate(async () => {
      const key = 'linguisty.settings';
      const stored = (await globalThis.chrome.storage.local.get(key))[key] ?? {};
      await globalThis.chrome.storage.local.set({ [key]: { ...stored, uiLanguage: 'ru', targetLanguage: 'ru', targetLanguageMode: 'manual' } });
      localStorage.setItem('linguisty.uiLanguage', 'ru');
    });
    await options.reload();
    await expect(options.locator('#providerId')).toBeVisible();
    const initial = await success(options, { type: 'GET_SETTINGS' });

    await check('onboarding and UI settings save; secrets absent from public settings', async () => {
      assert.deepEqual(await success(options, { type: 'GET_SECRET_STATUS' }), { hasKey: false, mode: 'session' });
      await expect(options.locator('#apiKey')).toHaveValue('');
      const fixture = await context.newPage();
      try {
        await fixture.goto(`${server.origin}/real-estate.html`);
        const popup = await openInactivePopup(context, options, extensionId, fixture);
        await expect(popup.getByRole('heading', { name: 'Подключите свою модель' })).toBeVisible();
        await popup.close();
      } finally { await fixture.close(); }
      await grantLoopbackHost(context, extensionId, options);
      assert.equal(await options.evaluate(() => globalThis.chrome.permissions.contains({ origins: ['http://127.0.0.1/*'] })), true);
      await options.locator('#providerId').selectOption('openai-compatible');
      await options.locator('#baseUrl').fill(`${server.origin}/v1`);
      await options.locator('#apiKey').fill(MOCK_KEY);
      await options.locator('#model').fill('qa/mock-model');
      await options.getByRole('button', { name: 'Сохранить настройки', exact: true }).click();
      await expect(options.locator('#apiKey')).toHaveValue('');
      const saved = await success(options, { type: 'GET_SETTINGS' });
      assert.equal(saved.providerId, 'openai-compatible');
      assert.equal(saved.baseUrl, `${server.origin}/v1`);
      assert.equal(saved.model, 'qa/mock-model');
      assert.equal(JSON.stringify(saved).includes(MOCK_KEY), false);
      assert.equal('apiKey' in saved, false);
      assert.equal((await success(options, { type: 'GET_SECRET_STATUS' })).hasKey, true);
      observations.checks.push('onboarding/options save/manual model/public secret boundary');
    });
    const configuration = await success(options, { type: 'GET_SETTINGS' });
    assert.equal(configuration.model, 'qa/mock-model', 'Settings setup did not complete; dependent browser flows cannot run.');

    async function fixturePage(name) {
      const page = await context.newPage();
      await page.goto(`${server.origin}/${name}.html`);
      const tabId = await options.evaluate(async url => {
        const tabs = await globalThis.chrome.tabs.query({});
        return tabs.find(tab => tab.url === url)?.id;
      }, page.url());
      assert.equal(typeof tabId, 'number');
      return { page, tabId };
    }
    async function completed(tabId) {
      await expect.poll(async () => (await success(options, { type: 'GET_TAB_STATE', tabId })).status, { timeout: 12_000, intervals: [100, 250, 500] }).toBe('completed');
      return success(options, { type: 'GET_TAB_STATE', tabId });
    }
    async function configure(patch) {
      const settings = await success(options, { type: 'GET_SETTINGS' });
      await success(options, { type: 'SAVE_SETTINGS', settings: { ...settings, ...patch } });
    }

    await check('measured fonts, script directions, styles, clipping, dynamic nodes and toggles', async () => {
      observations.fonts = await checkFontScenario({
        fixture: async name => { const { page, tabId } = await fixturePage(name); return { handle: page, tabId }; },
        success: message => success(options, message),
        read: (page, fn, args = []) => page.evaluate(fn, args[0]),
        screenshot: (page, filename) => page.screenshot({ path: path.join(artifactRoot, `fonts-${filename}`) }),
        close: page => page.close(), requests: () => server.requests.length,
      });
    });

    await check('API journal details, redaction, retry count, text rendering, themes, copy and clear', async () => {
      observations.journal = await checkJournalScenario({
        fixture: async name => { const { page, tabId } = await fixturePage(name); return { handle: page, tabId }; },
        success: message => success(options, message), options,
        read: (page, fn, args = []) => page.evaluate(fn, args[0]),
        refresh: () => options.reload(),
        click: name => options.getByRole('button', { name, exact: true }).click(),
        theme: mode => options.locator('#theme').selectOption(mode),
        screenshot: (page, filename) => page.locator('.error-journal').screenshot({ path: path.join(artifactRoot, filename) }),
        close: page => page.close(), setMode: mode => server.setMode(mode),
      });
    });

    await check('streaming timing, validation, fallback, rollback, options and lifecycle cleanup', async () => {
      observations.streaming = await checkStreamScenario({
        fixture: async name => { const { page, tabId } = await fixturePage(name); return { handle: page, tabId }; },
        success: message => success(options, message), options,
        read: (page, fn, args = []) => page.evaluate(fn, args[0]), close: page => page.close(),
        navigate: (page, name) => page.goto(`${server.origin}/${name}.html`),
        setMode: (mode, delay) => server.setMode(mode, delay), requests: () => server.requests, metrics: () => server.metrics(),
        refresh: () => options.reload(),
        toggle: async value => { await options.getByRole('checkbox', { name: 'Показывать перевод постепенно' }).setChecked(value);
          await options.getByRole('button', { name: 'Сохранить настройки', exact: true }).click();
          await expect.poll(async () => (await success(options, { type: 'GET_SETTINGS' })).streaming).toBe(value); },
        screenshot: (page, filename) => page.screenshot({ path: path.join(artifactRoot, filename) }),
      });
    });

    /** @spec spec://modules/page/FEAT-002-page-translation#render */
    await check('large page batches, CJK inline spacing, layout, recovery and parallel timing', async () => {
      observations.largePage = await checkLargePageScenario({
        fixture: async name => { const { page, tabId } = await fixturePage(name); return { handle: page, tabId }; }, success: message => success(options, message),
        read: (page, fn, args = []) => page.evaluate(fn, args[0]), close: page => page.close(),
        setMode: (mode, delay) => server.setMode(mode, delay), requests: () => server.requests,
        screenshot: (page, filename) => page.screenshot({ path: path.join(artifactRoot, filename), fullPage: false }),
      });
    });

    await check('popup to background to page; viewport, whitespace, DOM references, form/gallery and network-free toggle', async () => {
      await configure({ maxNodesPerBatch: 4, concurrency: 2 });
      const { page, tabId } = await fixturePage('real-estate');
      let popup;
      try {
        await page.locator('#contact-name').fill('QA пользователь');
        await page.locator('#contact-note').fill('Не изменять введённый текст');
        const original = await page.locator('#listing-description').textContent();
        const before = server.requests.length;
        popup = await openInactivePopup(context, options, extensionId, page);
        await popup.getByRole('button', { name: 'Перевести страницу', exact: true }).click();
        await expect(page.locator('#listing-title')).toHaveText('Светлая квартира в Лионе', { timeout: 12_000 });
        const state = await completed(tabId);
        assert.ok(state.translated > 0 && state.failed === 0);
        await expect(page.locator('#far-title')).toHaveText('Информация о районе');
        const changed = await page.locator('#listing-description').textContent();
        assert.ok(changed.startsWith('  ') && changed.endsWith('  '));
        await expect(page.locator('#listing-price')).toContainText('245 000 €');
        await expect(page.locator('#contact-name')).toHaveValue('QA пользователь');
        await expect(page.locator('#contact-note')).toHaveValue('Не изменять введённый текст');
        await page.locator('#gallery-next').click();
        await expect(page.locator('#gallery-count')).toHaveText('2 / 3');
        await page.locator('#contact-submit').click();
        await expect(page.locator('#form-result')).toHaveText('submitted:1');
        assert.equal((await page.evaluate(() => globalThis.linguistyFixture.inspect())).referencesPreserved, true);
        assert.equal(await page.locator('#listing-link').getAttribute('href'), '#contact');
        const translatedRequests = server.requests.slice(before);
        const flatTexts = translatedRequests.flatMap(request => request.nodes.map(node => node.text));
        assert.ok(flatTexts.indexOf('Appartement lumineux à Lyon') >= 0);
        assert.ok(flatTexts.indexOf('Appartement lumineux à Lyon') < flatTexts.indexOf('Informations sur le quartier'));
        assert.ok(translatedRequests.every(request => request.authorized && !request.keyInBody && request.nodes.length <= 4));
        assert.ok(server.metrics().maximumActiveRequests <= 2);
        await page.screenshot({ path: path.join(artifactRoot, 'real-estate-translated.png'), fullPage: true });
        const count = server.requests.length;
        await popup.getByRole('button', { name: 'Оригинал', exact: true }).click();
        await expect(page.locator('#listing-description')).toHaveText(original);
        assert.equal(await page.locator('#listing-description').textContent(), original);
        await page.evaluate(() => globalThis.linguistyFixture.addListing());
        await wait(700);
        await expect(page.locator('#dynamic-1')).toHaveText('Nouvelle annonce : maison avec jardin 1.');
        assert.equal(server.requests.length, count);
        await popup.getByRole('button', { name: 'Перевод', exact: true }).click();
        await expect(page.locator('#listing-title')).toHaveText('Светлая квартира в Лионе');
        await expect(page.locator('#dynamic-1')).toHaveText(translatedText('Nouvelle annonce : maison avec jardin 1.'), { timeout: 8_000 });
        await completed(tabId);
        await wait(700);
        const afterDynamic = server.requests.length;
        await wait(700);
        assert.equal(server.requests.length, afterDynamic, 'Own mutations caused repeated API requests.');
        await popup.close();
        popup = await openInactivePopup(context, options, extensionId, page);
        await expect(popup.locator('#page-status')).toHaveText('Перевод завершён');
        await expect(popup.locator('.progress-copy')).toContainText(String((await success(options, { type: 'GET_TAB_STATE', tabId })).translated));
        observations.checks.push('UI→background→content→mock; viewport first; references/forms/gallery; exact whitespace restore; resume; popup reopen; no own-mutation loop');
      } finally { await popup?.close(); await page.close(); }
    });

    /** @spec spec://modules/page/FEAT-002-page-translation#scan */
    await check('DOM exclusions, table/placeholders, editable values and text-only HTML response', async () => {
      for (const name of ['dom-edge-cases', 'table', 'forms']) {
        const { page, tabId } = await fixturePage(name);
        try {
          const selectors = name === 'dom-edge-cases' ? ['#no-translate', '#hidden-attribute', '#hidden-css', '#visibility-hidden', '#aria-hidden', '#inert-text', '#pre', '#code', '#pure-url', '#pure-email', '#pure-hash'] : name === 'table' ? ['#url-only', '#email-only'] : ['#editable', '#editable-plain'];
          const originals = await Promise.all(selectors.map(selector => page.locator(selector).textContent()));
          await success(options, { type: 'START_TRANSLATION', tabId });
          await completed(tabId);
          assert.deepEqual(await Promise.all(selectors.map(selector => page.locator(selector).textContent())), originals);
          if (name === 'table') for (const token of ['{nom}', '{{date}}', '%s', '#LY-014']) await expect(page.locator('#placeholders')).toContainText(token);
          if (name === 'forms') {
            await expect(page.locator('#contact-name')).toHaveValue('Marie Dupont');
            await expect(page.locator('#contact-note')).toHaveValue('Je souhaite visiter samedi.');
            await expect(page.locator('#contact-slot')).toHaveValue('Samedi matin');
            await expect(page.locator('#contact-consent')).toBeChecked();
          }
        } finally { await page.close(); }
      }
      await success(options, { type: 'CLEAR_CACHE' });
      server.setMode('html-text');
      const { page, tabId } = await fixturePage('dynamic');
      try {
        await success(options, { type: 'START_TRANSLATION', tabId });
        await completed(tabId);
        await expect(page.locator('h1')).toHaveText('<img src=x onerror="window.injectionRan=true">');
        assert.equal(await page.locator('img').count(), 0);
        assert.equal(await page.evaluate(() => globalThis.injectionRan === true), false);
      } finally { server.setMode('ok'); await page.close(); }
      observations.checks.push('DOM exclusions/table/placeholders/form values; provider HTML inserted as literal text');
    });

    /** @spec spec://modules/page/FEAT-002-page-translation#sessions */
    await check('external mutation, dynamic deletion and SPA route reset', async () => {
      const { page, tabId } = await fixturePage('dynamic');
      await options.evaluate(id => {
        globalThis.qaTabUpdates = [];
        globalThis.qaTabListener = (updatedId, change) => {
          if (updatedId === id && globalThis.qaTabUpdates.length < 30) globalThis.qaTabUpdates.push({ status: change.status, url: change.url, title: change.title });
        };
        globalThis.chrome.tabs.onUpdated.addListener(globalThis.qaTabListener);
      }, tabId);
      try {
        await success(options, { type: 'START_TRANSLATION', tabId });
        await completed(tabId);
        const previous = (await success(options, { type: 'GET_TAB_STATE', tabId })).sessionId;
        await page.locator('#add-listing').click();
        await expect(page.locator('#dynamic-1')).toHaveText(translatedText('Nouvelle annonce : maison avec jardin 1.'), { timeout: 8_000 });
        await page.evaluate(() => { document.getElementById('external-text').firstChild.data = 'Nouveau texte externe à conserver.'; });
        await expect(page.locator('#external-text')).toHaveText(translatedText('Nouveau texte externe à conserver.'), { timeout: 8_000 });
        await success(options, { type: 'SET_DISPLAY_MODE', tabId, mode: 'original' });
        await expect(page.locator('#external-text')).toHaveText('Nouveau texte externe à conserver.');
        await success(options, { type: 'SET_DISPLAY_MODE', tabId, mode: 'translated' });
        await page.locator('#remove-listing').click();
        await expect(page.locator('#dynamic-region p')).toHaveCount(0);
        await page.locator('#change-route').click();
        try { await expect(page.locator('h1')).toHaveText('Доступные дома в Нанте', { timeout: 8_000 }); }
        catch (error) {
          observations.spaFailure = {
            url: page.url(), state: await send(options, { type: 'GET_TAB_STATE', tabId }),
            heading: await page.locator('h1').textContent(),
            providerContexts: server.requests.slice(-5).map(request => request.context),
            tabUpdates: await options.evaluate(() => globalThis.qaTabUpdates),
            contentState: await options.evaluate(id => globalThis.chrome.tabs.sendMessage(id, { channel: 'linguisty', type: 'CONTENT_COMMAND', payload: { command: 'get-state' } }).catch(() => ({ unavailable: true })), tabId),
          };
          await writeFile(path.join(artifactRoot, 'spa-failure.json'), JSON.stringify(observations.spaFailure, null, 2));
          throw error;
        }
        await expect.poll(async () => (await success(options, { type: 'GET_TAB_STATE', tabId })).sessionId, { timeout: 8_000 }).not.toBe(previous);
        assert.ok(server.requests.some(request => request.context.title === 'Maisons à Nantes — fixture Linguisty'));
      } finally {
        await options.evaluate(() => {
          globalThis.chrome.tabs.onUpdated.removeListener(globalThis.qaTabListener);
          delete globalThis.qaTabListener;
          delete globalThis.qaTabUpdates;
        });
        await page.close();
      }
      observations.checks.push('external text becomes new original; inserted/deleted nodes; SPA session/context change');
    });

  /** @spec spec://modules/translation/FEAT-001-engine#dedup */
    await check('repeat visit uses cache; model change invalidates cache; clear works without provider', async () => {
      server.setMode('ok');
      await success(options, { type: 'CLEAR_CACHE' });
      const first = await fixturePage('table');
      await success(options, { type: 'START_TRANSLATION', tabId: first.tabId });
      await completed(first.tabId);
      await first.page.close();
      const count = server.requests.length;
      const second = await fixturePage('table');
      try {
        await success(options, { type: 'START_TRANSLATION', tabId: second.tabId });
        const state = await completed(second.tabId);
        assert.ok(state.fromCache > 0);
        assert.equal(server.requests.length, count);
        await configure({ model: 'qa/changed-model' });
        await success(options, { type: 'START_TRANSLATION', tabId: second.tabId });
        await completed(second.tabId);
        assert.ok(server.requests.length > count);
        await configure({ model: 'qa/mock-model' });
        const beforeClear = server.requests.length;
        server.setMode('unauthorized');
        await success(options, { type: 'CLEAR_CACHE' });
        assert.equal((await success(options, { type: 'GET_CACHE_STATS' })).entries, 0);
        assert.equal(server.requests.length, beforeClear);
      } finally { server.setMode('ok'); await second.page.close(); }
      observations.checks.push('persistent cache reuse/model isolation/network-free stats and clear');
    });

    /** @spec spec://modules/platform/INFRA-001-extension#recovery */
    await check('service worker termination restores session and handles a fresh content batch', async () => {
      server.setMode('ok');
      const { page, tabId } = await fixturePage('dynamic');
      const devtools = await context.newCDPSession(options);
      const versions = new Map();
      let stoppedVersion;
      let observedStop = false;
      devtools.on('ServiceWorker.workerVersionUpdated', ({ versions: updates }) => {
        for (const version of updates) {
          if (version.scriptURL === worker.url()) versions.set(version.versionId, version);
          if (version.versionId === stoppedVersion && version.runningStatus === 'stopped') observedStop = true;
        }
      });
      try {
        await success(options, { type: 'START_TRANSLATION', tabId });
        const previous = await completed(tabId);
        await devtools.send('ServiceWorker.enable');
        await expect.poll(() => [...versions.values()].some(version => version.runningStatus === 'running'), { timeout: 5000 }).toBe(true);
        stoppedVersion = [...versions.values()].find(version => version.runningStatus === 'running').versionId;
        await devtools.send('ServiceWorker.stopWorker', { versionId: stoppedVersion });
        await expect.poll(() => observedStop, { timeout: 5000 }).toBe(true);
        const recovered = await success(options, { type: 'GET_TAB_STATE', tabId });
        assert.equal(recovered.sessionId, previous.sessionId);
        assert.equal(recovered.translated, previous.translated);
        assert.equal(recovered.status, 'completed');
        const before = server.requests.length;
        await page.evaluate(() => {
          const paragraph = document.createElement('p');
          paragraph.id = 'after-restart';
          paragraph.textContent = 'Nouveau texte après redémarrage.';
          document.getElementById('dynamic-region').append(paragraph);
        });
        await expect(page.locator('#after-restart')).toHaveText(translatedText('Nouveau texte après redémarrage.'), { timeout: 8000 });
        await completed(tabId);
        assert.ok(server.requests.length > before);
        assert.equal(JSON.stringify(recovered).includes(MOCK_KEY), false);
        observations.workerRecovery = { observedStop, sameSession: recovered.sessionId === previous.sessionId, newBatchTranslated: true };
      } finally { await devtools.detach(); await page.close(); }
      observations.checks.push('CDP observed worker stop; restored bounded session snapshot; fresh content batch after worker wake');
    });

    /** @spec spec://modules/platform/INFRA-001-extension#errors */
    await check('401/429/malformed/unknown IDs produce safe errors with bounded retry', async () => {
      for (const [mode, code, expectedMaximumRequests] of [['unauthorized', 'INVALID_API_KEY', 1], ['rate-limit', 'RATE_LIMIT', 3], ['malformed', 'INVALID_MODEL_RESPONSE', 2], ['unknown-id', 'INVALID_MODEL_RESPONSE', 2]]) {
        await success(options, { type: 'CLEAR_CACHE' });
        server.setMode(mode);
        const before = server.requests.length;
        const result = await success(options, { type: 'TEST_CONNECTION' });
        assert.equal(result.success, false, mode);
        assert.equal(JSON.stringify(result).includes(MOCK_KEY), false);
        assert.ok(server.requests.length - before > 0 && server.requests.length - before <= expectedMaximumRequests, `${mode}: retry count`);
        const { page, tabId } = await fixturePage('dynamic');
        try {
          await success(options, { type: 'START_TRANSLATION', tabId });
          await expect.poll(async () => (await success(options, { type: 'GET_TAB_STATE', tabId })).error?.code, { timeout: 10_000 }).toBe(code);
          const state = await success(options, { type: 'GET_TAB_STATE', tabId });
          assert.equal(JSON.stringify(state).includes(MOCK_KEY), false);
          assert.ok(state.failed > 0);
        } finally { await page.close(); }
      }
      server.setMode('ok');
      observations.checks.push('401/429/malformed/unknown-ID provider failures; bounded retries; public error redaction');
    });

    /** @spec spec://modules/page/FEAT-002-page-translation#acceptance */
    await check('cancel aborts in-flight requests and suppresses late writes; closed tab state is removed', async () => {
      await success(options, { type: 'CLEAR_CACHE' });
      server.setMode('ok', 1800);
      const { page, tabId } = await fixturePage('dynamic');
      try {
        const original = await page.locator('h1').textContent();
        const before = server.requests.length;
        await success(options, { type: 'START_TRANSLATION', tabId });
        await expect.poll(() => server.requests.length, { timeout: 5000 }).toBeGreaterThan(before);
        await success(options, { type: 'CANCEL_TRANSLATION', tabId });
        const count = server.requests.length;
        await wait(2000);
        await expect(page.locator('h1')).toHaveText(original);
        assert.equal(server.requests.length, count);
        assert.equal((await success(options, { type: 'GET_TAB_STATE', tabId })).status, 'cancelled');
        await expect.poll(() => server.metrics().activeRequests).toBe(0);
        await page.close();
        await expect.poll(async () => (await send(options, { type: 'GET_TAB_STATE', tabId })).ok).toBe(false);
      } finally { server.setMode('ok'); if (!page.isClosed()) await page.close(); }
      observations.checks.push('cancel stops fetch/late write/new batches; tab close clears live state');
    });

    /** @spec spec://common/PROP-002-quality#ui */
    await check('light/dark/system themes, labels, keyboard and restricted page', async () => {
      await options.reload();
      await expect(options.locator('#theme')).toBeVisible();
      for (const theme of ['light', 'dark', 'system']) {
        await options.locator('#theme').selectOption(theme);
        await options.getByRole('button', { name: 'Сохранить настройки', exact: true }).click();
        await expect.poll(async () => (await success(options, { type: 'GET_SETTINGS' })).theme).toBe(theme);
        if (theme !== 'system') await expect(options.locator('html')).toHaveAttribute('data-theme', theme);
        if (theme === 'system') {
          await options.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
          await expect(options.locator('html')).toHaveAttribute('data-theme', 'dark');
          await options.emulateMedia({ colorScheme: 'light' });
          await expect(options.locator('html')).toHaveAttribute('data-theme', 'light');
        }
        await options.screenshot({ path: path.join(artifactRoot, `options-${theme}.png`), fullPage: true });
      }
      assert.equal(await options.locator('input:not([type="hidden"]),select,textarea').evaluateAll(elements => elements.every(element => element.labels?.length > 0 || element.getAttribute('aria-label'))), true);
      await options.locator('#providerId').focus();
      await options.keyboard.press('Tab');
      assert.equal(await options.locator('#baseUrl').evaluate(element => element === document.activeElement), true);
      const restricted = await context.newPage();
      try {
        await restricted.goto('chrome://version');
        const tabId = await options.evaluate(async () => (await globalThis.chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
        const result = await send(options, { type: 'START_TRANSLATION', tabId });
        assert.equal(result.ok, false);
        assert.equal(result.error.code, 'RESTRICTED_PAGE');
      } finally { await restricted.close(); }
      assert.deepEqual(pageErrors, []);
      observations.checks.push('light/dark/system/reduced motion/labels/tab focus; restricted Chrome page');
    });
    observations.provider = server.metrics();
    observations.package = { files: inspection.files, bytes: inspection.bytes };
    observations.pageErrors = pageErrors.length;
    observations.initialSettingsWithoutSecret = !JSON.stringify(initial).includes(MOCK_KEY);
    observations.ok = observations.results.every(result => result.ok || result.skipped);
    observations.fullSmoke = !filter;
  } catch (error) {
    observations.ok = false;
    observations.setupError = error.message.replaceAll(MOCK_KEY, '[withheld]').slice(0, 1000);
    throw error;
  } finally {
    try { await runtime?.cleanup(); observations.isolatedProfileRemoved = true; }
    finally { await server.close(); observations.localServerClosed = true; }
    await mkdir(artifactRoot, { recursive: true });
    await writeFile(path.join(artifactRoot, observationName), JSON.stringify(observations, null, 2));
  }
});
