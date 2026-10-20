/** @spec spec://modules/platform/INFRA-004-codex-connection#changelog */
import { generateKeyPairSync } from 'node:crypto';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const codexFixture = { privateKey: keys.privateKey.export({ format: 'jwk' }),
  publicKey: { ...keys.publicKey.export({ format: 'jwk' }), kid: 'qa-key', use: 'sig', alg: 'RS256' } };
/** Runs only in a QA connection page. The production package is never modified. No network or real account is used. */
export async function installCodexFixture(fixture) {
  const scope = window.wrappedJSObject ?? window;
  const api = scope.browser ?? scope.chrome;
  const originalUpdate = api.tabs.update.bind(api.tabs);
  let nonce; let account = 'qa-user';
  const calls = { models: 0, responses: 0, token: 0, tokenStatus: 200, invalidNonce: false, unexpected: 0, completed: true, emptyOutput: false, callback: 0, redirected: 0 };
  scope.__linguistyCodexQa = calls;
  scope.__linguistyCodexQaSwitchAccount = value => { account = value; };
  for (const [area, method] of [['tabs', 'getCurrent'], ['tabs', 'create'], ['declarativeNetRequest', 'updateSessionRules']]) {
    if (!api[area]?.[method]) continue;
    const original = api[area][method].bind(api[area]);
    api[area][method] = (...args) => {
      calls.stage = method;
      const result = original(...args);
      return result?.then ? result.then(value => { calls.stage = method + '-done'; return value; }, error => { calls.stage = method + '-error'; throw error; }) : result;
    };
  }
  api.runtime.onMessage.addListener((message, sender) => {
    if (message.channel === 'linguisty-codex-callback') {
      calls.callback++; calls.sender = { id: sender.id, tabId: sender.tab?.id, path: sender.url?.split(/[?#]/)[0] };
    }
  });
  api.tabs.update = (id, properties, ...rest) => {
    if (properties?.url?.startsWith('https://auth.openai.com/api/accounts/authorize?')) {
      const url = new URL(properties.url); nonce = url.searchParams.get('nonce');
      calls.redirected++;
      const callback = new URL('http://127.0.0.1:1455/auth/callback');
      callback.searchParams.set('state', url.searchParams.get('state')); callback.searchParams.set('code', 'qa-code');
      callback.searchParams.set('client_id', url.searchParams.get('client_id') === 'dynamic_agent_client' ? 'qa-client' : url.searchParams.get('client_id'));
      if (fixture.deferCallback || fixture.webCallback) {
        calls.pendingCallback = callback.href;
        return originalUpdate(id, fixture.webCallback ? properties : { ...properties, url: 'about:blank#linguisty-codex-qa' }, ...rest);
      }
      return originalUpdate(id, { ...properties, url: callback.href }, ...rest);
    }
    return originalUpdate(id, properties, ...rest);
  };
  const key = await crypto.subtle.importKey('jwk', fixture.privateKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const base64 = value => btoa(String.fromCharCode(...value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const encode = value => base64(new TextEncoder().encode(JSON.stringify(value)));
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  scope.fetch = async (input, init) => {
    const url = String(input);
    if (url === 'https://auth.openai.com/.well-known/openid-configuration') return json({ issuer: 'https://auth.openai.com',
      jwks_uri: 'https://auth.openai.com/qa-jwks', revocation_endpoint: 'https://auth.openai.com/qa-revoke' });
    if (url === 'https://auth.openai.com/qa-jwks') return json({ keys: [fixture.publicKey] });
    if (url === 'https://auth.openai.com/qa-revoke') return new Response(null, { status: 200 });
    if (url === 'https://auth.openai.com/api/accounts/oauth/token') {
      calls.token++; const now = Math.floor(Date.now() / 1000); const clientId = new URLSearchParams(init.body).get('client_id');
      if (calls.tokenStatus !== 200) return json({ error: 'invalid_grant', error_description: 'qa-private-provider-description' }, calls.tokenStatus);
      const data = `${encode({ alg: 'RS256', kid: 'qa-key' })}.${encode({ iss: 'https://auth.openai.com', aud: [clientId],
        nonce: calls.invalidNonce ? 'qa-private-wrong-nonce' : nonce, sub: account, email: 'qa@example.test', iat: now, exp: now + 3600 })}`;
      const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
      return json({ access_token: 'qa-access', refresh_token: 'qa-refresh', token_type: 'Bearer', expires_in: 3600,
        scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct', id_token: `${data}.${base64(new Uint8Array(signature))}` });
    }
    if (url === 'https://api.openai.com/v1/models') { calls.models++; return json({ models: [{ slug: 'gpt-6-luna', display_name: 'GPT-6 Luna (fixture)', visibility: 'list' }] }); }
    if (url === 'https://api.openai.com/v1/responses') {
      calls.responses++; const body = JSON.parse(init.body);
      if (body.model !== 'gpt-6-luna' || body.store !== false || body.stream !== true || body.input[0].role !== 'developer'
        || Object.keys(body).length !== 5 || body.text?.format?.type !== 'json_schema' || body.text.format.name !== 'linguisty_translations'
        || body.text.format.strict !== true || body.text.format.schema?.additionalProperties !== false) throw new Error('Unsupported Responses fields');
      if (!calls.completed) return new Response('data: {"type":"response.incomplete"}\n\n');
      const source = JSON.parse(body.input[1].content);
      const text = JSON.stringify({ translations: source.nodes.map(node => ({ id: node.id, text: 'Codex QA: ' + node.text })) });
      const events = calls.emptyOutput ? [
        { type: 'response.output_item.done', output_index: 0, item: { type: 'reasoning', summary: [] } },
        { type: 'response.completed', response: { status: 'completed', output: [] } },
      ] : [
        { type: 'response.output_item.done', output_index: 0, item: { type: 'message', role: 'assistant', phase: 'commentary', status: 'completed', content: [{ type: 'output_text', text: 'Intermediate QA commentary, not translation JSON.' }] } },
        { type: 'response.output_item.done', output_index: 1, item: { type: 'reasoning', summary: [] } },
        { type: 'response.output_item.done', output_index: 2, item: { type: 'message', role: 'assistant', phase: 'final_answer', status: 'completed', content: [{ type: 'output_text', text }] } },
        { type: 'response.completed', response: { status: 'completed', output: [] } },
      ];
      return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } });
    }
    calls.unexpected++; throw new Error('QA blocks real network access');
  };
  scope.__linguistyCodexQaAccount = value => { account = value; };
  return true;
}
