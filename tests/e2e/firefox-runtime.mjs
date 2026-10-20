/** @spec spec://common/PROP-002-quality#checks */
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const elementKey = 'element-6066-11e4-a52e-4f735466cecf';
export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function eventually(read, accept, label, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  do {
    last = await read();
    if (accept(last)) return last;
    await pause(150);
  } while (Date.now() < deadline);
  throw new Error(`${label}: ${JSON.stringify(last).slice(0, 600)}`);
}

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function processInventory() {
  if (process.platform !== 'win32') return [];
  const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process -Filter "Name = \'firefox.exe\' OR Name = \'geckodriver.exe\'" | Select-Object ProcessId,ParentProcessId,WorkingSetSize | ConvertTo-Json -Compress'], { windowsHide: true, timeout: 10_000 });
  return stdout.trim() ? [JSON.parse(stdout)].flat() : [];
}

/** @spec spec://common/PROP-002-quality#resources */
export async function launchIsolatedFirefox({ projectRoot, extensionPath, artifactRoot, preferences = {} }) {
  const cacheRoot = path.join(projectRoot, '.cache/firefox-qa');
  const binary = process.env.LINGUISTY_FIREFOX_EXECUTABLE || path.join(process.env.LOCALAPPDATA || '', 'Mozilla Firefox/firefox.exe');
  const driverPath = process.env.LINGUISTY_GECKODRIVER || path.join(cacheRoot, 'driver/geckodriver.exe');
  assert.ok(existsSync(binary), `Firefox executable absent: ${binary}`);
  assert.ok(existsSync(driverPath), `Official geckodriver absent: ${driverPath}. See docs/FIREFOX-QA.md.`);
  await mkdir(cacheRoot, { recursive: true });
  await mkdir(artifactRoot, { recursive: true });
  const profile = await mkdtemp(path.join(cacheRoot, 'profile-'));
  const port = await unusedPort();
  // The privileged context is limited to this test browser. It opens trusted
  // extension pages and inspects native permission UI; no extension protection
  // preferences, CSP, manifest, or production files are changed.
  const driver = spawn(driverPath, ['--host', '127.0.0.1', '--port', String(port), '--allow-system-access', '--log', 'warn'], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, TMP: cacheRoot, TEMP: cacheRoot },
  });
  let driverLog = '';
  for (const stream of [driver.stdout, driver.stderr]) stream.on('data', chunk => { if (driverLog.length < 128 * 1024) driverLog += chunk.toString(); });
  let spawnError;
  driver.once('error', error => { spawnError = error; });
  const origin = `http://127.0.0.1:${port}`;
  let sessionId;
  let context = 'content';
  let metadata;
  let cleanupResult;
  const ownedPids = new Set([driver.pid].filter(Boolean));

  async function command(method, route, payload, timeoutMs = 25_000) {
    if (spawnError) throw spawnError;
    const response = await fetch(`${origin}${route}`, {
      method, headers: { 'Content-Type': 'application/json' },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const envelope = await response.json();
    // ApiResult and tab snapshots may legitimately have an `error` field.
    // Only the transport status identifies a WebDriver protocol error.
    if (!response.ok) {
      const error = new Error(`${envelope.value?.error || response.status}: ${envelope.value?.message || 'WebDriver command failed'}`);
      error.webdriverCode = envelope.value?.error;
      throw error;
    }
    return envelope.value;
  }
  const sessionCommand = (method, route, payload, timeoutMs) => command(method, `/session/${sessionId}${route}`, payload, timeoutMs);
  async function setContext(next) {
    if (context === next) return;
    await sessionCommand('POST', '/moz/context', { context: next });
    context = next;
  }
  async function execute(script, args = [], nextContext = 'content') {
    await setContext(nextContext);
    return sessionCommand('POST', '/execute/sync', { script, args });
  }
  async function executeAsync(script, args = [], nextContext = 'content') {
    await setContext(nextContext);
    return sessionCommand('POST', '/execute/async', { script, args });
  }
  async function switchTo(handle) {
    await setContext('content');
    await sessionCommand('POST', '/window', { handle });
  }
  async function sampleMemory(stage) {
    const inventory = await processInventory();
    let added;
    do {
      added = false;
      for (const item of inventory) if (ownedPids.has(item.ParentProcessId) && !ownedPids.has(item.ProcessId)) { ownedPids.add(item.ProcessId); added = true; }
    } while (added);
    const own = inventory.filter(item => ownedPids.has(item.ProcessId));
    return { stage, ownProcessCount: own.length, ownWorkingSetBytes: own.reduce((sum, item) => sum + Number(item.WorkingSetSize), 0), ownPids: own.map(item => item.ProcessId), freeSystemBytes: os.freemem(), node: process.memoryUsage() };
  }
  async function startSession() {
    const created = await command('POST', '/session', {
      capabilities: { alwaysMatch: { browserName: 'firefox', 'moz:firefoxOptions': {
        binary, args: ['-headless', '-profile', profile],
        prefs: { 'browser.startup.page': 0, 'browser.shell.checkDefaultBrowser': false, 'browser.aboutConfig.showWarning': false, ...preferences },
      } } },
    }, 45_000);
    sessionId = created.sessionId;
    context = 'content';
    ownedPids.add(created.capabilities['moz:processID']);
    metadata ??= { binary, driverPath, version: created.capabilities.browserVersion, geckodriverVersion: created.capabilities['moz:geckodriverVersion'], headless: true, isolatedProfile: true, systemAccessForHarness: true, profile, browserRestarts: 0 };
    await sessionCommand('POST', '/timeouts', { implicit: 0, pageLoad: 15_000, script: 15_000 });
    await sessionCommand('POST', '/window/rect', { width: 1280, height: 900 });
  }
  async function installAddon(addonPath = extensionPath) {
    const addonId = await sessionCommand('POST', '/moz/addon/install', { path: path.resolve(addonPath), temporary: true });
    const extensionHost = await execute('return WebExtensionPolicy.getByID(arguments[0])?.mozExtensionHostname;', [addonId], 'chrome');
    assert.ok(extensionHost, 'Temporary extension has no active WebExtensionPolicy.');
    metadata.addonId = addonId;
    metadata.extensionOrigin = `moz-extension://${extensionHost}`;
    return addonId;
  }
  async function cleanup() {
    if (cleanupResult) return cleanupResult;
    const before = await sampleMemory('before-close');
    if (sessionId) {
      try { await command('DELETE', `/session/${sessionId}`, undefined, 15_000); }
      catch { /* The fallback below targets this driver's captured process IDs only. */ }
      sessionId = undefined;
    }
    if (driver.exitCode === null) driver.kill();
    await pause(600);
    let remaining = (await processInventory()).filter(item => ownedPids.has(item.ProcessId));
    for (const item of remaining) {
      // Verify the current process is still a captured Firefox/driver PID before
      // terminating it; never terminate by executable name.
      const current = (await processInventory()).find(candidate => candidate.ProcessId === item.ProcessId && candidate.ParentProcessId === item.ParentProcessId);
      if (current) await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Stop-Process -Id ${current.ProcessId} -Force -ErrorAction SilentlyContinue`], { windowsHide: true, timeout: 10_000 });
    }
    await pause(250);
    remaining = (await processInventory()).filter(item => ownedPids.has(item.ProcessId));
    assert.equal(remaining.length, 0, 'An owned Firefox/driver process survived cleanup.');
    const resolved = path.resolve(profile);
    assert.equal(path.dirname(resolved), path.resolve(cacheRoot), 'Refusing removal outside owned Firefox QA cache.');
    assert.ok(path.basename(resolved).startsWith('profile-'), 'Refusing to remove an unowned profile.');
    await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
    await writeFile(path.join(artifactRoot, 'geckodriver.log'), driverLog.replaceAll('linguisty-qa-local-credential', '[withheld]'));
    cleanupResult = { before, after: await sampleMemory('after-close'), profileRemoved: !existsSync(profile), remainingOwnedProcesses: remaining.length };
    return cleanupResult;
  }
  try {
    await eventually(async () => {
      try { return await command('GET', '/status', undefined, 1000); } catch { return null; }
    }, value => value?.ready, 'geckodriver did not become ready', 15_000);
    await startSession();
    await installAddon();
    return {
      metadata, execute, executeAsync, command: sessionCommand, switchTo, setContext, sampleMemory, cleanup, installAddon,
      /** Same owned profile, actual browser exit/start; production profile preferences are never touched. */
      async restart({ reinstall = true } = {}) {
        await command('DELETE', `/session/${sessionId}`, undefined, 15_000);
        sessionId = undefined;
        await eventually(() => command('GET', '/status'), value => value.ready, 'Driver did not release the stopped browser');
        await startSession();
        metadata.browserRestarts += 1;
        if (reinstall) await installAddon();
      },
      async open(url, { active = true } = {}) {
        await setContext('content');
        const before = await sessionCommand('GET', '/window/handles');
        await execute('const t = gBrowser.addTrustedTab(arguments[0]); if (arguments[1]) gBrowser.selectedTab = t; return true;', [url, active], 'chrome');
        // Wait in chrome scope until the initial about:blank browsing context is
        // replaced. Switching earlier leaves Marionette on its obsolete context.
        await eventually(() => execute('return Array.from(gBrowser.tabs).some(t => t.linkedBrowser.currentURI.spec === arguments[0] && !t.linkedBrowser.webProgress.isLoadingDocument);', [url], 'chrome'), Boolean, 'Trusted tab did not load');
        await setContext('content');
        const handles = await eventually(() => sessionCommand('GET', '/window/handles'), next => next.length > before.length, 'New browser tab not found');
        const handle = handles.find(value => !before.includes(value));
        await switchTo(handle);
        await eventually(() => execute('return {url:location.href,ready:document.readyState};'), value => value.url === url && value.ready === 'complete', 'Tab did not load');
        return handle;
      },
      async close(handle) { await switchTo(handle); return sessionCommand('DELETE', '/window'); },
      async navigate(url) { await setContext('content'); return sessionCommand('POST', '/url', { url }); },
      async element(selector) { await setContext('content'); return sessionCommand('POST', '/element', { using: 'css selector', value: selector }); },
      async click(selector) { const element = await this.element(selector); return sessionCommand('POST', `/element/${element[elementKey]}/click`, {}); },
      async fill(selector, text) {
        const element = await this.element(selector);
        await sessionCommand('POST', `/element/${element[elementKey]}/clear`, {});
        return sessionCommand('POST', `/element/${element[elementKey]}/value`, { text });
      },
      async screenshot(filename) {
        await setContext('content');
        const encoded = await sessionCommand('GET', '/screenshot');
        await writeFile(path.join(artifactRoot, filename), Buffer.from(encoded, 'base64'));
      },
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
