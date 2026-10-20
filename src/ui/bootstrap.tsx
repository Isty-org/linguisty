/** @spec spec://modules/interface/FEAT-003-controls#errors */
import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyInitialTheme } from './theme';
import { I18nProvider, translate, useI18n } from './i18n';
import { isMessageKey } from './locales';

function UiFailure() {
  const { t } = useI18n();
  return <main className="startup-fallback" role="alert">
    <h1>Linguisty</h1>
    <p>{t('Не удалось открыть интерфейс. Перезагрузите окно и попробуйте ещё раз.')}</p>
    <button type="button" className="button-primary" onClick={() => window.location.reload()}>{t('Перезагрузить окно')}</button>
  </main>;
}

export class UiErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  override render() {
    if (this.state.failed) return <UiFailure />;
    return this.props.children;
  }
}

export function mountUi(view: ReactNode) {
  applyInitialTheme();
  const root = document.getElementById('root');
  if (!root) return;
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n;
    if (key && isMessageKey(key)) element.textContent = translate(key);
  }
  const app = createRoot(root, { onCaughtError: () => { /* The fallback is the report; raw render errors can contain form values. */ } });
  app.render(<I18nProvider><UiErrorBoundary>{view}</UiErrorBoundary></I18nProvider>);
  return app;
}
