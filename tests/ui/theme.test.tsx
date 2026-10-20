/** @spec spec://modules/interface/FEAT-003-controls#design */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Theme } from '../../src/shared/contracts';
import { applyInitialTheme, rememberTheme, useTheme } from '../../src/ui/theme';

let dark = false;
const listeners = new Set<() => void>();

beforeEach(() => {
  dark = false;
  listeners.clear();
  localStorage.clear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    get matches() { return dark; },
    addEventListener: (_event: string, callback: () => void) => listeners.add(callback),
    removeEventListener: (_event: string, callback: () => void) => listeners.delete(callback),
  })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Theme preference and lifecycle', () => {
  it('applies the saved non-secret hint before mounting, with an operating system fallback', () => {
    rememberTheme('dark');
    applyInitialTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');
    rememberTheme('system');
    dark = true;
    applyInitialTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');
    dark = false;
    applyInitialTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.length).toBe(1);
  });

  it('reacts to system changes and removes its only subscription when switching or unmounting', () => {
    const hook = renderHook(({ theme }: { theme: Theme }) => useTheme(theme), { initialProps: { theme: 'system' as Theme } });
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(listeners.size).toBe(1);
    act(() => { dark = true; for (const update of listeners) update(); });
    expect(document.documentElement.dataset.theme).toBe('dark');
    hook.rerender({ theme: 'light' });
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(listeners.size).toBe(0);
    hook.rerender({ theme: 'system' });
    expect(listeners.size).toBe(1);
    hook.unmount();
    expect(listeners.size).toBe(0);
  });
});
