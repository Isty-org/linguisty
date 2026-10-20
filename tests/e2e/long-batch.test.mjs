/** @spec spec://modules/page/FEAT-002-page-translation#queue */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import { inspectBuild } from '../../scripts/check-manifests.mjs';
import { launchIsolatedChromium } from './browser-runtime.mjs';
import { eventually, launchIsolatedFirefox, pause } from './firefox-runtime.mjs';
import { MOCK_KEY, startLocalServer } from './local-server.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const buildRoot = path.join(projectRoot, '.output/chrome-mv3');
const firefoxBuildRoot = path.join(projectRoot, '.output/firefox-mv3');
const firefoxArtifacts = path.join(projectRoot, 'test-results/linguisty-long-batch-firefox');

/** The shared gateway deliberately caps delay at 10 s; this owned fixture needs 40 s. */
async function startDelayedGateway() {
  const requests = [];
  let providerAttempts = 0;
  const timers = new Set();
  const sockets = new Set();
  const server = createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/long-batch.html') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<!doctype html><html><body><p id="long-batch-target">Bonjour</p></body></html>');
      return;
    }
    if (url.pathname !== '/v1/chat/completions' || request.method !== 'POST') {
      response.writeHead(404).end('Mock route absent');
      return;
    }
    providerAttempts += 1;
    try {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        assert.ok(bytes <= 128 * 1024, 'Oversized mock request');
        chunks.push(chunk);
      }
      assert.equal(request.headers.authorization, `Bearer ${MOCK_KEY}`);
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const prompt = JSON.parse(payload.messages.find(message => message.role === 'user').content);
      assert.ok(Array.isArray(prompt.nodes) && prompt.nodes.length === 1);
      const record = { startedAt: Date.now(), repliedAt: 0, closedAt: 0 };
      requests.push(record);
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (response.destroyed) return;
        record.repliedAt = Date.now();
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
          content: JSON.stringify({ translations: prompt.nodes.map(node => ({ id: node.id, text: 'Hello' })) }),
        } }] }));
      }, 40_000);
      timers.add(timer);
      response.once('close', () => { record.closedAt = Date.now(); clearTimeout(timer); timers.delete(timer); });
    } catch {
      if (!response.destroyed) response.writeHead(400).end('Invalid bounded mock request');
    }
  });
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return {
    origin: `http://127.0.0.1:${server.address().port}`, requests,
    metrics() { return { providerAttempts, pendingTimers: timers.size,
      requests: requests.map(({ startedAt, repliedAt, closedAt }) => ({ startedAt, repliedAt, closedAt })) }; },
    async close() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      for (const socket of sockets) socket.destroy();
      await closed;
    },
  };
}

async function success(page, message) {
  const response = await page.evaluate(payload => globalThis.chrome.runtime.sendMessage({ channel: 'linguisty', ...payload }), message);
  assert.equal(response?.ok, true, `Background ${message.type} failed: ${response?.error?.code ?? 'missing response'}`);
  return response.data;
}

async function grantLoopback(context, extensionId, options) {
  const management = await context.newPage();
  try {
    await management.goto('chrome://extensions');
    await management.evaluate(id => globalThis.chrome.developerPrivate.addHostPermission(id, 'http://127.0.0.1/*'), extensionId);
  } finally { await management.close(); }
  assert.equal(await options.evaluate(() => globalThis.chrome.permissions.request({ origins: ['http://127.0.0.1/*'] })), true);
}

