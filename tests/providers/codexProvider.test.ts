// @vitest-environment node
/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
import { expect, it, vi } from 'vitest';
import { getProvider } from '../../src/providers/registry';
import { credentialScope, normalizeProviderConfig } from '../../src/providers/config';
import { configFor, inputFor } from './fixtures';
import type { CodexRequester } from '../../src/codex/protocol';
vi.mock('wxt/browser', () => ({ browser: { runtime: {} } }));
it('strictly validates translations and strips unrelated credentials/endpoints from the port boundary', async () => {
  const config = { ...configFor(), providerId: 'codex' as const, accountScope: 'a'.repeat(64), model: 'default', apiKey: 'unused-unit-key' };
  const request = vi.fn<CodexRequester>(async () => ({ content: '{"translations":[{"id":"n1","text":"А"},{"id":"n2","text":"Б"}]}' }));
  const provider = getProvider('codex', { codexRequest: request });
  expect((await provider.translate(inputFor(), config)).translations).toHaveLength(2);
  expect(JSON.stringify(request.mock.calls)).not.toContain(config.apiKey); expect(JSON.stringify(request.mock.calls)).not.toContain(config.baseUrl);
  expect(normalizeProviderConfig(config, 'codex')).toMatchObject({ apiKey: '', streaming: false });
  request.mockResolvedValueOnce({ content: '{"translations":[{"id":"wrong","text":"Oops"}]}' });
  await expect(provider.translate(inputFor(), config)).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE', retryable: true,
    message: 'Модель вернула некорректный ответ. [LGT-translation-json]' });
  expect(await credentialScope(config)).not.toBe(await credentialScope({ ...config, accountScope: 'b'.repeat(64) }));
});
it('checks model discovery without a paid translation and does not claim an inference check', async () => {
  const request = vi.fn<CodexRequester>(async () => [{ id: 'unit-model', name: 'Unit model' }]);
  const provider = getProvider('codex', { codexRequest: request });
  expect(await provider.testConnection({ ...configFor(), providerId: 'codex', apiKey: '' })).toMatchObject({ success: true, message: expect.stringContaining('Ответ модели не проверялся') });
  expect(request.mock.calls.every(([value]) => value.type === 'models')).toBe(true);
});
