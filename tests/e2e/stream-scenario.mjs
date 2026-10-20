/** @spec spec://modules/translation/FEAT-001-engine#acceptance */
import assert from 'node:assert/strict';
import { eventually, pause } from './firefox-runtime.mjs';

export async function checkStreamScenario({ fixture, success, read, close, navigate, setMode, requests, metrics, options, refresh, toggle, screenshot }) {
  const initial = await success({ type: 'GET_SETTINGS' });
  const evidence = { timings: [], errors: [], lifecycles: [] };
  async function config(patch) { await success({ type: 'SAVE_SETTINGS', settings: { ...initial, concurrency: 1, maxNodesPerBatch: 40, streaming: true, ...patch } }); await success({ type: 'CLEAR_CACHE' }); }
  async function prepare(mode, delay = 900) {
    setMode(mode, delay);
    const page = await fixture('streaming');
    await read(page.handle, function () {
      const first = document.querySelector('#first'); const last = document.querySelector('#last');
      const observer = new MutationObserver(() => {
        if (first.textContent === 'Перевод: First complete phrase' && !document.documentElement.hasAttribute('data-qa-first-at')) document.documentElement.setAttribute('data-qa-first-at', String(Date.now()));
        if (last.textContent === 'Перевод: A final phrase for strict validation.' && !document.documentElement.hasAttribute('data-qa-final-at')) document.documentElement.setAttribute('data-qa-final-at', String(Date.now()));
      });
      observer.observe(document.body, { characterData: true, childList: true, subtree: true });
      document.addEventListener('qa-stop-stream-probe', () => observer.disconnect(), { once: true });
    });
    return page;
  }
  const snapshot = handle => read(handle, function () { return { first: document.querySelector('#first').textContent, last: document.querySelector('#last').textContent,
    firstAt: Number(document.documentElement.getAttribute('data-qa-first-at')), finalAt: Number(document.documentElement.getAttribute('data-qa-final-at')), input: document.querySelector('input').value }; });
  async function stop(page) { await read(page.handle, function () { document.dispatchEvent(new Event('qa-stop-stream-probe')); }).catch(() => undefined); await close(page.handle); }
  async function preview(page) { return eventually(() => snapshot(page.handle), value => value.firstAt > 0, 'Early streamed item'); }
  async function noRequestsLeft() { await eventually(metrics, value => value.activeRequests === 0 && value.pendingTimers === 0, 'Stream request cleanup'); }
  try {
    for (const streaming of [true, false]) {
      await config({ streaming });
      const page = await prepare('stream', 2500); const before = requests().length;
      try {
        await success({ type: 'START_TRANSLATION', tabId: page.tabId });
        if (streaming) {
          const early = await preview(page);
          assert.equal(early.last, 'A final phrase for strict validation.');
          assert.equal((await success({ type: 'GET_TAB_STATE', tabId: page.tabId })).translated, 0);
          assert.equal((await success({ type: 'GET_CACHE_STATS' })).entries, 0);
          await screenshot(page.handle, 'streaming-early.png');
        }
        await eventually(() => success({ type: 'GET_TAB_STATE', tabId: page.tabId }), state => state.status === 'completed', 'Stream completion');
        const state = await snapshot(page.handle); const rows = requests().slice(before);
        assert.equal(rows.length, 1); assert.equal(rows[0].streaming, streaming);
        assert.equal(state.input, 'Typed value');
        assert.ok((await success({ type: 'GET_CACHE_STATS' })).entries === 3);
        if (streaming) assert.ok(state.firstAt < rows[0].finishedAt && state.firstAt < state.finalAt - 500, 'First item was not displayed before response ended.');
        else assert.ok(state.firstAt >= rows[0].finishedAt, 'Regular request displayed before its response.');
        evidence.timings.push({ streaming, firstDisplayMs: state.firstAt - rows[0].startedAt, fullDisplayMs: state.finalAt - rows[0].startedAt, providerFirstMs: rows[0].firstAt ? rows[0].firstAt - rows[0].startedAt : null, providerFinishedMs: rows[0].finishedAt - rows[0].startedAt });
      } finally { await stop(page); }
      await noRequestsLeft();
    }

    // Exercise the real options checkbox and persistence rather than just injecting settings.
    await refresh(); await toggle(false); await refresh();
    assert.equal((await success({ type: 'GET_SETTINGS' })).streaming, false);
    await toggle(true); await refresh(); assert.equal((await success({ type: 'GET_SETTINGS' })).streaming, true);
    await screenshot(options, 'streaming-options.png');

    // Multi-node validation failures now use bounded adaptive recovery. Unknown
    // and missing-ID fixtures become valid at one node; duplicate-ID output
    // remains invalid and must roll back the entire original batch.
    for (const [mode, expected, attempts] of [['stream-duplicate', 'INVALID_MODEL_RESPONSE', 6], ['stream-unknown', null, 7], ['stream-missing', null, 7], ['stream-error', 'INVALID_API_KEY', 1], ['stream-drop', 'NETWORK_ERROR', 3]]) {
      await config({ model: `qa/${mode}` }); const page = await prepare(mode); const before = requests().length;
      try {
        await success({ type: 'START_TRANSLATION', tabId: page.tabId }); await preview(page);
        const state = await eventually(() => success({ type: 'GET_TAB_STATE', tabId: page.tabId }), value => value.status === (expected ? 'error' : 'completed'), `${mode} final state`);
        const displayed = await snapshot(page.handle);
        const rows = requests().slice(before);
        assert.equal(rows.length, attempts);
        if (expected) {
          assert.equal(state.error.code, expected); assert.equal(state.translated, 0);
          assert.equal(displayed.first, 'First complete phrase'); assert.equal(displayed.last, 'A final phrase for strict validation.');
          assert.equal((await success({ type: 'GET_CACHE_STATS' })).entries, 0);
          evidence.errors.push({ mode, code: state.error.code, attempts: rows.length, rolledBack: true });
        } else {
          assert.ok(!state.error); assert.equal(state.translated, 3);
          assert.equal(displayed.first, 'Перевод: First complete phrase'); assert.equal(displayed.last, 'Перевод: A final phrase for strict validation.');
          assert.equal((await success({ type: 'GET_CACHE_STATS' })).entries, 3);
          assert.deepEqual(rows.map(row => row.nodes.length), [3, 3, 2, 2, 1, 1, 1]);
          evidence.errors.push({ mode, code: null, attempts: rows.length, recovered: true });
        }
      } finally { await stop(page); }
      await noRequestsLeft();
    }

    await config({ model: 'qa/stream-fallback' });
    const fallback = await prepare('stream-unsupported', 0); const beforeFallback = requests().length;
    try {
      await success({ type: 'START_TRANSLATION', tabId: fallback.tabId });
      await eventually(() => success({ type: 'GET_TAB_STATE', tabId: fallback.tabId }), value => value.status === 'completed', 'Explicit streaming fallback');
      assert.deepEqual(requests().slice(beforeFallback).map(row => row.streaming), [true, false]); evidence.fallback = true;
    } finally { await stop(fallback); }

    for (const action of ['cancel', 'original', 'external-text', 'navigation', 'close']) {
      await config({ model: `qa/lifecycle-${action}` }); const page = await prepare('stream', 2500);
      let closed = false;
      try {
        await success({ type: 'START_TRANSLATION', tabId: page.tabId }); await preview(page);
        if (action === 'external-text') {
          await read(page.handle, function () { document.querySelector('#first').firstChild.data = 'Changed by the page'; });
          await success({ type: 'CANCEL_TRANSLATION', tabId: page.tabId });
          assert.equal((await snapshot(page.handle)).first, 'Changed by the page');
        } else if (action === 'cancel') {
          await success({ type: 'CANCEL_TRANSLATION', tabId: page.tabId }); assert.equal((await snapshot(page.handle)).first, 'First complete phrase');
        } else if (action === 'original') {
          await success({ type: 'SET_DISPLAY_MODE', tabId: page.tabId, mode: 'original' });
          assert.equal((await snapshot(page.handle)).first, 'First complete phrase');
          await noRequestsLeft();
          setMode('stream', 300);
          await success({ type: 'SET_DISPLAY_MODE', tabId: page.tabId, mode: 'translated' });
          await eventually(() => success({ type: 'GET_TAB_STATE', tabId: page.tabId }), value => value.status === 'completed', 'Resume streamed batch');
          const count = requests().length;
          await success({ type: 'SET_DISPLAY_MODE', tabId: page.tabId, mode: 'original' });
          await success({ type: 'SET_DISPLAY_MODE', tabId: page.tabId, mode: 'translated' });
          assert.equal(requests().length, count, 'Committed stream was requested again on toggle.');
        } else if (action === 'navigation') {
          await navigate(page.handle, 'dynamic');
          await pause(150);
          assert.equal(await read(page.handle, function () { return document.querySelector('#first') === null && document.querySelector('h1').textContent === 'Annonces disponibles'; }), true);
        } else { await stop(page); closed = true; }
        await noRequestsLeft();
        if (action !== 'original') assert.equal((await success({ type: 'GET_CACHE_STATS' })).entries, 0);
        evidence.lifecycles.push({ action, stoppedOrResumed: true });
      } finally { if (!closed) await stop(page); }
    }
    evidence.finalResources = metrics();
  } finally {
    setMode('ok'); await success({ type: 'SAVE_SETTINGS', settings: initial });
  }
  return evidence;
}
