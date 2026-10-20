// Local deterministic fixture. Never contacts a model or reads credentials.
import { readFile } from 'node:fs/promises';
const mode = process.argv[2];
const provider = process.argv[3];
const translated = JSON.stringify({ translations: [{ id: 'n1', text: 'Привет' }] });
if (mode === 'wait') { setInterval(() => {}, 1000); }
else if (mode === 'oversize') { process.stdout.write('x'.repeat(5 * 1024 * 1024)); setInterval(() => {}, 1000); }
else if (mode === 'login') { process.stderr.write('Authentication required: please log in'); process.exitCode = 1; }
else {
  if (provider === 'antigravity-cli') {
    process.stdout.write(JSON.stringify({ event: 'init', init: { tools: mode === 'unsafe' ? ['read_file'] : [] } }) + '\n');
  }
  if (mode === 'unsafe') { setInterval(() => {}, 1000); }
  else {
    let input = '';
    for await (const chunk of process.stdin) input += chunk.toString();
    if (provider === 'grok-build') input = await readFile(process.argv[process.argv.indexOf('--prompt-file') + 1], 'utf8');
    if (!input.includes('n1')) { process.stderr.write('Missing prompt'); process.exitCode = 2; }
    else if (provider === 'codex-cli') {
      process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: translated } }) + '\n');
      process.stdout.write('{"type":"turn.completed","usage":{"input_tokens":1}}\n');
    } else if (provider === 'antigravity-cli') {
      const event = JSON.parse(input);
      if (event.event !== 'user') process.exitCode = 2;
      else process.stdout.write(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: translated } }) + '\n');
    } else if (provider === 'claude-code') process.stdout.write(JSON.stringify({ type: 'result', structured_output: JSON.parse(translated) }));
    else process.stdout.write(JSON.stringify({ text: translated }));
  }
}
