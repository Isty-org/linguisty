/** @spec spec://common/PROP-002-quality#checks */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixturesRoot = fileURLToPath(new URL('../fixtures/', import.meta.url));
export const MOCK_KEY = 'linguisty-qa-local-credential';
export const JOURNAL_ECHO = '日本語';
const textMap = new Map([
  ['日本語の見出し', 'Заголовок страницы'],
  ['この地域には静かな公園と便利な商店があります。', 'В этом районе есть тихий парк и удобные магазины.'],
  ['写真の説明', 'Подпись к фотографии'],
  ['短い説明', 'Краткое описание'],
  ['Заголовок страницы', '日本語の見出し'],
  ['В этом районе есть тихий парк и удобные магазины.', 'この地域には静かな公園と便利な商店があります。'],
  ['Подпись к фотографии', '写真の説明'],
  ['Краткое описание', '短い説明'],
  ['Appartement lumineux à Lyon', 'Светлая квартира в Лионе'],
  ['Appartement de 68 m², 3 pièces, situé au 2e étage avec balcon.', 'Квартира 68 m², 3 комнаты, на 2-м этаже с балконом.'],
  ['Prix : 245 000 € — charges : 120 €/mois', 'Цена: 245 000 € — расходы: 120 €/месяц'],
  ['Informations sur le quartier', 'Информация о районе'],
  ['Les commerces et les écoles sont accessibles à pied.', 'Магазины и школы находятся в пешей доступности.'],
  ['Maisons disponibles à Nantes', 'Доступные дома в Нанте'],
  ['Le logement est disponible immédiatement.', 'Жильё доступно сразу.'],
  ['Hello', 'Здравствуйте'],
  ['人工智能', 'Искусственный интеллект'], ['人工', 'Искусственный'], ['智能', 'интеллект'],
  ['可以', 'может'], ['学习。', 'обучаться.'], ['研究', 'Исследования'], ['操作', 'Действие'], ['[1]', '[1]'],
]);

export function translatedText(text) {
  if (text.includes('长段测试')) return 'Переведённая часть длинного абзаца.';
  return textMap.get(text.trim()) ?? `Перевод: ${text.trim()}`;
}

