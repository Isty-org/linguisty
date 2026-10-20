/** @spec spec://modules/interface/FEAT-003-controls#popup */
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { CHANNEL } from '../shared/constants';
import type { PublicError, SecretStatus, Settings, TabTranslationState, TranslationStatus } from '../shared/contracts';
import { toPublicError } from '../shared/errors';
import { sendMessage, waitForBrowser } from '../shared/messaging';
import { getLanguageOptions, resolveBrowserTargetLanguage } from '../shared/languages';
import { Brand, LanguageSelect, Notice, PoweredBy, type NoticeData } from './components';
import { requestProviderPermission } from './settingsForm';
import { rememberTheme, useTheme } from './theme';
import { setI18nPreference, useI18n } from './i18n';
import { getUiLocaleBundle, type MessageKey } from './locales';
import { isCliProvider, isKeylessProvider, PROVIDER_NAMES } from '../shared/providers';

const statusLabels: Record<TranslationStatus, MessageKey> = {
  idle: 'Готово к переводу', scanning: 'Находим текст страницы', translating: 'Переводим страницу',
  completed: 'Перевод завершён', cancelled: 'Перевод отменён', error: 'Перевод остановлен с ошибкой',
};

export function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [secret, setSecret] = useState<SecretStatus | null>(null);
  const [codexConnected, setCodexConnected] = useState(false);
  const [state, setState] = useState<TabTranslationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const [pageError, setPageError] = useState<PublicError | null>(null);
  const [reload, setReload] = useState(0);
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const tabId = useRef<number | undefined>(undefined);
  const savedSettings = useRef<Settings | null>(null);
  const stateRevision = useRef(0);
  const lifetime = useRef<AbortController | null>(null);
  const uiLanguage = settings?.uiLanguage;
  const { locale, t, localizeError } = useI18n(uiLanguage);
  const codexText = getUiLocaleBundle(locale).codex;
  const localizeErrorRef = useRef(localizeError);
  useTheme(settings?.theme);

  useEffect(() => {
    if (uiLanguage) setI18nPreference(uiLanguage);
  }, [uiLanguage]);
  useEffect(() => { localizeErrorRef.current = localizeError; }, [localizeError]);
  useEffect(() => {
    const update = () => setSettings(current => current?.targetLanguageMode === 'browser'
      ? { ...current, targetLanguage: resolveBrowserTargetLanguage() } : current);
    window.addEventListener('languagechange', update);
    return () => window.removeEventListener('languagechange', update);
  }, []);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    const controller = new AbortController();
    lifetime.current = controller;
    setLoading(true);
    setNotice(null);
    setPageError(null);
    const listener = (message: unknown) => {
      if (!message || typeof message !== 'object' || !('channel' in message) || message.channel !== CHANNEL
        || !('type' in message) || message.type !== 'TAB_STATE_CHANGED' || !('state' in message)) return;
      const next = message.state as TabTranslationState;
      if (!next || typeof next !== 'object' || typeof tabId.current !== 'number' || next.tabId !== tabId.current) return;
      stateRevision.current += 1;
      setState(next);
    };
    browser.runtime.onMessage.addListener(listener);
    async function load() {
      try {
        const [currentSettings, currentSecret, tabs] = await Promise.all([
          sendMessage<Settings>({ channel: CHANNEL, type: 'GET_SETTINGS' }, { signal: controller.signal }),
          sendMessage<SecretStatus>({ channel: CHANNEL, type: 'GET_SECRET_STATUS' }, { signal: controller.signal }),
          waitForBrowser(() => browser.tabs.query({ active: true, currentWindow: true }), { signal: controller.signal }),
        ]);
        if (disposed) return;
        setSettings(currentSettings);
        savedSettings.current = currentSettings;
        setSecret(currentSecret);
        if (currentSettings.providerId === 'codex') {
          const status = await sendMessage<{ connected: boolean }>({ channel: CHANNEL, type: 'GET_CODEX_STATUS' }, { signal: controller.signal });
          if (!disposed) setCodexConnected(status.connected === true);
        }
        rememberTheme(currentSettings.theme);
        tabId.current = tabs[0]?.id;
        const revision = stateRevision.current;
        const currentState = await sendMessage<TabTranslationState>({ channel: CHANNEL, type: 'GET_TAB_STATE', ...(tabId.current === undefined ? {} : { tabId: tabId.current }) }, { signal: controller.signal });
        if (!disposed && revision === stateRevision.current) setState(currentState);
      } catch (error) {
        if (!disposed) {
          const publicError = toPublicError(error);
          setPageError(publicError);
          setNotice({ kind: 'error', message: localizeErrorRef.current(publicError) });
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void load();
    return () => {
      disposed = true;
      mounted.current = false;
      controller.abort();
      browser.runtime.onMessage.removeListener(listener);
    };
  }, [reload]);

  async function action(kind: 'start' | 'cancel' | 'original' | 'translated' | 'refresh' | 'options') {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    setNotice(null);
    const wait = { signal: lifetime.current?.signal };
    const current = () => mounted.current && !wait.signal?.aborted;
    try {
      if (kind === 'options') {
        const opened = browser.runtime.openOptionsPage();
        await waitForBrowser(() => opened, wait);
        return;
      }
      const tab = tabId.current === undefined ? {} : { tabId: tabId.current };
      if (kind === 'start' && settings) {
        // This call happens synchronously in the button handler, before storage or messaging awaits.
        const permission = requestProviderPermission(settings);
        await waitForBrowser(() => permission, { ...wait, timeoutMs: 120_000 });
        if (!current()) return;
        if (settings.sourceLanguage !== savedSettings.current?.sourceLanguage || settings.targetLanguage !== savedSettings.current?.targetLanguage
          || settings.targetLanguageMode !== savedSettings.current?.targetLanguageMode) {
          const saved = await sendMessage<Settings>({ channel: CHANNEL, type: 'SAVE_SETTINGS', settings, preserveKeyMode: true, languagesOnly: true }, wait);
          savedSettings.current = saved;
          if (current()) setSettings(saved);
        }
        const revision = stateRevision.current;
        const next = await sendMessage<TabTranslationState>({ channel: CHANNEL, type: 'START_TRANSLATION', ...tab }, wait);
        if (current()) {
          setPageError(null);
          if (revision === stateRevision.current) setState(next);
        }
      } else if (kind === 'cancel') {
        const revision = stateRevision.current;
        const next = await sendMessage<TabTranslationState>({ channel: CHANNEL, type: 'CANCEL_TRANSLATION', ...tab }, wait);
        if (current() && revision === stateRevision.current) setState(next);
      } else if (kind === 'original' || kind === 'translated') {
        const revision = stateRevision.current;
        const next = await sendMessage<TabTranslationState>({ channel: CHANNEL, type: 'SET_DISPLAY_MODE', mode: kind, ...tab }, wait);
        if (current() && revision === stateRevision.current) setState(next);
      } else if (kind === 'refresh') {
        const revision = stateRevision.current;
        const next = await sendMessage<TabTranslationState>({ channel: CHANNEL, type: 'GET_TAB_STATE', ...tab }, wait);
        if (current()) {
          setPageError(null);
          if (revision === stateRevision.current) setState(next);
        }
      }
    } catch (error) {
      if (current()) {
        const publicError = toPublicError(error);
        setNotice({ kind: 'error', message: localizeError(publicError) });
        if (kind !== 'options') setPageError(publicError);
      }
    } finally {
      busyRef.current = false;
      if (current()) setBusy(null);
    }
  }

  const active = state?.status === 'scanning' || state?.status === 'translating';
  const configured = settings?.providerId === 'codex' ? codexConnected : isCliProvider(settings?.providerId) || (!!secret?.hasKey && !!settings?.model.trim());
  const processed = state ? state.translated + state.failed : 0;
  const progress = state?.discovered ? Math.min(100, Math.round(processed / state.discovered * 100)) : 0;
  const currentError = state?.error ?? pageError;
  const restricted = currentError?.code === 'RESTRICTED_PAGE';
  const needsSettings = currentError && ['INVALID_API_KEY', 'MODEL_NOT_FOUND', 'INVALID_SETTINGS', 'CLI_HOST_MISSING', 'CLI_NOT_FOUND', 'CLI_LOGIN_REQUIRED', 'CLI_EXECUTION_FAILED', 'CODEX_NOT_CONNECTED', 'CODEX_AUTH_FAILED', 'CODEX_PLAN_REQUIRED'].includes(currentError.code);

  const targetName = settings ? getLanguageOptions(locale).find(language => language.code === settings.targetLanguage)?.label ?? settings.targetLanguage : '';

  /** @spec spec://modules/interface/FEAT-003-controls#languages */
  function changeTarget(value: string) {
    if (!settings) return;
    setSettings({ ...settings, targetLanguageMode: value === '__browser__' ? 'browser' : 'manual',
      targetLanguage: value === '__browser__' ? resolveBrowserTargetLanguage() : value });
  }

  return <main className="popup-shell">
    <header className="popup-header"><Brand compact caption={t('Ваша модель. Ваш перевод.')} /><button type="button" className="button-quiet popup-settings" aria-label={t('Настройки')} title={t('Настройки')} onClick={() => void action('options')} disabled={busy !== null}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M10 3h4l.5 2.5 1.4.8 2.4-.8 2 3.4-1.9 1.7v1.6l1.9 1.7-2 3.4-2.4-.8-1.4.8L14 21h-4l-.5-2.5-1.4-.8-2.4.8-2-3.4 1.9-1.7v-1.6l-1.9-1.7 2-3.4 2.4.8 1.4-.8L10 3Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button></header>
    {loading ? <p className="loading-copy" role="status">{t('Загружаем настройки и статус страницы…')}</p> : <>
      {settings && <>
        <div className="language-grid">
          <div className="field"><label htmlFor="popup-source">{t('С языка')}</label><LanguageSelect id="popup-source" value={settings.sourceLanguage} source locale={locale} disabled={active || busy !== null} onChange={(value) => setSettings({ ...settings, sourceLanguage: value })} /></div>
          <div className="field"><label htmlFor="popup-target">{t('На язык')}</label><LanguageSelect id="popup-target" value={settings.targetLanguageMode === 'browser' ? '__browser__' : settings.targetLanguage} browserTarget locale={locale} disabled={active || busy !== null} onChange={changeTarget} />{settings.targetLanguageMode === 'browser' && <span className="field-help">{t('Выбран автоматически: {language}', { language: targetName })}</span>}</div>
        </div>
        <div className="model-summary"><span>{settings.providerId === 'codex' ? codexText.name : PROVIDER_NAMES[settings.providerId]}</span><span className="mono">{settings.model || (isKeylessProvider(settings.providerId) ? 'default' : t('Модель ещё не выбрана'))}</span></div>
      </>}
      {settings && !configured && <section className="onboarding" aria-labelledby="onboarding-title">
        <h2 id="onboarding-title">{t('Подключите свою модель')}</h2>
        <p>{settings.providerId === 'codex' ? codexText.CODEX_NOT_CONNECTED : !secret?.hasKey ? !settings.model.trim() ? t('Добавьте свой API-ключ и укажите ID модели в настройках.') : t('Добавьте свой API-ключ в настройках.') : t('Укажите ID модели в настройках. Ключ уже добавлен.')}</p>
        <button type="button" className="button-primary" onClick={() => void action('options')} disabled={busy !== null}>{t('Настроить Linguisty')}</button>
      </section>}
      {state && <section className="progress-card" aria-labelledby="page-status">
        <div className="status-heading"><h2 id="page-status">{state.status === 'completed' && state.failed > 0 ? t('Перевод завершён с ошибками') : t(statusLabels[state.status])}</h2><span className="status-dot" data-active={active} aria-hidden="true" /></div>
        {state.status !== 'idle' && <>
          <progress aria-label={t('Прогресс перевода')} max={100} {...(state.status === 'scanning' ? {} : { value: progress })} />
          <p className="progress-copy" role="status" aria-live="polite" aria-atomic="true">{t('Переведено {translated} из {discovered} · ошибок: {failed}', { translated: state.translated, discovered: state.discovered, failed: state.failed })}</p>
          <p className="small muted">{t('В работе: {inFlight} · из кэша: {fromCache}', { inFlight: state.inFlight, fromCache: state.fromCache })}{state.status === 'completed' && state.discovered === 0 ? ` · ${t('нет подходящего текста')}` : ''}</p>
        </>}
        {state.limited && <p className="notice notice-info">{t('Достигнут предел обрабатываемого текста страницы. Переведена доступная часть.')}</p>}
        {state.error && <p className="notice notice-error" role="alert">{localizeError(state.error)}</p>}
        {state.translated > 0 && <div className="display-actions" role="group" aria-label={t('Отображение страницы')}>
          <button type="button" className="button-secondary" aria-pressed={state.displayMode === 'original'} disabled={busy !== null} onClick={() => void action('original')}>{t('Оригинал')}</button>
          <button type="button" className="button-secondary" aria-pressed={state.displayMode === 'translated'} disabled={busy !== null} onClick={() => void action('translated')}>{t('Перевод')}</button>
        </div>}
      </section>}
      {active ? <button type="button" className="button-secondary full-width" disabled={busy !== null} onClick={() => void action('cancel')}>{busy === 'cancel' ? t('Отменяем…') : t('Отменить перевод')}</button> : configured && settings && (needsSettings ? <button type="button" className="button-primary full-width" disabled={busy !== null} onClick={() => void action('options')}>{t('Открыть настройки сервиса')}</button> : <button type="button" className="button-primary full-width" disabled={busy !== null || restricted} onClick={() => void action('start')}>{busy === 'start' ? t('Запускаем…') : currentError?.code === 'PERMISSION_REQUIRED' ? t('Разрешить доступ и перевести') : currentError?.retryable ? t('Повторить перевод') : state && state.status !== 'idle' ? t('Перевести заново') : t('Перевести страницу')}</button>)}
      <Notice notice={notice} />
      {(!settings || !state) && <button type="button" className="button-secondary full-width" onClick={() => setReload((value) => value + 1)}>{t('Повторить загрузку')}</button>}
      {state && (active || currentError) && <button type="button" className="button-quiet full-width" onClick={() => void action('refresh')} disabled={busy !== null}>{busy === 'refresh' ? t('Обновляем…') : t('Обновить статус')}</button>}
      <p className="privacy-copy">{t('Текст и ограниченный контекст страницы передаются выбранному сервису для перевода. Ключ отправляется только этому сервису.')}</p>
    </>}
    <footer className="popup-footer"><PoweredBy /></footer>
  </main>;
}
