// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/shared/constants';
import { LinguistyError } from '../../src/shared/errors';
import { normalizeBaseUrl, normalizeSettings } from '../../src/storage/normalization';

/** @spec spec://modules/storage/INFRA-002-local-data#settings */
describe('settings normalization', () => {
  it('migrates the transport choice without changing the persistent key mode and accepts an explicit regular mode', () => {
    const legacy = { ...DEFAULT_SETTINGS, keyMode: 'persistent', streaming: undefined };
    expect(normalizeSettings(legacy)).toMatchObject({ keyMode: 'persistent', streaming: true });
    expect(normalizeSettings({ ...legacy, streaming: false })).toMatchObject({ keyMode: 'persistent', streaming: false });
    expect(() => normalizeSettings({ streaming: 'true' })).toThrow();
  });
  it('returns independent static English/browser defaults and projects only public fields', () => {
    const result = normalizeSettings({ apiKey: 'private-test-value', secrets: { apiKey: 'nested-value' } });
    expect(result).toEqual(DEFAULT_SETTINGS);
    expect(result).not.toHaveProperty('apiKey');
    expect(result).not.toHaveProperty('secrets');
    result.targetLanguage = 'ru';
    expect(normalizeSettings(undefined).targetLanguage).toBe('en');
    expect(DEFAULT_SETTINGS.targetLanguage).toBe('en');
    expect(result.targetLanguageMode).toBe('browser');
    expect(result.uiLanguage).toBe('auto');
  });

  it('migrates a legacy explicit target to manual without changing source/model/key mode', () => {
    const result = normalizeSettings({ sourceLanguage: 'fr-ca', targetLanguage: 'tlh', model: 'saved/model', keyMode: 'persistent' });
    expect(result).toMatchObject({
      sourceLanguage: 'fr-CA', targetLanguage: 'tlh', targetLanguageMode: 'manual',
      model: 'saved/model', keyMode: 'persistent', uiLanguage: 'auto',
    });
    expect(normalizeSettings({ targetLanguage: 'fr-CA', targetLanguageMode: 'browser' })).toMatchObject({
      targetLanguage: 'fr-CA', targetLanguageMode: 'browser',
    });
  });

  it('validates independent UI choices without reading runtime language preferences', () => {
    expect(normalizeSettings({ uiLanguage: 'zh-tw' })).toMatchObject({ uiLanguage: 'zh-TW', targetLanguage: 'en' });
    expect(normalizeSettings({ uiLanguage: 'ar', targetLanguageMode: 'manual', targetLanguage: 'fil' })).toMatchObject({
      uiLanguage: 'ar', targetLanguageMode: 'manual', targetLanguage: 'fil',
    });
  });

  it('normalizes endpoints, model IDs and BCP 47 tags while preserving instruction whitespace', () => {
    const result = normalizeSettings({
      baseUrl: ' https://EXAMPLE.com:443/v1/// ', model: ' model/id ',
      sourceLanguage: 'auto', targetLanguage: 'zh-cn', customInstructions: '  Keep terms.\n\tPreserve tone.  ',
    });
    expect(result.baseUrl).toBe('https://example.com/v1');
    expect(result.model).toBe('model/id');
    expect(result.targetLanguage).toBe('zh-CN');
    expect(result.customInstructions).toBe('  Keep terms.\n\tPreserve tone.  ');
    expect(normalizeSettings({ sourceLanguage: 'pt-br' }).sourceLanguage).toBe('pt-BR');
  });

  it.each([
    { schemaVersion: 2 }, { providerId: 'unknown' }, { style: 'invented' }, { theme: 'blue' },
    { keyMode: 'sync' }, { targetLanguageMode: 'auto' }, { uiLanguage: 'unsupported' },
    { uiLanguage: 'en-US' }, { uiLanguage: 1 }, { concurrency: 5 }, { concurrency: 1.5 }, { maxNodesPerBatch: 41 },
    { maxCharsPerBatch: 10_001 }, { requestTimeoutMs: 999 }, { requestTimeoutMs: 120_001 },
    { model: 'x'.repeat(201) }, { customInstructions: 'x'.repeat(4_001) },
    { customInstructions: '\0' }, { targetLanguage: 'auto' }, { targetLanguage: 'AUTO' }, { sourceLanguage: 'en_Us' },
    { targetLanguage: 'ru\u0001en' }, { model: 1 },
  ])('rejects invalid settings %j with a safe typed error', (invalid) => {
    expect(() => normalizeSettings(invalid)).toThrowError(LinguistyError);
    expect(() => normalizeSettings(invalid)).toThrowError();
  });

  it('accepts all exact contract limits', () => {
    expect(normalizeSettings({
      concurrency: 4, maxNodesPerBatch: 40, maxCharsPerBatch: 10_000,
      requestTimeoutMs: 120_000, model: 'x'.repeat(200), customInstructions: 'x'.repeat(4_000),
    }).concurrency).toBe(4);
  });

  it.each([
    'http://localhost:8080/v1/', 'http://127.0.0.1:8090/v1/', 'http://[::1]:8090/v1/',
  ])('permits explicit local HTTP gateway %s', (endpoint) => {
    expect(normalizeBaseUrl(endpoint)).toBe(endpoint.slice(0, -1));
  });

  it.each([
    'http://example.com/v1', 'http://localhost.evil.test/v1', 'http://192.168.1.1/v1',
    'ftp://example.com/v1', 'https://@example.com/v1', 'https://user:private-test-value@example.com/v1',
    'https://example.com/v1?token=private-test-value', 'https://example.com/v1?',
    'https://example.com/v1#private-test-value', 'https://example.com/v1#', 'relative/v1',
    'https:example.com/v1', 'https:////@example.com/v1', 'https:\\@example.com/v1',
    'https:/@example.com/v1', 'https:@example.com/v1',
  ])('rejects remote HTTP, credentials, query, fragment and malformed endpoint %s', (endpoint) => {
    try {
      normalizeBaseUrl(endpoint);
      expect.fail('Expected endpoint rejection');
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_SETTINGS', retryable: false });
      expect(String(error)).not.toContain('private-test-value');
    }
  });
});
