/** @spec spec://modules/page/FEAT-002-page-translation#acceptance */
import assert from 'node:assert/strict';

export async function checkLargePageScenario({ fixture, success, read, close, setMode, requests, screenshot }) {
  const evidence = { timings: [], requests: [], limitations: ['Local mock tests page mechanics; real Flash Lite latency and language quality are unverified.'] };
  const waitUntil = async (get, test, label) => {
    const start = Date.now();
    while (Date.now() - start < 60_000) {
      const value = await get(); if (test(value)) return value;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out: ${label}`);
  };
  async function configure(patch) {
    const settings = await success({ type: 'GET_SETTINGS' });
    await success({ type: 'SAVE_SETTINGS', settings: { ...settings, sourceLanguage: 'zh', targetLanguage: 'ru',
      targetLanguageMode: 'manual', maxNodesPerBatch: 40, maxCharsPerBatch: 10_000, streaming: false, ...patch } });
    await success({ type: 'CLEAR_CACHE' });
  }
  const initial = await success({ type: 'GET_SETTINGS' });
  try {
    for (const [mode, concurrency, model] of [['ok', 1, 'qa/large-serial'], ['ok', 2, 'qa/large-parallel'], ['truncate-large', 2, 'qa/large-recovery']]) {
      await configure({ concurrency, model });
      setMode(mode, mode === 'ok' ? 90 : 0);
      const page = await fixture('large-page');
      const before = requests().length;
      try {
        await read(page.handle, function () {
          window.qaLargeOriginal = document.body.innerHTML.replace(/ style=""/g, '');
          window.qaLargeNodes = [...document.querySelectorAll('a,span,sup,button,input')];
          window.qaLargeStyles = window.qaLargeNodes.map(node => {
            const css = getComputedStyle(node); return [css.fontSize, css.lineHeight];
          });
          window.qaLargeClicks = 0;
          document.getElementById('click-test').addEventListener('click', () => window.qaLargeClicks++);
          document.getElementById('typed').value = 'QA typed value';
        });
        const startedAt = Date.now();
        await success({ type: 'START_TRANSLATION', tabId: page.tabId });
        const state = await waitUntil(() => success({ type: 'GET_TAB_STATE', tabId: page.tabId }), value => ['completed', 'error'].includes(value.status), 'Large page completion');
        const elapsedMs = Date.now() - startedAt;
        assert.equal(state.status, 'completed', JSON.stringify(state));
        assert.equal(state.failed, 0, JSON.stringify(state)); assert.equal(state.inFlight, 0);
        assert.equal(state.translated, state.discovered);
        const result = await read(page.handle, function () {
          document.getElementById('click-test').click();
          return { inline: document.getElementById('inline').textContent, form: document.getElementById('typed').value,
            sameNodes: window.qaLargeNodes.every((node, index) => node === document.querySelectorAll('a,span,sup,button,input')[index]),
            styles: [...document.querySelectorAll('a,span,sup,button,input')].map(node => { const css = getComputedStyle(node); return [css.fontSize, css.lineHeight]; }),
            originalStyles: window.qaLargeStyles, clicks: window.qaLargeClicks,
            long: document.getElementById('long').textContent };
        });
        assert.equal(result.inline, 'Искусственный интеллект может обучаться.[1]');
        assert.equal(result.form, 'QA typed value'); assert.ok(result.sameNodes); assert.equal(result.clicks, 1);
        assert.deepEqual(result.styles, result.originalStyles);
        assert.ok(result.long.includes('Переведённая часть длинного абзаца.') && !result.long.includes('长段测试'));
        const rows = requests().slice(before);
        assert.ok(rows.length > 10);
        for (const row of rows) {
          assert.ok(row.nodes.length <= 16 && row.nodes.reduce((sum, node) => sum + node.text.length, 0) <= 3_000);
          assert.ok(!row.keyInBody && row.authorized);
        }
        const events = rows.flatMap(row => [[row.startedAt, 1], [row.closedAt ?? row.finishedAt, -1]])
          .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        let active = 0; let maximum = 0;
        for (const [, change] of events) { active += change; maximum = Math.max(maximum, active); }
        assert.ok(maximum <= concurrency); if (concurrency === 2 && mode === 'ok') assert.equal(maximum, 2);
        evidence.timings.push({ mode, concurrency, elapsedMs, maximumActiveRequests: maximum, translatedNodes: state.translated, requestCount: rows.length });
        if (mode === 'truncate-large') evidence.requests = rows.map(row => ({ nodes: row.nodes.length, chars: row.nodes.reduce((sum, node) => sum + node.text.length, 0) }));
        if (mode === 'ok' && concurrency === 2) await screenshot(page.handle, 'large-page-translated.png');
        for (let index = 0; index < 4; index++) {
          await success({ type: 'SET_DISPLAY_MODE', tabId: page.tabId, mode: 'original' });
          const restored = await read(page.handle, function () {
            const original = window.qaLargeOriginal; const current = document.body.innerHTML.replace(/ style=""/g, '');
            let offset = 0; while (offset < original.length && original[offset] === current[offset]) offset++;
            return { equal: current === original, original: original.slice(Math.max(0, offset - 60), offset + 160),
              current: current.slice(Math.max(0, offset - 60), offset + 160) };
          });
          assert.ok(restored.equal, JSON.stringify(restored));
          await success({ type: 'SET_DISPLAY_MODE', tabId: page.tabId, mode: 'translated' });
        }
        assert.equal(requests().length - before, rows.length);
      } finally { await close(page.handle); }
    }
  } finally {
    setMode('ok');
    await success({ type: 'SAVE_SETTINGS', settings: initial });
    await success({ type: 'CLEAR_CACHE' });
  }
  return evidence;
}
