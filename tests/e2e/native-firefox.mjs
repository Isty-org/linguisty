/** @spec spec://modules/platform/INFRA-003-local-cli#acceptance */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { launchIsolatedFirefox, eventually, pause } from './firefox-runtime.mjs';
import { startLocalServer } from './local-server.mjs';
import { nativeFixture, powershell } from './native-fixture.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const artifact = path.join(root, 'test-results/linguisty-native');
const report = { checks: [], limitations: ['Production Firefox package is unchanged; headless permission button is clicked in privileged test-browser scope.', 'Translations are native-host fixtures; no real model or account verification.', 'Temporary install does not check signing, data consent or physical toolbar invocation.'] };
let runtime, server, restore;
try {
  await mkdir(artifact, { recursive: true });
  await powershell(path.join(root, 'native-host/install.ps1'), ['-FirefoxOnly']);
  runtime = await launchIsolatedFirefox({ projectRoot: root, extensionPath: path.join(root, '.output/firefox-mv3'), artifactRoot: artifact });
  report.runtime = runtime.metadata;
  server = await startLocalServer();
  const options = await runtime.open(runtime.metadata.extensionOrigin + '/options.html');
  async function send(payload) {
    await runtime.switchTo(options);
    return runtime.executeAsync('const done=arguments[arguments.length-1];browser.runtime.sendMessage({channel:"linguisty",...arguments[0]}).then(done,e=>done({transportError:e.name}));', [payload]);
  }
  const settings = (await send({ type: 'GET_SETTINGS' })).data;
  await runtime.executeAsync('const done=arguments[arguments.length-1];browser.storage.local.set({"linguisty.settings":{...arguments[0],uiLanguage:"ru",targetLanguage:"ru",targetLanguageMode:"manual"}}).then(()=>{localStorage.setItem("linguisty.uiLanguage","ru");done(true)});', [settings]);
  await runtime.command('POST', '/refresh', {});
  await eventually(() => runtime.execute('return !!document.getElementById("providerId");'), Boolean, 'Settings form absent');
  async function nativePermission() {
    await eventually(() => runtime.execute('return PopupNotifications.panel.state === "open" && !!document.getElementById("addon-webext-permissions-notification");', [], 'chrome'), Boolean, 'Native permission prompt absent');
    await pause(750);
    await runtime.execute('document.getElementById("addon-webext-permissions-notification").button.click();', [], 'chrome');
  }
  await runtime.click('#providerId option[value="codex-cli"]');
  await runtime.click('button[type="submit"]');
  await nativePermission();
  await eventually(() => send({ type: 'GET_SETTINGS' }), r => r.data?.providerId === 'codex-cli', 'CLI settings did not save');
  assert.equal((await send({ type: 'GET_SECRET_STATUS' })).data.hasKey, false);
  for (const providerId of ['codex-cli', 'grok-build']) {
    const status = await send({ type: 'TEST_CONNECTION', settings: { ...settings, providerId, model: 'default' } });
    assert.equal(status.ok, true, status.error?.code); assert.match(status.data.message, /не проверялись/);
  }
  report.checks.push('Actual optional nativeMessaging permission accepted; keyless save and real Codex/Grok presence checks passed without inference.');
  await pause(250);
  restore = await nativeFixture('firefox', 'linguisty@isty.local');
  await runtime.switchTo(options);
  await runtime.execute('const button=document.createElement("button");button.id="qa-loopback";button.textContent="QA grant";button.onclick=()=>browser.permissions.request({origins:["http://127.0.0.1/*"]});document.body.append(button);');
  await runtime.click('#qa-loopback');
  await nativePermission();
  const url = server.origin + '/real-estate.html';
  const page = await runtime.open(url);
  const original = await runtime.execute('return document.querySelector("h1").textContent;');
  await runtime.switchTo(options);
  const tabId = await runtime.executeAsync('const done=arguments[arguments.length-1];browser.tabs.query({}).then(tabs=>done(tabs.find(t=>t.url===arguments[0])?.id));', [url]);
  assert.equal(typeof tabId, 'number');
  for (const providerId of ['codex-cli', 'claude-code', 'antigravity-cli', 'grok-build']) {
    const saved = await send({ type: 'SAVE_SETTINGS', settings: { ...settings, providerId, model: 'default', targetLanguage: 'ru', targetLanguageMode: 'manual', uiLanguage: 'ru', streaming: false, concurrency: 1 } });
    assert.equal(saved.ok, true, saved.error?.code);
    assert.equal((await send({ type: 'START_TRANSLATION', tabId })).ok, true);
    await eventually(() => send({ type: 'GET_TAB_STATE', tabId }), r => r.data?.status === 'completed', 'CLI page did not complete');
    await runtime.switchTo(page);
    assert.equal(await runtime.execute('return document.querySelector("h1").textContent;'), 'CLI: ' + original);
    await send({ type: 'SET_DISPLAY_MODE', tabId, mode: 'original' });
    await runtime.switchTo(page);
    assert.equal(await runtime.execute('return document.querySelector("h1").textContent;'), original);
    report.checks.push(providerId + ': native page translation and original restore.');
  }
  report.memory = await runtime.sampleMemory('native-checks-completed');
  console.log('Firefox native checks passed: ' + report.checks.length);
} catch (error) {
  report.failure = error.message;
  process.exitCode = 1; console.error(error);
} finally {
  if (runtime) report.cleanup = await runtime.cleanup();
  await restore?.();
  await server?.close();
  await writeFile(path.join(artifact, 'firefox.json'), JSON.stringify(report, null, 2));
}
