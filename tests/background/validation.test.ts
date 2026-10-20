/** @spec spec://common/PROP-001-contracts#messages */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, createIdleState } from '../../src/shared/constants';
import { LinguistyError } from '../../src/shared/errors';
import { isTranslatableUrl, safeError, validateMessage, validateSettings, validateState } from '../../src/background/validation';

describe('runtime payload boundary', () => {
  it('projects settings onto the public schema and drops secret/extra fields', () => {
    const settings = validateSettings({ ...DEFAULT_SETTINGS, apiKey: 'hidden', nested: { key: 'hidden' } });
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(JSON.stringify(settings)).not.toContain('hidden');
  });

  /** @spec spec://modules/storage/INFRA-002-local-data#settings */
  it('enforces the same 200-character model boundary as settings and provider', () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, model: 'm'.repeat(200) }).model).toHaveLength(200);
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, model: 'm'.repeat(201) })).toThrow(LinguistyError);
  });

  /** @spec spec://modules/storage/INFRA-002-local-data#secrets */
  it('accepts a 4096-character key boundary, rejects 4097 and rejects control characters', () => {
    const message = { channel: 'linguisty', type: 'SAVE_SETTINGS', settings: DEFAULT_SETTINGS };
    expect(validateMessage({ ...message, apiKey: 'k'.repeat(4_096) })).toHaveProperty('apiKey');
    expect(() => validateMessage({ ...message, apiKey: 'k'.repeat(4_097) })).toThrow(LinguistyError);
    for (const apiKey of ['key\tvalue', 'key\nvalue', 'key\rvalue', 'key\0value', `key${String.fromCharCode(127)}value`]) {
      expect(() => validateMessage({ ...message, apiKey })).toThrow(LinguistyError);
    }
  });

  it.each([
    null, [], { channel: 'linguisty', type: 'UNKNOWN' },
    { channel: 'linguisty', type: 'START_TRANSLATION', tabId: -1 },
    { channel: 'linguisty', type: 'START_TRANSLATION', tabId: '1' },
    { channel: 'linguisty', type: 'GET_SECRET_STATUS', apiKey: 'bad' },
    { channel: 'linguisty', type: 'SAVE_SETTINGS', settings: { ...DEFAULT_SETTINGS, concurrency: 5 } },
    { channel: 'linguisty', type: 'SAVE_SETTINGS', settings: DEFAULT_SETTINGS, apiKey: 'line\nkey' },
    { channel: 'linguisty', type: 'SET_DISPLAY_MODE', mode: 'anything' },
    { channel: 'linguisty', type: 'CONTENT_COMMAND', payload: { command: 'get-state' } },
    { channel: 'linguisty', type: 'TAB_STATE_CHANGED', state: createIdleState() },
  ])('rejects malformed or outbound-only payload %j', (message) => {
    expect(() => validateMessage(message)).toThrow(LinguistyError);
  });

  it('rejects duplicate node IDs, oversized text and forged tab/context fields', () => {
    const message = {
      channel: 'linguisty', type: 'TRANSLATE_BATCH', sessionId: 'session', batchId: 'batch',
      nodes: [{ id: 'n1', text: 'Hello' }], pageContext: { title: 'Title', domain: 'example.org' },
    };
    expect(validateMessage(message)).toEqual(message);
    for (const patch of [
      { nodes: [{ id: 'n1', text: 'a' }, { id: 'n1', text: 'b' }] },
      { nodes: [{ id: 'n1', text: 'a'.repeat(10_001) }] },
      { nodes: Array.from({ length: 41 }, (_, index) => ({ id: String(index), text: 'a' })) },
      { tabId: 99 },
      { pageContext: { title: 'x', domain: 'example.org/path?query' } },
      { pageContext: { title: 'x'.repeat(301), domain: 'example.org' } },
    ]) expect(() => validateMessage({ ...message, ...patch })).toThrow(LinguistyError);
  });

  it('checks progress counters, session identity and sanitizes raw error messages', () => {
    const state = { ...createIdleState(1), sessionId: 'session', discovered: 2, translated: 1 };
    expect(() => validateState({ ...state, tabId: 2 }, 1)).toThrow();
    expect(() => validateState({ ...state, failed: 2 }, 1)).toThrow();
    expect(() => validateState({ ...state, fromCache: 2 }, 1)).toThrow();
    expect(() => validateState({ ...state, inFlight: Number.NaN }, 1)).toThrow();
    expect(() => validateMessage({ channel: 'linguisty', type: 'PAGE_PROGRESS', sessionId: 'different', state })).toThrow();
    const output = validateState({ ...state, error: { code: 'NETWORK_ERROR', message: 'secret provider body', retryable: true }, apiKey: 'secret' }, 1);
    expect(JSON.stringify(output)).not.toContain('secret');
    expect(safeError(new LinguistyError('INVALID_API_KEY', 'secret key details'))).toMatchObject({ code: 'INVALID_API_KEY' });
    expect(safeError(new Error('secret body')).message).not.toContain('secret');
  });

  /** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
  it.each(['LGT-response-completion', 'LGT-response-empty', 'LGT-response-phase', 'LGT-response-conflict'])('preserves only allowlisted subscription references through batch replies and progress snapshots: %s', reference => {
    const message = `private-provider-body [${reference}]`;
    const expected = `Модель вернула некорректный ответ. [${reference}]`;
    expect(safeError(new LinguistyError('INVALID_MODEL_RESPONSE', message)).message).toBe(expected);
    const state = { ...createIdleState(1), sessionId: 'session', status: 'error', discovered: 1, failed: 1,
      error: { code: 'INVALID_MODEL_RESPONSE', message, retryable: false } };
    expect(validateState(state, 1).error?.message).toBe(expected);
    expect(JSON.stringify(validateState(state, 1))).not.toContain('private');
    expect(safeError(new LinguistyError('INVALID_MODEL_RESPONSE', 'private [LGT-private-token]')).message).toBe('Модель вернула некорректный ответ.');
    expect(safeError(new LinguistyError('NETWORK_ERROR', message)).message).not.toContain('LGT');
  });

  /** @spec spec://modules/platform/INFRA-001-extension#permissions */
  it.each(['chrome://settings', 'about:config', 'moz-extension://id/options.html', 'file:///a', 'data:text/plain,a',
    'https://chromewebstore.google.com/item', 'https://example.org/page.pdf'])('rejects protected URL %s', (url) => {
    expect(isTranslatableUrl(url)).toBe(false);
  });

  it('applies Firefox restricted domains only to Firefox', () => {
    expect(isTranslatableUrl('https://addons.mozilla.org/addon/test', true)).toBe(false);
    expect(isTranslatableUrl('https://addons.mozilla.org/addon/test')).toBe(true);
    expect(isTranslatableUrl('https://chromewebstore.google.com/item', true)).toBe(true);
  });
});
