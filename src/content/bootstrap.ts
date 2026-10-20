/** @spec spec://modules/page/FEAT-002-page-translation#sessions */
import { browser } from 'wxt/browser';
import { CHANNEL } from '../shared/constants';
import type { ApiResult, ContentCommand, PageController, TabTranslationState } from '../shared/contracts';
import { LinguistyError, toPublicError } from '../shared/errors';
import { assertPageSettings, createPageController, parseBatchProgress } from './controller';

interface RuntimeSender { id?: string; tab?: unknown }
export type ContentListener = (message: unknown, sender: RuntimeSender, sendResponse: (response: ApiResult<TabTranslationState>) => void) => true | undefined;
export interface ContentRuntime {
  id: string;
  onMessage: {
    addListener(listener: ContentListener): void;
    removeListener(listener: ContentListener): void;
  };
}
export interface PageBootstrap { controller: PageController; dispose(): void }
export interface BootstrapOptions {
  document?: Document;
  runtime?: ContentRuntime;
  createController?: () => PageController;
}

const BOOTSTRAP_MARKER: unique symbol = Symbol.for('linguisty.page.bootstrap.v1');
type BootstrappedDocument = Document & { [BOOTSTRAP_MARKER]?: PageBootstrap };

function parseCommand(value: unknown): ContentCommand {
  if (!value || typeof value !== 'object') throw new LinguistyError('INTERNAL_ERROR');
  const payload = value as Record<string, unknown>;
  switch (payload.command) {
    case 'batch-progress': return parseBatchProgress(payload);
    case 'start':
      if (typeof payload.sessionId !== 'string' || !payload.sessionId || payload.sessionId.length > 128) throw new LinguistyError('INTERNAL_ERROR');
      assertPageSettings(payload.settings);
      return { command: 'start', sessionId: payload.sessionId, settings: payload.settings };
    case 'cancel': return { command: 'cancel' };
    case 'get-state': return { command: 'get-state' };
    case 'set-display':
      if (payload.mode !== 'original' && payload.mode !== 'translated') throw new LinguistyError('INTERNAL_ERROR');
      return { command: 'set-display', mode: payload.mode };
    default: throw new LinguistyError('INTERNAL_ERROR');
  }
}

/** @spec spec://common/PROP-001-contracts#messages */
async function dispatch(controller: PageController, payload: unknown): Promise<ApiResult<TabTranslationState>> {
  try {
    const command = parseCommand(payload);
    const data = command.command === 'batch-progress' ? controller.progress(command)
      : command.command === 'start' ? await controller.start(command.sessionId, command.settings)
      : command.command === 'cancel' ? await controller.cancel()
        : command.command === 'set-display' ? await controller.setDisplayMode(command.mode)
          : controller.getState();
    return { ok: true, data };
  } catch (error) { return { ok: false, error: toPublicError(error) }; }
}

/** @spec spec://modules/page/FEAT-002-page-translation#sessions */
export function bootstrapPageRuntime(options: BootstrapOptions = {}): PageBootstrap {
  const document = (options.document ?? globalThis.document) as BootstrappedDocument;
  const known = document[BOOTSTRAP_MARKER];
  if (known) return known;
  const runtime = options.runtime ?? browser.runtime;
  const controller = options.createController?.() ?? createPageController({ document });
  const listener: ContentListener = (message, sender, sendResponse) => {
    if (sender.id !== runtime.id || sender.tab || !message || typeof message !== 'object') return;
    const envelope = message as Record<string, unknown>;
    if (envelope.channel !== CHANNEL || envelope.type !== 'CONTENT_COMMAND') return;
    void dispatch(controller, envelope.payload).then(sendResponse).catch(() => undefined);
    // Chrome 120 requires the callback channel to stay open; this also works
    // in Firefox without relying on Promise-returning listener support.
    return true;
  };
  let disposed = false;
  const handle: PageBootstrap = {
    controller,
    dispose() {
      if (disposed) return;
      disposed = true;
      runtime.onMessage.removeListener(listener);
      document.defaultView?.removeEventListener('pagehide', onPageHide);
      controller.dispose();
      delete document[BOOTSTRAP_MARKER];
    },
  };
  const onPageHide = () => handle.dispose();
  runtime.onMessage.addListener(listener);
  document.defaultView?.addEventListener('pagehide', onPageHide);
  document[BOOTSTRAP_MARKER] = handle;
  return handle;
}