test('built Chrome content accepts a mock batch reply after 35 seconds', { timeout: 150_000 }, async () => {
  const inspection = await inspectBuild(buildRoot, 'chrome');
  assert.equal(inspection.ok, true, inspection.errors.join('\n'));
  const server = await startLocalServer();
  let runtime;
  try {
    runtime = await launchIsolatedChromium(buildRoot);
    const { context } = runtime;
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15_000 });
    const extensionId = new URL(worker.url()).hostname;
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await grantLoopback(context, extensionId, options);
    const current = await success(options, { type: 'GET_SETTINGS' });
    await success(options, { type: 'SAVE_SETTINGS', apiKey: MOCK_KEY, settings: {
      ...current, providerId: 'openai-compatible', baseUrl: `${server.origin}/v1`, model: 'qa/mock-model',
      targetLanguage: 'en', targetLanguageMode: 'manual', streaming: false, requestTimeoutMs: 120_000,
      concurrency: 1, maxNodesPerBatch: 1,
    } });
    assert.equal((await success(options, { type: 'GET_SECRET_STATUS' })).hasKey, true);

    // This patch stays inside the isolated test worker. It delays only the
    // local mock inference response; no paid or external provider is contacted.
    await worker.evaluate(() => {
      const nativeFetch = globalThis.fetch.bind(globalThis);
      globalThis.fetch = async (url, init) => {
        if (!String(url).endsWith('/v1/chat/completions')) return nativeFetch(url, init);
        const body = JSON.parse(init.body);
        const prompt = JSON.parse(body.messages.find(message => message.role === 'user').content);
        if (init.signal?.aborted) throw new DOMException('Mock request cancelled', 'AbortError');
        await new Promise((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            init.signal?.removeEventListener('abort', abort);
            reject(new DOMException('Mock request cancelled', 'AbortError'));
          };
          const timer = setTimeout(() => {
            init.signal?.removeEventListener('abort', abort);
            resolve();
          }, 40_000);
          init.signal?.addEventListener('abort', abort, { once: true });
        });
        return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
          content: JSON.stringify({ translations: prompt.nodes.map(node => ({ id: node.id, text: 'Hello' })) }),
        } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
    });

    const page = await context.newPage();
    await page.goto(`${server.origin}/real-estate.html`);
    await page.evaluate(() => { document.body.innerHTML = '<p id="long-batch-target">Bonjour</p>'; });
    const tabId = await options.evaluate(async url =>
      (await globalThis.chrome.tabs.query({})).find(tab => tab.url === url)?.id, page.url());
    assert.equal(typeof tabId, 'number');
    const startedAt = Date.now();
    await success(options, { type: 'START_TRANSLATION', tabId });
    await expect(page.locator('#long-batch-target')).toHaveText('Hello', { timeout: 90_000 });
    const elapsed = Date.now() - startedAt;
    assert.ok(elapsed >= 35_000, `Mock response arrived too early: ${elapsed} ms`);
    const state = await success(options, { type: 'GET_TAB_STATE', tabId });
    assert.equal(state.status, 'completed');
    assert.equal(state.translated, 1);
    assert.equal(state.failed, 0);
    assert.equal(server.requests.length, 0, 'The mock gateway unexpectedly received a provider request.');
  } finally {
    try { await runtime?.cleanup(); }
    finally { await server.close(); }
  }
});

