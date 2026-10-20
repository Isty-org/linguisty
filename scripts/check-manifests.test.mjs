/** @spec spec://modules/platform/INFRA-001-extension#acceptance */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { inspectBuild, checkManifests } from './check-manifests.mjs';
import { checkHygiene } from './check-hygiene.mjs';

async function withBuild(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'linguisty-manifest-check-'));
  try {
    await mkdir(path.join(root, 'icon'));
    for (const size of [16, 32, 48, 128]) await writeFile(path.join(root, 'icon', `${size}.png`), await readFile(new URL(`../public/icon/${size}.png`, import.meta.url)));
    for (const name of ['background.js', 'translate.js', 'popup.js', 'options.js', 'codex.js', 'codex-callback.js']) await writeFile(path.join(root, name), 'console.log("Linguisty fixture runtime");');
    for (const name of ['popup', 'options', 'codex', 'codex-callback']) await writeFile(path.join(root, `${name}.html`), `<html><head><title>Linguisty</title><script src="./${name}.js"></script></head><body></body></html>`);
    const manifest = {
      manifest_version: 3, name: 'Linguisty', version: '0.1.0', minimum_chrome_version: '120',
      permissions: ['activeTab', 'scripting', 'storage', 'declarativeNetRequestWithHostAccess'],
      optional_permissions: ['nativeMessaging'],
      web_accessible_resources: [{ resources: ['codex-callback.html'], matches: ['http://127.0.0.1/*', 'https://auth.openai.com/*'] }],
      optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*', 'http://[::1]/*'],
      icons: Object.fromEntries([16, 32, 48, 128].map(size => [size, `icon/${size}.png`])),
      action: { default_title: 'Linguisty', default_popup: 'popup.html' }, options_ui: { page: 'options.html' },
      background: { service_worker: 'background.js' },
      content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
    };
    const save = () => writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest));
    await save();
    await run(root, manifest, save);
  } finally {
    // Only this explicitly-created temporary directory is removed.
    assert.ok(root.startsWith(path.join(os.tmpdir(), 'linguisty-manifest-check-')));
    await rm(root, { recursive: true, force: true });
  }
}

test('accepts valid platform-specific packages and verifies real asset bytes', async () => {
  await withBuild(async (root, manifest, save) => {
    const chrome = await inspectBuild(root, 'chrome');
    assert.equal(chrome.ok, true, chrome.errors.join('\n'));
    assert.equal(chrome.files, 15);
    assert.ok(chrome.bytes > 3000);
    manifest.background = { scripts: ['background.js'], persistent: false };
    manifest.browser_specific_settings = { gecko: { id: 'linguisty@isty.local', strict_min_version: '142.0', data_collection_permissions: { required: ['websiteContent', 'browsingActivity', 'authenticationInfo'] } } };
    await save();
    const firefox = await inspectBuild(root, 'firefox');
    assert.equal(firefox.ok, true, firefox.errors.join('\n'));
  });
});

/** @spec spec://modules/platform/INFRA-001-extension#build */
test('resolves CSS root URLs from the package root and still rejects escaping paths', async () => {
  await withBuild(async root => {
    await mkdir(path.join(root, 'assets')); await mkdir(path.join(root, 'fonts'));
    await writeFile(path.join(root, 'fonts', 'local.woff2'), 'local-font-fixture');
    await writeFile(path.join(root, 'assets', 'styles.css'), '@font-face{src:url(/fonts/local.woff2)}');
    assert.equal((await inspectBuild(root, 'chrome')).ok, true);
    await writeFile(path.join(root, 'assets', 'styles.css'), '@font-face{src:url(/../outside.woff2)}');
    assert.ok((await inspectBuild(root, 'chrome')).errors.some(error => error.includes('escapes the build')));
  });
});

/** @spec spec://modules/platform/INFRA-004-codex-connection#auth */
test('requires the OpenAI callback initiator without exposing resources to unrelated sites', async () => {
  await withBuild(async (root, manifest, save) => {
    const rule = manifest.web_accessible_resources[0];
    for (const matches of [
      ['http://127.0.0.1/*'],
      ['http://127.0.0.1/*', 'http://127.0.0.1/*'],
      ['http://127.0.0.1/*', 'https://*/*'],
      ['http://127.0.0.1/*', 'https://auth.openai.com/*', 'https://unrelated.example/*'],
    ]) {
      rule.matches = matches;
      await save();
      assert.ok((await inspectBuild(root, 'chrome')).errors.some(error => error.includes('web-accessible')));
    }
    rule.matches = ['https://auth.openai.com/*', 'http://127.0.0.1/*'];
    await save();
    assert.equal((await inspectBuild(root, 'chrome')).ok, true);
    rule.resources.push('codex.html');
    await save();
    assert.ok((await inspectBuild(root, 'chrome')).errors.some(error => error.includes('web-accessible')));
  });
});

