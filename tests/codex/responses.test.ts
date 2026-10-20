// @vitest-environment node
/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
import { expect, it } from 'vitest';
import { readResponses } from '../../src/codex/responses';
import { CODEX_MAX_RESPONSE } from '../../src/codex/protocol';
import { complete } from './fixture';
import { parseTranslations } from '../../src/translation/parser';

function sse(events: unknown[]): Response {
  return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''));
}

function message(text: string, phase = 'final_answer') {
  return { type: 'message', role: 'assistant', phase, status: 'completed', content: [{ type: 'output_text', text }] };
}

/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
it('uses final_answer without concatenating intermediate commentary into translation JSON', async () => {
  const content = '{"translations":[{"id":"n1","text":"Привет"}]}';
  const response = new Response(`data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output: [
    { type: 'message', role: 'assistant', phase: 'commentary', content: [{ type: 'output_text', text: 'I will translate the supplied nodes.' }] },
    { type: 'reasoning', summary: [] },
    { type: 'message', role: 'assistant', phase: 'final_answer', content: [{ type: 'output_text', text: content }] },
  ] } })}\n\n`);
  expect(parseTranslations(await readResponses(response), [{ id: 'n1', text: 'Hello' }])).toEqual([{ id: 'n1', text: 'Привет' }]);
});

/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
it('keeps completed streamed messages when the terminal event does not repeat the output', async () => {
  const content = '{"translations":[{"id":"n1","text":"Привет"}]}';
  const events = [
    { type: 'response.output_item.done', output_index: 0, item: { id: 'm0', type: 'message', role: 'assistant', phase: 'commentary', status: 'completed', content: [{ type: 'output_text', text: 'Intermediate text.' }] } },
    { type: 'response.output_item.done', output_index: 2, item: { id: 'm2', type: 'message', role: 'assistant', phase: 'final_answer', status: 'completed', content: [{ type: 'output_text', text: content }] } },
    { type: 'response.completed', response: { status: 'completed', output: [] } },
  ];
  const response = new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''));
  expect(parseTranslations(await readResponses(response), [{ id: 'n1', text: 'Hello' }])).toEqual([{ id: 'n1', text: 'Привет' }]);
  expect(response.body!.locked).toBe(false);
});

/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
it('deduplicates done and aggregate messages, including an aggregate with additional completed items', async () => {
  const response = sse([
    { type: 'response.output_item.done', output_index: 1, item: message('Привет') },
    { type: 'response.output_item.done', output_index: 1, item: message('Привет') },
    { type: 'response.completed', response: { status: 'completed', output: [message('Commentary.', 'commentary'), message('Привет'), message(' 🌍')] } },
  ]);
  expect(await readResponses(response)).toBe('Привет 🌍');
});

it.each([undefined, null, [], [{ type: 'reasoning', summary: [] }]])('supports a compact completion (%j) after completed output items', async output => {
  const response = sse([
    { type: 'response.output_item.done', output_index: 2, item: message('вет') },
    { type: 'response.output_item.done', output_index: 1, item: message('При') },
    { type: 'response.completed', response: { status: 'completed', output } },
  ]);
  expect(await readResponses(response)).toBe('Привет');
});

