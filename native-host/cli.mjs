/** @spec spec://modules/platform/INFRA-003-local-cli#execution */
import { spawn } from 'node:child_process';
import { access, readFile, readdir, stat, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const names = { 'codex-cli': 'codex', 'claude-code': 'claude', 'antigravity-cli': 'agy', 'grok-build': 'grok' };
const MAX_STDOUT = 4 * 1024 * 1024;
const MAX_STDERR = 32 * 1024;
const schema = await readFile(path.join(root, 'schema.json'), 'utf8');

async function executable(candidate) {
  try { await access(candidate, os.platform() === 'win32' ? constants.F_OK : constants.X_OK); return (await stat(candidate)).isFile(); }
  catch { return false; }
}
/** Local filesystem only; never reads credentials or calls a model. */
export async function resolveCli(providerId, config = {}) {
  const name = names[providerId];
  if (!name) throw new Error('CLI_NOT_FOUND');
  const candidates = [];
  if (typeof config.executables?.[providerId] === 'string') candidates.push(config.executables[providerId]);
  const ext = os.platform() === 'win32' ? ['.exe', '.cmd'] : [''];
  for (const directory of (process.env.PATH || '').split(path.delimiter).slice(0, 128)) {
    if (directory) for (const suffix of ext) candidates.push(path.join(directory, name + suffix));
  }
  const home = os.homedir();
  if (os.platform() === 'win32') {
    candidates.push(path.join(home, '.local/bin', name + '.exe'), path.join(home, '.grok/bin', name + '.exe'),
      path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData/Local'), 'agy/bin', name + '.exe'));
    if (providerId === 'codex-cli') {
      const bin = path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData/Local'), 'OpenAI/Codex/bin');
      try {
        const directories = (await readdir(bin, { withFileTypes: true })).filter(d => d.isDirectory()).slice(0, 100);
        const installed = await Promise.all(directories.map(async d => {
          const file = path.join(bin, d.name, 'codex.exe');
          return { file, modified: (await stat(file).catch(() => ({ mtimeMs: 0 }))).mtimeMs };
        }));
        candidates.push(...installed.sort((a, b) => b.modified - a.modified).map(row => row.file));
      } catch { /* Desktop app may be absent. */ }
    }
  } else candidates.push(path.join(home, '.local/bin', name));
  for (const candidate of [...new Set(candidates)]) {
    if (!path.isAbsolute(candidate) || !await executable(candidate)) continue;
    if (os.platform() === 'win32' && /\.(?:cmd|ps1)$/i.test(candidate)) {
      const packageEntry = providerId === 'codex-cli' ? 'node_modules/@openai/codex/bin/codex.js'
        : providerId === 'claude-code' ? 'node_modules/@anthropic-ai/claude-code/cli.js' : undefined;
      if (!packageEntry) continue;
      const script = path.join(path.dirname(candidate), packageEntry);
      if (await executable(script)) return { command: process.execPath, prefix: [script] };
    } else if (os.platform() !== 'win32' || candidate.toLowerCase().endsWith('.exe')) return { command: candidate, prefix: [] };
  }
  throw new Error('CLI_NOT_FOUND');
}

export function invocation(providerId, model, workspace, messages) {
  const prompt = messages.map(m => m.role.toUpperCase() + ':\n' + m.content).join('\n\n');
  const selectedModel = model && model !== 'default' ? ['--model', model] : [];
  switch (providerId) {
    case 'codex-cli': return {
      args: ['exec', '--json', '--ephemeral', '--ignore-user-config', '--skip-git-repo-check', '--sandbox', 'read-only',
        '-c', 'features.shell_tool=false', '-c', 'features.unified_exec=false', '-c', 'features.apps=false',
        '-c', 'mcp_servers={}', '-c', 'web_search="disabled"', '--output-schema', path.join(root, 'schema.json'),
        ...selectedModel, '-'], stdin: prompt,
    };
    case 'claude-code': return {
      args: ['-p', '--output-format', 'json', '--json-schema', schema, '--tools', '', '--disallowedTools', 'mcp__*',
        '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--no-session-persistence', '--setting-sources', '',
        '--disable-slash-commands', ...selectedModel], stdin: prompt,
    };
    case 'grok-build': return {
      args: ['--no-auto-update', '--prompt-file', path.join(workspace, 'prompt.txt'), '--output-format', 'json',
        '--json-schema', schema, '--tools', '', '--disallowed-tools', 'Agent', '--no-subagents',
        '--disable-web-search', '--deny', 'MCPTool(*)', '--permission-mode', 'dontAsk', '--max-turns', '1',
        '--verbatim', ...selectedModel], stdin: '',
    };
    case 'antigravity-cli': return {
      args: ['--input-format', 'stream-json', '--output-format', 'stream-json', '--agent', 'linguisty-translator',
        '--json-schema', schema, '--sandbox', ...selectedModel],
      stdin: JSON.stringify({ event: 'user', message: { content: prompt } }) + '\n', waitForInit: true,
    };
    default: throw new Error('CLI_NOT_FOUND');
  }
}

export function readResult(providerId, stdout) {
  let envelope;
  if (providerId === 'codex-cli') {
    let completed = false;
    for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
      const event = JSON.parse(line);
      if (event.type === 'turn.failed' || event.type === 'error') throw new Error('CLI_EXECUTION_FAILED');
      if (event.type === 'turn.completed') completed = true;
      if (event.type === 'item.completed' && event.item?.type === 'agent_message') envelope = event.item.text;
    }
    if (!completed) throw new Error('CLI_EXECUTION_FAILED');
  } else if (providerId === 'antigravity-cli') {
    for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
      const event = JSON.parse(line);
      if (event.event === 'result') {
        if (event.result?.status !== 'SUCCESS') throw new Error('CLI_EXECUTION_FAILED');
        envelope = event.result.response;
      }
    }
  } else {
    const result = JSON.parse(stdout);
    if (result.is_error || result.error || result.status === 'error') throw new Error('CLI_EXECUTION_FAILED');
    const structured = result.structured_output ?? result.structuredOutput;
    envelope = structured ? JSON.stringify(structured) : result.result ?? result.text ?? result.response;
  }
  if (typeof envelope !== 'string' || !envelope.trim() || Buffer.byteLength(envelope, 'utf8') > 700 * 1024) throw new Error('INVALID_MODEL_RESPONSE');
  return envelope;
}

