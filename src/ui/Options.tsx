/** @spec spec://modules/interface/FEAT-003-controls#options */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { browser } from 'wxt/browser';
import { CHANNEL, MODEL_MAX_ENTRIES, OPENROUTER_BASE_URL } from '../shared/constants';
import type { CacheStats, ConnectionTestResult, KeyMode, ModelInfo, ProviderId, SecretStatus, Settings, Theme, TranslationStyle } from '../shared/contracts';
import { toPublicError } from '../shared/errors';
import { sendMessage, waitForBrowser } from '../shared/messaging';
import { getLanguageOptions, resolveBrowserTargetLanguage } from '../shared/languages';
import { Brand, FieldError, LanguageSelect, Notice, PoweredBy, formatBytes, type NoticeData } from './components';
import { API_KEY_INPUT_MAX_LENGTH, normalizedForm, requestProviderPermission, validateForm, type FormErrors } from './settingsForm';
import { rememberTheme, useTheme } from './theme';
import { ErrorJournal } from './ErrorJournal';
import { setI18nPreference, useI18n } from './i18n';
import { getUiLocaleBundle, isMessageKey, UI_LOCALES } from './locales';
import { CLI_BASE_URL, CODEX_BASE_URL, isCliProvider, isKeylessProvider, PROVIDER_NAMES } from '../shared/providers';
import { CODEX_CONNECTION_MESSAGE } from '../codex/protocol';