/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
it('waits for terminal completion even after a full valid translation message', async () => {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(new ReadableStream({ start(value) { controller = value; } }));
  const completed = { type: 'response.output_item.done', output_index: 0, item: message('Valid final text.') };
  controller!.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(completed)}\n\n`));
  let settled = false;
  const result = readResponses(response).finally(() => { settled = true; });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(settled).toBe(false);
  controller!.enqueue(new TextEncoder().encode('data: {"type":"response.completed","response":{"status":"completed","output":[]}}\n\n'));
  expect(await result).toBe('Valid final text.');
  expect(response.body!.locked).toBe(false);
});

it.each([
  [undefined, 'INVALID_MODEL_RESPONSE'],
  [{ type: 'response.incomplete' }, 'INVALID_MODEL_RESPONSE'],
  [{ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'private-usage' } } }, 'RATE_LIMIT'],
  [{ type: 'response.completed', response: { status: 'incomplete', output: [] } }, 'INVALID_MODEL_RESPONSE'],
])('does not commit done text when the stream fails or ends before completion (%j)', async (terminal, code) => {
  const events: unknown[] = [{ type: 'response.output_item.done', output_index: 0, item: message('private-source') }];
  if (terminal) events.push(terminal);
  const response = sse(events);
  const error = await readResponses(response).catch(value => value);
  expect(error.code).toBe(code); expect(error.message).not.toContain('private');
  expect(response.body!.locked).toBe(false);
});

it.each([
  [{ ...message('private-source'), role: 'user' }, 'LGT-response-message'],
  [{ ...message('private-source'), content: null }, 'LGT-response-message'],
  [message('private-source', 'private-phase'), 'LGT-response-phase'],
  [{ ...message('private-source'), status: 'in_progress' }, 'LGT-response-status'],
  [{ ...message('private-source'), content: [{ type: 'output_text', text: 7 }] }, 'LGT-response-part'],
  [{ ...message('private-source'), content: [{ type: 'refusal', refusal: 'private-refusal' }] }, 'LGT-response-refusal'],
  [message('', 'commentary'), 'LGT-response-commentary'],
  [message(''), 'LGT-response-empty'],
])('reports a fixed message shape reason without content (%j)', async (item, reference) => {
  const response = sse([{ type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response: { status: 'completed', output: [] } }]);
  const error = await readResponses(response).catch(value => value);
  expect(error.code).toBe('INVALID_MODEL_RESPONSE'); expect(error.message).toContain(`[${reference}]`);
  expect(error.message).not.toContain('private'); expect(response.body!.locked).toBe(false);
});

it.each([-1, 128, 1.5, '0', null])('rejects unsafe or unbounded output indexes (%j)', async output_index => {
  const response = sse([{ type: 'response.output_item.done', output_index, item: message('private-source') },
    { type: 'response.completed', response: { status: 'completed', output: [] } }]);
  await expect(readResponses(response)).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE', message: expect.stringContaining('[LGT-response-output]') });
});

it.each(['duplicate', 'aggregate', 'phase'])('rejects contradictory completed messages (%s)', async conflict => {
  const final = message('private-source');
  const done = { type: 'response.output_item.done', output_index: 0, item: final };
  const terminal = { type: 'response.completed', response: { status: 'completed', output: conflict === 'aggregate' ? [message('private-other')] : conflict === 'phase' ? [message('private-source', 'commentary')] : [] } };
  const response = sse(conflict === 'duplicate' ? [done, { ...done, item: message('private-other') }, terminal] : [done, terminal]);
  const error = await readResponses(response).catch(value => value);
  expect(error.message).toContain('[LGT-response-conflict]'); expect(error.message).not.toContain('private');
  expect(response.body!.locked).toBe(false);
});

it('bounds aggregate slots and rejects invalid terminal output shape', async () => {
  await expect(readResponses(sse([{ type: 'response.completed', response: { status: 'completed', output: Array.from({ length: 129 }, () => ({ type: 'reasoning' })) } }]))).rejects.toMatchObject({ message: expect.stringContaining('[LGT-response-limit]') });
  await expect(readResponses(sse([{ type: 'response.completed', response: { status: 'completed', output: 'private-output' } }]))).rejects.toMatchObject({ message: expect.stringContaining('[LGT-response-output]') });
});

/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
it.each(['\n', '\r\n', '\r'])('reads SSE line ending %j even when delimiters and UTF-8 bytes cross chunks', async ending => {
  const frame = (await complete('Привет 🌍').text()).replaceAll('\n', ending);
  const source = new TextEncoder().encode(': keepalive' + ending + ending + frame);
  let cancelled = 0;
  const response = new Response(new ReadableStream({ start(controller) {
    for (const byte of source) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  }, cancel() { cancelled++; } }));
  expect(await readResponses(response)).toBe('Привет 🌍');
  expect(response.body!.locked).toBe(false); expect(cancelled).toBeLessThanOrEqual(1);
});
it('accepts only a completed response and reads UTF-8 correctly across arbitrary chunk boundaries', async () => {
  const source = new Uint8Array(await complete('Привет 🌍').arrayBuffer()); let cancelled = false;
  const response = new Response(new ReadableStream({ start(controller) {
    for (const byte of source) controller.enqueue(Uint8Array.of(byte));
  }, cancel() { cancelled = true; } }));
  expect(await readResponses(response)).toBe('Привет 🌍'); expect(cancelled).toBe(true);
});
it.each([
  'data: {"type":"response.output_text.delta","delta":"partial"}\n\n', 'data: [DONE]\n\n',
  'data: {"type":"response.incomplete"}\n\n', 'data: malformed\n\n',
  'data: {"type":"response.completed","response":{"status":"incomplete","output":[]}}\n\n',
])('does not treat partial or invalid events as a successful translation', async data => {
  await expect(readResponses(new Response(data))).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
});
it.each([['subscription_sharing_usage_limit_exceeded', 'RATE_LIMIT'], ['subscription_sharing_usage_unavailable', 'CODEX_PLAN_REQUIRED']])('maps plan failures after stream start without leaking messages', async (code, expected) => {
  const error = await readResponses(new Response(`data: ${JSON.stringify({ type: 'response.failed', response: { error: { code, message: 'private text' } } })}\n\n`)).catch(value => value);
  expect(error.code).toBe(expected); expect(error.message).not.toContain('private text');
});
it('bounds response bytes and rejects refusals', async () => {
  await expect(readResponses(new Response('data: ' + 'x'.repeat(CODEX_MAX_RESPONSE)))).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
  await expect(readResponses(new Response('data: {"type":"response.completed","response":{"status":"completed","output":[{"type":"message","role":"assistant","content":[{"type":"refusal","refusal":"no"}]}]}}\n\n'))).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
});

/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
it.each([
  ['commentary', 'completed', 'output_text'], ['private-phase', 'completed', 'output_text'],
  ['final_answer', 'in_progress', 'output_text'], ['final_answer', 'completed', 'refusal'],
])('rejects commentary-only, unknown phase, unfinished message or refusal (%s/%s/%s)', async (phase, status, type) => {
  const response = new Response(`data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output: [
    { type: 'message', role: 'assistant', phase, status, content: [{ type, text: 'private-source', refusal: 'private-refusal' }] },
  ] } })}\n\n`);
  const error = await readResponses(response).catch(value => value);
  expect(error.code).toBe('INVALID_MODEL_RESPONSE'); expect(error.message).toMatch(/\[LGT-response-(commentary|phase|status|refusal)\]$/);
  expect(error.message).not.toMatch(/private/); expect(response.body!.locked).toBe(false);
});

it.each([
  ['data: malformed\n\n', 'LGT-response-json'],
  ['data: {"type":"response.output_text.delta","delta":"private-source"}\n\n', 'LGT-response-completion'],
  ['data: ' + 'x'.repeat(CODEX_MAX_RESPONSE), 'LGT-response-limit'],
])('distinguishes malformed framing, missing completion and size limit without body text', async (data, reference) => {
  const response = new Response(data), error = await readResponses(response).catch(value => value);
  expect(error.code).toBe('INVALID_MODEL_RESPONSE'); expect(error.message).toContain(`[${reference}]`);
  expect(error.message).not.toContain('private-source'); expect(response.body!.locked).toBe(false);
});
