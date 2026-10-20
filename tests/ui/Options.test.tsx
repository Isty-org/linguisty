/** @spec spec://modules/interface/FEAT-003-controls#acceptance */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { browserMock, messagesOf, resetBrowser } from './browserMock';
import { Options } from '../../src/ui/Options';

beforeEach(resetBrowser);
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openOptions() {
  const view = render(<Options />);
  await screen.findByLabelText(/Сервис перевода/);
  return view;
}

describe('Options through the shared runtime boundary', () => {
  /** @spec spec://modules/interface/FEAT-003-controls#languages */
  it('previews and saves English UI independently from a manually selected translation language', async () => {
    await openOptions();
    fireEvent.change(screen.getByLabelText('Язык интерфейса'), { target: { value: 'en' } });
    await screen.findByRole('heading', { name: 'Your service. Your language.' });
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect((screen.getByLabelText('Target language') as HTMLSelectElement).value).toBe('ru');
    expect(screen.getByRole('heading', { name: 'API error log' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await screen.findByText('Settings saved. Linguisty is ready to translate.');
    expect(messagesOf('SAVE_SETTINGS')[0]?.settings).toMatchObject({ uiLanguage: 'en', targetLanguage: 'ru', targetLanguageMode: 'manual' });
  });

  /** @spec spec://modules/interface/FEAT-003-controls#languages */
  it('switches the browser target to a manual BCP 47 code and can return to automatic selection', async () => {
    const preferences = vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    browserMock.settings = { ...browserMock.settings, targetLanguage: 'en-US', targetLanguageMode: 'browser' };
    await openOptions();
    const target = screen.getByLabelText('Язык перевода') as HTMLSelectElement;
    expect(target.value).toBe('__browser__');
    expect(screen.queryByLabelText('Другой код языка')).toBeNull();
    expect(target.options.length).toBeGreaterThan(184);
    fireEvent.change(target, { target: { value: 'fr' } });
    fireEvent.change(screen.getByLabelText('Другой код языка'), { target: { value: 'sr-Latn-RS' } });
    preferences.mockReturnValue(['ja']);
    act(() => window.dispatchEvent(new Event('languagechange')));
    expect((screen.getByLabelText('Другой код языка') as HTMLInputElement).value).toBe('sr-Latn-RS');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
    await screen.findByText('Настройки сохранены. Linguisty готов к переводу.');
    expect(messagesOf('SAVE_SETTINGS')[0]?.settings).toMatchObject({ targetLanguage: 'sr-Latn-RS', targetLanguageMode: 'manual' });
    fireEvent.change(target, { target: { value: '__browser__' } });
    expect(screen.queryByLabelText('Другой код языка')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
    await screen.findByText('Настройки сохранены. Linguisty готов к переводу.');
    expect(messagesOf('SAVE_SETTINGS')[1]?.settings).toMatchObject({ targetLanguage: 'ja', targetLanguageMode: 'browser' });
    preferences.mockRestore();
  });

  /** @spec spec://modules/interface/FEAT-003-controls#languages */
  it('localizes validation before permission and keeps an English connection failure diagnostic', async () => {
    browserMock.settings = { ...browserMock.settings, uiLanguage: 'en' };
    render(<Options />);
    await screen.findByLabelText('Translation service');
    fireEvent.change(screen.getByLabelText('Other language code'), { target: { value: 'invalid tag' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(screen.getByRole('alert').textContent).toBe('Check the highlighted fields.');
    expect(screen.getByText('Enter a language code, for example ru or en.')).toBeTruthy();
    expect(browserMock.request).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Other language code'), { target: { value: 'ru' } });
    browserMock.connection = { success: false, message: 'Account has no credits; request refused.' };
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    await screen.findByText('Account has no credits; request refused.');
    expect(screen.getByRole('alert').textContent).toBe('Account has no credits; request refused.');
    expect(messagesOf('SAVE_SETTINGS')).toHaveLength(0);
  });

  it('releases the wait timer for a pending user action when options close', async () => {
    const view = await openOptions();
    const original = browserMock.sendMessage.getMockImplementation()!;
    browserMock.sendMessage.mockImplementation((message) => message.type === 'LIST_MODELS'
      ? new Promise(() => {}) : original(message));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить список моделей' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => { view.unmount(); });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('explains the storage limit of a temporary Firefox installation without adding permissions', async () => {
    browserMock.getURL.mockReturnValue('moz-extension://test/');
    browserMock.getSelf.mockResolvedValue({ installType: 'development' });
    await openOptions();
    await screen.findByText(/Linguisty установлен в Firefox временно/);
    expect(browserMock.request).not.toHaveBeenCalled();
  });

  /** @spec spec://modules/interface/FEAT-003-controls#errors */
  it('opens the settings form while cache statistics are still pending', async () => {
    const original = browserMock.sendMessage.getMockImplementation()!;
    browserMock.sendMessage.mockImplementation((message) => message.type === 'GET_CACHE_STATS'
      ? new Promise(() => {}) : original(message));
    await openOptions();
    expect(screen.getByLabelText('Хранение ключа')).toBeTruthy();
    expect(screen.getByText('Статистика кэша пока недоступна.')).toBeTruthy();
  });

  /** @spec spec://modules/storage/INFRA-002-local-data#secrets */
  it('preserves a newer key mode when an old options form only changes the theme', async () => {
    await openOptions();
    browserMock.settings = { ...browserMock.settings, keyMode: 'persistent' };
    browserMock.secret = { hasKey: true, mode: 'persistent' };
    fireEvent.change(screen.getByLabelText('Тема оформления'), { target: { value: 'dark' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
    await screen.findByText('Настройки сохранены. Linguisty готов к переводу.');
    expect(browserMock.settings.keyMode).toBe('persistent');
    expect(browserMock.secret.mode).toBe('persistent');
  });

  it('never prefills a stored key and preserves it when saving an empty field and changing its mode', async () => {
    const user = userEvent.setup();
    await openOptions();
    expect((screen.getByLabelText(/^API-ключ/) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/^API-ключ/) as HTMLInputElement).maxLength).toBe(4_096);
    await user.selectOptions(screen.getByLabelText('Хранение ключа'), 'persistent');
    browserMock.flow = [];
    await user.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
    await screen.findByText('Настройки сохранены. Linguisty готов к переводу.');
    expect(messagesOf('SAVE_SETTINGS')).toHaveLength(1);
    expect(messagesOf('SAVE_SETTINGS')[0]).not.toHaveProperty('apiKey');
    expect(messagesOf('SAVE_SETTINGS')[0]?.settings.keyMode).toBe('persistent');
    expect(browserMock.secret).toEqual({ hasKey: true, mode: 'persistent' });
    expect(browserMock.flow.slice(0, 2)).toEqual(['permissions', 'SAVE_SETTINGS']);
    expect(browserMock.request).toHaveBeenCalledWith({ origins: ['https://openrouter.ai/*'] });
  });

  it('requests permission synchronously from a button and does not save denied provider changes', async () => {
    await openOptions();
    fireEvent.change(screen.getByLabelText('Сервис перевода'), { target: { value: 'openai-compatible' } });
    fireEvent.change(screen.getByLabelText('Базовый адрес API'), { target: { value: 'https://gateway.example/v1' } });
    fireEvent.change(screen.getByLabelText(/^API-ключ/), { target: { value: 'test-only-key' } });
    browserMock.request.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
    expect(browserMock.request).toHaveBeenCalledWith({ origins: ['https://gateway.example/*'] });
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('не разрешён');
    expect(messagesOf('SAVE_SETTINGS')).toHaveLength(0);
    expect(browserMock.settings.providerId).toBe('openrouter');
    expect((screen.getByLabelText(/^API-ключ/) as HTMLInputElement).value).toBe('test-only-key');
    expect((screen.getByRole('button', { name: 'Сохранить настройки' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each(['http://remote.example/v1', 'https://user:pass@gateway.example/v1', 'https://gateway.example/v1?', 'https://gateway.example/v1#',
    'https://@gateway.example/v1', 'https:/@gateway.example/v1', 'https:@gateway.example/v1'])('blocks invalid endpoint %s before permission or persistence', async (endpoint) => {
    await openOptions();
    fireEvent.change(screen.getByLabelText('Сервис перевода'), { target: { value: 'openai-compatible' } });
    fireEvent.change(screen.getByLabelText('Базовый адрес API'), { target: { value: endpoint } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
    expect(screen.getByRole('alert').textContent).toBe('Проверьте отмеченные поля.');
    expect(document.activeElement).toBe(screen.getByLabelText('Базовый адрес API'));
    expect(screen.getByLabelText('Базовый адрес API').getAttribute('aria-invalid')).toBe('true');
    expect(browserMock.request).not.toHaveBeenCalled();
    expect(messagesOf('SAVE_SETTINGS')).toHaveLength(0);
  });

  it('uses an entered key for testing without saving it, and does not turn a failed connection into success', async () => {
    await openOptions();
    browserMock.connection = { success: false, message: 'Сервис не принял ключ.' };
    fireEvent.change(screen.getByLabelText(/^API-ключ/), { target: { value: 'temporary-test-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить подключение' }));
    await screen.findByText('Сервис не принял ключ.');
    expect(screen.getByRole('alert').textContent).toBe('Сервис не принял ключ.');
    expect(messagesOf('TEST_CONNECTION')[0]?.apiKey).toBe('temporary-test-key');
    expect(messagesOf('SAVE_SETTINGS')).toHaveLength(0);
    expect((screen.getByLabelText(/^API-ключ/) as HTMLInputElement).value).toBe('temporary-test-key');
  });

  it('rejects an overlong key before requesting permission or sending it to the background', async () => {
    await openOptions();
    fireEvent.change(screen.getByLabelText(/^API-ключ/), { target: { value: 'k'.repeat(4_097) } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
    expect(screen.getByRole('alert').textContent).toBe('Проверьте отмеченные поля.');
    expect(screen.getByText('Проверьте API-ключ: он должен быть одной строкой до 4 096 символов.')).toBeTruthy();
    expect(browserMock.request).not.toHaveBeenCalled();
    expect(messagesOf('SAVE_SETTINGS')).toHaveLength(0);
  });

  /** @spec spec://modules/storage/INFRA-002-local-data#secrets */
  it.each([9, 1, 127])('rejects key control character %i before requesting permission', async (code) => {
    await openOptions();
    fireEvent.change(screen.getByLabelText(/^API-ключ/), { target: { value: `key${String.fromCharCode(code)}value` } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
    expect(screen.getByRole('alert').textContent).toBe('Проверьте отмеченные поля.');
    expect(screen.getByLabelText(/^API-ключ/).getAttribute('aria-invalid')).toBe('true');
    expect(browserMock.request).not.toHaveBeenCalled();
    expect(messagesOf('SAVE_SETTINGS')).toHaveLength(0);
  });

  it('clears the entered key after successful persistence and reports missing configuration honestly', async () => {
    await openOptions();
    fireEvent.change(screen.getByLabelText(/^API-ключ/), { target: { value: 'replacement-test-key' } });
    fireEvent.change(screen.getByLabelText('ID модели'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
    await screen.findByText('Настройки сохранены. Укажите ID модели, чтобы начать перевод.');
    expect(messagesOf('SAVE_SETTINGS')[0]?.apiKey).toBe('replacement-test-key');
    expect((screen.getByLabelText(/^API-ключ/) as HTMLInputElement).value).toBe('');
    expect(screen.queryByText('Настройки сохранены. Linguisty готов к переводу.')).toBeNull();
  });

  it('keeps manual model entry usable after discovery failure and releases the busy state', async () => {
    await openOptions();
    browserMock.failures.set('LIST_MODELS', { code: 'NETWORK_ERROR', message: 'Не удалось связаться с сервисом.', retryable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить список моделей' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('ID модели можно указать вручную.');
    fireEvent.change(screen.getByLabelText('ID модели'), { target: { value: 'manual/working-model' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
    await screen.findByText('Настройки сохранены. Linguisty готов к переводу.');
    expect(messagesOf('SAVE_SETTINGS')[0]?.settings.model).toBe('manual/working-model');
  });

  it('deduplicates and bounds discovery, searches it, and selects a model with the keyboard', async () => {
    const user = userEvent.setup();
    browserMock.models = [
      { id: 'duplicate', name: 'Same model' }, { id: 'duplicate', name: 'Same model' },
      ...Array.from({ length: 1_005 }, (_, index) => ({ id: `model-${index}`, name: `Model ${index}` })),
    ];
    await openOptions();
    await user.click(screen.getByRole('button', { name: 'Загрузить список моделей' }));
    await screen.findByLabelText('Поиск модели');
    expect(screen.getAllByRole('button', { name: /^Model \d/ })).toHaveLength(39);
    expect(screen.getAllByRole('button', { name: /Same model duplicate/ })).toHaveLength(1);
    await user.type(screen.getByLabelText('Поиск модели'), 'model-997');
    const choice = screen.getByRole('button', { name: 'Model 997 model-997' });
    choice.focus();
    await user.keyboard('{Enter}');
    expect((screen.getByLabelText('ID модели') as HTMLInputElement).value).toBe('model-997');
    fireEvent.change(screen.getByLabelText('Сервис перевода'), { target: { value: 'openai-compatible' } });
    expect(screen.queryByLabelText('Поиск модели')).toBeNull();
  });

  it('removes a saved key separately, and refreshes actual cache statistics after clearing', async () => {
    await openOptions();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить сохранённый ключ' }));
    await screen.findByText('Сохранённый ключ удалён.');
    expect(messagesOf('REMOVE_API_KEY')).toHaveLength(1);
    expect(browserMock.request).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Удалить сохранённый ключ' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('4 КБ')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Очистить кэш переводов' }));
    await screen.findByText('Кэш очищен. Уже показанный перевод страницы сохранён.');
    expect(messagesOf('CLEAR_CACHE')).toHaveLength(1);
    expect(messagesOf('GET_CACHE_STATS')).toHaveLength(2);
    expect(screen.getByText('0 Б')).toBeTruthy();
  });

  it('does not show cache clear success after a rejected runtime result', async () => {
    await openOptions();
    browserMock.failures.set('CLEAR_CACHE', { code: 'INTERNAL_ERROR', message: 'Не удалось очистить кэш.', retryable: false });
    fireEvent.click(screen.getByRole('button', { name: 'Очистить кэш переводов' }));
    await screen.findByText('Не удалось очистить кэш.');
    expect(screen.queryByText('Кэш очищен. Уже показанный перевод страницы сохранён.')).toBeNull();
    expect(screen.getByText('4 КБ')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Очистить кэш переводов' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
