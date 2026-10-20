// @vitest-environment node
/** @spec spec://modules/platform/INFRA-004-codex-connection#auth */
import { expect, it } from 'vitest';
import { createAuthAttempt, exchangeAuthCode, openIdConfiguration, parseAuthCallback, verifyIdToken } from '../../src/codex/auth';
import { CODEX_AUTH_ORIGIN, CODEX_CALLBACK_URL } from '../../src/codex/protocol';
import { codexErrorReference } from '../../src/codex/failure';
import { attempt, authFixture, callback, json, jwt } from './fixture';
it('uses an opaque host, fresh state/nonce/PKCE and reuses the issued client without a client secret', async () => {
  const first = await createAuthAttempt({ hostId: 'urn:uuid:unit-host' });
  const next = await createAuthAttempt({ hostId: 'urn:uuid:unit-host', clientId: 'issued-client' });
  const a = new URL(first.url), b = new URL(next.url);
  expect(a.origin).toBe(CODEX_AUTH_ORIGIN); expect(a.searchParams.get('client_id')).toBe('dynamic_agent_client');
  expect(a.searchParams.get('agent_name_hint')).toBe('Linguisty'); expect(b.searchParams.has('agent_name_hint')).toBe(false);
  expect(b.searchParams.get('client_id')).toBe('issued-client'); expect(a.searchParams.get('redirect_uri')).toBe(CODEX_CALLBACK_URL);
  expect(first.state).not.toBe(next.state); expect(first.nonce).not.toBe(first.state);
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(first.verifier));
  expect(a.searchParams.get('code_challenge')).toBe(Buffer.from(bytes).toString('base64url'));
  expect(a.searchParams.get('code_challenge_method')).toBe('S256'); expect(a.searchParams.has('client_secret')).toBe(false);
});
it.each([
  callback.replace(attempt.state, 'wrong'), callback + '&state=' + attempt.state,
  callback.replace('127.0.0.1', 'localhost'), callback.replace('/auth/callback', '/other'), callback + '#fragment',
  callback.replace('client_id=unit-client', 'client_id=dynamic_agent_client'), callback + '&code=second', callback + '&client_id=second',
])('rejects invalid callback before exchanging a code: %s', value => {
  expect(() => parseAuthCallback(value, attempt)).toThrow(expect.objectContaining({ code: 'CODEX_AUTH_FAILED' }));
});
it('requires the issued client and handles a refused plan without exposing provider diagnostics', () => {
  expect(parseAuthCallback(callback, attempt)).toEqual({ code: 'unit-code', clientId: 'unit-client' });
  expect(() => parseAuthCallback(callback, { ...attempt, clientId: 'other-client' })).toThrow();
  expect(() => parseAuthCallback(`${CODEX_CALLBACK_URL}?state=${attempt.state}&error=access_denied&error_description=private`, attempt))
    .toThrow(expect.objectContaining({ code: 'CODEX_PLAN_REQUIRED' }));
});
it('verifies RSA signature and identity before accepting credentials and sends only documented form fields', async () => {
  const f = authFixture(), value = await exchangeAuthCode(attempt, callback, f.fetchImpl);
  expect(value).toMatchObject({ clientId: 'unit-client', sub: 'unit-user' });
  const form = new URLSearchParams(f.fetchImpl.mock.calls[0]![1]!.body as URLSearchParams);
  expect([...form.keys()].sort()).toEqual(['client_id', 'code', 'code_verifier', 'grant_type', 'redirect_uri', 'resource']);
  expect(form.get('client_id')).not.toBe('dynamic_agent_client');
});
it('accepts a signed ID token with the issued client as its sole array audience and no azp', async () => {
  const f = authFixture(); f.hooks.token = { id_token: jwt({ aud: ['unit-client'] }) };
  await expect(exchangeAuthCode(attempt, callback, f.fetchImpl)).resolves.toMatchObject({ clientId: 'unit-client', sub: 'unit-user' });
});
it.each([
  { aud: ['unit-client'], azp: 'unit-client' },
  { aud: ['unit-client', 'other-client'], azp: 'unit-client' },
])('accepts the issued authorized party with signed audiences %j', async claims => {
  const f = authFixture(); f.hooks.token = { id_token: jwt(claims) };
  await expect(exchangeAuthCode(attempt, callback, f.fetchImpl)).resolves.toMatchObject({ clientId: 'unit-client' });
});
it.each([
  { aud: ['unit-client'], azp: 'other-client' }, { aud: 'unit-client', azp: 'other-client' },
  { aud: ['unit-client', 'other-client'] }, { aud: ['unit-client', 42], azp: 'unit-client' },
  { aud: [] }, { aud: ['other-client'] },
])('rejects an invalid audience or authorized party %j', async claims => {
  const f = authFixture(); f.hooks.token = { id_token: jwt(claims) };
  await expect(exchangeAuthCode(attempt, callback, f.fetchImpl)).rejects.toMatchObject({ stage: 'identity', reason: 'audience' });
});
it.each([
  [{ iss: 'private-issuer' }, 'issuer'], [{ nonce: 'private-nonce' }, 'nonce'],
  [{ exp: 1 }, 'expiry'], [{ iat: 1e15 }, 'issued_at'], [{ nbf: 1e15 }, 'not_before'], [{ sub: '' }, 'subject'],
] as const)('reports a fixed safe label for rejected claims %j', async (claims, reason) => {
  const f = authFixture(); f.hooks.token = { id_token: jwt(claims) };
  try { await exchangeAuthCode(attempt, callback, f.fetchImpl); throw new Error('Expected validation failure'); }
  catch (error) { expect(codexErrorReference(error)).toBe(`LGT-identity-${reason}`); expect(JSON.stringify(error)).not.toContain('private-'); }
});
it.each([{ iss: 'https://evil.test' }, { aud: 'other-client' }, { nonce: 'other' }, { exp: 1 }, { sub: '' },
  { iat: 1e15 }, { nbf: 1e15 }, { aud: ['unit-client', 'other-client'] }])('rejects invalid signed identity %j', async claims => {
  const f = authFixture(), configuration = await openIdConfiguration(f.fetchImpl);
  await expect(verifyIdToken(jwt(claims), 'unit-client', attempt.nonce, configuration, f.fetchImpl)).rejects.toMatchObject({ code: 'CODEX_AUTH_FAILED' });
});
it('rejects tampered signatures, unsafe algorithms and foreign JWKS endpoints', async () => {
  const f = authFixture(), configuration = await openIdConfiguration(f.fetchImpl);
  const token = jwt(); const parts = token.split('.'); parts[2] = (parts[2]!.startsWith('A') ? 'B' : 'A') + parts[2]!.slice(1);
  await expect(verifyIdToken(parts.join('.'), 'unit-client', attempt.nonce, configuration, f.fetchImpl)).rejects.toMatchObject({ code: 'CODEX_AUTH_FAILED' });
  await expect(verifyIdToken(jwt({}, { alg: 'none' }), 'unit-client', attempt.nonce, configuration, f.fetchImpl)).rejects.toMatchObject({ code: 'CODEX_AUTH_FAILED' });
  await expect(openIdConfiguration(async () => json({ issuer: CODEX_AUTH_ORIGIN, jwks_uri: 'https://evil.test/keys' }))).rejects.toMatchObject({ code: 'CODEX_AUTH_FAILED' });
});
it('does not accept a token without a plan grant or with malformed token attributes', async () => {
  for (const fields of [{ scope: 'openid profile' }, { token_type: {} }, { expires_in: 0 }]) {
    const f = authFixture(); f.hooks.token = fields;
    await expect(exchangeAuthCode(attempt, callback, f.fetchImpl)).rejects.toBeTruthy();
  }
});
