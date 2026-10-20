/** @spec spec://modules/platform/INFRA-003-local-cli#acceptance */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, cp, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
const run = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
export function powershell(file, args = []) {
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file, ...args],
    { windowsHide: true, timeout: 20000 });
}
export async function nativeChromePackage() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'linguisty-native-package-'));
  await cp(path.join(root, '.output/chrome-mv3'), directory, { recursive: true });
  const manifestPath = path.join(directory, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.deepEqual(manifest.optional_permissions, ['nativeMessaging']);
  // Test copy only: Chromium headless cannot approve the native browser bubble.
  manifest.permissions.push('nativeMessaging'); delete manifest.optional_permissions;
  await writeFile(manifestPath, JSON.stringify(manifest));
  return { directory, cleanup: async () => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('linguisty-native-package-'));
    await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } };
}
export async function nativeFixture(platform, extensionId) {
  assert.equal(os.platform(), 'win32');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'linguisty-native-qa-'));
  const mockFile = path.join(directory, 'fixture.mjs');
  const imports = name => JSON.stringify(new URL('../../native-host/' + name, import.meta.url).href);
  await writeFile(mockFile, [
    'import {createHost} from ' + imports('host.mjs') + ';',
    'import {FrameReader,encodeFrame} from ' + imports('protocol.mjs') + ';',
    'const host=createHost(m=>process.stdout.write(encodeFrame(m)),{}, {',
    'resolve:async()=>({}), run:async r=>JSON.stringify({translations:JSON.parse(r.messages[1].content).nodes.map(n=>({id:n.id,text:"CLI: "+n.text}))})',
    '}); const reader=new FrameReader(); process.stdin.on("data",c=>{for(const m of reader.push(c))host.receive(m)});',
    'process.stdin.on("end",()=>host.close()); process.stdin.on("error",()=>host.close());',
  ].join('\n'));
  const launcher = path.join(directory, 'launch.cmd');
  await writeFile(launcher, '@echo off\r\n"' + process.execPath + '" "' + mockFile + '" %*\r\n');
  const manifest = path.join(directory, platform + '.json');
  await writeFile(manifest, JSON.stringify({ name: 'com.linguisty.cli', description: 'Linguisty isolated QA fixture', path: launcher, type: 'stdio',
    ...(platform === 'chrome' ? { allowed_origins: ['chrome-extension://' + extensionId + '/'] } : { allowed_extensions: ['linguisty@isty.local'] }),
  }));
  const script = path.join(root, 'tests/native/swap-manifest.ps1');
  const { stdout } = await powershell(script, ['-Action', 'set', '-Platform', platform, '-Manifest', manifest]);
  const previous = JSON.parse(stdout).previous;
  return async () => {
    await powershell(script, ['-Action', 'restore', '-Platform', platform, '-Manifest', manifest, ...(previous ? ['-Previous', previous] : [])]);
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('linguisty-native-qa-'));
    await rm(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  };
}