/** @spec spec://modules/platform/INFRA-001-extension#build */
test('rejects the Firefox consent version warning and unverified Android support', async () => {
  await withBuild(async (root, manifest, save) => {
    manifest.background = { scripts: ['background.js'], persistent: false };
    manifest.browser_specific_settings = { gecko: { id: 'linguisty@isty.local', strict_min_version: '140.0', data_collection_permissions: { required: ['websiteContent', 'browsingActivity', 'authenticationInfo'] } } };
    for (const minimum of ['140.0', '141.0']) {
      manifest.browser_specific_settings.gecko.strict_min_version = minimum;
      await save();
      const result = await inspectBuild(root, 'firefox');
      assert.equal(result.ok, false);
      assert.ok(result.errors.some(error => error.includes('minimum version >=142')));
    }
    manifest.browser_specific_settings.gecko.strict_min_version = '142.0';
    manifest.browser_specific_settings.gecko_android = { strict_min_version: '142.0' };
    await save();
    const result = await inspectBuild(root, 'firefox');
    assert.ok(result.errors.some(error => error.includes('Android compatibility')));
  });
});

test('rejects incorrect platform background, broad mandatory access and unsafe CSP', async () => {
  await withBuild(async (root, manifest, save) => {
    manifest.background = { scripts: ['background.js'] };
    manifest.host_permissions = ['<all_urls>'];
    manifest.content_scripts = [{ matches: ['<all_urls>'], js: ['translate.js'] }];
    manifest.externally_connectable = { matches: ['https://*/*'] };
    manifest.content_security_policy.extension_pages = "script-src 'self' 'unsafe-inline'; object-src 'self'; script-src-elem https://cdn.example.invalid";
    await save();
    const result = await inspectBuild(root, 'chrome');
    assert.equal(result.ok, false);
    for (const pattern of [/service worker/, /Mandatory host/, /Persistent content/, /externally_connectable/, /script-src/]) assert.ok(result.errors.some(error => pattern.test(error)), String(pattern));
  });
});

test('rejects missing or escaped entrypoints and altered PNG dimensions', async () => {
  await withBuild(async (root, manifest, save) => {
    manifest.options_ui.page = '../outside.html';
    manifest.action.default_popup = 'missing.html';
    const icon = await readFile(path.join(root, 'icon/16.png'));
    icon.writeUInt32BE(32, 16);
    await writeFile(path.join(root, 'icon/16.png'), icon);
    await save();
    const result = await inspectBuild(root, 'chrome');
    assert.ok(result.errors.some(error => /escapes/.test(error)));
    assert.ok(result.errors.some(error => /missing asset/.test(error)));
    assert.ok(result.errors.some(error => /PNG/.test(error)));
  });
});

test('reports credential filenames without leaking values, remote imports and inline execution', async () => {
  await withBuild(async root => {
    const fakeKey = ['sk', 'or', 'v1', 'a'.repeat(48)].join('-');
    await writeFile(path.join(root, 'background.js'), `const apiKey = "${fakeKey}"; import "https://cdn.example.invalid/runtime.js";`);
    await writeFile(path.join(root, 'popup.html'), '<html><script>window.bad = true</script><button onclick="bad()">Run</button><script src="https://cdn.example.invalid/script.js"></script></html>');
    const result = await inspectBuild(root, 'chrome');
    assert.equal(result.ok, false);
    for (const pattern of [/credential/, /nonpackaged/, /inline executable/, /inline event/, /invalid packaged asset/]) assert.ok(result.errors.some(error => pattern.test(error)), String(pattern));
    assert.equal(JSON.stringify(result).includes(fakeKey), false);
  });
});

test('missing production builds fail rather than being called successful', async () => {
  const result = await checkManifests(path.join(os.tmpdir(), `linguisty-not-created-${process.pid}`));
  assert.equal(result.ok, false);
  assert.equal(result.builds.length, 2);
  assert.ok(result.builds.every(build => !build.ok && build.errors.some(error => /missing/.test(error))));
});

/** @spec spec://common/PROP-002-quality#hygiene */
test('hygiene detects identical source copies without deleting them', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'linguisty-hygiene-check-'));
  try {
    await mkdir(path.join(root, 'src'));
    const source = 'export const marker = "bounded source duplicate inspection fixture";\n'.repeat(3);
    await writeFile(path.join(root, 'src/controller.ts'), source);
    await writeFile(path.join(root, 'src/controller copy.ts'), source);
    const report = await checkHygiene(root);
    assert.equal(report.ok, false);
    assert.equal(report.duplicates.length, 1);
    assert.deepEqual(report.suspicious, ['src/controller copy.ts']);
    assert.equal(await readFile(path.join(root, 'src/controller copy.ts'), 'utf8'), source);
    assert.ok(report.memory.totalSystemBytes > 0);
  } finally {
    assert.ok(root.startsWith(path.join(os.tmpdir(), 'linguisty-hygiene-check-')));
    await rm(root, { recursive: true, force: true });
  }
});
