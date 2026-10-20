/** @spec spec://common/PROP-002-quality#checks */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectBuild } from '../../scripts/check-manifests.mjs';
import { eventually, launchIsolatedFirefox, pause } from './firefox-runtime.mjs';
import { MOCK_KEY, startLocalServer, translatedText } from './local-server.mjs';
import { checkFontScenario } from './font-scenario.mjs';
import { checkJournalScenario } from './journal-scenario.mjs';
import { checkStreamScenario } from './stream-scenario.mjs';
import { checkLargePageScenario } from './large-page-scenario.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const buildRoot = path.join(projectRoot, '.output/firefox-mv3');
const artifactRoot = path.join(projectRoot, 'test-results/linguisty-firefox');
const elementKey = 'element-6066-11e4-a52e-4f735466cecf';

async function fingerprint(directory) {
  const files = [];
  async function visit(root) {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      const absolute = path.join(root, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) {
        const bytes = await readFile(absolute);
        files.push({ path: path.relative(directory, absolute).replaceAll('\\', '/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
      } else throw new Error('Package contains an unsupported filesystem entry.');
    }
  }
  await visit(directory);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, bytes: files.reduce((sum, file) => sum + file.bytes, 0), sha256: createHash('sha256').update(JSON.stringify(files)).digest('hex') };
}

/** Observes resource creation in the test extension's isolated content world. */
function installResourceProbe() {
  const marker = Symbol.for('linguisty.qa.firefox.resources');
  if (globalThis[marker]) return false;
  const timers = new Set();
  const mutations = new Set();
  const intersections = new Set();
  const listeners = new Map();
  const savedTimeout = window.setTimeout.bind(window);
  const savedClear = window.clearTimeout.bind(window);
  window.setTimeout = (callback, delay, ...args) => {
    let id;
    id = savedTimeout(() => { timers.delete(id); callback(...args); }, delay);
    timers.add(id);
    return id;
  };
  window.clearTimeout = id => { timers.delete(id); savedClear(id); };
  const observe = (name, set) => {
    const Original = window[name];
    if (!Original) return;
    // A plain wrapper retains its JS methods across Firefox's Xray boundary;
    // a subclass of the native observer loses those overrides on construction.
    window[name] = class ObservedResource {
      constructor(...args) { this.native = new Original(...args); }
      observe(...args) { set.add(this); return this.native.observe(...args); }
      unobserve(...args) { return this.native.unobserve(...args); }
      takeRecords() { return this.native.takeRecords(); }
      disconnect() { set.delete(this); return this.native.disconnect(); }
    };
  };
  observe('MutationObserver', mutations);
  observe('IntersectionObserver', intersections);
  const savedAdd = window.addEventListener.bind(window);
  const savedRemove = window.removeEventListener.bind(window);
  const watched = new Set(['popstate', 'hashchange', 'scroll', 'resize', 'pagehide']);
  window.addEventListener = (type, listener, ...args) => {
    if (watched.has(type)) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    }
    return savedAdd(type, listener, ...args);
  };
  window.removeEventListener = (type, listener, ...args) => { listeners.get(type)?.delete(listener); return savedRemove(type, listener, ...args); };
  globalThis[marker] = () => ({ timers: timers.size, mutationObservers: mutations.size, intersectionObservers: intersections.size, listeners: Object.fromEntries([...listeners].map(([type, set]) => [type, set.size])) });
  return true;
}

