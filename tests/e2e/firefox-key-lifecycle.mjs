/** @spec spec://modules/storage/INFRA-002-local-data#secrets */
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { eventually, launchIsolatedFirefox } from './firefox-runtime.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const buildRoot = path.join(projectRoot, '.output/firefox-mv3');
const artifactRoot = path.join(projectRoot, 'test-results/linguisty-key-lifecycle');
const report = { scenarios: [], limitations: ['Unsigned temporary installation. Signed permanent installation and upgrading the Firefox executable are not tested.', 'Only test credentials; no real provider request or user profile.'] };
await mkdir(artifactRoot, { recursive: true });
let runtime;

try {
  for (const preserveTemporaryStorage of [false, true]) {
    const result = { preserveTemporaryStorage, checks: [], memory: [] };
    report.scenarios.push(result);
    runtime = await launchIsolatedFirefox({ projectRoot, extensionPath: buildRoot, artifactRoot, preferences: {
      'extensions.webextensions.keepStorageOnUninstall': preserveTemporaryStorage,
      'extensions.webextensions.keepUuidOnUninstall': preserveTemporaryStorage,
    } });
    result.runtime = runtime.metadata;
    result.memory.push(await runtime.sampleMemory('installed'));
    let options;
    async function openOptions() {
      options = await runtime.open(`${runtime.metadata.extensionOrigin}/options.html`);
      await eventually(() => runtime.execute('return !!document.getElementById("keyMode");'), Boolean, 'Options did not initialize');
    }
    async function send(message) {
      await runtime.switchTo(options);
      const response = await runtime.executeAsync('const done=arguments[arguments.length-1];browser.runtime.sendMessage({channel:"linguisty",...arguments[0]}).then(done,e=>done({transportError:e.name}));', [message]);
      assert.equal(response.ok, true, `${message.type} failed: ${response.error?.code}`);
      return response.data;
    }
    async function assertDurableKey() {
      const settings = await send({ type: 'GET_SETTINGS' });
      assert.equal(settings.keyMode, 'persistent');
      assert.deepEqual(await send({ type: 'GET_SECRET_STATUS' }), { hasKey: true, mode: 'persistent' });
      const locations = await runtime.executeAsync('const done=arguments[arguments.length-1];Promise.all([browser.storage.local.get("linguisty.apiKey"),browser.storage.session.get("linguisty.apiKey")]).then(([local,session])=>done({local:typeof local["linguisty.apiKey"]==="string",session:typeof session["linguisty.apiKey"]==="string"}));');
      assert.deepEqual(locations, { local: true, session: false });
    }

    await openOptions();
    await runtime.executeAsync('const done=arguments[arguments.length-1];const key="linguisty.settings";browser.storage.local.get(key).then(result=>browser.storage.local.set({[key]:{...(result[key]??{}),uiLanguage:"ru",targetLanguage:"ru",targetLanguageMode:"manual"}})).then(()=>done(true),e=>done({error:e.name}));');
    await openOptions();
    const info = await runtime.executeAsync('const done=arguments[arguments.length-1];browser.management.getSelf().then(info=>done({id:info.id,installType:info.installType,version:info.version}));');
    result.installation = info;
    assert.equal(info.installType, 'development');
    await eventually(() => runtime.execute('return document.body.textContent.includes("Linguisty установлен в Firefox временно");'), Boolean, 'Temporary install explanation absent');
    const oldSettings = await send({ type: 'GET_SETTINGS' });
    await send({ type: 'SAVE_SETTINGS', settings: { ...oldSettings, keyMode: 'persistent', model: 'qa/mock-model' }, apiKey: 'linguisty-lifecycle-test-credential' });
    await send({ type: 'SAVE_SETTINGS', settings: { ...oldSettings, targetLanguage: 'de' }, preserveKeyMode: true });
    await assertDurableKey();
    result.checks.push('Persistent key and current mode survive an incidental save from an old configuration; only one secret store has a key.');

    await runtime.executeAsync('const done=arguments[arguments.length-1];ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs").AddonManager.getAddonByID(arguments[0]).then(addon=>addon.reload()).then(()=>done(true),e=>done({error:e.name}));', [runtime.metadata.addonId], 'chrome');
    await openOptions();
    await assertDurableKey();
    result.checks.push('Actual AddonManager reload preserves the persistent key and mode.');

    const updatedBuild = path.join(runtime.metadata.profile, 'linguisty-update');
    assert.equal(path.dirname(path.resolve(updatedBuild)), path.resolve(runtime.metadata.profile));
    await cp(buildRoot, updatedBuild, { recursive: true });
    const manifestPath = path.join(updatedBuild, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const [major, minor, patch] = manifest.version.split('.').map(Number);
    manifest.version = `${major}.${minor}.${patch + 1}`;
    await writeFile(manifestPath, JSON.stringify(manifest));
    await runtime.installAddon(updatedBuild);
    await openOptions();
    await assertDurableKey();
    assert.equal(await runtime.execute('return browser.runtime.getManifest().version;'), manifest.version);
    result.checks.push('Installing a higher-version package with the same Gecko ID preserves the persistent key and mode.');

    await runtime.restart({ reinstall: false });
    result.addonAfterRestart = await runtime.executeAsync('const done=arguments[arguments.length-1];ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs").AddonManager.getAddonByID(arguments[0]).then(addon=>done(addon?{version:addon.version,temporary:addon.temporarilyInstalled,active:addon.isActive}:null));', [runtime.metadata.addonId], 'chrome');
    assert.equal(result.addonAfterRestart, null, 'Temporary add-on remained installed after browser restart');
    await runtime.installAddon();
    await openOptions();
    if (preserveTemporaryStorage) {
      await assertDurableKey();
      result.checks.push('Actual browser exit/start with documented test-profile preservation preferences keeps the local key after temporary reinstall.');
    } else {
      const status = await send({ type: 'GET_SECRET_STATUS' });
      result.keyAfterDefaultReinstall = status.hasKey;
      if (status.hasKey) {
        await assertDurableKey();
        result.checks.push('This Firefox retains the persistent key after temporary removal/reinstall in the same profile with default preservation preferences.');
      } else result.checks.push('Default temporary-install removal on browser exit deletes the local key: browser limitation reproduced.');
    }
    result.memory.push(await runtime.sampleMemory('after-restart'));
    await runtime.screenshot(preserveTemporaryStorage ? 'options-after-preserved-restart.png' : 'options-after-default-restart.png');
    result.ok = true;
    result.cleanup = await runtime.cleanup();
    runtime = undefined;
  }
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.failure = error instanceof Error ? error.message.replaceAll('linguisty-lifecycle-test-credential', '[withheld]') : 'Unknown failure';
  process.exitCode = 1;
} finally {
  if (runtime) report.finalCleanup = await runtime.cleanup();
  await writeFile(path.join(artifactRoot, 'observations.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, scenarios: report.scenarios.map(({ preserveTemporaryStorage, ok, checks }) => ({ preserveTemporaryStorage, ok, checks })), ...(report.failure ? { failure: report.failure } : {}) }));
}
