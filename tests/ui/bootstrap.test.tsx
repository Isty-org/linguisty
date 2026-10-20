/** @spec spec://modules/interface/FEAT-003-controls#errors */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import { mountUi } from '../../src/ui/bootstrap';
import { resetBrowser } from './browserMock';
import { setI18nPreference } from '../../src/ui/i18n';

beforeEach(resetBrowser);
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('UI startup fallback', () => {
  it('replaces bootstrap content with a safe recovery action after a render error', async () => {
    const root = document.createElement('div');
    root.id = 'root';
    root.textContent = 'Открываем интерфейс…';
    document.body.append(root);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    function BrokenView(): never { throw new Error('unsafe-private-test-value'); }
    let app: ReturnType<typeof mountUi>;
    await act(async () => { app = mountUi(<BrokenView />); });
    expect(screen.getByRole('alert').textContent).toContain('Не удалось открыть интерфейс');
    expect(screen.getByRole('button', { name: 'Перезагрузить окно' })).toBeTruthy();
    expect(root.textContent).not.toContain('private-test-value');
    expect(logged).not.toHaveBeenCalled();
    await act(async () => { app?.unmount(); });
  });

  /** @spec spec://modules/interface/FEAT-003-controls#languages */
  it('localizes the safe render failure in English without exposing thrown details', async () => {
    setI18nPreference('en');
    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);
    function BrokenView(): never { throw new Error('private-secret-value'); }
    let app: ReturnType<typeof mountUi>;
    await act(async () => { app = mountUi(<BrokenView />); });
    expect(screen.getByRole('button', { name: 'Reload window' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
    expect(root.textContent).not.toContain('private-secret-value');
    await act(async () => { app?.unmount(); });
  });
});