/** @spec spec://modules/platform/INFRA-001-extension#acceptance */
export async function runFirefoxSmoke() {
  const report = {
    startedAt: new Date().toISOString(), results: [], memory: [],
    limitations: [
      'Temporary installation does not reproduce signed installation or installation-time data-consent prompts.',
      'Headless native optional-host prompt is resolved through its real Firefox button in privileged WebDriver chrome scope. Physical clicking, toolbar invocation and activeTab-only access are not verified.',
      'Popup is opened as a trusted inactive extension tab over the active fixture; production popup markup and handlers are used, but native popup geometry is not verified.',
      'Loopback mock verifies transport and runtime behavior; no real OpenRouter access, paid request or linguistic accuracy is verified.',
      'Working-set samples are observational; lifecycle counters provide bounded cleanup evidence, not a proof of absence of every possible memory leak.',
    ],
  };
  const filter = process.env.LINGUISTY_FIREFOX_SMOKE_FILTER;
  if (filter) report.focusedFilter = filter;
  const reportFilename = filter ? `observations-focused-${filter.toLowerCase().replace(/[^a-z\d-]+/g, '-').slice(0, 40)}.json` : 'observations.json';
  let runtime;
  let server;
  let options;
  async function check(name, body) {
    if (filter && !name.startsWith('onboarding') && !name.includes('package remained') && !name.toLowerCase().includes(filter.toLowerCase())) {
      report.results.push({ name, skipped: true });
      return;
    }
    try {
      await body();
      report.results.push({ name, ok: true });
      console.log(`PASS ${name}`);
    } catch (error) {
      const message = error.message.replaceAll(MOCK_KEY, '[withheld]').slice(0, 1800);
      report.results.push({ name, ok: false, error: message });
      console.log(`FAIL ${name}: ${message}`);
    }
  }
  try {
    await mkdir(artifactRoot, { recursive: true });
    const inspection = await inspectBuild(buildRoot, 'firefox');
    assert.equal(inspection.ok, true, inspection.errors.join('\n'));
    report.packageBefore = await fingerprint(buildRoot);
    try { report.driverSource = JSON.parse(await readFile(path.join(projectRoot, '.cache/firefox-qa/driver-source.json'), 'utf8')); } catch { report.driverSource = null; }
    server = await startLocalServer();
    runtime = await launchIsolatedFirefox({ projectRoot, extensionPath: buildRoot, artifactRoot });
    report.runtime = runtime.metadata;
    report.memory.push(await runtime.sampleMemory('installed'));
    options = await runtime.open(`${runtime.metadata.extensionOrigin}/options.html`);
    // Existing Russian pipeline fixtures explicitly choose their UI/target;
    // fresh browser-language defaults are checked in the locale scenario.
    await runtime.executeAsync('const done=arguments[arguments.length-1];const key="linguisty.settings";browser.storage.local.get(key).then(result=>browser.storage.local.set({[key]:{...(result[key]??{}),uiLanguage:"ru",targetLanguage:"ru",targetLanguageMode:"manual"}})).then(()=>done(true),e=>done({error:e.name}));');
    await runtime.navigate(`${runtime.metadata.extensionOrigin}/options.html`);

    async function on(handle, script, args = []) { await runtime.switchTo(handle); return runtime.execute(script, args); }
    async function send(message) {
      await runtime.switchTo(options);
      const result = await runtime.executeAsync('const done=arguments[arguments.length-1];browser.runtime.sendMessage({channel:"linguisty",...arguments[0]}).then(done,e=>done({transportError:e.name}));', [message]);
      assert.equal(typeof result?.ok, 'boolean', `Invalid background response to ${message.type}`);
      assert.equal(JSON.stringify(result).includes(MOCK_KEY), false, 'Public message exposed the mock credential.');
      return result;
    }
    async function success(message) { const result = await send(message); assert.equal(result.ok, true, `${message.type}: ${result.error?.code}`); return result.data; }
    async function configure(patch) { await success({ type: 'SAVE_SETTINGS', settings: { ...await success({ type: 'GET_SETTINGS' }), ...patch } }); }
    async function text(handle, selector) { return on(handle, 'return document.querySelector(arguments[0])?.textContent;', [selector]); }
    async function expectText(handle, selector, value, timeout = 10_000) { return eventually(() => text(handle, selector), actual => actual === value, `${selector} text`, timeout); }
    async function clickText(handle, value) {
      await runtime.switchTo(handle);
      const element = await runtime.execute('const e=Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()===arguments[0]);e?.scrollIntoView({block:"center",inline:"nearest"});return e;', [value]);
      assert.ok(element?.[elementKey], `Button absent: ${value}`);
      await runtime.command('POST', `/element/${element[elementKey]}/click`, {});
    }
    async function fixture(name) {
      const url = `${server.origin}/${name}.html`;
      const handle = await runtime.open(url);
      await runtime.switchTo(options);
      const tabId = await runtime.executeAsync('const done=arguments[arguments.length-1];browser.tabs.query({}).then(tabs=>done(tabs.find(tab=>tab.url===arguments[0])?.id));', [url]);
      assert.equal(typeof tabId, 'number');
      return { handle, tabId };
    }
    async function completed(tabId) {
      return eventually(() => success({ type: 'GET_TAB_STATE', tabId }), state => state.status === 'completed', 'Translation did not complete', 12_000);
    }
    async function popupOver(handle) {
      await runtime.switchTo(handle);
      const popup = await runtime.open(`${runtime.metadata.extensionOrigin}/popup.html`, { active: false });
      await eventually(() => on(popup, 'return !!document.querySelector(".language-grid") && !document.querySelector(".popup-shell")?.textContent.includes("Загружаем настройки");'), Boolean, 'Popup did not initialize');
      return popup;
    }
    async function contentProbe(tabId, script) {
      await runtime.switchTo(options);
      const result = await runtime.executeAsync(`const done=arguments[arguments.length-1];browser.scripting.executeScript({target:{tabId:arguments[0]},func:${script}}).then(done,e=>done({error:e.message}));`, [tabId]);
      assert.ok(Array.isArray(result) && result[0]?.error === undefined, 'Content probe failed');
      return result[0].result;
    }
    async function nativePermission(accept) {
      await eventually(() => runtime.execute('return PopupNotifications.panel.state === "open" && !!document.getElementById("addon-webext-permissions-notification");', [], 'chrome'), Boolean, 'Firefox optional-host prompt absent');
      await pause(750); // Respect Firefox's anti-click-through delay.
      const clicked = await runtime.execute('const n=document.getElementById("addon-webext-permissions-notification");const b=arguments[0]?n.button:n.secondaryButton;b.click();return true;', [accept], 'chrome');
      assert.equal(clicked, true);
    }

    /** @spec spec://modules/interface/FEAT-003-controls#options */
    await check('onboarding, denied/granted origin, settings UI and connection/model discovery', async () => {
      await eventually(() => on(options, 'return !!document.getElementById("providerId");'), Boolean, 'Options form absent');
      const initial = await success({ type: 'GET_SETTINGS' });
      assert.deepEqual(await success({ type: 'GET_SECRET_STATUS' }), { hasKey: false, mode: 'session' });
      const page = { handle: await runtime.open(`${server.origin}/real-estate.html`) };
      let popup;
      try { popup = await popupOver(page.handle); await expectText(popup, '#onboarding-title', 'Подключите свою модель'); }
      finally { if (popup) await runtime.close(popup); await runtime.close(page.handle); }
      await runtime.switchTo(options);
      await runtime.click('#providerId option[value="openai-compatible"]');
      await runtime.fill('#baseUrl', `${server.origin}/v1`);
      await runtime.fill('#apiKey', MOCK_KEY);
      await runtime.fill('#model', 'qa/mock-model');
      await runtime.click('button[type="submit"]');
      await nativePermission(false);
      await eventually(() => text(options, '.form-feedback'), value => !!value, 'Denied permission feedback absent');
      assert.deepEqual(await success({ type: 'GET_SETTINGS' }), initial);
      assert.equal((await success({ type: 'GET_SECRET_STATUS' })).hasKey, false);
      await runtime.switchTo(options);
      await runtime.click('button[type="submit"]');
      await nativePermission(true);
      await eventually(() => on(options, 'return document.getElementById("apiKey").value === "";'), Boolean, 'Saved key input did not clear');
      const saved = await success({ type: 'GET_SETTINGS' });
      assert.equal(saved.providerId, 'openai-compatible');
      assert.equal(saved.baseUrl, `${server.origin}/v1`);
      assert.equal(saved.model, 'qa/mock-model');
      assert.equal('apiKey' in saved, false);
      await runtime.switchTo(options);
      const permissions = await runtime.executeAsync('browser.permissions.getAll().then(arguments[arguments.length-1]);');
      assert.deepEqual(permissions.origins, ['http://127.0.0.1/*']);
      report.grantedOrigins = permissions.origins;
      await clickText(options, 'Проверить подключение');
      await eventually(() => text(options, '.form-feedback'), value => value?.includes('Соединение установлено'), 'Mock connection test failed');
      await clickText(options, 'Загрузить список моделей');
      await eventually(() => text(options, '.model-list'), value => value?.includes('qa/mock-model'), 'Mock model discovery failed');
    });
    const saved = await success({ type: 'GET_SETTINGS' });
    assert.equal(saved.model, 'qa/mock-model', 'Settings setup failed; dependent scenarios were not run.');

    await check('measured fonts, script directions, styles, clipping, dynamic nodes and toggles', async () => {
      report.fonts = await checkFontScenario({
        fixture, success,
        read: (handle, fn, args = []) => on(handle, `return (${fn.toString()})(...arguments);`, args),
        screenshot: async (handle, filename) => { await runtime.switchTo(handle); await runtime.screenshot(`fonts-${filename}`); },
        close: handle => runtime.close(handle), requests: () => server.requests.length,
      });
    });

    await check('API journal details, redaction, retry count, text rendering, themes, copy and clear', async () => {
      report.journal = await checkJournalScenario({
        fixture, success, options,
        read: async (handle, fn, args = []) => {
          await runtime.switchTo(handle);
          // Async JS handles the one provider call; ordinary reads resolve immediately.
          const result = await runtime.executeAsync(`const done=arguments[arguments.length-1];Promise.resolve((${fn.toString()})(arguments[0])).then(done,e=>done({testError:e.message}));`, args.length ? args : [undefined]);
          if (result?.testError) throw new Error(result.testError);
          return result;
        },
        refresh: async () => { await runtime.switchTo(options); await runtime.command('POST', '/refresh', {}); },
        click: name => clickText(options, name),
        theme: async mode => { await runtime.switchTo(options); await runtime.click(`#theme option[value="${mode}"]`); },
        screenshot: async (handle, filename) => { await on(handle, 'document.querySelector(".error-journal").scrollIntoView();'); await runtime.screenshot(filename); },
        close: handle => runtime.close(handle), setMode: mode => server.setMode(mode),
      });
    });

    await check('streaming timing, validation, fallback, rollback, options and lifecycle cleanup', async () => {
      report.streaming = await checkStreamScenario({
        fixture, success, options,
        read: (handle, fn, args = []) => on(handle, `return (${fn.toString()})(...arguments);`, args),
        close: handle => runtime.close(handle),
        navigate: async (handle, name) => { await runtime.switchTo(handle); await runtime.command('POST', '/url', { url: `${server.origin}/${name}.html` }); },
        setMode: (mode, delay) => server.setMode(mode, delay), requests: () => server.requests, metrics: () => server.metrics(),
        refresh: async () => { await runtime.switchTo(options); await runtime.command('POST', '/refresh', {}); },
        toggle: async value => {
          await eventually(() => on(options, 'return !!document.querySelector("input[type=checkbox]") && document.querySelector("form")?.getAttribute("aria-busy") === "false";'), Boolean, 'Streaming form ready after refresh');
          const checked = await on(options, 'return document.querySelector("input[type=checkbox]").checked;');
          if (checked !== value) { await runtime.switchTo(options); await runtime.click('input[type=checkbox]'); }
          await clickText(options, 'Сохранить настройки');
          await eventually(() => success({ type: 'GET_SETTINGS' }), settings => settings.streaming === value, 'Save streaming checkbox');
        },
        screenshot: async (handle, filename) => { await runtime.switchTo(handle); if (handle === options) await runtime.execute('document.querySelector("#translation-title").scrollIntoView();'); await runtime.screenshot(filename); },
      });
    });

    /** @spec spec://modules/page/FEAT-002-page-translation#render */
    await check('large page batches, CJK inline spacing, layout, recovery and parallel timing', async () => {
      report.largePage = await checkLargePageScenario({
        fixture, success, read: (handle, fn, args = []) => on(handle, `return (${fn.toString()})(...arguments);`, args),
        close: handle => runtime.close(handle), setMode: (mode, delay) => server.setMode(mode, delay), requests: () => server.requests,
        screenshot: async (handle, filename) => { await runtime.switchTo(handle); await runtime.screenshot(filename); },
      });
    });

    await check('production popup pipeline, DOM/form/gallery preservation, original/resume and reopen', async () => {
      await configure({ maxNodesPerBatch: 4, concurrency: 2 });
      const page = await fixture('real-estate');
      let popup;
      try {
        await runtime.switchTo(page.handle);
        await runtime.fill('#contact-name', 'QA пользователь');
        await runtime.fill('#contact-note', 'Не изменять введённый текст');
        const original = await text(page.handle, '#listing-description');
        const before = server.requests.length;
        popup = await popupOver(page.handle);
        await clickText(popup, 'Перевести страницу');
        await expectText(page.handle, '#listing-title', 'Светлая квартира в Лионе');
        assert.equal((await completed(page.tabId)).failed, 0);
        await expectText(page.handle, '#far-title', 'Информация о районе');
        const translated = await text(page.handle, '#listing-description');
        assert.ok(translated.startsWith('  ') && translated.endsWith('  '));
        assert.ok((await text(page.handle, '#listing-price')).includes('245 000 €'));
        const values = await on(page.handle, 'return [document.getElementById("contact-name").value,document.getElementById("contact-note").value];');
        assert.deepEqual(values, ['QA пользователь', 'Не изменять введённый текст']);
        await runtime.switchTo(page.handle); await runtime.click('#gallery-next');
        await expectText(page.handle, '#gallery-count', '2 / 3');
        await runtime.click('#contact-submit');
        await expectText(page.handle, '#form-result', 'submitted:1');
        assert.equal(await on(page.handle, 'return window.linguistyFixture.inspect().referencesPreserved;'), true);
        const requests = server.requests.slice(before);
        assert.ok(requests.length > 0 && requests.every(request => request.authorized && !request.keyInBody && request.nodes.length <= 4));
        const texts = requests.flatMap(request => request.nodes.map(node => node.text));
        assert.ok(texts.indexOf('Appartement lumineux à Lyon') < texts.indexOf('Informations sur le quartier'));
        await runtime.switchTo(page.handle); await runtime.screenshot('real-estate-translated.png');
        const count = server.requests.length;
        await clickText(popup, 'Оригинал');
        await expectText(page.handle, '#listing-description', original);
        await on(page.handle, 'window.linguistyFixture.addListing();');
        await pause(650);
        await expectText(page.handle, '#dynamic-1', 'Nouvelle annonce : maison avec jardin 1.');
        assert.equal(server.requests.length, count);
        await clickText(popup, 'Перевод');
        await expectText(page.handle, '#dynamic-1', translatedText('Nouvelle annonce : maison avec jardin 1.'));
        await completed(page.tabId);
        await pause(650);
        const stable = server.requests.length;
        await pause(650);
        assert.equal(server.requests.length, stable, 'Own mutations caused extra requests.');
        await runtime.close(popup); popup = await popupOver(page.handle);
        await expectText(popup, '#page-status', 'Перевод завершён');
        assert.ok((await text(popup, '.progress-copy')).includes(String((await success({ type: 'GET_TAB_STATE', tabId: page.tabId })).translated)));
      } finally { if (popup) await runtime.close(popup); await runtime.close(page.handle); }
      report.memory.push(await runtime.sampleMemory('pipeline-and-original'));
    });

    /** @spec spec://modules/page/FEAT-002-page-translation#sessions */
    await check('external changes, dynamic insertion/deletion and SPA context/session renewal', async () => {
      const page = await fixture('dynamic');
      try {
        await success({ type: 'START_TRANSLATION', tabId: page.tabId }); await completed(page.tabId);
        const prior = (await success({ type: 'GET_TAB_STATE', tabId: page.tabId })).sessionId;
        await runtime.switchTo(page.handle); await runtime.click('#add-listing');
        await expectText(page.handle, '#dynamic-1', translatedText('Nouvelle annonce : maison avec jardin 1.'));
        await on(page.handle, 'document.getElementById("external-text").firstChild.data="Nouveau texte externe à conserver.";');
        await expectText(page.handle, '#external-text', translatedText('Nouveau texte externe à conserver.'));
        await success({ type: 'SET_DISPLAY_MODE', tabId: page.tabId, mode: 'original' });
        await expectText(page.handle, '#external-text', 'Nouveau texte externe à conserver.');
        await success({ type: 'SET_DISPLAY_MODE', tabId: page.tabId, mode: 'translated' });
        await runtime.switchTo(page.handle); await runtime.click('#remove-listing');
        assert.equal(await on(page.handle, 'return document.querySelectorAll("#dynamic-region p").length;'), 0);
        await runtime.click('#change-route');
        await expectText(page.handle, 'h1', 'Доступные дома в Нанте');
        await eventually(() => success({ type: 'GET_TAB_STATE', tabId: page.tabId }), state => state.sessionId && state.sessionId !== prior, 'SPA did not create a new session');
        assert.ok(server.requests.some(request => request.context.title === 'Maisons à Nantes — fixture Linguisty'));
        await runtime.switchTo(page.handle); await runtime.screenshot('spa-translated.png');
      } catch (error) {
        report.spaFailure = { state: await send({ type: 'GET_TAB_STATE', tabId: page.tabId }), heading: await text(page.handle, 'h1'), contexts: server.requests.slice(-4).map(request => request.context) };
        throw error;
      } finally { await runtime.close(page.handle); }
    });

    /** @spec spec://modules/storage/INFRA-002-local-data#cache.data */
    await check('repeat visit cache, model isolation, bounded stats and offline clear', async () => {
      await success({ type: 'CLEAR_CACHE' });
      const first = await fixture('table');
      try { await success({ type: 'START_TRANSLATION', tabId: first.tabId }); await completed(first.tabId); }
      finally { await runtime.close(first.handle); }
      const count = server.requests.length;
      const second = await fixture('table');
      try {
        await success({ type: 'START_TRANSLATION', tabId: second.tabId });
        const cachedState = await completed(second.tabId);
        assert.ok(cachedState.fromCache > 0);
        assert.equal(cachedState.fromCache, cachedState.translated, 'Fully cached revisit must count each translated node once.');
        assert.equal(server.requests.length, count);
        await configure({ model: 'qa/mock-model-2' });
        await success({ type: 'START_TRANSLATION', tabId: second.tabId }); await completed(second.tabId);
        assert.ok(server.requests.length > count);
        const stats = await success({ type: 'GET_CACHE_STATS' });
        assert.ok(stats.entries > 0 && stats.entries <= 10_000 && stats.estimatedBytes <= 50 * 1024 * 1024);
        report.cachePopulated = stats;
        const beforeClear = server.requests.length;
        await success({ type: 'CLEAR_CACHE' });
        assert.equal((await success({ type: 'GET_CACHE_STATS' })).entries, 0);
        assert.equal(server.requests.length, beforeClear);
      } finally { await configure({ model: 'qa/mock-model' }); await runtime.close(second.handle); }
    });

    /** @spec spec://modules/page/FEAT-002-page-translation#scan */
    await check('DOM exclusions, placeholders and provider HTML remains text', async () => {
      for (const name of ['dom-edge-cases', 'table', 'forms']) {
        const page = await fixture(name);
        try {
          const selectors = name === 'dom-edge-cases' ? ['#no-translate', '#hidden-attribute', '#hidden-css', '#visibility-hidden', '#aria-hidden', '#inert-text', '#pre', '#code', '#pure-url', '#pure-email', '#pure-hash'] : name === 'table' ? ['#url-only', '#email-only'] : ['#editable', '#editable-plain'];
          const original = await on(page.handle, 'return arguments[0].map(selector=>document.querySelector(selector)?.textContent);', [selectors]);
          await success({ type: 'START_TRANSLATION', tabId: page.tabId }); await completed(page.tabId);
          assert.deepEqual(await on(page.handle, 'return arguments[0].map(selector=>document.querySelector(selector)?.textContent);', [selectors]), original);
          if (name === 'table') for (const token of ['{nom}', '{{date}}', '%s', '#LY-014']) assert.ok((await text(page.handle, '#placeholders')).includes(token));
          if (name === 'forms') assert.deepEqual(await on(page.handle, 'return [document.getElementById("contact-name").value,document.getElementById("contact-note").value,document.getElementById("contact-consent").checked];'), ['Marie Dupont', 'Je souhaite visiter samedi.', true]);
        } finally { await runtime.close(page.handle); }
      }
      await success({ type: 'CLEAR_CACHE' }); server.setMode('html-text');
      const page = await fixture('dynamic');
      try {
        await success({ type: 'START_TRANSLATION', tabId: page.tabId }); await completed(page.tabId);
        await expectText(page.handle, 'h1', '<img src=x onerror="window.injectionRan=true">');
        assert.equal(await on(page.handle, 'return document.querySelectorAll("img").length;'), 0);
        assert.equal(await on(page.handle, 'return window.injectionRan===true;'), false);
      } finally { server.setMode('ok'); await runtime.close(page.handle); await success({ type: 'CLEAR_CACHE' }); }
    });

    /** @spec spec://modules/platform/INFRA-001-extension#errors */
    await check('401, 429, malformed/unknown IDs, redaction and restricted pages', async () => {
      report.errorCases = [];
      for (const [mode, code] of [['unauthorized', 'INVALID_API_KEY'], ['rate-limit', 'RATE_LIMIT'], ['malformed', 'INVALID_MODEL_RESPONSE'], ['unknown-id', 'INVALID_MODEL_RESPONSE']]) {
        await success({ type: 'CLEAR_CACHE' }); server.setMode(mode);
        const page = await fixture('dynamic');
        try {
          await success({ type: 'START_TRANSLATION', tabId: page.tabId });
          const state = await eventually(() => success({ type: 'GET_TAB_STATE', tabId: page.tabId }), state => state.failed > 0 && state.inFlight === 0, `${mode} error absent`, 12_000);
          assert.equal(state.error?.code, code);
          assert.equal(JSON.stringify(state).includes('Raw mock response'), false);
          assert.equal(JSON.stringify(state).includes(MOCK_KEY), false);
          report.errorCases.push({ mode, code: state.error.code, failed: state.failed, inFlight: state.inFlight });
        } finally { await runtime.close(page.handle); server.setMode('ok'); }
      }
      await runtime.switchTo(options);
      const previousTabs = await runtime.executeAsync('const done=arguments[arguments.length-1];browser.tabs.query({}).then(tabs=>done(tabs.map(tab=>tab.id)));');
      const restricted = await runtime.open('about:config');
      try {
        await runtime.switchTo(options);
        // No tabs permission is requested by production; Firefox hides this
        // restricted URL. Identify the newly opened tab by ID, not by its URL.
        const tabId = await runtime.executeAsync('const done=arguments[arguments.length-1];browser.tabs.query({}).then(tabs=>done(tabs.find(tab=>!arguments[0].includes(tab.id))?.id));', [previousTabs]);
        assert.equal(typeof tabId, 'number', 'Restricted tab ID was not discovered.');
        const result = await send({ type: 'START_TRANSLATION', tabId });
        assert.equal(result.ok, false); assert.equal(result.error.code, 'RESTRICTED_PAGE');
        report.errorCases.push({ mode: 'about:config', code: result.error.code });
      } finally { await runtime.close(restricted); }
    });

    /** @spec spec://common/PROP-002-quality#resources */
    await check('cancel, stale replies, repeated lifecycle, zero timers/observers and removed snapshots', async () => {
      report.lifecycle = [];
      for (let cycle = 0; cycle < 3; cycle++) {
        await success({ type: 'CLEAR_CACHE' }); server.setMode('ok', 2500);
        const page = await fixture('dynamic');
        try {
          await contentProbe(page.tabId, installResourceProbe.toString());
          await success({ type: 'START_TRANSLATION', tabId: page.tabId });
          await eventually(() => Promise.resolve(server.metrics()), metrics => metrics.activeRequests > 0, 'No in-flight mock request');
          const active = await contentProbe(page.tabId, '()=>globalThis[Symbol.for("linguisty.qa.firefox.resources")]()');
          report.lifecycle.push({ cycle, active });
          assert.ok(active.timers > 0 && active.mutationObservers === 1 && active.intersectionObservers === 1, `Resource probe did not observe production activation: ${JSON.stringify(active)}`);
          if (cycle === 0) {
            await runtime.switchTo(options);
            await runtime.executeAsync('const done=arguments[arguments.length-1];browser.scripting.executeScript({target:{tabId:arguments[0]},files:["/translate.js"]}).then(done);', [page.tabId]);
            const duplicate = await contentProbe(page.tabId, '()=>globalThis[Symbol.for("linguisty.qa.firefox.resources")]()');
            assert.equal(duplicate.mutationObservers, 1); assert.equal(duplicate.intersectionObservers, 1);
            for (const type of ['pagehide', 'popstate', 'hashchange', 'scroll', 'resize']) assert.equal(duplicate.listeners[type], 1);
            report.lifecycle.at(-1).afterRepeatedInjection = duplicate;
          }
          const state = await success({ type: 'CANCEL_TRANSLATION', tabId: page.tabId });
          assert.equal(state.status, 'cancelled'); assert.equal(state.inFlight, 0);
          await eventually(() => Promise.resolve(server.metrics()), metrics => metrics.activeRequests === 0 && metrics.pendingTimers === 0, 'Cancel did not abort gateway work');
          await pause(250);
          const stopped = await contentProbe(page.tabId, '()=>globalThis[Symbol.for("linguisty.qa.firefox.resources")]()');
          assert.equal(stopped.timers, 0); assert.equal(stopped.mutationObservers, 0); assert.equal(stopped.intersectionObservers, 0);
          for (const type of ['popstate', 'hashchange', 'scroll', 'resize']) assert.equal(stopped.listeners[type] || 0, 0);
          const original = await text(page.handle, 'h1');
          await on(page.handle, 'window.linguistyFixture.addListing();'); await pause(600);
          await expectText(page.handle, '#dynamic-1', 'Nouvelle annonce : maison avec jardin 1.');
          await expectText(page.handle, 'h1', original);
          Object.assign(report.lifecycle.at(-1), { stopped, network: server.metrics() });
        } finally { await runtime.close(page.handle); server.setMode('ok'); }
        await runtime.switchTo(options);
        await eventually(() => runtime.executeAsync('const done=arguments[arguments.length-1];browser.storage.session.get("linguisty.tabSessions.v1").then(s=>done(s["linguisty.tabSessions.v1"]?.sessions?.length??0));'), count => count === 0, 'Closed page left background snapshots');
      }
      report.memory.push(await runtime.sampleMemory('after-three-lifecycles'));
    });

    /** @spec spec://modules/storage/INFRA-002-local-data#secrets */
    await check('secret migration/no duplicate, public/content boundaries and removal', async () => {
      await configure({ keyMode: 'persistent' });
      await runtime.switchTo(options);
      const locations = async () => runtime.executeAsync('const done=arguments[arguments.length-1];Promise.all([browser.storage.local.get("linguisty.apiKey"),browser.storage.session.get("linguisty.apiKey")]).then(([local,session])=>done({local:typeof local["linguisty.apiKey"]==="string",session:typeof session["linguisty.apiKey"]==="string"}));');
      assert.deepEqual(await locations(), { local: true, session: false });
      await configure({ keyMode: 'session' }); await runtime.switchTo(options);
      assert.deepEqual(await locations(), { local: false, session: true });
      const page = await fixture('dynamic');
      try {
        const result = await contentProbe(page.tabId, 'async()=>Promise.all([browser.runtime.sendMessage({channel:"linguisty",type:"GET_SETTINGS"}),browser.runtime.sendMessage({channel:"linguisty",type:"GET_SECRET_STATUS"})])');
        assert.ok(result.every(item => item.ok === false && item.error.code === 'PERMISSION_REQUIRED'));
        assert.equal(await on(page.handle, 'return typeof browser;'), 'undefined');
      } finally { await runtime.close(page.handle); }
      await success({ type: 'REMOVE_API_KEY' }); await runtime.switchTo(options);
      assert.deepEqual(await locations(), { local: false, session: false });
      assert.equal((await success({ type: 'GET_SECRET_STATUS' })).hasKey, false);
      // Restore the test-only credential for independent theme/UI checks.
      await success({ type: 'SAVE_SETTINGS', settings: await success({ type: 'GET_SETTINGS' }), apiKey: MOCK_KEY });
    });

    /** @spec spec://modules/interface/FEAT-003-controls#design */
    await check('light/dark/system, labels, keyboard focus and aria-live progress', async () => {
      report.themes = [];
      for (const theme of ['light', 'dark', 'system']) {
        await configure({ theme });
        await runtime.switchTo(options); await runtime.navigate(`${runtime.metadata.extensionOrigin}/options.html`);
        await eventually(() => on(options, 'return !!document.getElementById("theme");'), Boolean, 'Theme form absent');
        const actual = await on(options, 'return {theme:document.documentElement.dataset.theme,expected:matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light",background:getComputedStyle(document.body).backgroundColor,labels:Array.from(document.querySelectorAll("input,select,textarea")).every(e=>!!e.labels?.length)};');
        assert.equal(actual.theme, theme === 'system' ? actual.expected : theme); assert.equal(actual.labels, true);
        await runtime.screenshot(`options-${theme}.png`); report.themes.push({ requested: theme, ...actual });
      }
      await runtime.switchTo(options);
      await runtime.execute('document.getElementById("model").focus();');
      const model = await runtime.element('#model');
      await runtime.command('POST', `/element/${model[elementKey]}/value`, { text: '\uE004' });
      assert.equal(await on(options, 'return document.activeElement?.textContent.trim();'), 'Загрузить список моделей');
      const page = await fixture('real-estate'); let popup;
      try {
        await success({ type: 'START_TRANSLATION', tabId: page.tabId }); await completed(page.tabId);
        popup = await popupOver(page.handle);
        assert.equal(await on(popup, 'return document.querySelector(".progress-copy").getAttribute("aria-live");'), 'polite');
        await runtime.screenshot('popup-system.png');
      } finally { if (popup) await runtime.close(popup); await runtime.close(page.handle); }
      report.limitations.push('Full WCAG audit, every contrast ratio, reduced-motion animation and manual keyboard flow are not established by these targeted UI checks.');
    });

    report.mock = server.metrics();
    assert.ok(report.mock.maximumActiveRequests <= 2);
    assert.ok(server.requests.every(request => request.authorized && !request.keyInBody));
    report.cacheFinal = await success({ type: 'CLEAR_CACHE' });
    await success({ type: 'REMOVE_API_KEY' });
    report.packageAfter = await fingerprint(buildRoot);
    await check('production package remained unchanged during execution', async () => { assert.equal(report.packageAfter.sha256, report.packageBefore.sha256); });
  } catch (error) {
    report.fatal = error.message.replaceAll(MOCK_KEY, '[withheld]').slice(0, 1800);
    console.log(`FATAL ${report.fatal}`);
  } finally {
    if (runtime) {
      try { report.cleanup = await runtime.cleanup(); }
      catch (error) { report.cleanupError = error.message; report.fatal ||= 'Owned Firefox cleanup failed.'; }
    }
    if (server) {
      await server.close(); await pause(50);
      report.mockAfterClose = server.metrics();
      if (report.mockAfterClose.activeRequests !== 0 || report.mockAfterClose.pendingTimers !== 0) report.fatal ||= 'Mock resources survived cleanup.';
    }
    report.finishedAt = new Date().toISOString();
    report.passed = report.results.filter(result => result.ok).length;
    report.failed = report.results.filter(result => result.ok === false).length;
    await mkdir(artifactRoot, { recursive: true });
    await writeFile(path.join(artifactRoot, reportFilename), JSON.stringify(report, null, 2));
  }
  console.log(`Firefox smoke: ${report.passed} passed, ${report.failed} failed${report.fatal ? ', fatal limitation' : ''}; ${path.join(artifactRoot, reportFilename)}`);
  return report;
}