export function Options() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [secret, setSecret] = useState<SecretStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [search, setSearch] = useState('');
  const [cache, setCache] = useState<CacheStats | null>(null);
  const [cacheNotice, setCacheNotice] = useState<NoticeData | null>(null);
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [temporaryFirefox, setTemporaryFirefox] = useState(false);
  const [journalRefresh, setJournalRefresh] = useState(0);
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const savedKeyMode = useRef<KeyMode | undefined>(undefined);
  const lifetime = useRef<AbortController | null>(null);
  const uiLanguage = settings?.uiLanguage;
  const { locale, t, localizeError } = useI18n(uiLanguage);
  const cli = isCliProvider(settings?.providerId);
  const codex = settings?.providerId === 'codex';
  const keyless = isKeylessProvider(settings?.providerId);
  const { codex: codexText, cli: cliText } = getUiLocaleBundle(locale);
  const localizeErrorRef = useRef(localizeError);
  const languages = useMemo(() => getLanguageOptions(locale), [locale]);
  useTheme(settings?.theme);

  useEffect(() => {
    if (uiLanguage) setI18nPreference(uiLanguage);
  }, [uiLanguage]);
  useEffect(() => { localizeErrorRef.current = localizeError; }, [localizeError]);
  useEffect(() => { document.title = t('Настройки — Linguisty'); }, [t]);
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
    setCacheNotice(null);
    async function load() {
      try {
        const [currentSettings, currentSecret] = await Promise.all([
          sendMessage<Settings>({ channel: CHANNEL, type: 'GET_SETTINGS' }, { signal: controller.signal }),
          sendMessage<SecretStatus>({ channel: CHANNEL, type: 'GET_SECRET_STATUS' }, { signal: controller.signal }),
        ]);
        if (disposed) return;
        // @spec spec://modules/platform/INFRA-004-codex-connection#settings
        setSettings(isCliProvider(currentSettings.providerId) ? { ...currentSettings, providerId: 'codex', baseUrl: CODEX_BASE_URL,
          model: 'default', concurrency: 1, streaming: false, requestTimeoutMs: 120_000 } : currentSettings);
        savedKeyMode.current = currentSettings.keyMode;
        setSecret(currentSecret);
        rememberTheme(currentSettings.theme);
      } catch (error) {
        if (!disposed) setNotice({ kind: 'error', message: localizeErrorRef.current(toPublicError(error)) });
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void load();
    if (typeof browser.runtime.getURL === 'function' && browser.runtime.getURL('/').startsWith('moz-extension:') && browser.management?.getSelf) {
      void waitForBrowser(() => browser.management.getSelf(), { signal: controller.signal }).then(
        (info) => { if (!disposed) setTemporaryFirefox(info.installType === 'development'); },
        () => { /* Installation metadata is optional and never delays configuration. */ },
      );
    }
    void sendMessage<CacheStats>({ channel: CHANNEL, type: 'GET_CACHE_STATS' }, { signal: controller.signal }).then(
      (statistics) => { if (!disposed) setCache(statistics); },
      (error: unknown) => { if (!disposed) setCacheNotice({ kind: 'error', message: localizeErrorRef.current(toPublicError(error)) }); },
    );
    return () => { disposed = true; mounted.current = false; controller.abort(); };
  }, [reload]);

  function update<K extends keyof Settings>(field: K, value: Settings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    setNotice(null);
    setErrors({});
    if (field === 'baseUrl' || field === 'providerId') { setModels([]); setSearch(''); }
  }

  function changeProvider(providerId: ProviderId) {
    if (!settings) return;
    const local = isKeylessProvider(providerId);
    setSettings({ ...settings, providerId,
      baseUrl: providerId === 'codex' ? CODEX_BASE_URL : local ? CLI_BASE_URL : providerId === 'openrouter' ? OPENROUTER_BASE_URL : isKeylessProvider(settings.providerId) || settings.baseUrl === OPENROUTER_BASE_URL ? '' : settings.baseUrl,
      ...(local ? { model: 'default', concurrency: 1, requestTimeoutMs: 120_000, streaming: false }
        : isKeylessProvider(settings.providerId) ? { model: '', requestTimeoutMs: 25_000, concurrency: 2, streaming: true } : {}),
    });
    setApiKey('');
    setModels([]);
    setSearch('');
    setErrors({});
    setNotice(null);
  }

  /** @spec spec://modules/interface/FEAT-003-controls#languages */
  function changeTarget(value: string) {
    if (!settings) return;
    setSettings({ ...settings, targetLanguageMode: value === '__browser__' ? 'browser' : 'manual',
      targetLanguage: value === '__browser__' ? resolveBrowserTargetLanguage() : value });
    setNotice(null); setErrors({});
  }

  async function privileged(kind: 'save' | 'test' | 'models' | 'connect') {
    if (!settings || busyRef.current) return;
    setNotice(null);
    const validation = validateForm(settings, apiKey, kind === 'test', kind !== 'save' && kind !== 'connect' && !secret?.hasKey, locale);
    setErrors(validation);
    const firstInvalid = Object.keys(validation)[0];
    if (firstInvalid) {
      setNotice({ kind: 'error', message: t('Проверьте отмеченные поля.') });
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(kind);
    const wait = { signal: lifetime.current?.signal };
    const active = () => mounted.current && !wait.signal?.aborted;
    try {
      const candidate = normalizedForm(settings);
      // Keep permissions.request within the synchronous user gesture; do not await contains/storage first.
      const permission = requestProviderPermission(candidate);
      await waitForBrowser(() => permission, { ...wait, timeoutMs: 120_000 });
      if (!active()) return;
      const suppliedKey = !keyless && apiKey.trim() ? { apiKey: apiKey.trim() } : {};
      if (kind === 'save' || kind === 'connect') {
        await sendMessage<unknown>({ channel: CHANNEL, type: 'SAVE_SETTINGS', settings: candidate, preserveKeyMode: candidate.keyMode === savedKeyMode.current, ...suppliedKey }, wait);
        if (!active()) return;
        setApiKey('');
        const [saved, keyStatus] = await Promise.all([
          sendMessage<Settings>({ channel: CHANNEL, type: 'GET_SETTINGS' }, wait),
          sendMessage<SecretStatus>({ channel: CHANNEL, type: 'GET_SECRET_STATUS' }, wait),
        ]);
        if (!active()) return;
        setSettings(saved);
        savedKeyMode.current = saved.keyMode;
        setSecret(keyStatus);
        rememberTheme(saved.theme);
        const ready = keyStatus.hasKey && !!saved.model;
        setNotice(saved.providerId === 'codex' ? { kind: 'info', message: codexText.saved } : isCliProvider(saved.providerId) ? { kind: 'info', message: cliText.saved } : { kind: ready ? 'success' : 'info', message: ready ? t('Настройки сохранены. Linguisty готов к переводу.') : !keyStatus.hasKey ? t('Настройки сохранены. Добавьте API-ключ, чтобы начать перевод.') : t('Настройки сохранены. Укажите ID модели, чтобы начать перевод.') });
        if (kind === 'connect') await sendMessage({ channel: CHANNEL, type: 'OPEN_CODEX_CONNECTION' }, wait);
      } else if (kind === 'test') {
        const result = await sendMessage<ConnectionTestResult>({ channel: CHANNEL, type: 'TEST_CONNECTION', settings: candidate, ...suppliedKey },
          { ...wait, timeoutMs: candidate.requestTimeoutMs + 5_000 });
        if (active()) setNotice({ kind: result.success ? 'success' : 'error',
          message: codex && result.success && result.message === CODEX_CONNECTION_MESSAGE ? codexText.checked : cli && result.success ? cliText.status : isMessageKey(result.message) ? t(result.message) : result.message });
      } else {
        const result = await sendMessage<ModelInfo[]>({ channel: CHANNEL, type: 'LIST_MODELS', settings: candidate, ...suppliedKey },
          { ...wait, timeoutMs: candidate.requestTimeoutMs + 5_000 });
        if (!active()) return;
        const unique = [...new Map(result.slice(0, MODEL_MAX_ENTRIES).map((model) => [model.id, model])).values()];
        setModels(unique);
        setNotice({ kind: 'info', message: unique.length ? t('Получено моделей: {count}. Выберите модель или укажите ID вручную.', { count: unique.length }) : t('Сервис не вернул моделей. Укажите ID вручную.') });
      }
    } catch (error) {
      if (active()) setNotice({ kind: 'error', message: `${localizeError(toPublicError(error))}${kind === 'models' ? ` ${t('ID модели можно указать вручную.')}` : ''}` });
    } finally {
      busyRef.current = false;
      if (active()) {
        setBusy(null);
        if (kind === 'test' || kind === 'models') setJournalRefresh(value => value + 1);
      }
    }
  }

  async function localAction(kind: 'remove' | 'clear' | 'cache') {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    if (kind === 'remove') setNotice(null);
    else setCacheNotice(null);
    const wait = { signal: lifetime.current?.signal };
    const active = () => mounted.current && !wait.signal?.aborted;
    try {
      if (kind === 'remove') {
        await sendMessage<unknown>({ channel: CHANNEL, type: 'REMOVE_API_KEY' }, wait);
        if (!active()) return;
        setApiKey('');
        const keyStatus = await sendMessage<SecretStatus>({ channel: CHANNEL, type: 'GET_SECRET_STATUS' }, wait);
        if (active()) {
          setSecret(keyStatus);
          setNotice({ kind: keyStatus.hasKey ? 'error' : 'success', message: keyStatus.hasKey ? t('Ключ по-прежнему сохранён. Попробуйте удалить его ещё раз.') : t('Сохранённый ключ удалён.') });
        }
      } else {
        if (kind === 'clear') await sendMessage<unknown>({ channel: CHANNEL, type: 'CLEAR_CACHE' }, wait);
        const statistics = await sendMessage<CacheStats>({ channel: CHANNEL, type: 'GET_CACHE_STATS' }, wait);
        if (active()) {
          setCache(statistics);
          if (kind === 'clear') setCacheNotice({ kind: 'success', message: t('Кэш очищен. Уже показанный перевод страницы сохранён.') });
        }
      }
    } catch (error) {
      if (active()) {
        const errorNotice: NoticeData = { kind: 'error', message: localizeError(toPublicError(error)) };
        if (kind === 'remove') setNotice(errorNotice);
        else setCacheNotice(errorNotice);
      }
    } finally {
      busyRef.current = false;
      if (active()) setBusy(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void privileged('save'); }
  const filtered = models.filter((model) => `${model.id} ${model.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  return <main className="options-shell">
    <header className="options-header"><Brand caption={t('Ваша модель. Ваш перевод.')} /><span className="local-badge">{t('Хранение на вашем устройстве')}</span></header>
    <div className="options-layout">
      <aside className="options-nav"><nav aria-label={t('Разделы настроек')}>
        <a href="#service-title"><span className="mono" aria-hidden="true">01</span>{t('Сервис')}</a>
        <a href="#model-title"><span className="mono" aria-hidden="true">02</span>{t('Модель')}</a>
        <a href="#translation-title"><span className="mono" aria-hidden="true">03</span>{t('Перевод')}</a>
        <a href="#interface-title"><span className="mono" aria-hidden="true">04</span>{t('Интерфейс')}</a>
        <a href="#cache-title"><span className="mono" aria-hidden="true">05</span>{t('Данные')}</a>
        <a href="#error-journal-title">{t('Журнал ошибок API')}</a>
      </nav></aside>
      <div className="options-content">
        <div className="options-intro"><p className="eyebrow">{t('Linguisty · ваши настройки')}</p><h1>{t('Ваш сервис. Ваш язык.')}</h1><p>{t('Подключите свою модель и настройте перевод так, как удобно вам.')}</p></div>
        {loading ? <p className="loading-copy" role="status">{t('Загружаем настройки…')}</p> : !settings ? <>
          <Notice notice={notice} /><button type="button" className="button-secondary" onClick={() => setReload((value) => value + 1)}>{t('Повторить загрузку')}</button>
        </> : <form noValidate onSubmit={submit} aria-busy={busy !== null}>
          <fieldset disabled={busy !== null} className="form-sections">
            <div className="form-feedback"><Notice notice={notice} /></div>
            <section className="settings-card" aria-labelledby="service-title">
              <div className="section-heading"><span className="step-number" aria-hidden="true">01</span><div><h2 id="service-title">{keyless ? t('Сервис перевода') : t('Сервис и API-ключ')}</h2><p>{keyless ? codex ? codexText.name : PROVIDER_NAMES[settings.providerId] : t('Нужен ваш ключ выбранного сервиса.')}</p></div></div>
              <div className="field"><label htmlFor="providerId">{t('Сервис перевода')}</label><select id="providerId" value={settings.providerId} onChange={(event) => changeProvider(event.target.value as ProviderId)}><option value="openrouter">OpenRouter</option><option value="openai-compatible">OpenAI-compatible</option><option value="codex">{codexText.name}</option></select></div>
              {!keyless && <>{settings.providerId === 'openai-compatible' ? <div className="field"><label htmlFor="baseUrl">{t('Базовый адрес API')}</label><input id="baseUrl" type="url" placeholder="https://api.example.com/v1" value={settings.baseUrl} onChange={(event) => update('baseUrl', event.target.value)} aria-invalid={!!errors.baseUrl} aria-describedby={errors.baseUrl ? 'baseUrl-error baseUrl-help' : 'baseUrl-help'} autoComplete="off" spellCheck={false} /><span id="baseUrl-help" className="field-help">{t('HTTPS или HTTP на localhost, 127.0.0.1, [::1]. Укажите корень API, без /chat/completions.')}</span><FieldError name="baseUrl" errors={errors} /></div> : <p className="field-help endpoint-copy">{t('Адрес API:')} <span className="mono">{OPENROUTER_BASE_URL}</span></p>}
              <div className="field"><label htmlFor="apiKey">{t('API-ключ')} {secret?.hasKey && <span className="saved-key-label">{t('· сохранён')}</span>}</label><input id="apiKey" type="password" value={apiKey} maxLength={API_KEY_INPUT_MAX_LENGTH} onChange={(event) => { setApiKey(event.target.value); setErrors({}); setNotice(null); }} placeholder={secret?.hasKey ? t('Оставьте пустым, чтобы сохранить текущий') : t('Введите свой API-ключ')} autoComplete="new-password" spellCheck={false} aria-invalid={!!errors.apiKey} aria-describedby={errors.apiKey ? 'apiKey-error apiKey-help' : 'apiKey-help'} /><span id="apiKey-help" className="field-help">{t('Пустое поле сохраняет текущий ключ. При смене сервиса укажите новый ключ. Проверка подключения не сохраняет введённый ключ.')}</span><FieldError name="apiKey" errors={errors} /></div>
              <div className="field"><label htmlFor="keyMode">{t('Хранение ключа')}</label><select id="keyMode" value={settings.keyMode} onChange={(event) => update('keyMode', event.target.value as KeyMode)}><option value="session">{t('До закрытия браузера')}</option><option value="persistent">{t('Сохранить на этом устройстве')}</option></select><span className="field-help">{t('При изменении режима существующий ключ переносится после сохранения. Постоянно установленное расширение сохраняет ключ при перезапуске и обновлении. Локальное хранилище не обеспечивает отдельного шифрования ключа.')}</span></div>
              {temporaryFirefox && <p className="notice notice-info" role="status">{t('Linguisty установлен в Firefox временно. При перезапуске браузер удаляет расширение и может удалить его данные, включая ключ. Для постоянного хранения установите подписанную версию.')}</p>}
              <div className="key-footer"><p className="small muted" role="status">{secret?.hasKey ? t('Ключ сохранён: {mode}.', { mode: secret.mode === 'session' ? t('до закрытия браузера') : t('на этом устройстве') }) : t('Сохранённого ключа нет.')}</p><button type="button" className="button-danger" disabled={!secret?.hasKey} onClick={() => void localAction('remove')}>{busy === 'remove' ? t('Удаляем…') : t('Удалить сохранённый ключ')}</button></div>
              </>}{codex && <div className="codex-connect"><p>{codexText.intro}</p><button type="button" className="button-primary" onClick={() => void privileged('connect')}>{codexText.connect}</button><p className="field-help">{codexText.keepOpen}</p></div>}{cli && <><p className="field-help">{cliText.setup}</p><div className="field"><label htmlFor="cli-extension-id">{cliText.extensionId}</label><input id="cli-extension-id" className="mono" readOnly value={browser.runtime.id} onFocus={event => event.currentTarget.select()} /></div></>}
            </section>
            <section className="settings-card" aria-labelledby="model-title">
              <div className="section-heading"><span className="step-number" aria-hidden="true">02</span><div><h2 id="model-title">{t('Модель')}</h2><p>{codex ? codexText.modelHelp : cli ? cliText.model : t('Выберите из списка или введите ID вручную.')}</p></div></div>
              <div className="field"><label htmlFor="model">{t('ID модели')}</label><input id="model" className="mono" value={settings.model} onChange={(event) => update('model', event.target.value)} placeholder={keyless ? 'default' : t('Например, openai/gpt-4.1-mini')} autoComplete="off" spellCheck={false} aria-invalid={!!errors.model} aria-describedby={errors.model ? 'model-error model-help' : 'model-help'} /><span id="model-help" className="field-help">{codex ? codexText.modelHelp : cli ? cliText.model : t('Список моделей может быть недоступен. Ручной ID работает независимо от него; стоимость определяет выбранный сервис.')}</span><FieldError name="model" errors={errors} /></div>
              <button type="button" className="button-secondary" onClick={() => void privileged('models')}>{busy === 'models' ? t('Загружаем модели…') : t('Загрузить список моделей')}</button>
              {models.length > 0 && <div className="model-discovery">
                <div className="field"><label htmlFor="model-search">{t('Поиск модели')}</label><input id="model-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Название или ID')} /></div>
                {filtered.length ? <ul className="model-list" aria-label={t('Доступные модели')}>{filtered.slice(0, 40).map((model) => <li key={model.id}><button type="button" className="model-choice" aria-pressed={settings.model === model.id} onClick={() => update('model', model.id)}><span>{cli && model.id === 'default' ? cliText.model : model.name}</span><span className="mono small">{model.id}</span></button></li>)}</ul> : <p className="small muted" role="status">{t('Моделей по этому запросу нет. Можно ввести ID вручную.')}</p>}
                {filtered.length > 40 && <p className="small muted">{t('Показано 40 из {count}. Уточните поиск.', { count: filtered.length })}</p>}
              </div>}
            </section>
            <section className="settings-card" aria-labelledby="translation-title">
              <div className="section-heading"><span className="step-number" aria-hidden="true">03</span><div><h2 id="translation-title">{t('Перевод и оформление')}</h2><p>{t('Настройки применятся при следующем запуске перевода.')}</p></div></div>
              {keyless ? <p className="field-help">{codex ? codexText.batch : cliText.batch}</p> : <><div className="field"><label className="checkbox-field"><input type="checkbox" checked={settings.streaming} onChange={event => update('streaming', event.target.checked)} aria-describedby="streaming-help" /> {t('Показывать перевод постепенно')}</label><span id="streaming-help" className="field-help">{t('Готовые фразы появляются во время ответа модели. При ошибке незавершённый перевод откатывается.')}</span></div></>}
              <div className="language-grid">
                <div className="field"><label htmlFor="sourceLanguage">{t('Исходный язык')}</label><input id="sourceLanguage" list="source-languages" value={settings.sourceLanguage} onChange={(event) => update('sourceLanguage', event.target.value)} aria-invalid={!!errors.sourceLanguage} aria-describedby={errors.sourceLanguage ? 'sourceLanguage-error source-help' : 'source-help'} autoComplete="off" spellCheck={false} /><span id="source-help" className="field-help">{t('auto — определить автоматически.')}</span><FieldError name="sourceLanguage" errors={errors} /></div>
                <div className="field"><label htmlFor="targetLanguageSelect">{t('Язык перевода')}</label><LanguageSelect id="targetLanguageSelect" value={settings.targetLanguageMode === 'browser' ? '__browser__' : settings.targetLanguage} onChange={changeTarget} browserTarget locale={locale} />
                  {settings.targetLanguageMode === 'browser' ? <span id="target-help" className="field-help">{t('Выбран автоматически: {language}', { language: languages.find(language => language.code === settings.targetLanguage)?.label ?? settings.targetLanguage })}</span> : <>
                    <label htmlFor="targetLanguage">{t('Другой код языка')}</label><input id="targetLanguage" list="target-languages" value={settings.targetLanguage} onChange={(event) => changeTarget(event.target.value)} aria-invalid={!!errors.targetLanguage} aria-describedby={errors.targetLanguage ? 'targetLanguage-error target-help' : 'target-help'} autoComplete="off" spellCheck={false} /><span id="target-help" className="field-help">{t('Код языка, например ru или en.')}</span>
                  </>}<FieldError name="targetLanguage" errors={errors} />
                </div>
              </div>
              <datalist id="source-languages"><option value="auto">{t('Определить автоматически')}</option>{languages.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}</datalist><datalist id="target-languages">{languages.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}</datalist>
              <div className="field"><label htmlFor="style">{t('Стиль перевода')}</label><select id="style" value={settings.style} onChange={(event) => update('style', event.target.value as TranslationStyle)}><option value="natural">{t('Естественный — свободное, живое чтение')}</option><option value="accurate">{t('Точный — сохранить смысл и термины')}</option><option value="literal">{t('Буквальный — ближе к структуре оригинала')}</option></select></div>
              <div className="field"><label htmlFor="customInstructions">{t('Дополнительные инструкции')}</label><textarea id="customInstructions" rows={4} maxLength={4_000} value={settings.customInstructions} onChange={(event) => update('customInstructions', event.target.value)} placeholder={t('Например: сохраняй названия продуктов и обращайся на «вы».')} aria-invalid={!!errors.customInstructions} aria-describedby={errors.customInstructions ? 'customInstructions-error instructions-help' : 'instructions-help'} /><span id="instructions-help" className="field-help">{t('{count} / 4 000 символов.', { count: settings.customInstructions.length })}</span><FieldError name="customInstructions" errors={errors} /></div>
            </section>
            <section className="settings-card" aria-labelledby="interface-title">
              <div className="section-heading"><span className="step-number" aria-hidden="true">04</span><div><h2 id="interface-title">{t('Интерфейс')}</h2><p>{t('Язык интерфейса не меняет язык перевода.')}</p></div></div>
              <div className="field"><label htmlFor="uiLanguage">{t('Язык интерфейса')}</label><select id="uiLanguage" value={settings.uiLanguage} onChange={(event) => update('uiLanguage', event.target.value)}><option value="auto">{t('Как в браузере')}</option>{UI_LOCALES.map(([code, name]) => <option key={code} value={code} lang={code}>{name}</option>)}</select></div>
              <div className="field"><label htmlFor="theme">{t('Тема оформления')}</label><select id="theme" value={settings.theme} onChange={(event) => update('theme', event.target.value as Theme)}><option value="system">{t('Как в системе')}</option><option value="light">{t('Бумага — светлая')}</option><option value="dark">{t('Графит — тёмная')}</option></select></div>
            </section>
            <div className="save-panel"><div className="save-actions"><button type="submit" className="button-primary">{busy === 'save' ? t('Сохраняем…') : t('Сохранить настройки')}</button><button type="button" className="button-secondary" onClick={() => void privileged('test')}>{busy === 'test' ? t('Проверяем…') : t('Проверить подключение')}</button></div><p className="privacy-copy">{t('Для перевода текст и ограниченный контекст страницы передаются выбранному сервису. API-ключ отправляется только этому сервису. Настройки и кэш хранятся локально; телеметрии Linguisty нет.')}</p></div>
            <section className="settings-card cache-card" aria-labelledby="cache-title">
              <div className="section-heading"><span className="step-number" aria-hidden="true">05</span><div><h2 id="cache-title">{t('Кэш переводов')}</h2><p>{t('Повторно используем переводы с тем же контекстом и настройками.')}</p></div></div>
              {cache ? <dl className="cache-stats"><div><dt>{t('Записей')}</dt><dd>{cache.entries.toLocaleString(locale)}</dd></div><div><dt>{t('Размер')}</dt><dd>{formatBytes(cache.estimatedBytes, locale)}</dd></div><div><dt>{t('Попаданий / промахов')}</dt><dd>{cache.hits.toLocaleString(locale)} / {cache.misses.toLocaleString(locale)}</dd></div></dl> : <p className="small muted">{t('Статистика кэша пока недоступна.')}</p>}
              <p className="field-help">{t('Очистка удаляет сохранённые переводы. Уже показанный перевод страницы останется.')}</p>
              <div className="cache-actions"><button type="button" className="button-secondary" onClick={() => void localAction('cache')}>{busy === 'cache' ? t('Обновляем…') : t('Обновить статистику')}</button><button type="button" className="button-danger" onClick={() => void localAction('clear')}>{busy === 'clear' ? t('Очищаем…') : t('Очистить кэш переводов')}</button></div>
              <Notice notice={cacheNotice} />
            </section>
          </fieldset>
        </form>}
        <ErrorJournal refreshKey={journalRefresh} preference={settings?.uiLanguage} />
        <footer className="options-footer"><span>{t('Linguisty · Chrome и Firefox desktop')}</span><PoweredBy /></footer>
      </div>
    </div>
  </main>;
}
