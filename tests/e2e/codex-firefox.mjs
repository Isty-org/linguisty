/** @spec spec://modules/platform/INFRA-004-codex-connection#changelog */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { launchIsolatedFirefox, eventually, pause } from './firefox-runtime.mjs';
import { startLocalServer } from './local-server.mjs';
import { codexFixture, installCodexFixture } from './codex-fixture.mjs';
import { codexTranslationScenario } from './codex-translation-scenario.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = path.join(root, 'test-results/linguisty-response-stream');
const report = { checks: [], limitations: ['OpenAI token/model/Responses traffic is replaced only in the QA page; live OAuth/account eligibility and linguistic quality are unverified.', 'Unchanged production package; temporary installation and privileged test-browser clicks do not check signing, physical toolbar or marketplace installation.'] };
let runtime, server;
try {
  await mkdir(artifacts, { recursive: true });
  runtime = await launchIsolatedFirefox({ projectRoot: root, extensionPath: path.join(root, '.output/firefox-mv3'), artifactRoot: artifacts });
  report.runtime = runtime.metadata; server = await startLocalServer();
  const origin = runtime.metadata.extensionOrigin; const options = await runtime.open(origin + '/options.html');
  const send = async payload => { await runtime.switchTo(options); return runtime.executeAsync('const done=arguments[arguments.length-1];browser.runtime.sendMessage({channel:"linguisty",...arguments[0]}).then(done,e=>done({error:e.name}));', [payload]); };
  const settings = (await send({ type: 'GET_SETTINGS' })).data;
  await runtime.executeAsync('const done=arguments[arguments.length-1];browser.storage.local.set({"linguisty.settings":{...arguments[0],uiLanguage:"ru",targetLanguage:"ru",targetLanguageMode:"manual"}}).then(()=>{localStorage.setItem("linguisty.uiLanguage","ru");done(true)});', [settings]);
  await runtime.command('POST', '/refresh', {}); await eventually(() => runtime.execute('return !!document.getElementById("providerId");'), Boolean, 'Settings missing');
  assert.deepEqual(await runtime.execute('return Array.from(document.querySelectorAll("#providerId option"),x=>x.value);'), ['openrouter', 'openai-compatible', 'codex']);
  async function acceptPermission() {
    await eventually(() => runtime.execute('return PopupNotifications.panel.state === "open" && !!document.getElementById("addon-webext-permissions-notification");', [], 'chrome'), Boolean, 'Permission prompt missing');
    await pause(750); await runtime.execute('document.getElementById("addon-webext-permissions-notification").button.click();', [], 'chrome');
  }
  await runtime.click('#providerId option[value="codex"]'); await runtime.click('.codex-connect .button-primary'); await acceptPermission();
  await eventually(() => send({ type: 'GET_SETTINGS' }), value => value.data?.providerId === 'codex', 'Codex save missing');
  const guideUrl = origin + '/codex.html'; let guide;
  await eventually(async () => {
    for (const handle of await runtime.command('GET', '/window/handles')) { await runtime.switchTo(handle); if (await runtime.execute('return location.href;') === guideUrl) { guide = handle; return true; } }
    return false;
  }, Boolean, 'Connection tab missing');
  await eventually(() => runtime.execute('return document.querySelectorAll(".codex-steps li").length;'), value => value === 4, 'Four steps missing');
  // Use the installed manifest and Firefox's own principal checks, not a copy of its allowlist.
  report.resourceAccess = await runtime.execute(`
    return [
      ['https://auth.openai.com', 'codex-callback.html', true],
      ['http://127.0.0.1:1455', 'codex-callback.html', true],
      ['https://unrelated.example', 'codex-callback.html', false],
      ['https://auth.openai.com.unrelated.example', 'codex-callback.html', false],
      ['http://auth.openai.com', 'codex-callback.html', false],
      ['https://auth.openai.com', 'codex.html', false],
      ['https://auth.openai.com', 'options.html', false],
    ].map(([origin, resource, expected]) => {
      const principal = Services.scriptSecurityManager.createContentPrincipal(Services.io.newURI(origin), {});
      let allowed = true;
      try { Services.scriptSecurityManager.checkLoadURIWithPrincipal(principal, Services.io.newURI(arguments[0] + '/' + resource), 0); }
      catch { allowed = false; }
      return { origin, resource, expected, allowed };
    });
  `, [origin], 'chrome');
  for (const check of report.resourceAccess) assert.equal(check.allowed, check.expected, check.origin + '/' + check.resource);
  report.checks.push('Firefox enforces callback origin restrictions; unrelated/insecure origins and private extension pages remain blocked.');
  await runtime.switchTo(guide);
  const callbackPage = await runtime.open(origin + '/codex-callback.html');
  report.localeChecks = [];
  for (const locale of ['en', 'ru', 'uk', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'tr', 'ja', 'ko', 'zh-CN', 'zh-TW', 'ar', 'hi']) {
    await runtime.switchTo(options);
    await runtime.executeAsync('const done=arguments[arguments.length-1];browser.storage.local.get("linguisty.settings").then(data=>browser.storage.local.set({"linguisty.settings":{...data["linguisty.settings"],uiLanguage:arguments[0]}})).then(()=>{localStorage.setItem("linguisty.uiLanguage",arguments[0]);done(true)});', [locale]);
    await runtime.command('POST', '/refresh', {});
    const label = await eventually(() => runtime.execute('return document.querySelector("#providerId option[value=codex]")?.textContent;'), value => value?.includes('ChatGPT'), 'Subscription label missing');
    assert.equal(label.includes('Codex'), false);
    await runtime.switchTo(guide); await runtime.command('POST', '/refresh', {});
    await eventually(() => runtime.execute('return [document.documentElement.lang,document.querySelectorAll(".codex-steps li").length];'), value => value[0] === locale && value[1] === 4, 'Guide locale missing');
    const state = await runtime.execute('return {dir:document.documentElement.dir,label:document.getElementById("codex-status-title").textContent,oldName:document.body.textContent.includes("Codex"),overflow:document.documentElement.scrollWidth > innerWidth};');
    assert.equal(state.label, label); assert.equal(state.dir, locale === 'ar' ? 'rtl' : 'ltr'); assert.equal(state.oldName, false); assert.equal(state.overflow, false);
    await runtime.switchTo(callbackPage); await runtime.command('POST', '/refresh', {});
    await eventually(() => runtime.execute('return document.documentElement.lang;'), value => value === locale, 'Callback locale missing');
    const callback = await runtime.execute('return {dir:document.documentElement.dir,title:document.querySelector("h1").textContent,returning:document.getElementById("status").textContent};');
    assert.equal(callback.title, 'Linguisty · ' + label); assert.equal(callback.dir, locale === 'ar' ? 'rtl' : 'ltr');
    if (locale !== 'en') assert.notEqual(callback.returning, 'Returning to Linguisty…');
    report.localeChecks.push({ locale, label, returning: callback.returning });
  }
  await runtime.command('DELETE', '/window');
  report.checks.push('All 16 languages: subscription label, four steps, localized OAuth return, matching lang/dir and no Codex name or overflow.');
  await runtime.switchTo(options);
  await runtime.executeAsync('const done=arguments[arguments.length-1];browser.storage.local.get("linguisty.settings").then(data=>browser.storage.local.set({"linguisty.settings":{...data["linguisty.settings"],uiLanguage:"ru"}})).then(()=>{localStorage.setItem("linguisty.uiLanguage","ru");done(true)});');
  await runtime.command('POST', '/refresh', {}); await runtime.switchTo(guide); await runtime.command('POST', '/refresh', {});
  await eventually(() => runtime.execute('return document.documentElement.lang;'), value => value === 'ru', 'Russian guide missing');
  await runtime.screenshot('firefox-guide-before.png');
  console.log('Firefox: guide opened; starting fixture login.');
  assert.equal(await runtime.executeAsync(`const done=arguments[arguments.length-1];(${installCodexFixture.toString()})(arguments[0]).then(done,e=>done({error:e.name}));`, [{ ...codexFixture, deferCallback: true }]), true);
  await runtime.click('.codex-status .button-primary'); await acceptPermission(); await runtime.switchTo(guide);
  // @spec spec://modules/platform/INFRA-004-codex-connection#auth
  // Exercise Firefox's real web-initiator access check. tabs.update(callback)
  // originates in the extension and bypasses the check made after OpenAI consent.
  async function finishCallback() {
    const pendingCallback = await eventually(() => runtime.execute('return (window.wrappedJSObject ?? window).__linguistyCodexQa.pendingCallback;'), Boolean, 'OAuth callback fixture missing');
    await eventually(() => runtime.execute(`
      const tab = Array.from(gBrowser.tabs).find(t => t.linkedBrowser.currentURI.spec === 'about:blank#linguisty-codex-qa');
      if (!tab) return false;
      const principal = Services.scriptSecurityManager.createContentPrincipal(Services.io.newURI('https://auth.openai.com'), {});
      tab.linkedBrowser.loadURI(Services.io.newURI(arguments[0]), { triggeringPrincipal: principal });
      return true;
    `, [pendingCallback], 'chrome'), Boolean, 'OAuth callback tab missing');
    await runtime.switchTo(guide);
  }
  await finishCallback();
  try { await eventually(() => runtime.execute('return document.querySelector(".notice-success")?.textContent;'), value => value?.includes('Ответ модели не проверялся'), 'Fixture login did not finish', 15_000); }
  catch (error) {
    report.fixtureCounts = await runtime.execute('return (window.wrappedJSObject ?? window).__linguistyCodexQa;');
    report.notice = await runtime.execute('return Array.from(document.querySelectorAll(".notice"),x=>x.textContent);');
    report.tabPaths = await runtime.executeAsync('const done=arguments[arguments.length-1];browser.tabs.query({}).then(tabs=>done(tabs.map(t=>t.url?.split(/[?#]/)[0])));');
    report.ruleTargets = await runtime.executeAsync('const done=arguments[arguments.length-1];browser.declarativeNetRequest.getSessionRules().then(rules=>done(rules.map(rule=>({tabIds:rule.condition.tabIds,excluded:rule.condition.excludedTabIds}))));');
    throw error;
  }
  assert.deepEqual(await runtime.executeAsync('const done=arguments[arguments.length-1];browser.declarativeNetRequest.getSessionRules().then(done);'), []);
  const persisted = await runtime.executeAsync('const done=arguments[arguments.length-1];Promise.all([browser.storage.local.get(null),browser.storage.session.get(null)]).then(values=>done(["qa-access","qa-refresh","id_token","qa@example.test"].some(s=>JSON.stringify([...values,{...localStorage}]).includes(s))));');
  assert.equal(persisted, false); assert.equal((await send({ type: 'GET_CODEX_STATUS' })).data.connected, true);
  report.checks.push('Actual optional permission prompts, fixture RSA/OIDC, callback navigation with auth.openai.com content principal, real state/tab redirect, rule cleanup, no persistent tokens.');
  await runtime.switchTo(guide); await runtime.click('.options-header .button-secondary');
  assert.equal((await send({ type: 'OPEN_CODEX_CONNECTION' })).ok, true);
  const tabCount = await runtime.executeAsync('const done=arguments[arguments.length-1];browser.tabs.query({}).then(tabs=>done(tabs.filter(t=>t.url===arguments[0]).length));', [guideUrl]);
  assert.equal(tabCount, 1); report.checks.push('Return and repeated connection reuse the live guide tab.');
  const url = server.origin + '/real-estate.html'; const page = await runtime.open(url); const original = await runtime.execute('return document.querySelector("h1").textContent;');
  await runtime.switchTo(options); const tabId = await runtime.executeAsync('const done=arguments[arguments.length-1];browser.tabs.query({}).then(tabs=>done(tabs.find(t=>t.url===arguments[0])?.id));', [url]);
  const started = await send({ type: 'START_TRANSLATION', tabId }); assert.equal(started.ok, true, started.error?.code);
  await eventually(() => send({ type: 'GET_TAB_STATE', tabId }), value => value.data?.status === 'completed', 'Codex translation incomplete', 15_000);
  await runtime.switchTo(page); assert.equal(await runtime.execute('return document.querySelector("h1").textContent;'), 'Codex QA: ' + original);
  await send({ type: 'SET_DISPLAY_MODE', tabId, mode: 'original' }); await runtime.switchTo(page); assert.equal(await runtime.execute('return document.querySelector("h1").textContent;'), original);
  report.checks.push('Background port reaches the connection page; Responses fixture translates real Text nodes and restores original.');
  report.largePage = await codexTranslationScenario({ send, tabId,
    onPage: async fn => { await runtime.switchTo(page); return runtime.execute(`return (${fn.toString()})();`); },
    onGuide: async fn => { await runtime.switchTo(guide); return runtime.execute(`return (${fn.toString()})();`); } });
  report.checks.push('Luna 6 schema and completed stream items with an empty terminal output; 1,340 nodes, cache-only repeat, incomplete/empty replies rejected with safe codes and no cache writes.');
  await runtime.switchTo(guide); await runtime.screenshot('firefox-guide-connected.png');
  await runtime.click('.codex-status .button-danger'); await eventually(() => runtime.execute('return document.querySelector(".notice-success")?.textContent;'), value => value?.includes('разрешение отозвано'), 'Disconnect missing');
  // @spec spec://modules/platform/INFRA-004-codex-connection#auth
  await runtime.execute('const fixture=(window.wrappedJSObject ?? window).__linguistyCodexQa; fixture.tokenStatus=401; fixture.pendingCallback=null;');
  await runtime.click('.codex-status .button-primary'); await finishCallback();
  await eventually(() => runtime.execute('return document.querySelector(".notice-error")?.textContent;'), value => value?.includes('[LGT-token-http-401]'), 'Safe token failure code missing');
  assert.equal(await runtime.execute('return ["qa-private","qa-access","qa-refresh","qa@example.test"].some(value=>document.body.textContent.includes(value));'), false);
  assert.deepEqual(await runtime.executeAsync('const done=arguments[arguments.length-1];browser.declarativeNetRequest.getSessionRules().then(done);'), []);
  await runtime.screenshot('firefox-guide-safe-error.png');
  report.checks.push('Single-element ID-token audience works; token HTTP 401 shows a fixed code without provider details and leaves no callback rule.');
  report.fixtureCounts = await runtime.execute('return (window.wrappedJSObject ?? window).__linguistyCodexQa;'); assert.equal(report.fixtureCounts.unexpected, 0);
  assert.equal((await send({ type: 'GET_CODEX_STATUS' })).data.connected, false); await runtime.close(guide);
  assert.equal((await send({ type: 'START_TRANSLATION', tabId })).error?.code, 'CODEX_NOT_CONNECTED');
  report.checks.push('Disconnect revocation fixture and closed-page reconnect error.'); report.memory = await runtime.sampleMemory('codex-completed');
  console.log('Firefox Codex checks passed: ' + report.checks.length);
} catch (error) { report.failure = error.message; process.exitCode = 1; console.error(error); }
finally { if (runtime) report.cleanup = await runtime.cleanup(); await server?.close(); await writeFile(path.join(artifacts, 'firefox.json'), JSON.stringify(report, null, 2)); }
