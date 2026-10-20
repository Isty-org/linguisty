/** @spec spec://modules/interface/FEAT-003-controls#acceptance */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { test } from 'node:test';
import { expect } from '@playwright/test';
import { launchIsolatedChromium } from '../e2e/browser-runtime.mjs';
import { MOCK_KEY, startLocalServer } from '../e2e/local-server.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = path.join(projectRoot, 'test-results/linguisty-ui');

test('WI-007 packaged UI: connection, models, themes, narrow layout, progress, modes and cache', { timeout: 60_000 }, async () => {
  const server = await startLocalServer();
  let runtime;
  const pageErrors = [];
  const observations = {
    checks: [],
    limitations: ['Chromium only; loopback permission pre-granted in an isolated profile. Native permission approval and toolbar activeTab gesture are separate checks.', 'Local mock responses do not establish real provider access or translation quality.'],
  };
  try {
    runtime = await launchIsolatedChromium(path.join(projectRoot, '.output/chrome-mv3'));
    observations.runtime = runtime.metadata;
    const { context } = runtime;
    context.on('page', page => page.on('pageerror', error => pageErrors.push(error.name)));
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15_000 });
    const extensionId = new URL(worker.url()).hostname;
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    // Russian selectors are an explicit fixture preference, independent of new-profile defaults.
    await options.evaluate(async () => {
      const key = 'linguisty.settings';
      const stored = (await globalThis.chrome.storage.local.get(key))[key] ?? {};
      await globalThis.chrome.storage.local.set({ [key]: { ...stored, uiLanguage: 'ru', targetLanguage: 'ru', targetLanguageMode: 'manual' } });
      localStorage.setItem('linguisty.uiLanguage', 'ru');
    });
    await options.reload();
    await expect(options.locator('#providerId')).toBeVisible();
    const management = await context.newPage();
    try {
      await management.goto('chrome://extensions');
      await management.evaluate(async id => globalThis.chrome.developerPrivate.addHostPermission(id, 'http://127.0.0.1/*'), extensionId);
    } finally { await management.close(); }

    await options.locator('#providerId').selectOption('openai-compatible');
    await options.locator('#baseUrl').fill(`${server.origin}/v1`);
    await options.locator('#apiKey').fill(MOCK_KEY);
    await options.locator('#model').fill('qa/mock-model');
    const save = options.getByRole('button', { name: 'Сохранить настройки', exact: true });
    async function persist(expected) {
      await save.click();
      await expect.poll(async () => {
        const result = await options.evaluate(() => globalThis.chrome.runtime.sendMessage({ channel: 'linguisty', type: 'GET_SETTINGS' }));
        assert.equal(result.ok, true);
        return result.data;
      }).toMatchObject(expected);
      await expect(options.getByRole('status').filter({ hasText: 'Настройки сохранены. Linguisty готов к переводу.' })).toBeVisible();
      await expect(options.locator('form')).toHaveAttribute('aria-busy', 'false');
      await expect(save).toBeEnabled();
    }
    await persist({ providerId: 'openai-compatible', model: 'qa/mock-model' });
    await expect(options.locator('#apiKey')).toHaveValue('');
    assert.equal((await options.content()).includes(MOCK_KEY), false);

    await options.getByRole('button', { name: 'Загрузить список моделей', exact: true }).click();
    await expect(options.locator('#model-search')).toBeVisible();
    await options.locator('#model-search').fill('qa/mock');
    await options.getByRole('button', { name: 'Local QA Mock qa/mock-model', exact: true }).click();
    await expect(options.locator('#model')).toHaveValue('qa/mock-model');
    await options.getByRole('button', { name: 'Проверить подключение', exact: true }).click();
    await expect(options.locator('.form-feedback .notice-success')).toBeVisible();
    await expect(options.locator('form')).toHaveAttribute('aria-busy', 'false');
    await expect(save).toBeEnabled();
    assert.ok(server.requests.length > 0 && server.requests.every(request => request.authorized && !request.keyInBody));
    observations.checks.push('Actual options save, blank password, model discovery/search/selection and connection test through loopback.');

    await mkdir(artifacts, { recursive: true });
    for (const theme of ['light', 'dark']) {
      await options.locator('#theme').selectOption(theme);
      await persist({ theme });
      await expect(options.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(save).toBeEnabled();
      await options.evaluate(() => window.scrollTo(0, 0));
      await options.screenshot({ path: path.join(artifacts, `options-${theme}-desktop.png`), animations: 'disabled' });
      await options.setViewportSize({ width: 390, height: 844 });
      await options.evaluate(() => window.scrollTo(0, 0));
      assert.equal(await options.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await options.locator('button,input,select,textarea').evaluateAll(elements => elements.every(element => {
        // A compact checkbox's whole native label is its clickable target.
        const target = element.matches('input[type="checkbox"]') ? element.labels?.[0] : element;
        return !!target && target.getBoundingClientRect().height >= 44;
      })), true);
      const checkbox = options.getByRole('checkbox', { name: 'Показывать перевод постепенно' });
      const checked = await checkbox.isChecked();
      await options.locator('label.checkbox-field').click({ position: { x: 120, y: 22 } });
      assert.equal(await checkbox.isChecked(), !checked);
      await options.locator('label.checkbox-field').click({ position: { x: 120, y: 22 } });
      assert.equal(await checkbox.isChecked(), checked);
      await options.screenshot({ path: path.join(artifacts, `options-${theme}-mobile.png`), animations: 'disabled' });
      await options.setViewportSize({ width: 1280, height: 800 });
    }
    await options.setViewportSize({ width: 320, height: 800 });
    assert.equal(await options.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await options.locator('#providerId').focus();
    await options.keyboard.press('Tab');
    assert.equal(await options.locator('#baseUrl').evaluate(element => element === document.activeElement), true);
    assert.equal(await options.locator('#baseUrl').evaluate(element => getComputedStyle(element).outlineWidth), '2px');
    await options.locator('#theme').selectOption('system');
    await options.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await expect(options.locator('html')).toHaveAttribute('data-theme', 'dark');
    assert.equal(await save.evaluate(element => getComputedStyle(element).transitionDuration), '0s');
    await options.emulateMedia({ colorScheme: 'light' });
    await expect(options.locator('html')).toHaveAttribute('data-theme', 'light');
    observations.checks.push('Light/dark screenshots; 390px and 320px layout without horizontal overflow; all controls >=44px; keyboard focus ring; system changes and reduced motion.');

    await options.locator('#theme').selectOption('light');
    await persist({ theme: 'light' });
    const fixture = await context.newPage();
    await fixture.goto(`${server.origin}/real-estate.html`);
    async function popup() {
      await fixture.bringToFront();
      const opened = context.waitForEvent('page', { timeout: 10_000 });
      await options.evaluate(url => globalThis.chrome.tabs.create({ url, active: false }), `chrome-extension://${extensionId}/popup.html`);
      const page = await opened;
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('.language-grid')).toBeVisible();
      await page.setViewportSize({ width: 390, height: 800 });
      return page;
    }
    let controls = await popup();
    await controls.locator('body').screenshot({ path: path.join(artifacts, 'popup-light-idle.png'), animations: 'disabled' });
    await controls.getByRole('button', { name: 'Перевести страницу', exact: true }).click();
    await expect(fixture.locator('#listing-title')).toHaveText('Светлая квартира в Лионе');
    await expect(controls.getByRole('heading', { name: 'Перевод завершён', exact: true })).toBeVisible();
    await controls.locator('body').screenshot({ path: path.join(artifacts, 'popup-light-completed.png'), animations: 'disabled' });
    await controls.close();
    await options.locator('#theme').selectOption('dark');
    await persist({ theme: 'dark' });
    controls = await popup();
    await expect(controls.getByRole('heading', { name: 'Перевод завершён', exact: true })).toBeVisible();
    await expect(controls.locator('html')).toHaveAttribute('data-theme', 'dark');
    await controls.locator('body').screenshot({ path: path.join(artifacts, 'popup-dark-completed.png'), animations: 'disabled' });
    assert.equal(await controls.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    observations.checks.push('Packaged popup at 390px, real progress and completed status restored after reopening, light/dark.');
    await controls.close();

    await options.getByRole('button', { name: 'Обновить статистику', exact: true }).click();
    await expect(save).toBeEnabled();
    assert.ok(Number(await options.locator('.cache-stats dd').first().textContent()) > 0);
    await options.getByRole('button', { name: 'Очистить кэш переводов', exact: true }).click();
    await expect(options.locator('.cache-stats dd').first()).toHaveText('0');
    await expect(fixture.locator('#listing-title')).toHaveText('Светлая квартира в Лионе');
    await expect(save).toBeEnabled();
    await options.locator('#keyMode').selectOption('persistent');
    await persist({ keyMode: 'persistent' });
    const status = await options.evaluate(() => globalThis.chrome.runtime.sendMessage({ channel: 'linguisty', type: 'GET_SECRET_STATUS' }));
    assert.deepEqual(status, { ok: true, data: { hasKey: true, mode: 'persistent' } });
    await options.getByRole('button', { name: 'Удалить сохранённый ключ', exact: true }).click();
    await expect(options.getByText('Сохранённый ключ удалён.', { exact: true })).toBeVisible();
    await expect(options.locator('#apiKey')).toHaveValue('');
    observations.checks.push('Actual cache refresh/clear preserving the displayed translation; existing key mode migration and explicit key removal.');
    assert.deepEqual(pageErrors, []);
    observations.pageErrors = pageErrors.length;
    observations.provider = server.metrics();
    observations.ok = true;
  } catch (error) {
    observations.ok = false;
    observations.failure = error instanceof Error ? error.message.replaceAll(MOCK_KEY, '[test credential]') : 'Unknown failure';
    throw error;
  } finally {
    try { await runtime?.cleanup(); observations.isolatedProfileRemoved = true; }
    finally { await server.close(); observations.localServerClosed = true; }
    await mkdir(artifacts, { recursive: true });
    await writeFile(path.join(artifacts, 'observations.json'), JSON.stringify(observations, null, 2));
  }
});
