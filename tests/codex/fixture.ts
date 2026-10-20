import { generateKeyPairSync, sign } from 'node:crypto';
import { vi } from 'vitest';
import { CODEX_API_ORIGIN, CODEX_AUTH_ORIGIN, CODEX_CALLBACK_URL } from '../../src/codex/protocol';
import { PLAN_SCOPE, type AuthAttempt } from '../../src/codex/auth';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const attempt: AuthAttempt = { state: 'state-value', nonce: 'nonce-value', verifier: 'verifier-value', url: '' };
export const callback = `${CODEX_CALLBACK_URL}?code=unit-code&state=${attempt.state}&client_id=unit-client`;
export function jwt(overrides: Record<string, unknown> = {}, header: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const data = `${encode({ alg: 'RS256', kid: 'unit-key', ...header })}.${encode({ iss: CODEX_AUTH_ORIGIN, aud: 'unit-client',
    nonce: attempt.nonce, sub: 'unit-user', email: 'unit@example.test', exp: now + 3600, iat: now, ...overrides })}`;
  return `${data}.${sign('RSA-SHA256', Buffer.from(data), keys.privateKey).toString('base64url')}`;
}
export const jwks = { keys: [{ ...keys.publicKey.export({ format: 'jwk' }), kid: 'unit-key', use: 'sig', alg: 'RS256' }] };
export function json(value: unknown, status = 200): Response { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }); }
export function complete(content = '{"translations":[{"id":"n1","text":"Привет"}]}'): Response {
  return new Response(`data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output: [
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: content }] },
  ] } })}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
}
export function authFixture() {
  const hooks = { token: {} as Record<string, unknown>, modelStatus: 200, response: () => complete(),
    models: [{ slug: 'unit-model', display_name: 'Unit model', visibility: 'list' }], revokeStatus: 200 };
  const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
    const address = String(url);
    if (address.endsWith('/.well-known/openid-configuration')) return json({ issuer: CODEX_AUTH_ORIGIN,
      jwks_uri: `${CODEX_AUTH_ORIGIN}/unit-jwks`, revocation_endpoint: `${CODEX_AUTH_ORIGIN}/unit-revoke` });
    if (address.endsWith('/unit-jwks')) return json(jwks);
    if (address.endsWith('/oauth/token')) {
      const refresh = new URLSearchParams(init?.body as URLSearchParams).get('grant_type') === 'refresh_token';
      return json({ access_token: refresh ? 'unit-access-next' : 'unit-access', refresh_token: refresh ? 'unit-refresh-next' : 'unit-refresh',
        token_type: 'Bearer', expires_in: 300, scope: PLAN_SCOPE, ...(!refresh ? { id_token: jwt() } : {}), ...hooks.token });
    }
    if (address === `${CODEX_API_ORIGIN}/v1/models`) return json({ models: hooks.models }, hooks.modelStatus);
    if (address === `${CODEX_API_ORIGIN}/v1/responses`) return hooks.response();
    if (address.endsWith('/unit-revoke')) return new Response(null, { status: hooks.revokeStatus });
    throw new Error('Unexpected fixture endpoint');
  });
  return { fetchImpl, hooks };
}
