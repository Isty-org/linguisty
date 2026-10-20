/** @spec spec://modules/page/FEAT-002-page-translation#render */
import assert from 'node:assert/strict';
import { eventually, pause } from './firefox-runtime.mjs';

const russian = ['Заголовок страницы', 'В этом районе есть тихий парк и удобные магазины.', 'Подпись к фотографии', 'Краткое описание'];
export function fontSnapshot() {
  return ['heading', 'body', 'caption', 'fixed'].map(id => {
    const element = document.getElementById(id);
    const style = getComputedStyle(element);
    const context = document.createElement('canvas').getContext('2d');
    context.font = style.font;
    const ink = text => { const m = context.measureText(text); return m.actualBoundingBoxAscent + m.actualBoundingBoxDescent; };
    return { id, size: parseFloat(style.fontSize), lineHeight: style.lineHeight, declarations: element.style.cssText,
      cjkInk: ink('日本語'), russianInk: ink('АБВН'), text: element.textContent,
      clippedX: Math.max(0, element.scrollWidth - element.clientWidth), clippedY: Math.max(0, element.scrollHeight - element.clientHeight) };
  });
}

/** Same production-package assertions in both browser runtimes. */
export async function checkFontScenario({ fixture, success, read, screenshot, close, requests }) {
  const evidence = [];
  const originalTarget = (await success({ type: 'GET_SETTINGS' })).targetLanguage;
  for (const reverse of [false, true]) {
    const current = await success({ type: 'GET_SETTINGS' });
    await success({ type: 'SAVE_SETTINGS', settings: { ...current, targetLanguage: reverse ? 'ja' : 'ru' } });
    const { handle, tabId } = await fixture('fonts');
    try {
      if (reverse) await read(handle, function (texts) {
        ['heading', 'body', 'caption', 'fixed'].forEach((id, index) => { document.getElementById(id).firstChild.data = texts[index]; });
      }, [russian]);
      await read(handle, function () { document.getElementById('input').value = 'Typed user value'; });
      const before = await read(handle, fontSnapshot);
      await success({ type: 'START_TRANSLATION', tabId });
      await eventually(() => success({ type: 'GET_TAB_STATE', tabId }), value => value.status === 'completed', 'Font translation completion');
      const after = await read(handle, fontSnapshot);
      assert.equal(after[3].size, before[3].size, 'Correction increased clipping in the fixed-height block.');
      assert.ok(after[0].size > after[1].size && after[1].size > after[2].size, 'Font hierarchy was lost.');
      for (let i = 0; i < 3; i++) {
        assert.ok(after[i].size <= before[i].size * 1.4 + .01);
        if (reverse) assert.ok(after[i].size >= before[i].size, 'CJK was made smaller.');
        else if (i < 2) assert.ok(Math.abs(after[i].russianInk / before[i].cjkInk - 1) <= .15, 'Cyrillic ink did not approach original height.');
      }
      assert.equal(after[1].text, reverse ? 'この地域には静かな公園と便利な商店があります。' : russian[1]);
      await screenshot(handle, `${reverse ? 'ru-ja' : 'ja-ru'}-translated.png`);
      const stable = requests();
      for (let i = 0; i < 5; i++) {
        await success({ type: 'SET_DISPLAY_MODE', tabId, mode: 'original' });
        const original = await read(handle, fontSnapshot);
        assert.deepEqual(original.map(item => [item.text, item.declarations, item.size]), before.map(item => [item.text, item.declarations, item.size]));
        await success({ type: 'SET_DISPLAY_MODE', tabId, mode: 'translated' });
      }
      await pause(600);
      assert.equal(requests(), stable, 'Typography mutations or toggles caused duplicate requests.');
      assert.equal(await read(handle, function () { return document.getElementById('input').value; }), 'Typed user value');
      if (!reverse) {
        await read(handle, function () {
          const p = document.createElement('p'); p.id = 'font-dynamic'; p.textContent = '写真の説明'; document.body.append(p);
        });
        await eventually(() => read(handle, function () { const p = document.getElementById('font-dynamic'); return [p.textContent, p.style.fontSize]; }), value => value[0] === russian[2] && parseFloat(value[1]) > 18, 'Dynamic typography');
        await read(handle, function () { document.getElementById('body').style.fontSize = '22px'; });
        await pause(600);
        assert.equal(await read(handle, function () { return document.getElementById('body').style.fontSize; }), '22px');
        await success({ type: 'SET_DISPLAY_MODE', tabId, mode: 'original' });
        assert.equal(await read(handle, function () { return document.getElementById('body').style.fontSize; }), '22px');
      }
      evidence.push({ direction: reverse ? 'ru-ja' : 'ja-ru', before, after, toggles: 5, stableRequestCount: stable });
    } finally { await close(handle); }
  }
  await success({ type: 'SAVE_SETTINGS', settings: { ...await success({ type: 'GET_SETTINGS' }), targetLanguage: originalTarget } });
  return evidence;
}