function failureCode(stderr) {
  if (/authentication required|not logged in|please (?:log|sign) in|login required|unauthorized|invalid.*(?:token|api.?key)|401/i.test(stderr)) return 'CLI_LOGIN_REQUIRED';
  if (/rate.?limit|quota.*(?:exhaust|exceed)|429/i.test(stderr)) return 'RATE_LIMIT';
  if (/context.*(?:too long|exceed)|token.*limit/i.test(stderr)) return 'CONTEXT_TOO_LARGE';
  return 'CLI_EXECUTION_FAILED';
}
function terminate(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (os.platform() === 'win32') {
    // PID belongs to this request; never select processes by name or kill a parent CLI.
    const killer = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/taskkill.exe'),
      ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', shell: false });
    killer.on('error', () => { child.kill(); });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
  }
}

async function removeWorkspace(workspace, tempRoot) {
  const target = path.resolve(workspace);
  if (path.dirname(target) !== tempRoot || !path.basename(target).startsWith('linguisty-cli-')) throw new Error('INTERNAL_ERROR');
  await rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

/** Owned workspace is removed only after child close, including aborted runs. */
export async function runCli(request, config, signal, dependencies = {}) {
  const resolve = dependencies.resolve ?? resolveCli;
  const spawnChild = dependencies.spawn ?? spawn;
  const command = await resolve(request.providerId, config);
  if (signal.aborted) throw new Error('CANCELLED');
  const tempRoot = path.resolve(os.tmpdir());
  const workspace = await mkdtemp(path.join(tempRoot, 'linguisty-cli-'));
  try {
    await mkdir(path.join(workspace, '.agents/agents'), { recursive: true });
    await writeFile(path.join(workspace, '.agents/agents/linguisty-translator.md'),
      '---\nname: linguisty-translator\ndescription: Translate supplied text only.\ntools: []\nmainAgent: true\nsubagent: false\n---\nReturn only the requested translation JSON. Never use tools.\n');
    const call = invocation(request.providerId, request.model, workspace, request.messages);
    if (request.providerId === 'grok-build') await writeFile(path.join(workspace, 'prompt.txt'), request.messages.map(m => m.role + ':\n' + m.content).join('\n\n'), { mode: 0o600 });
    if (signal.aborted) throw new Error('CANCELLED');
    return await new Promise((resolveResult, reject) => {
      const child = spawnChild(command.command, [...command.prefix, ...call.args], {
        cwd: workspace, windowsHide: true, shell: false, detached: os.platform() !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1', CI: '1' },
      });
      let stdout = '';
      let stderr = Buffer.alloc(0);
      let stdoutBytes = 0;
      let errorCode;
      let initBuffer = '';
      let sent = !call.waitForInit;
      const stop = code => { errorCode ??= code; terminate(child); };
      const abort = () => stop('CANCELLED');
      signal.addEventListener('abort', abort, { once: true });
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        stdoutBytes += Buffer.byteLength(chunk);
        if (stdoutBytes > MAX_STDOUT) { stop('CONTEXT_TOO_LARGE'); return; }
        stdout += chunk;
        if (!sent && call.waitForInit) {
          initBuffer += chunk;
          if (initBuffer.length > MAX_STDOUT) { stop('INVALID_MODEL_RESPONSE'); return; }
          const newline = initBuffer.indexOf('\n');
          if (newline >= 0) {
            try {
              const initial = JSON.parse(initBuffer.slice(0, newline));
              if (initial.event !== 'init' || !Array.isArray(initial.init?.tools) || initial.init.tools.length) {
                stop('CLI_EXECUTION_FAILED'); return;
              }
              sent = true; initBuffer = ''; child.stdin.end(call.stdin);
            } catch { stop('INVALID_MODEL_RESPONSE'); }
          }
        }
      });
      child.stderr.on('data', chunk => { if (stderr.length < MAX_STDERR) stderr = Buffer.concat([stderr, chunk.subarray(0, MAX_STDERR - stderr.length)]); });
      child.stdin.on('error', () => { /* EPIPE is reported by close and its exit status. */ });
      child.on('error', () => { errorCode = 'CLI_NOT_FOUND'; });
      child.on('close', code => {
        signal.removeEventListener('abort', abort);
        if (errorCode) { reject(new Error(errorCode)); return; }
        if (code !== 0) { reject(new Error(failureCode(stderr.toString('utf8') + stdout.slice(-MAX_STDERR)))); return; }
        try { resolveResult(readResult(request.providerId, stdout)); }
        catch (error) { reject(new Error(failureCode(stderr.toString('utf8')) === 'CLI_LOGIN_REQUIRED' ? 'CLI_LOGIN_REQUIRED' : error.message === 'INVALID_MODEL_RESPONSE' ? error.message : 'CLI_EXECUTION_FAILED')); }
      });
      if (signal.aborted) abort();
      else if (!call.waitForInit) child.stdin.end(call.stdin);
    });
  } finally {
    await removeWorkspace(workspace, tempRoot);
  }
}
