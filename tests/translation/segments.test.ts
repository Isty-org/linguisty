// @vitest-environment node
/** @spec spec://modules/translation/FEAT-001-engine#dedup */
import { describe, expect, it } from 'vitest';
import { batchTimeoutMs, joinTranslatedParts, splitText, textCost } from '../../src/translation/segments';

describe('bounded lossless text segmentation', () => {
  it('gives CJK an expansion budget and preserves every source character and Unicode code point', () => {
    const source = '人工智能学习。\n😀𠮷人工智能使用 Python。 '.repeat(180);
    const parts = splitText(source, 3_000, 3_000);
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.join('')).toBe(source);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(3_000);
      expect(textCost(part)).toBeLessThanOrEqual(3_000);
      expect(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/u.test(part)).toBe(false);
      expect(part.trim()).not.toBe('');
    }
  });

  it('preserves word/sentence separators and adds Russian spacing across CJK parts', () => {
    expect(joinTranslatedParts(['人工', '智能'], ['Искусственный', 'интеллект'])).toBe('Искусственный интеллект');
    expect(joinTranslatedParts(['𠮷', '中文'], ['Редкий', 'иероглиф'])).toBe('Редкий иероглиф');
    expect(joinTranslatedParts(['第一。', '第二。'], ['Первое.', 'Второе.'])).toBe('Первое. Второе.');
    expect(joinTranslatedParts(['Hello\n', 'world'], ['Привет', 'мир'])).toBe('Привет\nмир');
    expect(joinTranslatedParts(['micro', 'scope'], ['микро', 'скоп'])).toBe('микроскоп');
    expect(joinTranslatedParts(['中文OpenRo', 'uter中文'], ['Текст OpenRo', 'uter текст'])).toBe('Текст OpenRouter текст');
    expect(joinTranslatedParts(['人工', '智能'], ['人工', '智能'])).toBe('人工智能');
  });

  it('bounds part counts, rejects an impossible Unicode budget, and bounds whole-job time', () => {
    expect(() => splitText('x'.repeat(129), 1)).toThrow(RangeError);
    expect(() => splitText('😀', 1)).toThrow(RangeError);
    expect(batchTimeoutMs(25_000)).toBeLessThanOrEqual(300_000);
    expect(batchTimeoutMs(1_000)).toBeGreaterThan(3_000);
  });
});
