/** @spec spec://modules/interface/FEAT-003-controls#languages */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { I18nProvider, setI18nPreference, useI18n } from '../../src/ui/i18n';
import { getUiLocaleBundle, hasUiLocale, loadUiLocale } from '../../src/ui/locales';

const slowUkrainian = vi.hoisted(() => {
  let release: (() => void) | undefined;
  const wait = new Promise<void>(resolve => { release = resolve; });
  return { wait, release: () => release?.() };
});
const slowKorean = vi.hoisted(() => {
  let release: (() => void) | undefined;
  const wait = new Promise<void>(resolve => { release = resolve; });
  return { wait, release: () => release?.() };
});

vi.mock('../../src/ui/locales/uk', async () => {
  await slowUkrainian.wait;
  return vi.importActual('../../src/ui/locales/uk');
});
vi.mock('../../src/ui/locales/hi', () => { throw new Error('Simulated missing locale chunk'); });
vi.mock('../../src/ui/locales/ko', async () => {
  await slowKorean.wait;
  return vi.importActual('../../src/ui/locales/ko');
});

function Probe() {
  const { locale, t } = useI18n();
  return <div><output data-testid="locale">{locale}</output><span>{t('Настройки')}</span></div>;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('browser', { i18n: { getUILanguage: () => 'en-US' } });
  setI18nPreference('en');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('deduplicates a delayed pack and never paints it after a newer language wins', async () => {
  const remove = vi.spyOn(window, 'removeEventListener');
  const view = render(<I18nProvider preference="uk"><Probe /></I18nProvider>);
  expect(screen.getByTestId('locale').textContent).toBe('en');
  expect(document.documentElement.lang).toBe('en');
  const first = loadUiLocale('uk');
  expect(loadUiLocale('uk')).toBe(first);
  view.rerender(<I18nProvider preference="fr"><Probe /></I18nProvider>);
  await screen.findByText('fr');
  expect(document.documentElement.lang).toBe('fr');
  await act(async () => { slowUkrainian.release(); await first; });
  expect(hasUiLocale('uk')).toBe(true);
  expect(screen.getByTestId('locale').textContent).toBe('fr');
  expect(document.documentElement.lang).toBe('fr');
  view.unmount();
  expect(remove.mock.calls.some(([event]) => event === 'languagechange')).toBe(true);
  expect(remove.mock.calls.some(([event]) => event === 'storage')).toBe(true);
});

it('uses English UI, error text and document language if a local pack cannot load', async () => {
  const fallback = await loadUiLocale('hi');
  expect(fallback).toBe(getUiLocaleBundle('en'));
  expect(hasUiLocale('hi')).toBe(false);
  render(<I18nProvider preference="hi"><Probe /></I18nProvider>);
  expect(screen.getByTestId('locale').textContent).toBe('en');
  expect(screen.getByText('Settings')).toBeTruthy();
  expect(document.documentElement.lang).toBe('en');
});

it('releases subscriptions when the page closes before its dictionary arrives', async () => {
  const remove = vi.spyOn(window, 'removeEventListener');
  const view = render(<I18nProvider preference="ko"><Probe /></I18nProvider>);
  const pending = loadUiLocale('ko');
  expect(screen.getByTestId('locale').textContent).toBe('en');
  view.unmount();
  const removedBeforeArrival = remove.mock.calls.length;
  expect(removedBeforeArrival).toBeGreaterThan(0);
  await act(async () => { slowKorean.release(); await pending; });
  expect(remove.mock.calls).toHaveLength(removedBeforeArrival);
  expect(hasUiLocale('ko')).toBe(true);
});
