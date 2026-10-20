/** @spec spec://modules/platform/INFRA-004-codex-connection#auth */
import { LinguistyError } from '../shared/errors';
import { fetchCodexJson } from './http';
import { CodexFailure } from './failure';
import { boundedText, CODEX_AUTH_ORIGIN, CODEX_CALLBACK_URL, object } from './protocol';

export const PLAN_SCOPE = 'chatgpt.tokens.use.direct';
export const RESOURCE = 'https://api.openai.com/v1';
export interface CodexRegistration { hostId: string; clientId?: string }
export interface AuthAttempt { state: string; nonce: string; verifier: string; clientId?: string; url: string }
export interface CodexCredentials { accessToken: string; refreshToken?: string; clientId: string; sub: string; email?: string; nonce: string; expiresAt: number }
export interface OpenIdConfiguration { issuer: string; jwksUri: string; revocationEndpoint?: string }
export function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(value: string): Uint8Array {
  if (!/^[\w-]+$/.test(value)) throw new LinguistyError('CODEX_AUTH_FAILED');
  try { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0)); }
  catch { throw new LinguistyError('CODEX_AUTH_FAILED'); }
}
function random(): string { return base64url(crypto.getRandomValues(new Uint8Array(32))); }
export async function createAuthAttempt(registration: CodexRegistration): Promise<AuthAttempt> {
  const state = random(); const nonce = random(); const verifier = random();
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const url = new URL('/api/accounts/authorize', CODEX_AUTH_ORIGIN);
  const parameters = { client_id: registration.clientId ?? 'dynamic_agent_client', ext_agent_host_id: registration.hostId,
    response_type: 'code', redirect_uri: CODEX_CALLBACK_URL, scope: `openid profile email offline_access resource.invoke ${PLAN_SCOPE}`,
    resource: RESOURCE, state, nonce, code_challenge_method: 'S256', code_challenge: challenge,
    ...(!registration.clientId ? { agent_name_hint: 'Linguisty' } : {}) };
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return { state, nonce, verifier, clientId: registration.clientId, url: url.href };
}
export function parseAuthCallback(value: string, attempt: AuthAttempt): { code: string; clientId: string } {
  if (value.length > 8192) throw new CodexFailure('callback', 'format');
  let url: URL;
  try { url = new URL(value); } catch { throw new CodexFailure('callback', 'format'); }
  const expected = new URL(CODEX_CALLBACK_URL);
  if (url.origin !== expected.origin || url.pathname !== expected.pathname || url.hash || url.username || url.password) throw new CodexFailure('callback', 'format');
  if (url.searchParams.getAll('state').length !== 1 || url.searchParams.get('state') !== attempt.state) throw new CodexFailure('callback', 'state');
  if (url.searchParams.has('error')) throw new CodexFailure('callback', 'provider', url.searchParams.get('error') === 'access_denied' ? 'CODEX_PLAN_REQUIRED' : 'CODEX_AUTH_FAILED');
  const clientId = url.searchParams.get('client_id') ?? attempt.clientId;
  const code = url.searchParams.get('code');
  if (!boundedText(clientId, 200) || clientId === 'dynamic_agent_client' || url.searchParams.getAll('client_id').length > 1
    || (attempt.clientId && clientId !== attempt.clientId)) throw new CodexFailure('callback', 'client');
  if (!boundedText(code, 4096) || url.searchParams.getAll('code').length !== 1) throw new CodexFailure('callback', 'code');
  return { code, clientId };
}
function trustedAuthUrl(value: unknown): string {
  if (!boundedText(value, 2048)) throw new CodexFailure('discovery', 'endpoint');
  let url: URL;
  try { url = new URL(value); } catch { throw new CodexFailure('discovery', 'endpoint'); }
  if (url.origin !== CODEX_AUTH_ORIGIN || url.username || url.password || url.hash || url.search) throw new CodexFailure('discovery', 'endpoint');
  return url.href;
}
export async function openIdConfiguration(fetchImpl: typeof fetch, signal?: AbortSignal): Promise<OpenIdConfiguration> {
  const value = await fetchCodexJson('discovery', fetchImpl, `${CODEX_AUTH_ORIGIN}/.well-known/openid-configuration`, { signal, redirect: 'error' });
  if (value.issuer !== CODEX_AUTH_ORIGIN) throw new CodexFailure('discovery', 'issuer');
  return { issuer: value.issuer, jwksUri: trustedAuthUrl(value.jwks_uri),
    ...(value.revocation_endpoint === undefined ? {} : { revocationEndpoint: trustedAuthUrl(value.revocation_endpoint) }) };
}
export async function verifyIdToken(token: unknown, clientId: string, nonce: string, configuration: OpenIdConfiguration,
  fetchImpl: typeof fetch, signal?: AbortSignal, now = Date.now()): Promise<{ sub: string; email?: string }> {
  if (!boundedText(token, 32_768)) throw new CodexFailure('identity', 'format');
  const parts = token.split('.');
  if (parts.length !== 3) throw new CodexFailure('identity', 'format');
  try {
    const header: unknown = JSON.parse(new TextDecoder().decode(decode(parts[0]!)));
    const claims: unknown = JSON.parse(new TextDecoder().decode(decode(parts[1]!)));
    if (!object(header) || !object(claims)) throw new CodexFailure('identity', 'format');
    if (header.alg !== 'RS256' || !boundedText(header.kid, 200) || header.crit !== undefined) throw new CodexFailure('identity', 'algorithm');
    if (claims.iss !== configuration.issuer) throw new CodexFailure('identity', 'issuer');
    if (claims.nonce !== nonce) throw new CodexFailure('identity', 'nonce');
    const audiences = typeof claims.aud === 'string' ? [claims.aud] : claims.aud;
    if (!Array.isArray(audiences) || !audiences.length || !audiences.every(value => typeof value === 'string')
      || !audiences.includes(clientId) || (claims.azp !== undefined && claims.azp !== clientId)
      || (audiences.length > 1 && claims.azp !== clientId)) throw new CodexFailure('identity', 'audience');
    if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp * 1000 <= now) throw new CodexFailure('identity', 'expiry');
    if (typeof claims.iat !== 'number' || !Number.isFinite(claims.iat) || claims.iat * 1000 > now + 60_000) throw new CodexFailure('identity', 'issued_at');
    if (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || !Number.isFinite(claims.nbf) || claims.nbf * 1000 > now + 60_000)) throw new CodexFailure('identity', 'not_before');
    if (!boundedText(claims.sub, 200)) throw new CodexFailure('identity', 'subject');
    const jwks = await fetchCodexJson('jwks', fetchImpl, configuration.jwksUri, { signal, redirect: 'error' });
    if (!Array.isArray(jwks.keys) || jwks.keys.length > 32) throw new CodexFailure('jwks', 'key');
    const matches = jwks.keys.filter(key => object(key) && key.kid === header.kid && key.kty === 'RSA'
      && (key.use === undefined || key.use === 'sig') && (key.alg === undefined || key.alg === 'RS256'));
    if (matches.length !== 1) throw new CodexFailure('jwks', 'key');
    let key: CryptoKey;
    try { key = await crypto.subtle.importKey('jwk', matches[0] as JsonWebKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']); }
    catch { throw new CodexFailure('jwks', 'key'); }
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]!) as Uint8Array<ArrayBuffer>, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) throw new CodexFailure('identity', 'signature');
    return { sub: claims.sub, ...(boundedText(claims.email, 320) ? { email: claims.email } : {}) };
  } catch (error) { if (error instanceof CodexFailure || (error instanceof LinguistyError && error.code === 'CANCELLED')) throw error; throw new CodexFailure('identity', 'format'); }
}
export async function exchangeAuthCode(attempt: AuthAttempt, callback: string, fetchImpl: typeof fetch,
  signal?: AbortSignal): Promise<CodexCredentials> {
  const { code, clientId } = parseAuthCallback(callback, attempt);
  const value = await fetchCodexJson('token', fetchImpl, `${CODEX_AUTH_ORIGIN}/api/accounts/oauth/token`, { method: 'POST', signal, redirect: 'error',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: attempt.verifier,
      redirect_uri: CODEX_CALLBACK_URL, resource: RESOURCE }) });
  if (typeof value.scope !== 'string' || !value.scope.split(/\s+/).includes(PLAN_SCOPE)) throw new CodexFailure('token', 'scope', 'CODEX_PLAN_REQUIRED');
  const configuration = await openIdConfiguration(fetchImpl, signal);
  const identity = await verifyIdToken(value.id_token, clientId, attempt.nonce, configuration, fetchImpl, signal);
  if (!boundedText(value.access_token, 32_768) || typeof value.token_type !== 'string' || value.token_type.toLowerCase() !== 'bearer'
    || typeof value.expires_in !== 'number' || value.expires_in <= 0 || value.expires_in > 86400
    || (value.refresh_token !== undefined && !boundedText(value.refresh_token, 32_768))) throw new CodexFailure('token', 'credentials');
  return { accessToken: value.access_token, ...(typeof value.refresh_token === 'string' ? { refreshToken: value.refresh_token } : {}),
    clientId, ...identity, nonce: attempt.nonce, expiresAt: Date.now() + value.expires_in * 1000 };
}
