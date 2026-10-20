// @vitest-environment node
/** @spec spec://modules/platform/INFRA-004-codex-connection#auth */
import { expect, it, vi } from 'vitest';
import { fetchCodexJson } from '../../src/codex/http';
import { CodexFailure, codexErrorReference, type CodexStage } from '../../src/codex/failure';
import { toPublicError } from '../../src/shared/errors';
import { exchangeAuthCode, openIdConfiguration, parseAuthCallback, verifyIdToken } from '../../src/codex/auth';
import { attempt, authFixture, callback, json, jwt } from './fixture';

it.each(['token', 'discovery', 'jwks', 'refresh', 'models'] as const)('reports %s HTTP status without reading or leaking provider data', async stage => {
  const cancel = vi.fn(); const response = new Response(new ReadableStream({ cancel }), { status: 401 });
  const readBody = vi.spyOn(response, 'json');
  try { await fetchCodexJson(stage, async () => response, 'https://auth.openai.com/private-request'); throw new Error('Expected HTTP failure'); }
  catch (error) {
    expect(codexErrorReference(error)).toBe(`LGT-${stage}-http-401`);
    expect(toPublicError(error)).toEqual({ code: 'CODEX_AUTH_FAILED', message: expect.any(String), retryable: false });
    expect(JSON.stringify(error)).not.toContain('private-request');
  }
  expect(cancel).toHaveBeenCalledOnce(); expect(readBody).not.toHaveBeenCalled();
});
it('distinguishes a network error from malformed JSON and preserves cancellation', async () => {
  await expect(fetchCodexJson('token', async () => { throw new Error('private-credential'); }, 'https://auth.openai.com/token'))
    .rejects.toMatchObject({ code: 'NETWORK_ERROR', stage: 'token', reason: 'network' });
  const malformed = async () => new Response('private-response-not-json');
  await expect(fetchCodexJson('discovery', malformed, 'https://auth.openai.com/config'))
    .rejects.toMatchObject({ stage: 'discovery', reason: 'response' });
  const controller = new AbortController(); controller.abort();
  await expect(fetchCodexJson('token', async () => { throw new Error('Abort'); }, 'https://auth.openai.com/token', { signal: controller.signal }))
    .rejects.toMatchObject({ code: 'CANCELLED' });
});
it('shows only known diagnostic labels, excluding unknown errors and the public port reply', () => {
  const error = new CodexFailure('token', 'http', 'CODEX_AUTH_FAILED', 401); error.message = 'private-server-text';
  expect(codexErrorReference(error)).toBe('LGT-token-http-401');
  expect(codexErrorReference(new Error('private-credential'))).toBeUndefined();
  expect(codexErrorReference(new CodexFailure('private-value' as CodexStage, 'http'))).toBeUndefined();
  expect(codexErrorReference(new CodexFailure('token', 'http', 'CODEX_AUTH_FAILED', Infinity))).toBe('LGT-token-http');
  expect(toPublicError(new CodexFailure('jwks', 'key'))).not.toHaveProperty('stage');
});
it('distinguishes callback state/client and never copies the callback URL or error_description', () => {
  for (const [value, reason] of [[callback.replace(attempt.state, 'wrong'), 'state'],
    [callback.replace('&client_id=unit-client', ''), 'client'],
    [`http://127.0.0.1:1455/auth/callback?state=${attempt.state}&error=other&error_description=private-code`, 'provider']]) {
    try { parseAuthCallback(value!, attempt); throw new Error('Expected callback rejection'); }
    catch (error) { expect(codexErrorReference(error)).toBe(`LGT-callback-${reason}`); expect(JSON.stringify(error)).not.toMatch(/private-code|unit-code|state-value/); }
  }
});
it('preserves discovery/JWKS failure stages through token validation', async () => {
  const f = authFixture(); const config = await openIdConfiguration(f.fetchImpl);
  await expect(verifyIdToken(jwt(), 'unit-client', attempt.nonce, config, async () => json({}, 401)))
    .rejects.toMatchObject({ stage: 'jwks', reason: 'http', status: 401 });
  f.fetchImpl.mockImplementationOnce(async () => json({ id_token: jwt(), scope: 'chatgpt.tokens.use.direct' }))
    .mockImplementationOnce(async () => json({}, 401));
  await expect(exchangeAuthCode(attempt, callback, f.fetchImpl)).rejects.toMatchObject({ stage: 'discovery', reason: 'http', status: 401 });
});
