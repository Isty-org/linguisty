/** @spec spec://modules/platform/INFRA-004-codex-connection#resources */
import { expect, it, vi } from 'vitest';
import { cleanupCodexAuth } from '../../src/background/codexAuthCleanup';
import { fakeBrowser } from './harness';
vi.mock('wxt/browser', () => ({ browser: {} }));
function setup() {
  const fake = fakeBrowser();
  const own = { id: 2201, action: { type: 'redirect', redirect: { regexSubstitution: `${fake.runtime.getURL('/codex-callback.html')}#\\0` } },
    condition: { tabIds: [42], excludedTabIds: [7] } };
  const foreign = { ...own, id: 99, action: { type: 'redirect', redirect: { regexSubstitution: 'https://other.example/#\\0' } } };
  const update = vi.fn(async () => undefined), remove = vi.fn(async () => undefined);
  Object.assign(fake.api, { declarativeNetRequest: { getSessionRules: vi.fn(async () => [own, foreign]), updateSessionRules: update } });
  Object.assign(fake.api.tabs, { remove });
  return { ...fake, update, remove };
}
it('keeps an active Chrome login on worker wake even when tabs API hides its owner URL', async () => {
  const f = setup();
  const contexts = vi.fn(async () => [{ tabId: 7, windowId: 1, documentUrl: f.runtime.getURL('/codex.html') }]);
  Object.assign(f.api.runtime, { getContexts: contexts });
  f.tabs.get.mockResolvedValue({ id: 7 } as never);
  await cleanupCodexAuth(f.api);
  expect(contexts).toHaveBeenCalledOnce(); expect(f.tabs.get).not.toHaveBeenCalled();
  expect(f.update).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
});
it('releases only owned rules and closes only an abandoned owned auth tab', async () => {
  const f = setup();
  await cleanupCodexAuth(f.api, 8);
  expect(f.update).not.toHaveBeenCalled();
  await cleanupCodexAuth(f.api, 42);
  expect(f.update).toHaveBeenCalledExactlyOnceWith({ removeRuleIds: [2201] }); expect(f.remove).not.toHaveBeenCalled();
  f.update.mockClear();
  await cleanupCodexAuth(f.api, 7);
  expect(f.update).toHaveBeenCalledExactlyOnceWith({ removeRuleIds: [2201] }); expect(f.remove).toHaveBeenCalledExactlyOnceWith(42);
});
