/** @spec spec://common/PROP-001-contracts#messages */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { bootstrapPageRuntime, type ContentListener, type PageBootstrap } from '../../src/content/bootstrap';
import { createPageController } from '../../src/content/controller';
import { createIdleState } from '../../src/shared/constants';
import type { ApiResult, PageController, RuntimeMessage, TabTranslationState } from '../../src/shared/contracts';
import { flushMicrotasks, measureText, pageSettings } from './helpers';

vi.mock('wxt/browser', () => ({ browser: { runtime: { id: 'test-extension', sendMessage: vi.fn() } } }));

const bootstraps: PageBootstrap[] = [];
const controllers: PageController[] = [];
afterEach(() => {
  for (const bootstrap of bootstraps.splice(0)) bootstrap.dispose();
  for (const controller of controllers.splice(0)) controller.dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function mockBootstrap() {
  const listeners = new Set<ContentListener>();
  const runtime = {
    id: 'test-extension',
    onMessage: { addListener: vi.fn((listener: ContentListener) => listeners.add(listener)), removeListener: vi.fn((listener: ContentListener) => listeners.delete(listener)) },
  };
  const state = createIdleState();
  const controller: PageController = {
    progress: vi.fn(() => state),
    start: vi.fn(async () => state), cancel: vi.fn(async () => state),
    setDisplayMode: vi.fn(async () => state), getState: vi.fn(() => state), dispose: vi.fn(),
  };
  const createController = vi.fn(() => controller);
  const bootstrap = bootstrapPageRuntime({ document, runtime, createController });
  bootstraps.push(bootstrap);
  return { bootstrap, runtime, controller, createController, listener: [...listeners][0]! };
}

describe('single content bootstrap and message envelopes', () => {
  /** @spec spec://modules/page/FEAT-002-page-translation#sessions */
  it('registers only once per document, cleans up on pagehide and allows reinjection', () => {
    const f = mockBootstrap();
    expect(bootstrapPageRuntime({ document, runtime: f.runtime, createController: f.createController })).toBe(f.bootstrap);
    expect(f.createController).toHaveBeenCalledOnce();
    expect(f.runtime.onMessage.addListener).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event('pagehide'));
    expect(f.controller.dispose).toHaveBeenCalledOnce();
    expect(f.runtime.onMessage.removeListener).toHaveBeenCalledWith(f.listener);
    const next = bootstrapPageRuntime({ document, runtime: f.runtime, createController: f.createController });
    bootstraps.push(next);
    expect(next).not.toBe(f.bootstrap);
    expect(f.runtime.onMessage.addListener).toHaveBeenCalledTimes(2);
  });

  it('accepts only own extension commands and returns ApiResult for every recognized command', async () => {
    const f = mockBootstrap();
    const message = { channel: 'linguisty', type: 'CONTENT_COMMAND', payload: { command: 'get-state' } };
    const response = vi.fn();
    expect(f.listener(message, { id: 'other-extension' }, response)).toBeUndefined();
    expect(f.listener(message, { id: 'test-extension', tab: { id: 1 } }, response)).toBeUndefined();
    expect(f.listener({ ...message, channel: 'another' }, { id: 'test-extension' }, response)).toBeUndefined();
    expect(response).not.toHaveBeenCalled();
    const invoke = (payload: unknown) => new Promise<ApiResult<TabTranslationState>>(resolve => {
      expect(f.listener(payload, { id: 'test-extension' }, resolve)).toBe(true);
    });
    expect(await invoke(message)).toEqual({ ok: true, data: createIdleState() });
    await invoke({ ...message, payload: { command: 'start', sessionId: 'session', settings: pageSettings() } });
    expect(f.controller.start).toHaveBeenCalledWith('session', pageSettings());
    await invoke({ ...message, payload: { command: 'cancel' } });
    expect(f.controller.cancel).toHaveBeenCalledOnce();
    await invoke({ ...message, payload: { command: 'set-display', mode: 'original' } });
    expect(f.controller.setDisplayMode).toHaveBeenCalledWith('original');
    expect(await invoke({ ...message, payload: { command: 'start', sessionId: 'session', settings: { secret: 'never-output' } } }))
      .toMatchObject({ ok: false, error: { code: 'INVALID_SETTINGS' } });
  });

  it('uses the shared runtime helper to unwrap ApiResult<TranslationResult>', async () => {
    vi.mocked(browser.runtime.sendMessage).mockImplementation(async (raw: unknown) => {
      const message = raw as RuntimeMessage;
      if (message.type === 'TRANSLATE_BATCH') return { ok: true, data: { translations: message.nodes.map(node => ({ id: node.id, text: 'Готово' })), fromCache: message.nodes.length, cacheHitIds: message.nodes.map(node => node.id) } };
      return { ok: true, data: undefined };
    });
    document.body.innerHTML = '<p>Original</p>';
    const controller = createPageController({ document, window, measureText });
    controllers.push(controller);
    await controller.start('session', pageSettings());
    await flushMicrotasks();
    expect(document.body.textContent).toBe('Готово');
    expect(controller.getState()).toMatchObject({ translated: 1, fromCache: 1, failed: 0 });
  });

  it('normalizes a failed or missing background envelope without exposing response data', async () => {
    vi.mocked(browser.runtime.sendMessage).mockImplementation(async (_raw: unknown) => ({ ok: false, error: { code: 'PERMISSION_REQUIRED', message: 'Разрешите доступ.', retryable: false } }));
    document.body.innerHTML = '<p>Original</p>';
    const controller = createPageController({ document, window, measureText });
    controllers.push(controller);
    await controller.start('session', pageSettings());
    await flushMicrotasks();
    expect(controller.getState()).toMatchObject({ failed: 1, error: { code: 'PERMISSION_REQUIRED' } });
    vi.mocked(browser.runtime.sendMessage).mockImplementation(async (_raw: unknown) => undefined);
    await controller.start('next', pageSettings());
    await flushMicrotasks();
    expect(controller.getState()).toMatchObject({ failed: 1, error: { code: 'INTERNAL_ERROR' } });
  });
});
