/** @spec spec://modules/platform/INFRA-004-codex-connection#resources */
import { LinguistyError } from '../shared/errors';
import { CODEX_MAX_RESPONSE, object } from './protocol';
import { CodexFailure, type CodexStage } from './failure';

export function httpError(status: number): LinguistyError {
  return new LinguistyError(status === 401 ? 'CODEX_AUTH_FAILED' : status === 403 ? 'CODEX_PLAN_REQUIRED'
    : status === 429 ? 'RATE_LIMIT' : status === 404 ? 'MODEL_NOT_FOUND' : 'PROVIDER_UNAVAILABLE', undefined, status === 429 || status >= 500);
}
export async function readJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) { await response.body?.cancel().catch(() => undefined); throw httpError(response.status); }
  if (!response.body) throw new LinguistyError('INVALID_MODEL_RESPONSE');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = ''; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > CODEX_MAX_RESPONSE) throw new LinguistyError('INVALID_MODEL_RESPONSE');
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    const value: unknown = JSON.parse(text);
    if (!object(value)) throw new LinguistyError('INVALID_MODEL_RESPONSE');
    return value;
  } catch (error) {
    if (error instanceof LinguistyError) throw error;
    throw new LinguistyError('INVALID_MODEL_RESPONSE');
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

/** @spec spec://modules/platform/INFRA-004-codex-connection#auth */
export async function fetchCodexJson(stage: CodexStage, fetchImpl: typeof fetch, url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  let response: Response;
  try { response = await fetchImpl(url, init); }
  catch {
    if (init?.signal?.aborted) throw new LinguistyError('CANCELLED');
    throw new CodexFailure(stage, 'network', 'NETWORK_ERROR', undefined, true);
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    const failure = httpError(response.status);
    throw new CodexFailure(stage, 'http', failure.code, response.status, failure.retryable);
  }
  try { return await readJson(response); }
  catch {
    if (init?.signal?.aborted) throw new LinguistyError('CANCELLED');
    throw new CodexFailure(stage, 'response', 'INVALID_MODEL_RESPONSE');
  }
}
