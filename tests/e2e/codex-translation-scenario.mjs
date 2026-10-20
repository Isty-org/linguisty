/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
import assert from 'node:assert/strict';
import { eventually } from './firefox-runtime.mjs';

/** Production extension, fixture-only network; exercises the user's 1,340-node scale. */
export async function codexTranslationScenario({ send, tabId, onPage, onGuide }) {
  await send({ type: 'SET_DISPLAY_MODE', tabId, mode: 'original' });
  await onPage(() => {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 1340; i++) {
      const node = document.createElement('p'); node.textContent = 'Subscription large page item ' + i; fragment.append(node);
    }
    document.body.replaceChildren(fragment);
  });
  const requestsBefore = await onGuide(() => (window.wrappedJSObject ?? window).__linguistyCodexQa.responses);
  assert.equal((await send({ type: 'START_TRANSLATION', tabId })).ok, true);
  const state = (await eventually(() => send({ type: 'GET_TAB_STATE', tabId }), value => value.data?.status === 'completed', '1,340-node Codex fixture did not complete', 30_000)).data;
  assert.equal(state.discovered, 1340); assert.equal(state.translated, 1340); assert.equal(state.failed, 0); assert.equal(state.inFlight, 0);
  assert.equal(await onPage(() => [...document.querySelectorAll('p')].every(node => node.textContent.startsWith('Codex QA: '))), true);
  const requestsAfter = await onGuide(() => (window.wrappedJSObject ?? window).__linguistyCodexQa.responses);
  assert.ok(requestsAfter > requestsBefore); assert.ok(requestsAfter - requestsBefore <= 85, 'Unexpected recovery requests');
  await send({ type: 'SET_DISPLAY_MODE', tabId, mode: 'original' });
  assert.equal((await send({ type: 'START_TRANSLATION', tabId })).ok, true);
  const cached = (await eventually(() => send({ type: 'GET_TAB_STATE', tabId }), value => value.data?.status === 'completed', 'Large-page cache repeat did not complete', 30_000)).data;
  assert.equal(cached.fromCache, 1340); assert.equal(cached.inFlight, 0);
  assert.equal(await onGuide(() => (window.wrappedJSObject ?? window).__linguistyCodexQa.responses), requestsAfter);

  await send({ type: 'SET_DISPLAY_MODE', tabId, mode: 'original' });
  const cacheBeforeError = (await send({ type: 'GET_CACHE_STATS' })).data.entries;
  await onGuide(() => { (window.wrappedJSObject ?? window).__linguistyCodexQa.completed = false; });
  await onPage(() => { const node = document.createElement('p'); node.textContent = 'Subscription incomplete output fixture'; document.body.replaceChildren(node); });
  assert.equal((await send({ type: 'START_TRANSLATION', tabId })).ok, true);
  const failed = (await eventually(() => send({ type: 'GET_TAB_STATE', tabId }), value => value.data?.status === 'error', 'Incomplete Responses fixture was accepted', 10_000)).data;
  assert.equal(failed.translated, 0); assert.equal(failed.failed, 1); assert.equal(failed.inFlight, 0);
  assert.equal(failed.error.code, 'INVALID_MODEL_RESPONSE'); assert.ok(failed.error.message.endsWith('[LGT-response-completion]'));
  assert.equal(await onPage(() => document.querySelector('p').textContent), 'Subscription incomplete output fixture');
  assert.equal((await send({ type: 'GET_CACHE_STATS' })).data.entries, cacheBeforeError);
  await onGuide(() => { (window.wrappedJSObject ?? window).__linguistyCodexQa.completed = true; });
  await onGuide(() => { (window.wrappedJSObject ?? window).__linguistyCodexQa.emptyOutput = true; });
  await onPage(() => { const node = document.createElement('p'); node.textContent = 'Subscription empty completed output fixture'; document.body.replaceChildren(node); });
  assert.equal((await send({ type: 'START_TRANSLATION', tabId })).ok, true);
  const empty = (await eventually(() => send({ type: 'GET_TAB_STATE', tabId }), value => value.data?.status === 'error', 'Empty completed output was accepted', 10_000)).data;
  assert.equal(empty.translated, 0); assert.equal(empty.failed, 1); assert.equal(empty.inFlight, 0);
  assert.equal(empty.error.code, 'INVALID_MODEL_RESPONSE'); assert.ok(empty.error.message.endsWith('[LGT-response-empty]'));
  assert.equal(await onPage(() => document.querySelector('p').textContent), 'Subscription empty completed output fixture');
  assert.equal((await send({ type: 'GET_CACHE_STATS' })).data.entries, cacheBeforeError);
  await onGuide(() => { (window.wrappedJSObject ?? window).__linguistyCodexQa.emptyOutput = false; });
  return { nodes: state.translated, requests: requestsAfter - requestsBefore, cached: cached.fromCache,
    failureReference: failed.error.message, emptyFailureReference: empty.error.message, pending: empty.inFlight };
}
