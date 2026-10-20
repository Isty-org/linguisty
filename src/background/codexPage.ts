/** @spec spec://modules/platform/INFRA-004-codex-connection#settings */
import { browser } from 'wxt/browser';
export function codexPageOpener(api: typeof browser): () => Promise<{ tabId: number | undefined }> {
  let opening: Promise<{ tabId: number | undefined }> | undefined;
  return () => {
    if (opening) return opening;
    opening = (async () => {
      const url = api.runtime.getURL('/codex.html');
      const existing = (await codexGuideTabs(api)).at(0);
      if (existing?.id !== undefined) {
        await api.tabs.update(existing.id, { active: true });
        if (existing.windowId !== undefined) await api.windows.update(existing.windowId, { focused: true });
        return { tabId: existing.id };
      }
      const tab = await api.tabs.create({ url, active: true });
      return { tabId: tab.id };
    })().finally(() => { opening = undefined; });
    return opening;
  };
}

/** Own extension contexts remain visible without permission to read all browser tabs. */
export async function codexGuideTabs(api: typeof browser): Promise<Array<{ id: number; windowId?: number }>> {
  const url = api.runtime.getURL('/codex.html');
  const runtime = api.runtime as typeof api.runtime & {
    getContexts?: (filter: { contextTypes: ['TAB']; documentUrls: string[] }) => Promise<Array<{
      documentUrl?: string; tabId: number; windowId: number;
    }>>;
  };
  if (typeof runtime.getContexts === 'function') {
    return (await runtime.getContexts({ contextTypes: ['TAB'], documentUrls: [url] }))
      .filter(context => context.documentUrl === url && context.tabId >= 0)
      .map(context => ({ id: context.tabId, windowId: context.windowId }));
  }
  return (await api.tabs.query({ url })).filter(tab => tab.url === url && tab.id !== undefined)
    .map(tab => ({ id: tab.id!, windowId: tab.windowId }));
}
