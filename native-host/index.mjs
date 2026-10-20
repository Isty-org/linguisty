/** @spec spec://modules/platform/INFRA-003-local-cli#protocol */
import { readFile } from 'node:fs/promises';
import { FrameReader, encodeFrame } from './protocol.mjs';
import { createHost } from './host.mjs';
let config = {};
try { config = JSON.parse(await readFile(new URL('./config.json', import.meta.url), 'utf8')); }
catch { /* CLI discovery still works without explicit paths. */ }
const reader = new FrameReader();
const host = createHost(message => {
  try { process.stdout.write(encodeFrame(message)); } catch { host.close(); process.stdin.destroy(); }
}, config);
process.stdout.on('error', () => { host.close(); process.stdin.destroy(); });
process.stdin.on('data', chunk => {
  try { for (const message of reader.push(chunk)) host.receive(message); }
  catch { host.close(); reader.clear(); process.stdin.destroy(); process.exitCode = 1; }
});
process.stdin.on('end', () => { host.close(); reader.clear(); });
process.stdin.on('error', () => { host.close(); reader.clear(); });
process.on('SIGTERM', () => { host.close(); process.stdin.destroy(); });
process.on('SIGINT', () => { host.close(); process.stdin.destroy(); });
