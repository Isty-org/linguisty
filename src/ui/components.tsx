/** @spec spec://modules/interface/FEAT-003-controls#design */
import type { FormErrors } from './settingsForm';
import { getLanguageOptions } from '../shared/languages';
import { useI18n } from './i18n';

export { LANGUAGES } from '../shared/languages';

export function Brand({ compact = false, caption }: { compact?: boolean; caption?: string }) {
  const { t } = useI18n();
  return <div className="brand" data-compact={compact}>
    <span className="linguisty-mark" aria-hidden="true" />
    <div><span className="brand-name" dir="ltr">Linguisty</span><span className="brand-caption">{caption ?? t('Ваша модель. Ваш перевод.')}</span></div>
  </div>;
}

/** @spec spec://modules/interface/FEAT-003-controls#design */
export function PoweredBy() {
  const { t } = useI18n();
  const [before, after] = t('Разработано {brand}').split('{brand}');
  return <div className="powered-by">
    {before?.trim() && <span>{before.trim()}</span>}
    <span className="brand-mark powered-by-logo" role="img" aria-label="Isty" />
    {after?.trim() && <span>{after.trim()}</span>}
  </div>;
}

export interface NoticeData { kind: 'error' | 'success' | 'info'; message: string }

export function Notice({ notice }: { notice: NoticeData | null }) {
  if (!notice) return null;
  return <p className={`notice notice-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.message}</p>;
}

export function FieldError({ name, errors }: { name: keyof FormErrors; errors: FormErrors }) {
  return errors[name] ? <span className="field-error" id={`${name}-error`}>{errors[name]}</span> : null;
}

/** @spec spec://modules/interface/FEAT-003-controls#languages */
export function LanguageSelect({ id, value, onChange, source = false, disabled = false, locale, browserTarget = false }: {
  id: string; value: string; onChange: (value: string) => void; source?: boolean; disabled?: boolean; locale?: string; browserTarget?: boolean;
}) {
  const i18n = useI18n();
  const options = getLanguageOptions(locale ?? i18n.locale);
  const known = (source && value === 'auto') || (browserTarget && value === '__browser__') || options.some(({ code }) => code === value);
  return <select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
    {source && <option value="auto">{i18n.t('Определить автоматически')}</option>}
    {browserTarget && <option value="__browser__">{i18n.t('Как в браузере')}</option>}
    {!known && <option value={value}>{value}</option>}
    {options.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
  </select>;
}

export function formatBytes(bytes: number, locale = 'ru'): string {
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: bytes < 1_024 ? 0 : 1 });
  const units = locale.startsWith('ru') ? ['Б', 'КБ', 'МБ'] : ['B', 'KB', 'MB'];
  const unit = bytes < 1_024 ? 0 : bytes < 1_024 * 1_024 ? 1 : 2;
  return `${formatter.format(bytes / 1_024 ** unit)} ${units[unit]}`;
}
