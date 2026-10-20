/** @spec spec://modules/platform/INFRA-003-local-cli#acceptance */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import { launchIsolatedChromium } from './browser-runtime.mjs';
import { startLocalServer } from './local-server.mjs';
import { nativeFixture, nativeChromePackage, powershell } from './native-fixture.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const providers = ['codex-cli', 'claude-code', 'antigravity-cli', 'grok-build'];
test('Chrome package: native installation/status and four keyless CLI page translations', { timeout: 90000 }, async () => {
  let runtime, restore, server, testPackage;
  const chromeManifest = path.join(process.env.LOCALAPPDATA, 'Linguisty/native-host/globalThis.chrome.json');
  const previousManifest = await readFile(chromeManifest).catch(() => null);
  const report = { checks: [], limitations: ['CLI page responses are deterministic native-host fixtures; real models/accounts are not checked.', 'Chrome transport uses an isolated copy with nativeMessaging as a required permission because headless cannot approve its native bubble. JavaScript/assets are unchanged. Production optional permission and toolbar approval remain manual checks.'] };
  try {
    testPackage = await nativeChromePackage();
    runtime = await launchIsolatedChromium(testPackage.directory);
    server = await startLocalServer();
    report.runtime = runtime.metadata;
    const context = runtime.context;
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).hostname;
    report.extensionId = extensionId;
    const installed = await powershell(path.join(root, 'native-host/install.ps1'), ['-ChromeId', extensionId]);
    assert.match(installed.stdout, /installed/);
    const options = await context.newPage();
    await options.goto('chrome-extension://' + extensionId + '/options.html');
    const send = payload => options.evaluate(p => globalThis.chrome.runtime.sendMessage({ channel: 'linguisty', ...p }), payload);
    const settings = (await send({ type: 'GET_SETTINGS' })).data;
    await options.evaluate(async s => { await globalThis.chrome.storage.local.set({ 'linguisty.settings': { ...s, uiLanguage: 'ru', targetLanguage: 'ru', targetLanguageMode: 'manual' } }); localStorage.setItem('linguisty.uiLanguage', 'ru'); }, settings);
    await options.reload();
    report.nativePermission = await options.evaluate(() => globalThis.chrome.permissions.contains({ permissions: ['nativeMessaging'] }));
    assert.equal(report.nativePermission, true, 'Isolated transport fixture has no native permission.');
    await options.locator('#providerId').selectOption('codex-cli');
    await options.getByRole('button', { name: 'Проверить подключение' }).click();
    await expect(options.getByText('Соединитель подключён, CLI найден. Вход в аккаунт и ответ модели не проверялись.')).toBeVisible({ timeout: 10000 });
    report.checks.push('Installed connector and actual Codex binary found through real native messaging without inference.');
    for (const providerId of ['codex-cli', 'grok-build']) {
      const status = await send({ type: 'TEST_CONNECTION', settings: { ...settings, providerId, model: 'default' } });
      assert.equal(status.ok, true, status.error?.code); assert.match(status.data.message, /не проверялись/);
    }
    for (const providerId of ['claude-code', 'antigravity-cli']) {
      const status = await send({ type: 'TEST_CONNECTION', settings: { ...settings, providerId, model: 'default' } });
      report.checks.push(providerId + ' real presence check: ' + (status.ok ? 'found' : status.error.code));
    }
    await new Promise(resolve => setTimeout(resolve, 200)); // production idle host closes before registry swap
    restore = await nativeFixture('chrome', extensionId);
    const management = await context.newPage();
    await management.goto('chrome://extensions');
    await management.evaluate(async id => globalThis.chrome.developerPrivate.addHostPermission(id, 'http://127.0.0.1/*'), extensionId);
    await management.close();
    assert.equal(await options.evaluate(() => globalThis.chrome.permissions.request({ origins: ['http://127.0.0.1/*'] })), true);
    const page = await context.newPage();
    await page.goto(server.origin + '/real-estate.html');
    const tabId = await options.evaluate(async url => (await globalThis.chrome.tabs.query({})).find(t => t.url === url)?.id, page.url());
    assert.equal(typeof tabId, 'number');
    const original = await page.locator('h1').textContent();
    assert.equal((await send({ type: 'GET_SECRET_STATUS' })).data.hasKey, false);
    for (const providerId of providers) {
      const save = await send({ type: 'SAVE_SETTINGS', settings: { ...settings, providerId, model: 'default', targetLanguage: 'ru', targetLanguageMode: 'manual', uiLanguage: 'ru', streaming: false, concurrency: 1 } });
      assert.equal(save.ok, true, save.error?.code);
      assert.equal((await send({ type: 'START_TRANSLATION', tabId })).ok, true);
      await expect.poll(async () => (await send({ type: 'GET_TAB_STATE', tabId })).data.status, { timeout: 10000 }).toBe('completed');
      await expect(page.locator('h1')).toHaveText('CLI: ' + original);
      await send({ type: 'SET_DISPLAY_MODE', tabId, mode: 'original' });
      await expect(page.locator('h1')).toHaveText(original);
      report.checks.push(providerId + ': keyless native translation and original restore.');
    }
    await options.reload();
    await options.locator('#providerId').selectOption('grok-build');
    await expect(options.locator('#apiKey')).toHaveCount(0);
    await options.screenshot({ path: path.join(await artifactDirectory(), 'cli-options.png'), fullPage: true });
    report.checks.push('CLI setup UI rendered; API key field absent.');
  } finally {
    await runtime?.cleanup();
    await restore?.();
    if (previousManifest) await writeFile(chromeManifest, previousManifest);
    await server?.close();
    await testPackage?.cleanup();
    await writeFile(path.join(await artifactDirectory(), 'globalThis.chrome.json'), JSON.stringify(report, null, 2));
  }
});
async function artifactDirectory() {
  const directory = path.join(root, 'test-results/linguisty-native');
  await mkdir(directory, { recursive: true }); return directory;
}
