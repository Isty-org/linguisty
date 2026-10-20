/** @spec spec://modules/interface/FEAT-003-controls#errors */
import { useEffect, useRef, useState } from 'react';
import type { ApiErrorEntry } from '../shared/contracts';
import { CHANNEL } from '../shared/constants';
import { LinguistyError, toPublicError } from '../shared/errors';
import { sendMessage, waitForBrowser } from '../shared/messaging';
import { Notice, type NoticeData } from './components';
import { useI18n } from './i18n';

const operations = { translate: 'Перевод страницы', 'test-connection': 'Проверка подключения', 'list-models': 'Список моделей' } as const;
const sources = { api: 'Ответ API', network: 'Сбой сети', timeout: 'Время ожидания истекло', 'invalid-response': 'Некорректный ответ' } as const;

export function ErrorJournal({ refreshKey = 0, preference }: { refreshKey?: number; preference?: string }) {
  const { locale, t, localizeError } = useI18n(preference);
  const localizeErrorRef = useRef(localizeError);
  const [entries, setEntries] = useState<ApiErrorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const lifetime = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  useEffect(() => { localizeErrorRef.current = localizeError; }, [localizeError]);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    setLoading(true); setNotice(null);
    void sendMessage<ApiErrorEntry[]>({ channel: CHANNEL, type: 'GET_ERROR_LOG' }, { signal: controller.signal }).then(
      value => { if (!controller.signal.aborted) setEntries(value); },
      error => { if (!controller.signal.aborted) setNotice({ kind: 'error', message: localizeErrorRef.current(toPublicError(error)) }); },
    ).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload, refreshKey]);

  async function action(kind: 'copy' | 'clear') {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setNotice(null);
    const signal = lifetime.current?.signal;
    try {
      if (kind === 'copy') {
        if (!navigator.clipboard?.writeText) throw new LinguistyError('INTERNAL_ERROR', 'Буфер обмена недоступен в этом окне.');
        // Start writeText synchronously in the click's user gesture.
        const copied = navigator.clipboard.writeText(JSON.stringify(entries, null, 2));
        await waitForBrowser(() => copied, { signal });
        if (!signal?.aborted) setNotice({ kind: 'success', message: t('Журнал скопирован.') });
      } else {
        await sendMessage({ channel: CHANNEL, type: 'CLEAR_ERROR_LOG' }, { signal });
        if (!signal?.aborted) { setEntries([]); setNotice({ kind: 'success', message: t('Журнал очищен.') }); }
      }
    } catch (error) {
      if (!signal?.aborted) setNotice({ kind: 'error', message: localizeError(toPublicError(error)) });
    } finally { busyRef.current = false; if (!signal?.aborted) setBusy(false); }
  }

  return <section className="settings-card error-journal" aria-labelledby="error-journal-title" aria-busy={loading || busy}>
    <div className="section-heading"><div><h2 id="error-journal-title">{t('Журнал ошибок API')}</h2><p>{t('Причины отказа перевода и подключения, которые сообщил выбранный сервис.')}</p></div></div>
    <p className="field-help">{t('Хранится на этом устройстве 7 дней, до 100 записей. Секреты и текст запроса скрываются. Повторные попытки объединены в одну запись.')}</p>
    <div className="cache-actions">
      <button type="button" className="button-secondary" disabled={busy || loading} onClick={() => setReload(value => value + 1)}>{t('Обновить журнал')}</button>
      <button type="button" className="button-secondary" disabled={busy || loading || !entries.length} onClick={() => void action('copy')}>{t('Скопировать журнал')}</button>
      <button type="button" className="button-danger" disabled={busy || loading || !entries.length} onClick={() => void action('clear')}>{t('Очистить журнал')}</button>
    </div>
    <Notice notice={notice} />
    {loading ? <p role="status" className="small muted">{t('Загружаем журнал…')}</p> : !entries.length ? <p role="status" className="small muted">{t('Ошибок API пока нет.')}</p> : <ol className="error-log" aria-label={t('Ошибки API')}>{entries.map(entry => <li key={entry.id}>
      <div className="error-log-meta"><time dateTime={new Date(entry.createdAt).toISOString()}>{new Date(entry.createdAt).toLocaleString(locale)}</time><span>{t(operations[entry.operation])} · {t(sources[entry.source])}</span></div>
      <p className="small mono">{entry.providerId}{entry.model ? ` · ${entry.model}` : ''}{entry.httpStatus !== undefined ? ` · HTTP ${entry.httpStatus}` : ''} · {t('Попыток: {count}', { count: entry.attempts })}</p>
      <p>{entry.message ?? localizeError(toPublicError(new LinguistyError(entry.errorCode)))}</p>
      {entry.providerMessage && <p>{entry.providerMessage}</p>}
      <p className="small muted mono">{[entry.apiCode && t('Код: {code}', { code: entry.apiCode }), entry.apiType && t('Тип: {type}', { type: entry.apiType }), entry.requestId && t('Request ID: {id}', { id: entry.requestId }), entry.errorCode].filter(Boolean).join(' · ')}</p>
    </li>)}</ol>}
  </section>;
}
