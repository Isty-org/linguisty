// @vitest-environment node
/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
import { afterEach, expect, it, vi } from 'vitest';
import { CodexSession } from '../../src/codex/session';
import { translationResponseFormat } from '../../src/translation/prompt';
import { attempt, authFixture, callback, complete } from './fixture';
const sessions = new Set<CodexSession>();
afterEach(() => { for (const session of sessions) session.clear(); sessions.clear(); vi.useRealTimers(); });
async function setup() {
  const f = authFixture(), session = new CodexSession(f.fetchImpl); sessions.add(session);
  await session.connect(attempt, callback); return { ...f, session };
}
it('keeps credentials inside the page and returns only a hash scope and verified status', async () => {
  const f = await setup();
  const status = f.session.status();
  expect(status).toMatchObject({ connected: true, email: 'unit@example.test' }); expect(status.accountScope).toMatch(/^[a-f0-9]{64}$/);
  const publicData = JSON.stringify([status, await f.session.request({ type: 'models', timeoutMs: 1000 })]);
  expect(publicData).not.toMatch(/unit-access|unit-refresh|unit-user|id_token/);
  f.session.clear(); expect(f.session.status()).toEqual({ connected: false });
  await expect(f.session.request({ type: 'models', timeoutMs: 1000 })).rejects.toMatchObject({ code: 'CODEX_NOT_CONNECTED' });
});
it('preserves model order, deduplicates visible entries and caches discovery without inference', async () => {
  const f = await setup();
  f.hooks.models = [{ slug: 'hidden', display_name: 'Hidden', visibility: 'hide' },
    { slug: 'b', display_name: 'B', visibility: 'list' }, { slug: 'a', display_name: 'A', visibility: 'list' }, { slug: 'b', display_name: 'B', visibility: 'list' }];
  expect(await f.session.request({ type: 'models', timeoutMs: 1000 })).toEqual([{ id: 'b', name: 'B' }, { id: 'a', name: 'A' }]);
  await f.session.request({ type: 'models', timeoutMs: 1000 });
  expect(f.fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/v1/models'))).toHaveLength(1);
  expect(f.fetchImpl.mock.calls.some(([url]) => String(url).endsWith('/responses'))).toBe(false);
});
it('uses public Responses with developer input, default discovery and no forbidden fields or tools', async () => {
  const f = await setup();
  await f.session.request({ type: 'translate', model: 'default', accountScope: f.session.status().accountScope!, timeoutMs: 1000,
    messages: [{ role: 'system', content: 'Translate JSON' }, { role: 'user', content: 'Source JSON' }] });
  const call = f.fetchImpl.mock.calls.find(([url]) => String(url).endsWith('/v1/responses'))!;
  expect(String(call[0])).toBe('https://api.openai.com/v1/responses');
  expect(JSON.parse(call[1]!.body as string)).toEqual({ model: 'unit-model', store: false, stream: true,
    text: { format: { type: 'json_schema', ...translationResponseFormat().json_schema } },
    input: [{ role: 'developer', content: 'Translate JSON' }, { role: 'user', content: 'Source JSON' }] });
  await expect(f.session.request({ type: 'translate', model: 'default', accountScope: 'a'.repeat(64), timeoutMs: 1000,
    messages: [{ role: 'system', content: 'x' }, { role: 'user', content: 'y' }] })).rejects.toMatchObject({ code: 'CODEX_NOT_CONNECTED' });
});

/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
it('preserves the selected Luna 6 model and schema without another discovery or model fallback', async () => {
  const f = await setup();
  await f.session.request({ type: 'translate', model: 'gpt-6-luna', accountScope: f.session.status().accountScope!, timeoutMs: 1000,
    messages: [{ role: 'system', content: 'Translate JSON' }, { role: 'user', content: 'Source JSON' }] });
  const call = f.fetchImpl.mock.calls.find(([url]) => String(url).endsWith('/v1/responses'))!;
  expect(JSON.parse(call[1]!.body as string)).toMatchObject({ model: 'gpt-6-luna', text: { format: { type: 'json_schema', strict: true } } });
  expect(f.fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/v1/responses'))).toHaveLength(1);
  expect(f.fetchImpl.mock.calls.some(([url]) => String(url).endsWith('/v1/models'))).toBe(false);
});
it('serializes refresh rotation and clears credentials on a failed grant', async () => {
  const f = await setup(); const now = Date.now(); vi.spyOn(Date, 'now').mockReturnValue(now + 250_000);
  await Promise.all([f.session.request({ type: 'models', timeoutMs: 1000 }), f.session.request({ type: 'models', timeoutMs: 1000 })]);
  const refresh = f.fetchImpl.mock.calls.filter(([, init]) => init?.body instanceof URLSearchParams && init.body.get('grant_type') === 'refresh_token');
  expect(refresh).toHaveLength(1); expect((refresh[0]![1]!.body as URLSearchParams).has('scope')).toBe(false);
  expect(f.fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/models')).every(([, init]) =>
    (init!.headers as { Authorization: string }).Authorization === 'Bearer unit-access-next')).toBe(true);
  vi.spyOn(Date, 'now').mockReturnValue(now + 510_000); f.hooks.token = { scope: 'openid' };
  await Promise.all([expect(f.session.request({ type: 'models', timeoutMs: 1000 })).rejects.toMatchObject({ code: 'CODEX_PLAN_REQUIRED' }),
    expect(f.session.request({ type: 'models', timeoutMs: 1000 })).rejects.toMatchObject({ code: 'CODEX_PLAN_REQUIRED' })]);
  expect(f.session.status().connected).toBe(false);
});
it('reports remote revocation truthfully while clearing local tokens on success or failure', async () => {
  const f = await setup(); expect(await f.session.disconnect()).toBe(true); expect(f.session.status().connected).toBe(false);
  await f.session.connect(attempt, callback); f.hooks.revokeStatus = 500;
  expect(await f.session.disconnect()).toBe(false); expect(f.session.status().connected).toBe(false);
});
it('cancels an in-flight request when the page disconnects and cannot return old-account data', async () => {
  const f = await setup(); let started!: () => void; const pending = new Promise<void>(resolve => { started = resolve; });
  f.fetchImpl.mockImplementationOnce(async (_url, init) => {
    started(); await new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }));
    return complete();
  });
  const request = f.session.request({ type: 'models', timeoutMs: 1000 }); const rejected = expect(request).rejects.toMatchObject({ code: 'CANCELLED' });
  await pending; f.session.clear(); await rejected;
});
