/** @spec spec://modules/platform/INFRA-004-codex-connection#settings */
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { ModelInfo, Settings } from '../shared/contracts';
import { CHANNEL } from '../shared/constants';
import { CODEX_BASE_URL } from '../shared/providers';
import { LinguistyError, toPublicError } from '../shared/errors';
import { sendMessage, waitForBrowser } from '../shared/messaging';
import { CodexSession } from '../codex/session';
import { authorize, registration, requestCodexPermission, saveRegistration } from '../codex/browserAuth';
import { startCodexBridge } from '../codex/bridge';
import { codexErrorReference } from '../codex/failure';
import type { CodexStatus } from '../codex/protocol';
import { Brand, Notice, PoweredBy, type NoticeData } from './components';
import { useI18n } from './i18n';
import { getUiLocaleBundle } from './locales';
import { useTheme } from './theme';

export function CodexConnection() {
  const [session] = useState(() => new CodexSession());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<CodexStatus>({ connected: false });
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [model, setModel] = useState('default');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const operation = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const { locale, t, localizeError } = useI18n(settings?.uiLanguage);
  const text = getUiLocaleBundle(locale).codex;
  useTheme(settings?.theme);
  useEffect(() => { document.title = `${text.title} — Linguisty`; }, [text]);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController(); lifetime.current = controller;
    const stopBridge = startCodexBridge(session);
    const focus = () => { if (mounted.current) setStatus(session.status()); };
    const unload = () => { operation.current?.abort(); controller.abort(); stopBridge(); };
    window.addEventListener('pagehide', unload); window.addEventListener('focus', focus);
    void sendMessage<Settings>({ channel: CHANNEL, type: 'GET_SETTINGS' }, { signal: controller.signal }).then(value => {
      if (mounted.current && !controller.signal.aborted) { setSettings(value); setModel(value.providerId === 'codex' ? value.model || 'default' : 'default'); }
    }).catch(() => { /* Login remains available; saving reports settings failures explicitly. */ });
    return () => {
      mounted.current = false; unload(); window.removeEventListener('pagehide', unload); window.removeEventListener('focus', focus);
    };
  }, [session]);
  async function action(kind: 'login' | 'different' | 'check' | 'disconnect') {
    if (operation.current) return;
    const controller = new AbortController(); operation.current = controller;
    // Request optional permissions while still in the synchronous button click.
    const permission = kind === 'login' || kind === 'different' ? requestCodexPermission() : undefined;
    setBusy(kind); setNotice(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const current = () => mounted.current && !lifetime.current?.signal.aborted;
    try {
      if (permission && !await waitForBrowser(() => permission, { signal: controller.signal, timeoutMs: 120_000 })) throw new LinguistyError('PERMISSION_REQUIRED');
      timer = setTimeout(() => controller.abort(), 120_000);
      if (kind === 'disconnect') {
        const revoked = await session.disconnect(controller.signal);
        if (current()) { setModels([]); setNotice({ kind: revoked ? 'success' : 'info', message: revoked ? text.revoked : text.localOnly }); }
        return;
      }
      if (kind === 'login' || kind === 'different') {
        session.clear(); setModels([]); setStatus(session.status());
        if (current()) setNotice({ kind: 'info', message: text.waiting });
        const saved = await registration(kind === 'different');
        const { attempt, callback } = await authorize(saved, controller.signal);
        const connected = await session.connect(attempt, callback, controller.signal);
        await saveRegistration({ hostId: saved.hostId, clientId: connected.clientId });
        if (current()) setStatus(session.status());
      }
      const available = await session.request({ type: 'models', timeoutMs: 30_000 }, controller.signal) as ModelInfo[];
      if (current()) { setModels(available); setNotice({ kind: 'success', message: text.checked }); }
    } catch (error) {
      const reference = codexErrorReference(error);
      if (current()) setNotice({ kind: 'error', message: localizeError(toPublicError(error)) + (reference ? ` [${reference}]` : '') });
    } finally {
      clearTimeout(timer); operation.current = null;
      if (current()) { setStatus(session.status()); setBusy(null); }
    }
  }
  async function saveModel() {
    if (operation.current || !settings) return;
    const controller = new AbortController(); operation.current = controller; setBusy('save'); setNotice(null);
    try {
      const latest = await sendMessage<Settings>({ channel: CHANNEL, type: 'GET_SETTINGS' }, { signal: controller.signal });
      const saved = await sendMessage<Settings>({ channel: CHANNEL, type: 'SAVE_SETTINGS', preserveKeyMode: true,
        settings: { ...latest, providerId: 'codex', baseUrl: CODEX_BASE_URL, model, concurrency: 1, streaming: false, requestTimeoutMs: 120_000 },
      }, { signal: controller.signal });
      if (mounted.current) { setSettings(saved); setNotice({ kind: 'info', message: text.saved }); }
    } catch (error) { if (mounted.current) setNotice({ kind: 'error', message: localizeError(toPublicError(error)) }); }
    finally { operation.current = null; if (mounted.current) setBusy(null); }
  }
  async function returnToSettings() {
    try { await waitForBrowser(() => browser.runtime.openOptionsPage(), { signal: lifetime.current?.signal }); }
    catch (error) { if (mounted.current) setNotice({ kind: 'error', message: localizeError(toPublicError(error)) }); }
  }
  return <main className="options-shell codex-shell">
    <header className="options-header"><Brand caption={t('Ваша модель. Ваш перевод.')} /><button type="button" className="button-secondary" onClick={() => void returnToSettings()}>{text.returnOptions}</button></header>
    <div className="codex-content">
      <div className="options-intro"><p className="eyebrow">Linguisty · {text.name}</p><h1>{text.title}</h1><p>{text.intro}</p></div>
      <p className="notice notice-info codex-session-note">{text.keepOpen}</p>
      <ol className="codex-steps">{[text.step1, text.step2, text.step3, text.step4].map((step, index) =>
        <li key={index} className="settings-card"><span className="step-number" aria-hidden="true">0{index + 1}</span><p>{step}</p></li>)}</ol>
      <section className="settings-card codex-status" aria-labelledby="codex-status-title" aria-busy={busy !== null}>
        <h2 id="codex-status-title">{text.name}</h2>
        <p role="status" aria-live="polite">{status.connected ? text.authorized : text.disconnected}{status.email && <> <span>{status.email}</span></>}</p>
        <Notice notice={notice} />
        <div className="save-actions">
          <button type="button" className="button-primary" disabled={busy !== null || status.connected} onClick={() => void action('login')}>{text.signIn}</button>
          {busy && ['login', 'different'].includes(busy) && <button type="button" className="button-secondary" onClick={() => operation.current?.abort()}>{text.cancel}</button>}
          <button type="button" className="button-secondary" disabled={busy !== null || !status.connected} onClick={() => void action('check')}>{text.check}</button>
          <button type="button" className="button-danger" disabled={busy !== null || !status.connected} onClick={() => void action('disconnect')}>{text.disconnect}</button>
          <button type="button" className="button-quiet" disabled={busy !== null} onClick={() => void action('different')}>{text.differentAccount}</button>
        </div>
        {models.length > 0 && <div className="field"><label htmlFor="codex-model">{t('Модель')}</label><select id="codex-model" value={model} disabled={busy !== null} onChange={event => setModel(event.target.value)}><option value="default">default</option>{models.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="field-help">{text.modelHelp}</span><button type="button" className="button-secondary" disabled={busy !== null || !settings} onClick={() => void saveModel()}>{t('Сохранить настройки')}</button></div>}
      </section>
      <p className="privacy-copy">{text.limits}</p>
      <footer className="options-footer"><a href="https://developers.openai.com/siwc/token-sharing-open-source/sign-in" target="_blank" rel="noreferrer">{text.signIn} · OpenAI</a><button type="button" className="button-secondary" onClick={() => void returnToSettings()}>{text.returnOptions}</button><PoweredBy /></footer>
    </div>
  </main>;
}