/** Bounded loopback gateway; never forwards requests to an external API. */
export async function startLocalServer() {
  const requests = [];
  const timers = new Set();
  const sockets = new Set();
  let mode = 'ok';
  let delayMs = 0;
  let activeRequests = 0;
  let maximumActiveRequests = 0;
  const server = createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/v1/models') {
      response.setHeader('Content-Type', 'application/json');
      if (mode === 'unauthorized') {
        response.writeHead(401, { 'x-request-id': 'mock-models-request' });
        response.end(JSON.stringify({ error: { code: 401, message: `Account restricted by local gateway ${request.headers.authorization ?? ''}`, metadata: { error_type: 'authentication' } } }));
        return;
      }
      response.end(JSON.stringify({ data: [{ id: 'qa/mock-model', name: 'Local QA Mock' }] }));
      return;
    }
    if (url.pathname === '/v1/chat/completions' && request.method === 'POST') {
      activeRequests++;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      let completed = false;
      let timer;
      let record;
      const finish = () => {
        if (completed) return;
        completed = true;
        activeRequests--;
        if (record) { record.closedAt = Date.now(); record.aborted = !response.writableEnded; }
        if (timer) { clearTimeout(timer); timers.delete(timer); }
      };
      response.once('close', finish);
      try {
        const chunks = [];
        let bytes = 0;
        for await (const chunk of request) {
          bytes += chunk.length;
          assert.ok(bytes <= 128 * 1024, 'Mock received an oversized request.');
          chunks.push(chunk);
        }
        const bodyString = Buffer.concat(chunks).toString('utf8');
        const body = JSON.parse(bodyString);
        const input = JSON.parse(body.messages.find(message => message.role === 'user').content);
        assert.ok(Array.isArray(input.nodes) && input.nodes.length <= 40, 'Invalid mock input.');
        assert.ok(requests.length < 500, 'Mock request history limit exceeded.');
        const requestMode = mode;
        record = { model: body.model, nodes: input.nodes.map(({ id, text }) => ({ id, text })), context: input.pageContext, authorized: request.headers.authorization === `Bearer ${MOCK_KEY}`, keyInBody: bodyString.includes(MOCK_KEY), mode: requestMode, streaming: body.stream === true, startedAt: Date.now() };
        requests.push(record);
        if (requestMode === 'stream-unsupported' && body.stream === true) {
          response.writeHead(422, { 'Content-Type': 'application/json' });
          response.end('{"error":{"code":"unsupported_parameter","param":"stream"}}');
          return;
        }
        if (requestMode === 'journal-echo') {
          // Echo a real short page fragment through prose, encoded prose and an ID.
          const fragment = input.nodes.find(node => node.text.includes(JOURNAL_ECHO))?.text.slice(0, JOURNAL_ECHO.length);
          assert.equal(fragment, JOURNAL_ECHO, 'Journal fixture fragment missing from request.');
          response.writeHead(400, { 'Content-Type': 'application/json', 'x-request-id': `${encodeURIComponent(fragment)}-250` });
          response.end(JSON.stringify({ error: { code: 'invalid_request_error', type: 'invalid_request_error',
            message: `Invalid field: ${fragment} / 250 EUR`, metadata: { error_type: 'account_restricted',
              raw: JSON.stringify({ error: { message: `${encodeURIComponent(fragment)} owes 250 EUR` } }) } } }));
          return;
        }
        if (requestMode.startsWith('stream') && requestMode !== 'stream-unsupported' && body.stream === true) {
          response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'x-generation-id': 'mock-stream-generation' });
          response.flushHeaders();
          const translations = input.nodes.map(node => ({ id: node.id, text: translatedText(node.text) }));
          const event = value => `data: ${JSON.stringify(value)}\r\n\r\n`;
          const delta = content => event({ id: 'mock-stream-generation', choices: [{ index: 0, delta: { content }, finish_reason: null }] });
          const schedule = (action, ms) => { timer = setTimeout(() => { timers.delete(timer); if (!response.destroyed) action(); }, ms); timers.add(timer); };
          schedule(() => {
            const prefix = `{"translations":[${JSON.stringify(translations[0])}${translations.length > 1 ? ',' : ''}`;
            // Deliberately split model JSON and a UTF-8 SSE body; no forwarding to a paid API.
            const wire = Buffer.from(': keepalive\r\n\r\n' + delta(prefix.slice(0, 25)) + delta(prefix.slice(25)), 'utf8');
            response.write(wire.subarray(0, 33)); response.write(wire.subarray(33)); record.firstAt = Date.now();
            schedule(() => {
              if (requestMode === 'stream-drop') { response.destroy(); return; }
              if (requestMode === 'stream-error') { response.end(event({ error: { code: 401, message: `Stream rejected ${request.headers.authorization ?? ''}` } })); return; }
              let remaining = translations.slice(1);
              if (requestMode === 'stream-duplicate') remaining[0] = translations[0];
              if (requestMode === 'stream-unknown' && remaining[0]) remaining[0] = { ...remaining[0], id: 'unknown-stream-id' };
              if (requestMode === 'stream-missing') remaining = remaining.slice(0, -1);
              response.write(delta(`${remaining.map(item => JSON.stringify(item)).join(',')}]} `));
              response.write(event({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }));
              response.write(event({ choices: [], usage: { total_tokens: 25 } }));
              record.finishedAt = Date.now(); response.end('data: [DONE]\r\n\r\n');
            }, Math.max(200, delayMs - 30));
          }, 30);
          return;
        }
        const reply = () => {
          timers.delete(timer);
          if (response.destroyed) return;
          response.setHeader('Content-Type', 'application/json');
          if (requestMode === 'unauthorized' || requestMode === 'rate-limit') {
            const status = requestMode === 'unauthorized' ? 401 : 429;
            response.writeHead(status, { 'Retry-After': '0', 'x-request-id': 'mock-chat-request' });
            response.end(JSON.stringify({ error: { code: status, message: `${status === 401 ? 'Account restricted' : 'Rate limit reached'} by local gateway ${request.headers.authorization ?? ''} <img src=x>`, metadata: { error_type: status === 401 ? 'authentication' : 'rate_limit_exceeded' } } }));
          } else if (requestMode === 'truncate-large' && (input.nodes.length > 8 || input.nodes.length === 1 && input.nodes[0].text.length > 500)) {
            record.finishedAt = Date.now();
            response.end(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{"translations":[' } }] }));
          } else if (requestMode === 'malformed') response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"translations":[' } }] }));
          else {
            const translations = input.nodes.map(node => ({ id: requestMode === 'unknown-id' ? `wrong-${node.id}` : node.id, text: requestMode === 'html-text' ? '<img src=x onerror="window.injectionRan=true">' : translatedText(node.text) }));
            record.finishedAt = Date.now();
            response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ translations }) } }] }));
          }
        };
        if (delayMs > 0) { timer = setTimeout(reply, delayMs); timers.add(timer); }
        else reply();
      } catch {
        if (!response.destroyed) response.writeHead(400).end('{"error":{"message":"Invalid bounded mock request"}}');
      }
      return;
    }
    try {
      const filename = url.pathname === '/' ? 'real-estate.html' : decodeURIComponent(url.pathname).slice(1);
      assert.ok(/^[a-z\d-]+\.(?:html|css|js)$/.test(filename), 'Invalid fixture filename.');
      const file = await readFile(path.join(fixturesRoot, filename));
      response.setHeader('Content-Type', filename.endsWith('.html') ? 'text/html; charset=utf-8' : filename.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8');
      response.end(file);
    } catch { response.writeHead(404).end('Fixture not found'); }
  });
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin, requests,
    setMode(nextMode, nextDelayMs = 0) {
      assert.ok(['ok', 'unauthorized', 'journal-echo', 'rate-limit', 'malformed', 'unknown-id', 'html-text', 'truncate-large', 'stream', 'stream-duplicate', 'stream-unknown', 'stream-missing', 'stream-error', 'stream-drop', 'stream-unsupported'].includes(nextMode));
      assert.ok(nextDelayMs >= 0 && nextDelayMs <= 10_000);
      mode = nextMode;
      delayMs = nextDelayMs;
    },
    metrics() { return { requests: requests.length, activeRequests, maximumActiveRequests, pendingTimers: timers.size }; },
    async close() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      for (const socket of sockets) socket.destroy();
      await closed;
    },
  };
}
