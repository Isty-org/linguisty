/** @spec spec://modules/interface/FEAT-003-controls#design */
import { useLayoutEffect } from 'react';
import type { Theme } from '../shared/contracts';

const THEME_HINT_KEY = 'linguisty.theme';

function systemIsDark(): boolean {
  try { return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches; }
  catch { return false; }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme === 'system' ? (systemIsDark() ? 'dark' : 'light') : theme;
}

export function rememberTheme(theme: Theme): void {
  try {
    // A non-secret hint allows the external bootstrap to apply the theme before React paints.
    localStorage.setItem(THEME_HINT_KEY, theme);
  } catch {
    // The canonical setting still lives in extension storage when localStorage is unavailable.
  }
}

export function applyInitialTheme(): void {
  let theme: Theme = 'system';
  try {
    const hint = localStorage.getItem(THEME_HINT_KEY);
    if (hint === 'light' || hint === 'dark') theme = hint;
  } catch {
    // Use the operating system preference when a theme hint cannot be read.
  }
  applyTheme(theme);
}

export function useTheme(theme?: Theme): void {
  useLayoutEffect(() => {
    if (!theme) return;
    applyTheme(theme);
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return;
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme('system');
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, [theme]);
}
