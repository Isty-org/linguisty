/** @spec spec://modules/platform/INFRA-003-local-cli#acceptance */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { endianness, platform, tmpdir } from 'node:os';
import path from 'node:path';
import { FrameReader, encodeFrame, MAX_FRAME_BYTES, PROVIDERS, validateRequest } from '../../native-host/protocol.mjs';
import { createHost } from '../../native-host/host.mjs';
import { invocation, readResult, resolveCli, runCli } from '../../native-host/cli.mjs';
const fixture = fileURLToPath(new URL('./fake-cli.mjs', import.meta.url));
const request = (id = 'test', type = 'translate', providerId = 'codex-cli') => ({
  version: 1, id, type, providerId, model: 'default', timeoutMs: 1000,
  ...(type === 'translate' ? { messages: [{ role: 'system', content: 'Translate only.' }, { role: 'user', content: '{"id":"n1","text":"Hello"}' }] } : {}),
});
const idle = () => delay(10);

test('Windows npm shims resolve to official package entrypoints without a shell, including PowerShell shims', { skip: platform() !== 'win32' }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'linguisty-cli-shim-'));
  try {
    for (const [providerId, name, entry] of [
      ['codex-cli', 'codex', 'node_modules/@openai/codex/bin/codex.js'],
      ['claude-code', 'claude', 'node_modules/@anthropic-ai/claude-code/cli.js'],
    ]) {
      const script = path.join(directory, entry);
      await mkdir(path.dirname(script), { recursive: true }); await writeFile(script, '// Resolver fixture, never executed.\n');
      for (const extension of ['.cmd', '.ps1']) {
        const shim = path.join(directory, name + extension);
        await writeFile(shim, 'resolver fixture only');
        assert.deepEqual(await resolveCli(providerId, { executables: { [providerId]: shim } }), { command: process.execPath, prefix: [script] });
      }
    }
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('linguisty-cli-shim-'));
    await rm(directory, { recursive: true, force: true });
  }
});

test('native framing accepts fragmented Unicode and multiple messages; rejects oversized, truncated and invalid UTF-8 input', () => {
  const value = { id: 'тест', data: 'Привет 👋' };
  const frame = encodeFrame(value);
  const reader = new FrameReader();
  const received = [];
  for (const byte of frame) received.push(...reader.push(Buffer.from([byte])));
  assert.deepEqual(received, [value]);
  assert.deepEqual(reader.push(Buffer.concat([frame, frame])), [value, value]);
  reader.end();
  reader.push(frame.subarray(0, 6));
  assert.throws(() => reader.end(), /INVALID_MODEL_RESPONSE/);
  reader.clear();
  const size = Buffer.alloc(4);
  size[endianness() === 'LE' ? 'writeUInt32LE' : 'writeUInt32BE'](MAX_FRAME_BYTES + 1);
  assert.throws(() => reader.push(size), /CONTEXT_TOO_LARGE/);
  reader.clear();
  size[endianness() === 'LE' ? 'writeUInt32LE' : 'writeUInt32BE'](1);
  assert.throws(() => reader.push(Buffer.concat([size, Buffer.from([0xff])])), /encoded data/);
});

test('wire contract rejects arbitrary commands, paths, flags, keys, roles and control characters', () => {
  for (const change of [
    { providerId: 'arbitrary.exe' }, { command: 'cmd.exe' }, { args: ['--dangerously-skip-permissions'] },
    { apiKey: 'forbidden' }, { model: 'default\n--flag' }, { timeoutMs: 120001 },
    { messages: [{ role: 'user', content: 'source' }] }, { id: '../escape' },
  ]) assert.throws(() => validateRequest({ ...request(), ...change }), /INVALID_SETTINGS/);
  for (const provider of PROVIDERS) assert.equal(validateRequest(request('test', 'status', provider)).providerId, provider);
  assert.throws(() => validateRequest({ ...request('a', 'status'), messages: [] }), /INVALID_SETTINGS/);
});

test('status probes only filesystem resolution and never starts a CLI', async () => {
  let launches = 0;
  const sent = [];
  const host = createHost(v => sent.push(v), {}, {
    resolve: async id => { if (id === 'claude-code') throw new Error('CLI_NOT_FOUND'); },
    run: async () => { launches++; return 'unexpected'; },
  });
  host.receive(request('one', 'status'));
  host.receive(request('two', 'status', 'claude-code'));
  await idle();
  assert.deepEqual(sent.map(v => [v.id, v.ok, v.data?.available, v.code]), [
    ['one', true, true, undefined], ['two', false, undefined, 'CLI_NOT_FOUND'],
  ]);
  assert.equal(launches, 0);
  assert.deepEqual(host.resources(), { pending: 0, queued: 0, active: 0 });
  host.close();
});

