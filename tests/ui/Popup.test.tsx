/** @spec spec://modules/interface/FEAT-003-controls#popup */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { browserMock, messagesOf, publish, resetBrowser } from './browserMock';
import { Popup } from '../../src/ui/Popup';

beforeEach(resetBrowser);
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function openPopup() {
  const view = render(<Popup />);
  await screen.findByLabelText('На язык');
  return view;
}

describe('Popup translation lifecycle', () => {
  /** @spec spec://modules/interface/FEAT-003-controls#languages */
  it('saves automatic mode even when its resolved target matches the old manual language', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ru']);
    await openPopup();
    fireEvent.change(screen.getByLabelText('На язык'), { target: { value: '__browser__' } });
    expect((screen.getByLabelText('На язык') as HTMLSelectElement).value).toBe('__browser__');
    expect(screen.getByText(/Выбран автоматически:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Перевести страницу' }));
    await screen.findByRole('button', { name: 'Отменить перевод' });
    expect(messagesOf('SAVE_SETTINGS')[0]?.settings).toMatchObject({ targetLanguage: 'ru', targetLanguageMode: 'browser' });
  });

  /** @spec spec://modules/interface/FEAT-003-controls#languages */
  it('shows English controls and keeps a manual target when browser languages change', async () => {
    const preferences = vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    browserMock.settings = { ...browserMock.settings, uiLanguage: 'en', targetLanguage: 'en-US', targetLanguageMode: 'browser' };
    render(<Popup />);
    await screen.findByLabelText('To');
    expect(document.documentElement.lang).toBe('en');
    expect((screen.getByLabelText('To') as HTMLSelectElement).value).toBe('__browser__');
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'de' } });
    preferences.mockReturnValue(['ja']);
    act(() => window.dispatchEvent(new Event('languagechange')));
    expect((screen.getByLabelText('To') as HTMLSelectElement).value).toBe('de');
    fireEvent.click(screen.getByRole('button', { name: 'Translate page' }));
    await screen.findByRole('button', { name: 'Cancel translation' });
    expect(messagesOf('SAVE_SETTINGS')[0]?.settings).toMatchObject({ targetLanguage: 'de', targetLanguageMode: 'manual', uiLanguage: 'en' });
  });

  it('restores the active tab status on reopening and ignores progress for other tabs', async () => {
    browserMock.state = { ...browserMock.state, sessionId: 'existing', status: 'translating', discovered: 12, translated: 4, failed: 1, inFlight: 2 };
    await openPopup();
    expect(screen.getByText('Переведено 4 из 12 · ошибок: 1')).toBeTruthy();
    expect(messagesOf('GET_TAB_STATE')[0]?.tabId).toBe(7);
    act(() => publish({ ...browserMock.state, tabId: 8, translated: 9 }));
    expect(screen.getByText('Переведено 4 из 12 · ошибок: 1')).toBeTruthy();
    act(() => publish({ ...browserMock.state, tabId: 7, translated: 8 }));
    expect(screen.getByText('Переведено 8 из 12 · ошибок: 1')).toBeTruthy();
  });

  it('saves language changes after permission, then starts translation on the resolved tab', async () => {
    await openPopup();
    fireEvent.change(screen.getByLabelText('С языка'), { target: { value: 'en' } });
    fireEvent.change(screen.getByLabelText('На язык'), { target: { value: 'de' } });
    browserMock.flow = [];
    fireEvent.click(screen.getByRole('button', { name: 'Перевести страницу' }));
    expect(browserMock.request).toHaveBeenCalledTimes(1);
    await screen.findByRole('button', { name: 'Отменить перевод' });
    expect(browserMock.flow).toEqual(['permissions', 'SAVE_SETTINGS', 'START_TRANSLATION']);
    expect(messagesOf('SAVE_SETTINGS')[0]?.settings).toMatchObject({ sourceLanguage: 'en', targetLanguage: 'de' });
    expect(messagesOf('START_TRANSLATION')[0]?.tabId).toBe(7);
  });

  it('cancels a running session and switches original/translation without starting another request', async () => {
    browserMock.state = { ...browserMock.state, sessionId: 'existing', status: 'translating', discovered: 10, translated: 3, inFlight: 2, displayMode: 'translated' };
    await openPopup();
    fireEvent.click(screen.getByRole('button', { name: 'Отменить перевод' }));
    await screen.findByText('Перевод отменён');
    expect(messagesOf('CANCEL_TRANSLATION')[0]?.tabId).toBe(7);
    fireEvent.click(screen.getByRole('button', { name: 'Оригинал' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Оригинал' }).getAttribute('aria-pressed')).toBe('true'));
    fireEvent.click(screen.getByRole('button', { name: 'Перевод' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Перевод' }).getAttribute('aria-pressed')).toBe('true'));
    expect(messagesOf('SET_DISPLAY_MODE').map((message) => message.mode)).toEqual(['original', 'translated']);
    expect(messagesOf('START_TRANSLATION')).toHaveLength(0);
  });

  /** @spec spec://modules/storage/INFRA-002-local-data#secrets */
  it('does not reset a newer persistent key mode when an older popup saves languages', async () => {
    await openPopup();
    browserMock.settings = { ...browserMock.settings, keyMode: 'persistent' };
    browserMock.secret = { hasKey: true, mode: 'persistent' };
    fireEvent.change(screen.getByLabelText('На язык'), { target: { value: 'de' } });
    fireEvent.click(screen.getByRole('button', { name: 'Перевести страницу' }));
    await screen.findByRole('button', { name: 'Отменить перевод' });
    expect(browserMock.settings.keyMode).toBe('persistent');
    expect(browserMock.secret.mode).toBe('persistent');
  });

  /** @spec spec://modules/interface/FEAT-003-controls#popup */
  it('does not overwrite a newer provider, model or preferences when the popup saves only languages', async () => {
    await openPopup();
    const latest = { ...browserMock.settings, providerId: 'codex' as const, model: 'gpt-6-luna',
      concurrency: 1, streaming: false, keyMode: 'persistent' as const, theme: 'dark' as const,
      customInstructions: 'Keep current preferences.', requestTimeoutMs: 120_000 };
    browserMock.settings = latest;
    browserMock.secret = { hasKey: true, mode: 'persistent' };
    fireEvent.change(screen.getByLabelText('На язык'), { target: { value: 'de' } });
    fireEvent.click(screen.getByRole('button', { name: 'Перевести страницу' }));
    await screen.findByRole('button', { name: 'Отменить перевод' });
    expect(browserMock.settings).toEqual({ ...latest, targetLanguage: 'de' });
    expect(browserMock.secret).toEqual({ hasKey: true, mode: 'persistent' });
  });

  it('offers settings when configuration is incomplete and opens the real options page', async () => {
    browserMock.secret.hasKey = false;
    browserMock.settings.model = '';
    await openPopup();
    expect(screen.getByText('Добавьте свой API-ключ и укажите ID модели в настройках.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Перевести страницу' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Настроить Linguisty' }));
    await waitFor(() => expect(browserMock.openOptionsPage).toHaveBeenCalledTimes(1));
  });

  it('shows a protected-page error and prevents a translation attempt', async () => {
    browserMock.failures.set('GET_TAB_STATE', { code: 'RESTRICTED_PAGE', message: 'Браузер не разрешает перевод этой страницы.', retryable: false });
    await openPopup();
    expect(screen.getByRole('alert').textContent).toBe('Браузер не разрешает перевод этой страницы.');
    expect((screen.getByRole('button', { name: 'Перевести страницу' }) as HTMLButtonElement).disabled).toBe(true);
    expect(browserMock.request).not.toHaveBeenCalled();
  });

  it('reports partial failures honestly and routes an invalid key to settings instead of retrying it', async () => {
    browserMock.state = { ...browserMock.state, status: 'completed', discovered: 10, translated: 6, failed: 4,
      error: { code: 'INVALID_API_KEY', message: 'Проверьте свой API-ключ.', retryable: false } };
    await openPopup();
    expect(screen.getByRole('heading', { name: 'Перевод завершён с ошибками' })).toBeTruthy();
    expect(screen.getByText('Переведено 6 из 10 · ошибок: 4')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Перевести заново' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Открыть настройки сервиса' }));
    await waitFor(() => expect(browserMock.openOptionsPage).toHaveBeenCalledTimes(1));
    expect(messagesOf('START_TRANSLATION')).toHaveLength(0);
  });

  it('keeps newer pushed progress when an earlier status read resolves late', async () => {
    let resolveStatus: ((value: { ok: true; data: typeof browserMock.state }) => void) | undefined;
    const original = browserMock.sendMessage.getMockImplementation();
    browserMock.sendMessage.mockImplementation((message) => message.type === 'GET_TAB_STATE'
      ? new Promise((resolve) => { resolveStatus = resolve; })
      : original!(message));
    render(<Popup />);
    await waitFor(() => expect(resolveStatus).toBeDefined());
    const old = { ...browserMock.state };
    act(() => publish({ ...old, sessionId: 'current', status: 'translating', discovered: 10, translated: 8 }));
    await act(async () => { resolveStatus!({ ok: true, data: old }); });
    expect(screen.getByText('Переведено 8 из 10 · ошибок: 0')).toBeTruthy();
    expect(screen.queryByText('Готово к переводу')).toBeNull();
  });

  it('does not accumulate subscriptions over repeated popup lifecycles', async () => {
    for (let cycle = 0; cycle < 3; cycle += 1) {
      const view = await openPopup();
      expect(browserMock.listeners.size).toBe(1);
      view.unmount();
      expect(browserMock.listeners.size).toBe(0);
    }
    expect(browserMock.addListener).toHaveBeenCalledTimes(3);
    expect(browserMock.removeListener).toHaveBeenCalledTimes(3);
  });
});
