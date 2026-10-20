/** @spec spec://modules/platform/INFRA-004-codex-connection#changelog */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { expect } from '@playwright/test';
import { launchIsolatedChromium } from './browser-runtime.mjs';
import { startLocalServer } from './local-server.mjs';
import { codexFixture, installCodexFixture } from './codex-fixture.mjs';
import { codexTranslationScenario } from './codex-translation-scenario.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = path.join(root, 'test-results/linguisty-response-stream');
test('ChatGPT subscription: unchanged Chrome package, 16 languages, callback, safe port and translation', { timeout: 120_000 }, async () => {
  const report = { checks: [], limitations: ['OpenAI responses and issued identity are generated fixtures; live OAuth, account eligibility and model quality remain unverified.', 'Optional origin access is pregranted in an isolated test browser. Store installation prompts and toolbar geometry remain unverified.'] };
  let runtime, server;
  try {
    await mkdir(artifacts, { recursive: true }); runtime = await launchIsolatedChromium(path.join(root, '.output/chrome-mv3')); server = await startLocalServer();
    report.runtime = runtime.metadata; const { context } = runtime;
    const errors = []; context.on('page', page => page.on('pageerror', error => errors.push(error.name)));
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker'); const id = new URL(worker.url()).hostname;
    const options = await context.newPage(); await options.goto(`chrome-extension://${id}/options.html`);
    const send = async payload => options.evaluate(message => globalThis.chrome.runtime.sendMessage({ channel: 'linguisty', ...message }), payload);
    const initial = (await send({ type: 'GET_SETTINGS' })).data;
    await options.evaluate(async settings => { await globalThis.chrome.storage.local.set({ 'linguisty.settings': { ...settings, uiLanguage: 'ru', targetLanguage: 'ru', targetLanguageMode: 'manual' } }); localStorage.setItem('linguisty.uiLanguage', 'ru'); }, initial);
    await options.reload(); await expect(options.locator('#providerId')).toBeVisible();
    assert.deepEqual(await options.locator('#providerId option').evaluateAll(items => items.map(item => item.value)), ['openrouter', 'openai-compatible', 'codex']);
    const management = await context.newPage(); await management.goto('chrome://extensions');
    for (const origin of ['https://auth.openai.com/*', 'https://api.openai.com/*', 'http://127.0.0.1/*']) {
      await management.evaluate(async ({ id, origin }) => globalThis.chrome.developerPrivate.addHostPermission(id, origin), { id, origin });
    }
    await management.close(); await options.locator('#providerId').selectOption('codex');
    await expect(options.locator('#apiKey')).toHaveCount(0); const guideOpened = context.waitForEvent('page', { timeout: 10_000 });
    await options.getByRole('button', { name: 'Подключить ChatGPT' }).click(); const guide = await guideOpened;
    assert.ok(guide); await guide.waitForLoadState('domcontentloaded'); await expect(guide.locator('.codex-steps li')).toHaveCount(4);
    const localeChecks = [];
    const callbackPage = await context.newPage();
    await guide.setViewportSize({ width: 360, height: 800 });
    for (const locale of ['en', 'ru', 'uk', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'tr', 'ja', 'ko', 'zh-CN', 'zh-TW', 'ar', 'hi']) {
      await options.evaluate(async locale => {
        const settings = (await globalThis.chrome.storage.local.get('linguisty.settings'))['linguisty.settings'];
        await globalThis.chrome.storage.local.set({ 'linguisty.settings': { ...settings, uiLanguage: locale } });
        localStorage.setItem('linguisty.uiLanguage', locale);
      }, locale);
      await options.reload(); await expect(options.locator('#providerId')).toBeVisible();
      const label = await options.locator('#providerId option[value="codex"]').textContent();
      assert.ok(label.includes('ChatGPT') && !label.includes('Codex'));
      await guide.reload(); await expect(guide.locator('.codex-steps li')).toHaveCount(4);
      await expect(guide.locator('html')).toHaveAttribute('lang', locale);
      await expect(guide.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      assert.equal(await guide.locator('#codex-status-title').textContent(), label);
      assert.equal(await guide.evaluate(() => document.body.textContent.includes('Codex')), false);
      assert.equal(await guide.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, locale + ' overflow');
      await callbackPage.goto(`chrome-extension://${id}/codex-callback.html`);
      await expect(callbackPage.locator('html')).toHaveAttribute('lang', locale);
      assert.equal(await callbackPage.locator('h1').textContent(), 'Linguisty · ' + label);
      await expect(callbackPage.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      const returning = await callbackPage.locator('#status').textContent();
      if (locale !== 'en') assert.notEqual(returning, 'Returning to Linguisty…');
      if (['en', 'ru', 'ar'].includes(locale)) await guide.screenshot({ path: path.join(artifacts, `chrome-guide-${locale}-mobile.png`), fullPage: true });
      localeChecks.push({ locale, label, returning });
    }
    await callbackPage.close(); report.localeChecks = localeChecks;
    report.checks.push('All 16 languages: subscription selector/header, four steps, no Codex label, 360px layout, localized OAuth return and Arabic RTL.');
    await options.evaluate(async () => {
      const settings = (await globalThis.chrome.storage.local.get('linguisty.settings'))['linguisty.settings'];
      await globalThis.chrome.storage.local.set({ 'linguisty.settings': { ...settings, uiLanguage: 'ru' } }); localStorage.setItem('linguisty.uiLanguage', 'ru');
    });
    await options.reload(); await expect(options.locator('#providerId')).toBeVisible();
    await guide.reload(); await expect(guide.locator('.codex-steps li')).toHaveCount(4);
    await guide.setViewportSize({ width: 1280, height: 800 });
    await guide.screenshot({ path: path.join(artifacts, 'chrome-guide-before.png'), fullPage: true });
    await guide.evaluate(installCodexFixture, { ...codexFixture, webCallback: true });
    // @spec spec://modules/platform/INFRA-004-codex-connection#auth
    // A real form navigation from the OpenAI origin exercises the web initiator.
    // The response is local fixture HTML; no OpenAI account or network is used.
    await context.route('https://auth.openai.com/api/accounts/authorize?*', async route => {
      const callback = new URL(await guide.evaluate(() => globalThis.__linguistyCodexQa.pendingCallback));
      await route.fulfill({ contentType: 'text/html',
        body: `<form action="http://127.0.0.1:1455/auth/callback">${[...callback.searchParams].map(([name, value]) => `<input type="hidden" name="${name}" value="${value}">`).join('')}<button>Continue</button></form>` });
    });
    async function signIn(button) {
      await guide.getByRole('button', { name: button, exact: true }).click();
      await expect.poll(() => context.pages().some(page => page.url().startsWith('https://auth.openai.com/'))).toBe(true);
      const authPage = context.pages().find(page => page.url().startsWith('https://auth.openai.com/'));
      await authPage.getByRole('button', { name: 'Continue', exact: true }).click({ noWaitAfter: true });
    }
    await signIn('Войти через ChatGPT');
    try { await expect(guide.getByText('Вход подтверждён, список моделей доступен. Ответ модели не проверялся.')).toBeVisible({ timeout: 15_000 }); }
    catch (error) {
      report.fixtureCounts = await guide.evaluate(() => globalThis.__linguistyCodexQa);
      report.tabPaths = context.pages().map(page => page.url().split(/[?#]/)[0]);
      report.ruleTargets = await guide.evaluate(async () => (await globalThis.chrome.declarativeNetRequest.getSessionRules()).map(rule => ({ tabIds: rule.condition.tabIds, excluded: rule.condition.excludedTabIds })));
      throw error;
    }
    assert.equal((await send({ type: 'GET_CODEX_STATUS' })).data.connected, true);
    assert.deepEqual(await guide.evaluate(() => globalThis.chrome.declarativeNetRequest.getSessionRules()), []);
    const secretPersisted = await guide.evaluate(async () => {
      const data = JSON.stringify([await globalThis.chrome.storage.local.get(null), await globalThis.chrome.storage.session.get(null), { ...localStorage }]);
      return ['qa-access', 'qa-refresh', 'id_token', 'qa@example.test'].some(value => data.includes(value));
    });
    assert.equal(secretPersisted, false); report.checks.push('Codex dropdown/button, four steps, PKCE/RSA fixture login, form navigation from auth.openai.com, exact browser callback redirect, rule cleanup and no persisted tokens.');
    await guide.getByRole('button', { name: 'Вернуться в настройки' }).first().click();
    await options.getByRole('button', { name: 'Подключить ChatGPT' }).click();
    await expect(options.getByRole('button', { name: 'Подключить ChatGPT' })).toBeEnabled();
    assert.equal(context.pages().filter(page => page.url().endsWith('/codex.html')).length, 1); assert.equal((await send({ type: 'GET_CODEX_STATUS' })).data.connected, true);
    report.checks.push('Return to settings and repeated open preserve one connected guide tab.');
    const page = await context.newPage(); await page.goto(server.origin + '/real-estate.html'); const original = await page.locator('h1').textContent();
    const tabId = await options.evaluate(async url => (await globalThis.chrome.tabs.query({})).find(tab => tab.url === url)?.id, page.url());
    const started = await send({ type: 'START_TRANSLATION', tabId });
    if (!started.ok) { report.fixtureCounts = await guide.evaluate(() => globalThis.__linguistyCodexQa);
      report.extensionPages = context.pages().map(item => item.url()).filter(url => url.startsWith('chrome-extension:'));
    }
    assert.equal(started.ok, true, started.error?.code);
    await expect.poll(async () => (await send({ type: 'GET_TAB_STATE', tabId })).data?.status, { timeout: 15_000 }).toBe('completed');
    await expect(page.locator('h1')).toHaveText('Codex QA: ' + original);
    await send({ type: 'SET_DISPLAY_MODE', tabId, mode: 'original' }); await expect(page.locator('h1')).toHaveText(original);
    report.checks.push('Background → connection page → Responses fixture → strict parser → real page text, original restore.');
    const requestsBeforeCache = await guide.evaluate(() => globalThis.__linguistyCodexQa.responses);
    assert.equal((await send({ type: 'START_TRANSLATION', tabId })).ok, true);
    await expect.poll(async () => (await send({ type: 'GET_TAB_STATE', tabId })).data?.status).toBe('completed');
    assert.equal(await guide.evaluate(() => globalThis.__linguistyCodexQa.responses), requestsBeforeCache);
    await send({ type: 'SET_DISPLAY_MODE', tabId, mode: 'original' });
    await guide.evaluate(() => globalThis.__linguistyCodexQaSwitchAccount('qa-other-account'));
    await signIn('Войти в другой аккаунт');
    await expect.poll(() => guide.evaluate(() => globalThis.__linguistyCodexQa.token)).toBe(2);
    await expect(guide.getByText('Вход подтверждён, список моделей доступен. Ответ модели не проверялся.')).toBeVisible();
    assert.equal((await send({ type: 'START_TRANSLATION', tabId })).ok, true);
    await expect.poll(async () => (await send({ type: 'GET_TAB_STATE', tabId })).data?.status).toBe('completed');
    assert.equal(await guide.evaluate(() => globalThis.__linguistyCodexQa.responses), requestsBeforeCache + 1);
    report.checks.push('Same-account repeat uses the persistent cache; a different verified account requests a new translation.');
    report.largePage = await codexTranslationScenario({ send, tabId, onPage: fn => page.evaluate(fn), onGuide: fn => guide.evaluate(fn) });
    report.checks.push('Luna 6 schema and completed stream items with an empty terminal output; 1,340 nodes, cache-only repeat, incomplete/empty replies rejected with safe codes and no cache writes.');
    await guide.setViewportSize({ width: 360, height: 800 }); await guide.screenshot({ path: path.join(artifacts, 'chrome-guide-connected-mobile.png'), fullPage: true });
    assert.equal(await guide.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await guide.getByRole('button', { name: 'Отключить ChatGPT', exact: true }).click(); await expect(guide.getByText('ChatGPT отключён, разрешение отозвано в OpenAI.')).toBeVisible();
    assert.equal((await send({ type: 'GET_CODEX_STATUS' })).data.connected, false);
    // @spec spec://modules/platform/INFRA-004-codex-connection#auth
    await guide.evaluate(() => { globalThis.__linguistyCodexQa.invalidNonce = true; });
    await signIn('Войти через ChatGPT');
    await expect(guide.locator('.notice-error')).toContainText('[LGT-identity-nonce]');
    assert.equal(await guide.evaluate(() => ['qa-private', 'qa-access', 'qa-refresh', 'qa@example.test'].some(value => document.body.textContent.includes(value))), false);
    assert.equal(await guide.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal((await send({ type: 'GET_CODEX_STATUS' })).data.connected, false);
    assert.deepEqual(await guide.evaluate(() => globalThis.chrome.declarativeNetRequest.getSessionRules()), []);
    await guide.screenshot({ path: path.join(artifacts, 'chrome-guide-safe-error.png'), fullPage: true });
    report.checks.push('Single-element ID-token audience works; invalid nonce shows only a fixed diagnostic code at 360px and leaves no connection or callback rule.');
    report.fixtureCounts = await guide.evaluate(() => globalThis.__linguistyCodexQa); assert.equal(report.fixtureCounts.unexpected, 0);
    await guide.close(); assert.equal((await send({ type: 'START_TRANSLATION', tabId })).error?.code, 'CODEX_NOT_CONNECTED');
    report.checks.push('Narrow layout, revoke fixture, closed-tab detection and safe reconnect error.'); assert.deepEqual(errors, []);
  } catch (error) { report.failure = error.message; throw error; }
  finally { await runtime?.cleanup(); await server?.close(); report.memoryAfterClose = process.memoryUsage(); await writeFile(path.join(artifacts, 'chrome.json'), JSON.stringify(report, null, 2)); }
});