test('host serializes inference, bounds its queue and releases duplicate, cancelled and completed jobs', async () => {
  const sent = [], running = [];
  let active = 0, peak = 0;
  const host = createHost(v => sent.push(v), {}, { run: (r, _config, signal) => new Promise((resolve, reject) => {
    active++; peak = Math.max(peak, active);
    running.push({ id: r.id, resolve: value => { active--; resolve(value); } });
    signal.addEventListener('abort', () => { active--; reject(new Error('CANCELLED')); }, { once: true });
  }) });
  for (let i = 0; i < 17; i++) host.receive(request('job-' + i));
  assert.deepEqual(host.resources(), { pending: 16, queued: 15, active: 1 });
  assert.equal(sent[0].code, 'RATE_LIMIT');
  host.receive(request('job-0'));
  assert.equal(running.length, 1);
  for (let i = 1; i < 16; i++) host.receive({ version: 1, type: 'cancel', id: 'job-' + i });
  // Repeated cancellations cannot retain removed queued text.
  for (let i = 0; i < 100; i++) {
    host.receive(request('loop-' + i));
    host.receive({ version: 1, type: 'cancel', id: 'loop-' + i });
  }
  assert.deepEqual(host.resources(), { pending: 1, queued: 0, active: 1 });
  running[0].resolve('{"translations":[]}');
  await idle();
  assert.equal(peak, 1);
  assert.deepEqual(host.resources(), { pending: 0, queued: 0, active: 0 });
  assert.equal(sent.filter(v => v.id === 'job-0').length, 1);
  host.close();
});

test('timeout and disconnect abort owned requests, suppress late replies and return resources to zero', async () => {
  const sent = [];
  let aborted = 0;
  const host = createHost(v => sent.push(v), {}, { run: (_r, _c, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { aborted++; reject(new Error('CANCELLED')); }, { once: true });
  }) });
  host.receive(request('timeout'));
  await delay(1050);
  assert.equal(sent[0].code, 'REQUEST_TIMEOUT');
  assert.deepEqual(host.resources(), { pending: 0, queued: 0, active: 0 });
  host.receive(request('disconnect'));
  host.receive(request('queued'));
  host.close();
  await idle();
  assert.equal(aborted, 2);
  assert.deepEqual(host.resources(), { pending: 0, queued: 0, active: 0 });
  assert.equal(sent.length, 1);
});

test('all CLI invocations disable tools, keep model names in a single argument and use private prompt transport', () => {
  const model = 'example & touch HACKED';
  for (const id of PROVIDERS) {
    const call = invocation(id, model, 'private-workspace', request().messages);
    assert.equal(call.args[call.args.indexOf('--model') + 1], model);
    assert.equal(call.args.includes(request().messages[1].content), false);
    if (id === 'codex-cli') { assert.ok(call.args.includes('--ignore-user-config')); assert.ok(call.args.includes('features.shell_tool=false')); }
    else if (id !== 'antigravity-cli') assert.equal(call.args[call.args.indexOf('--tools') + 1], '');
    else assert.equal(call.waitForInit, true);
  }
  assert.throws(() => readResult('codex-cli', '{"type":"item.completed","item":{"type":"agent_message","text":"{}"}}\n'), /CLI_EXECUTION_FAILED/);
  assert.throws(() => readResult('grok-build', '{"text":""}'), /INVALID_MODEL_RESPONSE/);
  assert.throws(() => readResult('claude-code', '{"is_error":true,"result":"secret diagnostic"}'), /CLI_EXECUTION_FAILED/);
});

for (const provider of PROVIDERS) test('real child process: ' + provider + ' stdin, envelope and owned workspace cleanup', async () => {
  let directory, child;
  const result = await runCli(request('fixture', 'translate', provider), {}, new AbortController().signal, {
    resolve: async () => ({ command: process.execPath, prefix: [fixture, 'success', provider] }),
    spawn: (command, args, options) => {
      assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
      directory = options.cwd; child = spawn(command, args, options); return child;
    },
  });
  assert.deepEqual(JSON.parse(result).translations, [{ id: 'n1', text: 'Привет' }]);
  assert.equal(child.exitCode, 0);
  await assert.rejects(access(directory), { code: 'ENOENT' });
});

for (const [mode, expected, provider] of [
  ['wait', 'CANCELLED', 'codex-cli'], ['oversize', 'CONTEXT_TOO_LARGE', 'codex-cli'],
  ['login', 'CLI_LOGIN_REQUIRED', 'grok-build'], ['unsafe', 'CLI_EXECUTION_FAILED', 'antigravity-cli'],
]) test('real child process: ' + mode + ' stops without leaked process or workspace', async () => {
  let directory, child;
  const controller = new AbortController();
  const promise = runCli(request('negative', 'translate', provider), {}, controller.signal, {
    resolve: async () => ({ command: process.execPath, prefix: [fixture, mode, provider] }),
    spawn: (command, args, options) => {
      directory = options.cwd; child = spawn(command, args, options);
      if (mode === 'wait') setTimeout(() => controller.abort(), 100);
      return child;
    },
  });
  await assert.rejects(promise, { message: expected });
  assert.ok(child.exitCode !== null || child.signalCode !== null);
  await assert.rejects(access(directory), { code: 'ENOENT' });
});
