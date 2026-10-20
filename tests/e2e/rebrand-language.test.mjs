/** @spec spec://modules/interface/FEAT-003-controls#languages */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { expect } from '@playwright/test';
import { launchIsolatedChromium } from './browser-runtime.mjs';
import { MOCK_KEY, startLocalServer } from './local-server.mjs';
import { eventually, launchIsolatedFirefox, pause } from './firefox-runtime.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = path.join(root, 'test-results/linguisty-rebrand');
const locales = ['en', 'ru', 'uk', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'tr', 'ja', 'ko', 'zh-CN', 'zh-TW', 'ar', 'hi'];

function contrast(first, second) {
  function luminance(hex) {
    const rgb = hex.trim().replace(/^#/, '').match(/../g).map(value => Number.parseInt(value, 16) / 255);
    const [r, g, b] = rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * r + .7152 * g + .0722 * b;
  }
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

/** @spec spec://modules/interface/FEAT-003-controls#design */
test('packaged Retro Orbit UI: auto/manual languages, every locale, RTL, contrast and resources', { timeout: 120_000 }, async () => {
  const server = await startLocalServer();
  let runtime;
  const pageErrors = [];
  const report = { locales: [], themes: [], checks: [], limitations: ['Local loopback mock only; real provider language accuracy and native toolbar popup geometry are not verified here.'] };
  try {
    await mkdir(artifacts, { recursive: true });
    runtime = await launchIsolatedChromium(path.join(root, '.output/chrome-mv3'));
    report.runtime = runtime.metadata;
    const { context } = runtime;
    context.on('page', page => page.on('pageerror', error => pageErrors.push(error.name)));
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).hostname;
    const options = await context.newPage();
    const remoteResources = [];
    options.on('request', request => {
      if (/^https?:/.test(request.url())) remoteResources.push(request.url());
    });
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(options.locator('#providerId')).toBeVisible();
    const send = message => options.evaluate(value => globalThis.chrome.runtime.sendMessage({ channel: 'linguisty', ...value }), message);
    async function settings() { const result = await send({ type: 'GET_SETTINGS' }); assert.equal(result.ok, true); return result.data; }
    const fresh = await settings();
    assert.equal(fresh.targetLanguageMode, 'browser');
    assert.equal(fresh.uiLanguage, 'auto');
    const preferred = await options.evaluate(() => Intl.getCanonicalLocales(navigator.languages[0] ?? navigator.language)[0]);
    assert.equal(fresh.targetLanguage, preferred);
    await expect(options.locator('#targetLanguageSelect')).toHaveValue('__browser__');
    const targetCodes = await options.locator('#targetLanguageSelect option').evaluateAll(nodes => nodes.map(node => node.value));
    assert.ok(targetCodes.length >= 211);
    assert.equal(new Set(targetCodes).size, targetCodes.length);
    assert.equal((await options.locator('#uiLanguage option').count()), 17);
    report.checks.push('Fresh target follows actual Chromium preferred language; independent UI auto; 210 distinct translation choices.');

    const permissions = await context.newPage();
    try {
      await permissions.goto('chrome://extensions');
      await permissions.evaluate(id => globalThis.chrome.developerPrivate.addHostPermission(id, 'http://127.0.0.1/*'), extensionId);
    } finally { await permissions.close(); }
    await options.locator('#providerId').selectOption('openai-compatible');
    await options.locator('#baseUrl').fill(`${server.origin}/v1`);
    await options.locator('#apiKey').fill(MOCK_KEY);
    await options.locator('#model').fill('qa/mock-model');
    await options.locator('button[type="submit"]').click();
    await expect.poll(async () => (await settings()).model).toBe('qa/mock-model');
    await expect(options.locator('#apiKey')).toHaveValue('');
    await expect(options.locator('form')).toHaveAttribute('aria-busy', 'false');
    async function installLanguageTrace() { await options.evaluate(() => {
      const trace = globalThis.__languageQaTrace = [];
      const snapshot = () => ({ target: document.getElementById('targetLanguage')?.value, targetSelect: document.getElementById('targetLanguageSelect')?.value, ui: document.getElementById('uiLanguage')?.value, busy: document.querySelector('form')?.getAttribute('aria-busy'), disabled: document.querySelector('.form-sections')?.disabled });
      for (const type of ['change', 'submit']) document.addEventListener(type, event => {
        if (type === 'submit' || ['targetLanguageSelect', 'uiLanguage'].includes(event.target.id)) trace.push({ event: type, id: event.target.id, time: performance.now(), ...snapshot() });
      }, true);
    }); }

    async function persist(expected) {
      if (expected.targetLanguageMode === 'browser') {
        await expect(options.locator('#targetLanguageSelect')).toHaveValue('__browser__');
        await expect(options.locator('#targetLanguage')).toHaveCount(0);
      }
      await options.locator('button[type="submit"]').click();
      try { await expect.poll(settings).toMatchObject(expected); }
      catch (error) {
        report.lastForm = await options.evaluate(() => ({ target: document.getElementById('targetLanguage')?.value, targetSelect: document.getElementById('targetLanguageSelect')?.value, model: document.getElementById('model')?.value, notice: document.querySelector('.form-feedback')?.textContent }));
        report.trace = await options.evaluate(() => globalThis.__languageQaTrace);
        throw error;
      }
      await expect(options.locator('form')).toHaveAttribute('aria-busy', 'false');
      if (Object.hasOwn(expected, 'targetLanguageMode')) {
        await expect(options.locator('#targetLanguageSelect')).toHaveValue(expected.targetLanguageMode === 'browser' ? '__browser__' : expected.targetLanguage);
      }
      if (Object.hasOwn(expected, 'uiLanguage')) await expect(options.locator('#uiLanguage')).toHaveValue(expected.uiLanguage);
      await expect(options.locator('.form-feedback .notice')).toBeVisible();
    }
    await options.locator('#targetLanguageSelect').selectOption('ru');
    await options.locator('#targetLanguage').fill('sr-Latn-RS');
    await persist({ targetLanguage: 'sr-Latn-RS', targetLanguageMode: 'manual' });
    await options.reload();
    await expect(options.locator('#targetLanguage')).toHaveValue('sr-Latn-RS');
    await installLanguageTrace();
    await options.locator('#uiLanguage').selectOption('en');
    await persist({ uiLanguage: 'en', targetLanguage: 'sr-Latn-RS', targetLanguageMode: 'manual' });
    await expect(options.getByRole('heading', { name: 'Your service. Your language.' })).toBeVisible();
    await options.locator('#targetLanguageSelect').selectOption('__browser__');
    await persist({ targetLanguageMode: 'browser', targetLanguage: preferred });
    for (const uiLanguage of ['ru', 'en', 'ru']) {
      await options.locator('#targetLanguageSelect').selectOption('en');
      await options.locator('#targetLanguage').fill('sr-Latn-RS');
      await options.locator('#uiLanguage').selectOption(uiLanguage);
      await persist({ targetLanguageMode: 'manual', targetLanguage: 'sr-Latn-RS', uiLanguage });
      await options.locator('#targetLanguageSelect').selectOption('__browser__');
      await persist({ targetLanguageMode: 'browser', targetLanguage: preferred, uiLanguage });
    }
    assert.equal((await send({ type: 'GET_SECRET_STATUS' })).data.hasKey, true);
    report.checks.push('Arbitrary sr-Latn-RS survives save/reopen, UI change does not change target, return to browser mode preserves key.');

    for (const locale of locales) {
      await options.locator('#uiLanguage').selectOption(locale);
      await expect(options.locator('html')).toHaveAttribute('lang', locale);
      await expect(options.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      for (const width of [320, 390, 1280]) {
        await options.setViewportSize({ width, height: 900 });
        assert.equal(await options.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${locale} overflow at ${width}px`);
      }
      const labels = await options.locator('label').allTextContents();
      assert.equal(await options.locator('header .linguisty-mark[aria-hidden="true"]').count(), 1);
      assert.equal(await options.locator('header .brand-mark').count(), 0);
      assert.equal(await options.locator('footer .powered-by [role="img"][aria-label="Isty"]').count(), 1);
      const credit = await options.locator('footer .powered-by').textContent();
      assert.ok(credit.trim().length > 0 && !credit.includes('{brand}'));
      assert.equal(credit.includes('Powered by'), locale === 'en', `${locale}: untranslated credit`);
      assert.ok(labels.every(label => label.trim().length > 0), `${locale}: empty label`);
      if (locale !== 'ru') assert.equal(labels.some(label => /[А-Яа-яЁё]/.test(label)), locale === 'uk', `${locale}: unexpected Russian UI label`);
      report.locales.push({ locale, direction: locale === 'ar' ? 'rtl' : 'ltr', widths: [320, 390, 1280] });
    }
    await options.locator('#uiLanguage').selectOption('ru');
    for (const theme of ['light', 'dark']) {
      await options.locator('#theme').selectOption(theme);
      await expect(options.locator('html')).toHaveAttribute('data-theme', theme);
      const logoSource = theme === 'light' ? 'linguisty-monochrome.svg' : 'linguisty-color.svg';
      assert.equal(await options.locator('header .linguisty-mark').evaluate((node, source) => getComputedStyle(node).backgroundImage.includes(source), logoSource), true);
      await options.setViewportSize({ width: 1280, height: 900 });
      await options.evaluate(() => window.scrollTo(0, 0));
      await options.screenshot({ path: path.join(artifacts, `options-${theme}.png`), animations: 'disabled' });
      await options.locator('.options-footer').screenshot({ path: path.join(artifacts, `options-footer-${theme}.png`), animations: 'disabled' });
      const colors = await options.evaluate(() => {
        const css = getComputedStyle(document.documentElement);
        const keys = ['--surface-1', '--text-primary', '--text-secondary', '--text-muted', '--accent-primary-strong', '--success', '--success-soft', '--danger', '--danger-soft'];
        return Object.fromEntries(keys.map(key => [key, css.getPropertyValue(key).trim()]));
      });
      const ratios = Object.fromEntries(['--text-primary', '--text-secondary', '--text-muted', '--accent-primary-strong'].map(key => [key, contrast(colors[key], colors['--surface-1'])]));
      ratios.success = contrast(colors['--success'], colors['--success-soft']);
      ratios.danger = contrast(colors['--danger'], colors['--danger-soft']);
      assert.ok(Object.values(ratios).every(value => value >= 4.5), `${theme}: insufficient text contrast`);
      assert.equal(await options.locator('.brand-mark').evaluate(node => getComputedStyle(node).maskImage.includes('isty-logo.svg')), true);
      report.fonts = await options.evaluate(async () => {
        await document.fonts.ready;
        let loadError;
        try { await document.fonts.load('400 14px Onest'); } catch (error) { loadError = error.name; }
        return { faces: [...document.fonts].map(face => ({ family: face.family, status: face.status })), onest: document.fonts.check('400 14px Onest'), loadError };
      });
      assert.equal(report.fonts.onest, true, `Bundled Onest failed: ${JSON.stringify(report.fonts)}`);
      assert.equal(await options.locator('button,input,select,textarea').evaluateAll(nodes => nodes.every(node => {
        const target = node.matches('input[type="checkbox"]') ? node.labels?.[0] : node;
        return target.getBoundingClientRect().height >= 44;
      })), true);
      report.themes.push({ theme, ratios, logoSource });
    }
    await options.setViewportSize({ width: 390, height: 844 });
    await options.evaluate(() => window.scrollTo(0, 0));
    await options.screenshot({ path: path.join(artifacts, 'options-mobile.png'), animations: 'disabled' });
    await options.locator('#uiLanguage').selectOption('ar');
    await options.screenshot({ path: path.join(artifacts, 'options-arabic.png'), animations: 'disabled' });
    await options.locator('#uiLanguage').selectOption('ru');
    await options.locator('#theme').selectOption('light');
    await persist({ uiLanguage: 'ru', theme: 'light' });
    const fixture = await context.newPage();
    await fixture.goto(`${server.origin}/real-estate.html`);
    await fixture.bringToFront();
    const opened = context.waitForEvent('page');
    await options.evaluate(url => globalThis.chrome.tabs.create({ url, active: false }), `chrome-extension://${extensionId}/popup.html`);
    const popup = await opened;
    await popup.waitForLoadState('domcontentloaded');
    await expect(popup.locator('.language-grid')).toBeVisible();
    assert.equal(await popup.locator('header .linguisty-mark[aria-hidden="true"]').count(), 1);
    assert.equal(await popup.locator('header .linguisty-mark').evaluate(node => getComputedStyle(node).backgroundImage.includes('linguisty-monochrome.svg') && node.getBoundingClientRect().width === 44), true);
    assert.equal(await popup.locator('header .brand-mark').count(), 0);
    await expect(popup.locator('footer .powered-by')).toContainText('Разработано');
    assert.equal(await popup.getByRole('img', { name: 'Isty' }).count(), 1);
    /** @spec spec://common/PROP-001-contracts#messages */
    const latest = { ...await settings(), model: 'qa/popup-latest', theme: 'dark', customInstructions: 'Keep the latest settings.' };
    assert.equal((await send({ type: 'SAVE_SETTINGS', settings: latest })).ok, true);
    await popup.locator('#popup-target').selectOption('de');
    await popup.getByRole('button', { name: 'Перевести страницу', exact: true }).click();
    await expect(popup.getByRole('heading', { name: 'Перевод завершён' })).toBeVisible();
    assert.deepEqual(await settings(), { ...latest, targetLanguage: 'de', targetLanguageMode: 'manual' });
    report.checks.push('A stale packaged popup changes languages without reverting the newer model, theme or instructions.');
    /** @spec spec://modules/interface/FEAT-003-controls#popup */
    report.popupSettings = [];
    for (const [index, locale] of locales.entries()) {
      const theme = index % 2 ? 'dark' : 'light';
      assert.equal((await send({ type: 'SAVE_SETTINGS', settings: { ...await settings(), uiLanguage: locale, theme } })).ok, true);
      await popup.reload();
      await expect(popup.locator('.language-grid')).toBeVisible();
      await expect(popup.locator('html')).toHaveAttribute('lang', locale);
      await expect(popup.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      await expect(popup.locator('html')).toHaveAttribute('data-theme', theme);
      const gear = popup.locator('.popup-settings');
      const name = await gear.getAttribute('aria-label');
      assert.ok(name?.trim());
      await expect(popup.getByRole('button', { name, exact: true })).toHaveCount(1);
      await expect(gear).toHaveAttribute('title', name);
      assert.equal(await gear.textContent(), '');
      assert.equal(await gear.locator('svg[aria-hidden="true"][focusable="false"]').count(), 1);
      for (const width of [320, 390]) {
        await popup.setViewportSize({ width, height: 800 });
        assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.equal(await gear.evaluate(node => { const rect = node.getBoundingClientRect(); return rect.width === 44 && rect.height === 44; }), true);
      }
      report.popupSettings.push({ locale, theme, name });
      if (locale === 'ar' || locale === 'en') await popup.locator('body').screenshot({ path: path.join(artifacts, `popup-gear-${locale}-${theme}.png`), animations: 'disabled' });
    }
    await popup.locator('#popup-source').focus();
    await popup.keyboard.press('Shift+Tab');
    assert.equal(await popup.locator('.popup-settings').evaluate(node => node === document.activeElement && getComputedStyle(node).outlineWidth === '2px'), true);
    const optionsTabId = await options.evaluate(async () => (await globalThis.chrome.tabs.getCurrent()).id);
    const popupTabId = await popup.evaluate(async () => (await globalThis.chrome.tabs.getCurrent()).id);
    const activeTabId = () => popup.evaluate(async () => (await globalThis.chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id);
    await popup.bringToFront();
    await expect.poll(activeTabId).toBe(popupTabId);
    await popup.keyboard.press('Enter');
    await expect.poll(activeTabId).toBe(optionsTabId);
    report.checks.push('Icon-only settings: 16 accessible localized names, 44px targets at 320/390px, Paper/Graphite, Arabic RTL, keyboard focus and Enter opens options.');
    assert.equal((await send({ type: 'SAVE_SETTINGS', settings: { ...await settings(), uiLanguage: 'ru', theme: 'light' } })).ok, true);
    await popup.reload();
    await expect(popup.locator('.language-grid')).toBeVisible();
    for (const width of [320, 390]) {
      await popup.setViewportSize({ width, height: 800 });
      assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Popup overflow at ${width}px`);
    }
    await expect(popup.locator('html')).toHaveAttribute('lang', 'ru');
    await popup.locator('body').screenshot({ path: path.join(artifacts, 'popup-light.png'), animations: 'disabled' });
    await popup.close();
    assert.deepEqual(remoteResources, [], 'UI fetched an external font or resource.');
    assert.deepEqual(pageErrors, []);
    report.checks.push('All 16 locale previews at 320/390/1280 px; Arabic RTL; themed Linguisty header logo and distinct localized Isty footer; popup at 320/390px; local Onest/SVG; text contrast >=4.5:1; targets >=44px; zero UI external resources/page errors.');
  } finally {
    if (runtime) await runtime.cleanup();
    await server.close();
    report.cleanup = server.metrics();
    assert.equal(report.cleanup.activeRequests, 0);
    assert.equal(report.cleanup.pendingTimers, 0);
    await writeFile(path.join(artifacts, 'observations.json'), JSON.stringify(report, null, 2));
  }
});

/** @spec spec://modules/interface/FEAT-003-controls#languages */
test('packaged Firefox: browser languages, localized controls, Arabic RTL and manual persistence', { timeout: 120_000 }, async () => {
  const firefoxArtifacts = path.join(artifacts, 'firefox');
  let runtime;
  const report = { checks: [], limitations: ['Isolated temporary installation; paid provider, signed distribution and native toolbar popup geometry not tested.'] };
  try {
    runtime = await launchIsolatedFirefox({ projectRoot: root, extensionPath: path.join(root, '.output/firefox-mv3'), artifactRoot: firefoxArtifacts, preferences: { 'intl.accept_languages': 'uk-UA,en-US' } });
    report.runtime = runtime.metadata;
    const url = `${runtime.metadata.extensionOrigin}/options.html`;
    await runtime.open(url);
    await eventually(() => runtime.execute('return !!document.getElementById("providerId");'), Boolean, 'Firefox options did not load');
    const send = message => runtime.executeAsync('const done=arguments[arguments.length-1];browser.runtime.sendMessage({channel:"linguisty",...arguments[0]}).then(done,e=>done({transportError:e.name}));', [message]);
    const fresh = await send({ type: 'GET_SETTINGS' });
    assert.equal(fresh.ok, true);
    assert.equal(fresh.data.targetLanguageMode, 'browser');
    assert.equal(fresh.data.uiLanguage, 'auto');
    assert.equal(fresh.data.targetLanguage, 'uk-UA');
    assert.equal(await runtime.execute('return document.getElementById("targetLanguageSelect").value;'), '__browser__');
    const choices = await runtime.execute('return {targets:document.getElementById("targetLanguageSelect").options.length,ui:document.getElementById("uiLanguage").options.length};');
    assert.equal(choices.targets, 211);
    assert.equal(choices.ui, 17);
    assert.equal(await runtime.execute('return document.querySelectorAll("header .linguisty-mark[aria-hidden=true]").length === 1;'), true);
    assert.equal(await runtime.execute('return document.querySelectorAll("header .brand-mark").length === 0 && document.querySelectorAll("footer .powered-by [aria-label=Isty]").length === 1;'), true);
    report.checks.push('Actual Firefox navigator preferences select uk-UA automatically; 210 target choices and 16 UI locales.');
    await runtime.click('#uiLanguage option[value="ar"]');
    await eventually(() => runtime.execute('return [document.documentElement.lang,document.documentElement.dir,document.querySelector("label[for=uiLanguage]").textContent];'), value => value[0] === 'ar' && value[1] === 'rtl' && !/[А-Яа-яЁё]/.test(value[2]), 'Firefox Arabic RTL preview did not apply');
    await runtime.click('#theme option[value="dark"]');
    await eventually(() => runtime.execute('return document.documentElement.dataset.theme;'), value => value === 'dark', 'Firefox graphite theme did not apply');
    assert.equal(await runtime.execute('return getComputedStyle(document.querySelector("header .linguisty-mark")).backgroundImage.includes("linguisty-color.svg");'), true);
    await runtime.screenshot('options-arabic-dark.png');
    await runtime.click('#uiLanguage option[value="en"]');
    await eventually(() => runtime.execute('return document.querySelector("h1").textContent;'), value => value === 'Your service. Your language.', 'Firefox English UI did not apply');
    await runtime.click('#targetLanguageSelect option[value="de"]');
    await runtime.fill('#targetLanguage', 'sr-Latn-RS');
    await runtime.fill('#model', 'qa/mock-model');
    await runtime.click('#theme option[value="light"]');
    await runtime.click('button[type="submit"]');
    await eventually(() => runtime.execute('return PopupNotifications.panel.state === "open" && !!document.getElementById("addon-webext-permissions-notification");', [], 'chrome'), Boolean, 'Firefox save permission absent');
    await pause(750);
    await runtime.execute('document.getElementById("addon-webext-permissions-notification").button.click();', [], 'chrome');
    await eventually(() => send({ type: 'GET_SETTINGS' }), result => result.ok && result.data.targetLanguage === 'sr-Latn-RS' && result.data.targetLanguageMode === 'manual' && result.data.uiLanguage === 'en', 'Firefox form did not save manual language');
    await eventually(() => runtime.execute('return document.querySelector("form").getAttribute("aria-busy") === "false" && !!document.querySelector(".form-feedback .notice");'), Boolean, 'Firefox manual save feedback');
    await runtime.navigate(url);
    await eventually(() => runtime.execute('return document.getElementById("targetLanguage")?.value;'), value => value === 'sr-Latn-RS', 'Firefox manual target did not survive reopen');
    assert.equal(await runtime.execute('return document.documentElement.lang;'), 'en');
    assert.equal(await runtime.execute('return document.documentElement.dir;'), 'ltr');
    assert.equal(await runtime.execute('return getComputedStyle(document.querySelector("header .linguisty-mark")).backgroundImage.includes("linguisty-monochrome.svg");'), true);
    await runtime.screenshot('options-english-light.png');
    await runtime.click('#targetLanguageSelect option[value="__browser__"]');
    await eventually(() => runtime.execute('return !document.getElementById("targetLanguage") && document.getElementById("targetLanguageSelect").value === "__browser__";'), Boolean, 'Firefox auto mode did not render');
    await runtime.click('button[type="submit"]');
    await eventually(() => send({ type: 'GET_SETTINGS' }), result => result.ok && result.data.targetLanguageMode === 'browser' && result.data.targetLanguage === 'uk-UA', 'Firefox form did not save return to browser mode');
    await runtime.navigate(url);
    await eventually(() => runtime.execute('return document.getElementById("targetLanguageSelect")?.value;'), value => value === '__browser__', 'Firefox browser mode did not survive reopen');
    report.checks.push('Real Firefox select/input/submit handlers show Arabic RTL and graphite; explicit sr-Latn-RS and English survive save/reopen; return to browser restores uk-UA. No provider request or credential used.');
    /** @spec spec://common/PROP-001-contracts#messages */
    const old = (await send({ type: 'GET_SETTINGS' })).data;
    const latest = (await send({ type: 'SAVE_SETTINGS', settings: { ...old, model: 'qa/popup-latest', theme: 'dark', customInstructions: 'Latest preferences.' } })).data;
    const saved = await send({ type: 'SAVE_SETTINGS', settings: { ...old, sourceLanguage: 'en', targetLanguage: 'de', targetLanguageMode: 'manual' }, languagesOnly: true });
    assert.equal(saved.ok, true);
    assert.deepEqual(saved.data, { ...latest, sourceLanguage: 'en', targetLanguage: 'de', targetLanguageMode: 'manual' });
    report.checks.push('Actual Firefox background merges stale popup languages while preserving newer preferences.');
    /** @spec spec://modules/interface/FEAT-003-controls#popup */
    const popupUrl = `${runtime.metadata.extensionOrigin}/popup.html`;
    await runtime.open(popupUrl);
    report.popupSettings = [];
    for (const [index, locale] of locales.entries()) {
      const theme = index % 2 ? 'dark' : 'light';
      const current = (await send({ type: 'GET_SETTINGS' })).data;
      assert.equal((await send({ type: 'SAVE_SETTINGS', settings: { ...current, uiLanguage: locale, theme } })).ok, true);
      await runtime.navigate(popupUrl);
      await eventually(() => runtime.execute('return !!document.querySelector(".language-grid") && document.documentElement.lang;', []), value => value === locale, 'Firefox popup locale did not load');
      const gear = await runtime.execute('const e=document.querySelector(".popup-settings"),r=e.getBoundingClientRect();return {name:e.getAttribute("aria-label"),title:e.title,text:e.textContent,svg:!!e.querySelector("svg[aria-hidden=true][focusable=false]"),width:r.width,height:r.height,dir:document.documentElement.dir,theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth>innerWidth};');
      assert.ok(gear.name?.trim()); assert.equal(gear.title, gear.name); assert.equal(gear.text, ''); assert.equal(gear.svg, true);
      assert.equal(gear.width, 44); assert.equal(gear.height, 44); assert.equal(gear.overflow, false);
      assert.equal(gear.dir, locale === 'ar' ? 'rtl' : 'ltr'); assert.equal(gear.theme, theme);
      report.popupSettings.push({ locale, ...gear });
      if (locale === 'ar' || locale === 'en') await runtime.screenshot(`popup-gear-${locale}-${theme}.png`);
    }
    await runtime.execute('document.getElementById("popup-source").focus();');
    const sourceElement = await runtime.element('#popup-source');
    const elementKey = 'element-6066-11e4-a52e-4f735466cecf';
    await runtime.command('POST', `/element/${sourceElement[elementKey]}/value`, { text: '\uE008\uE004\uE000' });
    assert.equal(await runtime.execute('const e=document.querySelector(".popup-settings");return e===document.activeElement && getComputedStyle(e).outlineWidth==="2px";'), true);
    const gearElement = await runtime.element('.popup-settings');
    await runtime.command('POST', `/element/${gearElement[elementKey]}/value`, { text: '\uE007' });
    await eventually(() => runtime.executeAsync('const done=arguments[arguments.length-1];browser.tabs.query({active:true,currentWindow:true}).then(t=>done(t[0]?.url));'), value => value === url, 'Firefox gear Enter did not open options');
    report.checks.push('Icon-only settings in 16 locales, 44px target, both themes, Arabic RTL, native Shift+Tab and Enter open options.');
    report.memory = await runtime.sampleMemory('before-cleanup');
  } finally {
    if (runtime) report.cleanup = await runtime.cleanup();
    await mkdir(firefoxArtifacts, { recursive: true });
    await writeFile(path.join(firefoxArtifacts, 'observations.json'), JSON.stringify(report, null, 2));
  }
});
