/** @spec spec://modules/platform/INFRA-001-extension#recovery */
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, createIdleState } from '../../src/shared/constants';
import { MAX_SESSIONS, SESSION_STORAGE_KEY, SESSION_TTL_MS, SessionRegistry } from '../../src/background/sessions';
import { deferred, fakeBrowser } from './harness';

describe('bounded session snapshots', () => {
  it('restores settings before use, clears phantom in-flight status and rejects corrupt/closed snapshots', async () => {
    const fake = fakeBrowser();
    const settings = { ...DEFAULT_SETTINGS, model: 'frozen-model' };
    fake.sessionData[SESSION_STORAGE_KEY] = { version: 1, sessions: [
      { tabId: 1, sessionId: 'saved', settings, state: { ...createIdleState(1), sessionId: 'saved', status: 'translating', discovered: 3, inFlight: 3 }, updatedAt: Date.now() },
      { tabId: 99, sessionId: 'closed', settings, state: createIdleState(99), updatedAt: Date.now() },
      { tabId: 2, sessionId: 'bad', settings: { ...settings, concurrency: 8 }, state: createIdleState(2), updatedAt: Date.now() },
    ] };
    const registry = new SessionRegistry(fake.api);
    await registry.restore();
    expect(registry.get(1)?.settings.model).toBe('frozen-model');
    expect(registry.get(1)?.state).toMatchObject({ status: 'error', inFlight: 0, error: { code: 'REQUEST_TIMEOUT' } });
    expect(registry.resources()).toEqual({ sessions: 1, batches: 0 });
    await registry.dispose();
  });

  /** @spec spec://common/PROP-002-quality#resources */
  it('bounds sessions, expires inactive entries and aborts their requests', async () => {
    const fake = fakeBrowser();
    let now = Date.now();
    const registry = new SessionRegistry(fake.api, () => now);
    await registry.restore();
    for (let id = 0; id < MAX_SESSIONS; id++) registry.create(id, DEFAULT_SETTINGS);
    const session = registry.get(0)!;
    expect(() => registry.create(MAX_SESSIONS, DEFAULT_SETTINGS)).toThrow();
    expect(registry.resources().sessions).toBe(MAX_SESSIONS);
    now += SESSION_TTL_MS + 1;
    expect(registry.resources()).toEqual({ sessions: 0, batches: 0 });
    expect(session.controller.signal.aborted).toBe(true);
    await registry.dispose();
  });

  it('coalesces writes and never resurrects a removed session after a pending progress save', async () => {
    const fake = fakeBrowser();
    const registry = new SessionRegistry(fake.api);
    await registry.restore();
    registry.create(1, DEFAULT_SETTINGS);
    const blocked = deferred<void>();
    const normalSet = fake.storage.set.getMockImplementation()!;
    fake.storage.set.mockImplementationOnce(async (values) => { await blocked.promise; await normalSet(values); });
    const first = registry.persist();
    await vi.waitFor(() => expect(fake.storage.set).toHaveBeenCalledTimes(2));
    const pending = Array.from({ length: 100 }, () => registry.persist());
    expect(pending.every((promise) => promise === first)).toBe(true);
    registry.remove(1);
    const removal = registry.persist();
    blocked.resolve();
    await Promise.all([first, removal, ...pending]);
    expect(fake.sessionData[SESSION_STORAGE_KEY]).toEqual({ version: 1, sessions: [] });
    expect(fake.storage.set).toHaveBeenCalledTimes(3);
    await registry.dispose();
    expect(registry.resources()).toEqual({ sessions: 0, batches: 0 });
  });

  it('snapshot projection excludes provider config, page text, promises and extra settings fields', async () => {
    const fake = fakeBrowser();
    const registry = new SessionRegistry(fake.api);
    await registry.restore();
    const session = registry.create(1, { ...DEFAULT_SETTINGS, apiKey: 'fake-secret' } as typeof DEFAULT_SETTINGS);
    Object.assign(session, { apiKey: 'fake-secret', text: 'private page text' });
    await registry.persist();
    const serialized = JSON.stringify(fake.sessionData[SESSION_STORAGE_KEY]);
    expect(serialized).not.toContain('fake-secret');
    expect(serialized).not.toContain('private page text');
    expect(serialized).not.toContain('controller');
    expect(serialized).not.toContain('batches');
    await registry.dispose();
  });
});