/** @spec spec://modules/page/FEAT-002-page-translation#queue */
test('built Firefox content accepts a loopback batch reply after 35 seconds', { timeout: 180_000 }, async () => {
  const inspection = await inspectBuild(firefoxBuildRoot, 'firefox');
  assert.equal(inspection.ok, true, inspection.errors.join('\n'));
  const server = await startDelayedGateway();
  let runtime;
  try {
    runtime = await launchIsolatedFirefox({ projectRoot, extensionPath: firefoxBuildRoot, artifactRoot: firefoxArtifacts });
    const options = await runtime.open(`${runtime.metadata.extensionOrigin}/options.html`);
    await eventually(() => runtime.execute('return !!document.getElementById("providerId");'), Boolean, 'Firefox options form absent');
    await runtime.click('#providerId option[value="openai-compatible"]');
    await runtime.fill('#baseUrl', `${server.origin}/v1`);
    await runtime.fill('#apiKey', MOCK_KEY);
    await runtime.fill('#model', 'qa/mock-model');
    await runtime.click('button[type="submit"]');
    await eventually(() => runtime.execute('return PopupNotifications.panel.state === "open" && !!document.getElementById("addon-webext-permissions-notification");', [], 'chrome'), Boolean, 'Firefox optional-host prompt absent');
    await pause(750);
    await runtime.execute('const n=document.getElementById("addon-webext-permissions-notification");n.button.click();return true;', [], 'chrome');
    await runtime.switchTo(options);
    await eventually(() => runtime.execute('return document.getElementById("apiKey").value === "";'), Boolean, 'Firefox mock key was not saved');

    async function successFirefox(message) {
      await runtime.switchTo(options);
      const response = await runtime.executeAsync('const done=arguments[arguments.length-1];browser.runtime.sendMessage({channel:"linguisty",...arguments[0]}).then(done,e=>done({transportError:e.name}));', [message]);
      assert.equal(response?.ok, true, `Firefox ${message.type} failed: ${response?.error?.code ?? response?.transportError ?? 'missing response'}`);
      return response.data;
    }
    const current = await successFirefox({ type: 'GET_SETTINGS' });
    await successFirefox({ type: 'SAVE_SETTINGS', settings: {
      ...current, targetLanguage: 'en', targetLanguageMode: 'manual', streaming: false, requestTimeoutMs: 120_000,
      concurrency: 1, maxNodesPerBatch: 1,
    } });
    assert.equal((await successFirefox({ type: 'GET_SECRET_STATUS' })).hasKey, true);
    const savedSettings = await successFirefox({ type: 'GET_SETTINGS' });
    assert.equal(savedSettings.requestTimeoutMs, 120_000);
    assert.equal(savedSettings.streaming, false);

    // Read browser-owned lifecycle state without messaging/waking the event page.
    // Calling GET_TAB_STATE during the wait would itself reset its idle timer.
    const lifecycle = [];
    await runtime.execute(`
      const {ExtensionParent}=ChromeUtils.importESModule("resource://gre/modules/ExtensionParent.sys.mjs");
      const extension=ExtensionParent.GlobalManager.getExtension(arguments[0]);
      const events=[];
      gBrowser.__linguistyLongBatchEvents=events;
      for(const name of ["background-script-suspend","shutdown-background-script","background-script-started","background-script-suspend-canceled"]){
        extension.on(name,()=>{if(events.length<32)events.push({event:name,at:Date.now(),state:extension.backgroundState});});
      }
      return true;`, [runtime.metadata.addonId], 'chrome');
    const readLifecycleEvents = () => runtime.execute('return gBrowser.__linguistyLongBatchEvents;', [], 'chrome');
    async function sampleLifecycle() {
      const state = await runtime.execute('const {ExtensionParent}=ChromeUtils.importESModule("resource://gre/modules/ExtensionParent.sys.mjs");return ExtensionParent.GlobalManager.getExtension(arguments[0])?.backgroundState ?? "missing";', [runtime.metadata.addonId], 'chrome');
      if (lifecycle.at(-1)?.state !== state) lifecycle.push({ state, at: Date.now() });
      return state;
    }

    const pageUrl = `${server.origin}/long-batch.html`;
    const page = await runtime.open(pageUrl);
    await runtime.switchTo(options);
    const tabId = await runtime.executeAsync('const done=arguments[arguments.length-1];browser.tabs.query({}).then(tabs=>done(tabs.find(tab=>tab.url===arguments[0])?.id));', [pageUrl]);
    assert.equal(typeof tabId, 'number');
    const startedAt = Date.now();
    await successFirefox({ type: 'START_TRANSLATION', tabId });
    const stateEvidence = state => ({
      status: state.status, displayMode: state.displayMode, discovered: state.discovered,
      translated: state.translated, failed: state.failed, inFlight: state.inFlight, errorCode: state.error?.code,
    });
    const requestEvidence = () => {
      const metrics = server.metrics();
      return { providerAttempts: metrics.providerAttempts, pendingTimers: metrics.pendingTimers,
        requests: metrics.requests.map(record => ({
          startedAfterStartMs: record.startedAt - startedAt,
          repliedAfterStartMs: record.repliedAt ? record.repliedAt - startedAt : null,
          closedAfterStartMs: record.closedAt ? record.closedAt - startedAt : null,
        })) };
    };
    const beforeWait = { browserVersion: runtime.metadata.version,
      settings: { providerId: savedSettings.providerId, requestTimeoutMs: savedSettings.requestTimeoutMs, streaming: savedSettings.streaming },
      state: stateEvidence(await successFirefox({ type: 'GET_TAB_STATE', tabId })), request: requestEvidence() };
    console.log('Firefox long-batch before wait: ' + JSON.stringify(beforeWait));
    try {
      await eventually(async () => {
        await sampleLifecycle();
        assert.ok(!server.requests.some(record => record.closedAt && !record.repliedAt), 'Firefox closed the provider connection before the delayed reply');
        await runtime.switchTo(page);
        return runtime.execute('return document.getElementById("long-batch-target")?.textContent;');
      }, value => value === 'Hello', 'Firefox long batch did not translate', 90_000);
    } catch (error) {
      const lifecycleEvents = await readLifecycleEvents();
      let state;
      try { state = stateEvidence(await successFirefox({ type: 'GET_TAB_STATE', tabId })); }
      catch (failure) { state = { readFailed: failure instanceof Error ? failure.message.slice(0, 160) : 'Unknown read failure' }; }
      throw new Error(`${error.message}; beforeWait=${JSON.stringify(beforeWait)}; atFailure=${JSON.stringify({
        elapsedMs: Date.now() - startedAt, state, request: requestEvidence(),
        lifecycle: lifecycle.map(({ state, at }) => ({ state, afterStartMs: at - startedAt })),
        lifecycleEvents: lifecycleEvents.map(({ event, state, at }) => ({ event, state, afterStartMs: at - startedAt })),
      })}`);
    }
    assert.ok(Date.now() - startedAt >= 35_000, 'Firefox mock batch completed before the intended delay');
    const state = await eventually(() => successFirefox({ type: 'GET_TAB_STATE', tabId }),
      value => value.status === 'completed', 'Firefox long batch did not complete', 10_000);
    assert.equal(state.translated, 1);
    assert.equal(state.failed, 0);
    assert.equal(server.requests.length, 1);
    assert.ok(server.requests[0].repliedAt - server.requests[0].startedAt >= 35_000, 'Firefox mock responded too early');
    const completedAt = Date.now();
    const duringRequest = await readLifecycleEvents();
    assert.equal(duringRequest.filter(event => event.event === 'shutdown-background-script' && event.at <= server.requests[0].repliedAt).length, 0,
      'Firefox unloaded its background during the pending request');
    // No extension API calls here: the event page must become idle naturally.
    await eventually(sampleLifecycle, state => state === 'stopped', 'Firefox background stayed active after request completion', 45_000);
    console.log('Firefox long-batch completed: ' + JSON.stringify({ elapsedMs: completedAt - startedAt,
      idleAfterCompletionMs: Date.now() - completedAt, request: requestEvidence(),
      lifecycleEvents: (await readLifecycleEvents()).map(({ event, state, at }) => ({ event, state, afterStartMs: at - startedAt })),
    }));
  } finally {
    try {
      const cleanup = await runtime?.cleanup();
      if (cleanup) console.log('Firefox long-batch cleanup: ' + JSON.stringify({ profileRemoved: cleanup.profileRemoved,
        remainingOwnedProcesses: cleanup.remainingOwnedProcesses, ownedMemoryAfterBytes: cleanup.after.ownWorkingSetBytes }));
    }
    finally { await server.close(); }
  }
});
