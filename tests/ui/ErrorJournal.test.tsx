/** @spec spec://modules/interface/FEAT-003-controls#errors */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { browserMock, resetBrowser } from './browserMock';
import { ErrorJournal } from '../../src/ui/ErrorJournal';
beforeEach(() => resetBrowser());
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks();
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});
it('renders untrusted API message as text and copies/clears the sanitized displayed records', async () => {
  browserMock.errorLog = [{ id: 'error-1', createdAt: Date.now(), operation: 'translate', providerId: 'openrouter', model: 'model', source: 'api', httpStatus: 402,
    message: '<img src=x onerror="alert(1)"> Insufficient credits', errorCode: 'INVALID_SETTINGS', attempts: 1 }];
  const writeText = vi.fn(async (_text: string) => undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const view = render(<ErrorJournal />);
  await screen.findByText(/Insufficient credits/);
  expect(view.container.querySelector('img')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Скопировать журнал' }));
  await screen.findByText('Журнал скопирован.');
  expect(JSON.parse(writeText.mock.calls[0]![0]!)).toEqual(browserMock.errorLog);
  fireEvent.click(screen.getByRole('button', { name: 'Очистить журнал' }));
  await screen.findByText('Журнал очищен.');
  expect(browserMock.errorLog).toEqual([]);
  expect(screen.getByText('Ошибок API пока нет.')).toBeDefined();
});
it('shows a failed read and permits retry without blocking other UI', async () => {
  browserMock.failures.set('GET_ERROR_LOG', { code: 'INTERNAL_ERROR', message: 'Журнал недоступен.', retryable: true });
  render(<ErrorJournal />);
  await screen.findByText('Журнал недоступен.');
  browserMock.failures.clear();
  fireEvent.click(screen.getByRole('button', { name: 'Обновить журнал' }));
  await waitFor(() => expect(screen.queryByText('Журнал недоступен.')).toBeNull());
});

/** @spec spec://modules/interface/FEAT-003-controls#languages */
it('localizes journal labels while retaining the actual sanitized provider diagnostic', async () => {
  browserMock.errorLog = [{ id: 'english-error', createdAt: Date.now(), operation: 'test-connection', providerId: 'openrouter', model: 'model', source: 'api', httpStatus: 402,
    message: 'Account has no credits; request refused.', providerMessage: 'Add credits in the provider dashboard.', errorCode: 'INVALID_SETTINGS', attempts: 2 }];
  render(<ErrorJournal preference="en" />);
  await screen.findByText('Account has no credits; request refused.');
  expect(screen.getByRole('heading', { name: 'API error log' })).toBeTruthy();
  expect(screen.getByText('Connection test · API response')).toBeTruthy();
  expect(screen.getByText(/Attempts: 2/)).toBeTruthy();
  expect(screen.getByText('Add credits in the provider dashboard.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Clear log' })).toBeTruthy();
});
it('cancels a pending load and its timeout at unmount', async () => {
  vi.useFakeTimers();
  browserMock.sendMessage.mockImplementation(() => new Promise(() => undefined));
  const view = render(<ErrorJournal />);
  await Promise.resolve();
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  view.unmount(); await Promise.resolve(); await Promise.resolve();
  expect(vi.getTimerCount()).toBe(0);
});
