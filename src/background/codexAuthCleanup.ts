/** @spec spec://modules/platform/INFRA-004-codex-connection#resources */
import { browser } from 'wxt/browser';
import { codexGuideTabs } from './codexPage';
/** A closing/discarded page cannot reliably await its finally. The background cleans its exact owned rules/tabs. */
export async function cleanupCodexAuth(api: typeof browser, removedTabId?: number): Promise<void> {
  if (!api.declarativeNetRequest?.getSessionRules) return;
  try {
    if (!await api.permissions.contains({ permissions: ['declarativeNetRequestWithHostAccess'] })) return;
    const rules = await api.declarativeNetRequest.getSessionRules();
    let owners: Awaited<ReturnType<typeof codexGuideTabs>> | undefined;
    for (const rule of rules) {
      if (rule.action.redirect?.regexSubstitution !== `${api.runtime.getURL('/codex-callback.html')}#\\0`
        || rule.condition.tabIds?.length !== 1 || rule.condition.excludedTabIds?.length !== 1) continue;
      const authTab = rule.condition.tabIds[0]!, owner = rule.condition.excludedTabIds[0]!;
      let abandoned = removedTabId === owner;
      if (removedTabId === undefined) {
        owners ??= await codexGuideTabs(api);
        abandoned = !owners.some(tab => tab.id === owner);
      }
      if (!abandoned && removedTabId !== authTab) continue;
      await api.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id] });
      if (abandoned) await api.tabs.remove(authTab).catch(() => undefined);
    }
  } catch { /* Optional grant or already-removed tab/rule; no raw browser diagnostics retained. */ }
}
