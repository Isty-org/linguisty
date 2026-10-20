/** @spec spec://modules/page/FEAT-002-page-translation#render */
import type { DisplayMode } from '../shared/contracts';
import { syncExternalText, type NodeEntry, type NodeRegistry } from './registry';
import { isEditableText } from './scanner';
import type { PageTypography } from './typography';
import { applyInlineSpacing } from './spacing';

export interface NodeSnapshot {
  entry: NodeEntry;
  revision: number;
  original: string;
}

export function preserveWhitespace(original: string, translated: string): string {
  const leading = /^\s*/u.exec(original)?.[0] ?? '';
  const trailing = /\s*$/u.exec(original)?.[0] ?? '';
  const cjkSource = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(original);
  const alphabeticOutput = /[\p{Script=Latin}\p{Script=Cyrillic}]/u.test(translated);
  return (leading || (cjkSource && alphabeticOutput && /^\s/u.test(translated) ? ' ' : ''))
    + translated.trim() + (trailing || (cjkSource && alphabeticOutput && /\s$/u.test(translated) ? ' ' : ''));
}

export function writeDisplay(entry: NodeEntry, mode: DisplayMode, typography?: PageTypography, registry?: NodeRegistry): boolean {
  if (!entry.node.isConnected || syncExternalText(entry) || isEditableText(entry.node)) {
    typography?.restore(entry);
    return false;
  }
  const value = mode === 'translated' ? entry.preview ?? entry.translation ?? entry.original : entry.original;
  if (entry.node.data !== value) entry.node.data = value;
  entry.expected = value;
  if (registry) applyInlineSpacing(entry, mode === 'translated', registry);
  if (mode === 'translated' && (entry.preview ?? entry.translation)) typography?.apply(entry, value);
  else typography?.restore(entry);
  return true;
}

/** @spec spec://modules/page/FEAT-002-page-translation#render */
export function acceptTranslation(snapshot: NodeSnapshot, batchId: string, text: string, mode: DisplayMode, typography?: PageTypography, registry?: NodeRegistry): boolean {
  const { entry } = snapshot;
  if (!entry.node.isConnected || entry.batchId !== batchId || entry.revision !== snapshot.revision
    || entry.original !== snapshot.original || syncExternalText(entry)) return false;
  typography?.restore(entry);
  entry.preview = undefined;
  entry.translation = preserveWhitespace(entry.original, text);
  entry.phase = 'translated';
  entry.batchId = undefined;
  return writeDisplay(entry, mode, typography, registry);
}

/** @spec spec://modules/page/FEAT-002-page-translation#sessions */
export function rollbackPreview(entry: NodeEntry, typography?: PageTypography, registry?: NodeRegistry): void {
  if (entry.preview === undefined) return;
  syncExternalText(entry);
  typography?.restore(entry);
  entry.preview = undefined;
  // writeDisplay preserves a page's intervening text and form edits.
  writeDisplay(entry, 'original', typography, registry);
}

export function previewTranslation(snapshot: NodeSnapshot, batchId: string, text: string, typography?: PageTypography, registry?: NodeRegistry): boolean {
  const { entry } = snapshot;
  if (!entry.node.isConnected || entry.batchId !== batchId || entry.revision !== snapshot.revision
    || entry.original !== snapshot.original || syncExternalText(entry) || isEditableText(entry.node)) return false;
  const value = preserveWhitespace(entry.original, text);
  if (entry.preview === value) return true;
  typography?.restore(entry);
  entry.preview = value;
  return writeDisplay(entry, 'translated', typography, registry);
}
