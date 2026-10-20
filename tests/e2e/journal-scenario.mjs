/** @spec spec://modules/interface/FEAT-003-controls#errors */
import assert from 'node:assert/strict';
import { eventually } from './firefox-runtime.mjs';
import { JOURNAL_ECHO, MOCK_KEY } from './local-server.mjs';

/** @spec spec://modules/storage/INFRA-002-local-data#contracts */
export async function checkJournalScenario({ fixture, success, read, options, refresh, click, theme, screenshot, close, setMode }) {
  const initial = await success({ type: 'GET_SETTINGS' });
  const { handle, tabId } = await fixture('fonts');
  const evidence = {};
  try {
    await success({ type: 'CLEAR_ERROR_LOG' });
    setMode('ok');
    await success({ type: 'START_TRANSLATION', tabId });
    await eventually(() => success({ type: 'GET_TAB_STATE', tabId }), state => state.status === 'completed', 'Journal cache setup');
    const cacheBefore = await success({ type: 'GET_CACHE_STATS' });
    assert.ok(cacheBefore.entries > 0);
    await success({ type: 'SAVE_SETTINGS', settings: { ...initial, model: 'qa/journal-error' } });
    setMode('journal-echo');
    await success({ type: 'START_TRANSLATION', tabId });
    await eventually(() => success({ type: 'GET_TAB_STATE', tabId }), state => state.status === 'error', 'Translation error for journal');
    setMode('unauthorized');
    assert.equal((await success({ type: 'TEST_CONNECTION' })).success, false);
    // Different transient credential prevents the existing discovery cache from masking a real failed request.
    const models = await success({ type: 'GET_SETTINGS' });
    await read(options, async function (settings) {
      const runtime = globalThis.browser?.runtime ?? globalThis.chrome.runtime;
      const result = await runtime.sendMessage({ channel: 'linguisty', type: 'LIST_MODELS', settings, apiKey: 'linguisty-qa-local-credential-discovery' });
      if (result.ok) throw new Error('Discovery should fail.');
    }, [models]);
    let entries = await success({ type: 'GET_ERROR_LOG' });
    assert.equal(entries.length, 3);
    assert.deepEqual([...new Set(entries.map(entry => entry.operation))].sort(), ['list-models', 'test-connection', 'translate']);
    assert.deepEqual(entries.map(entry => entry.httpStatus).sort(), [400, 401, 401]);
    const translateError = entries.find(entry => entry.operation === 'translate');
    for (const [field, expected] of Object.entries({ source: 'api', httpStatus: 400, apiCode: 'invalid_request_error',
      apiType: 'account_restricted', errorCode: 'INVALID_SETTINGS', model: 'qa/journal-error', attempts: 1 })) assert.equal(translateError[field], expected);
    assert.ok(entries.every(entry => !('message' in entry) && !('providerMessage' in entry) && !('requestId' in entry)));
    const privateFragments = [JOURNAL_ECHO, encodeURIComponent(JOURNAL_ECHO), '250', 'EUR', MOCK_KEY];
    for (const fragment of privateFragments) assert.equal(JSON.stringify(entries).includes(fragment), false);
    setMode('rate-limit');
    assert.equal((await success({ type: 'TEST_CONNECTION' })).success, false);
    entries = await success({ type: 'GET_ERROR_LOG' });
    assert.equal(entries.length, 4, 'Retries produced duplicate journal entries.');
    assert.equal(entries[0].attempts, 3);
    evidence.entries = entries;
    await refresh();
    const visible = await eventually(() => read(options, function () { return document.querySelector('.error-journal').textContent; }), value => value.includes('HTTP 429') && value.includes('RATE_LIMIT'), 'Journal UI contents');
    for (const fragment of privateFragments) assert.equal(visible.includes(fragment), false);
    assert.equal(await read(options, function () { return document.querySelector('.error-log img') !== null; }), false);
    for (const mode of ['light', 'dark']) { await theme(mode); await screenshot(options, `journal-${mode}.png`); }
    // Capture only the test UI's outgoing clipboard data, preserving the user's system clipboard.
    await read(options, function () {
      const clipboard = (window.wrappedJSObject ?? window).navigator.clipboard;
      if (typeof clipboard?.writeText !== 'function') throw new Error('Clipboard API unavailable.');
      const original = clipboard.writeText;
      clipboard.writeText = async value => {
        document.documentElement.setAttribute('data-qa-clipboard', value);
        clipboard.writeText = original;
      };
    });
    try {
      await click('Скопировать журнал');
      const copied = await eventually(() => read(options, function () { return document.documentElement.getAttribute('data-qa-clipboard'); }), Boolean, 'Copy action');
      assert.deepEqual(JSON.parse(copied), entries);
      for (const fragment of privateFragments) assert.equal(copied.includes(fragment), false);
      evidence.clipboardBoundaryCaptured = true;
    } finally {
      await read(options, function () { document.documentElement.removeAttribute('data-qa-clipboard'); });
    }
    await click('Очистить журнал');
    await eventually(() => success({ type: 'GET_ERROR_LOG' }), rows => rows.length === 0, 'Journal clear');
    assert.equal((await success({ type: 'GET_CACHE_STATS' })).entries, cacheBefore.entries);
    evidence.cachePreserved = true;
  } finally {
    setMode('ok');
    await success({ type: 'SAVE_SETTINGS', settings: initial });
    await close(handle);
  }
  return evidence;
}
