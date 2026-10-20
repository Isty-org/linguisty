import type { ApiErrorInput, ApiOperation, ErrorCode, ProviderConfig } from '../shared/contracts';
import { MAX_RESPONSE_BYTES } from '../shared/constants';
import { LinguistyError } from '../shared/errors';
import { delay, throwIfCancelled, withSignal } from '../translation/abort';
import { isRecord } from '../translation/parser';
import { apiDiagnostic, safeConfiguredModel } from './diagnostics';

const MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 5_000;

class ProviderFailure extends LinguistyError {
  streamUnsupported = false;
  constructor(code: ErrorCode, retryable = false, readonly retryAfterMs?: number) {
    super(code, undefined, retryable);
  }
}

function retryAfter(headers: Headers): number | undefined {
  const value = headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(value) - Date.now();
  return Number.isFinite(ms) ? Math.min(MAX_RETRY_DELAY_MS, Math.max(0, ms)) : undefined;
}

function httpError(status: number, retryAfterMs?: number): ProviderFailure {
  if (status === 401 || status === 403) return new ProviderFailure('INVALID_API_KEY');
  if (status === 404) return new ProviderFailure('MODEL_NOT_FOUND');
  if (status === 408) return new ProviderFailure('REQUEST_TIMEOUT');
  if (status === 413) return new ProviderFailure('CONTEXT_TOO_LARGE');
  if (status === 429) return new ProviderFailure('RATE_LIMIT', true, retryAfterMs);
  if (status >= 500) return new ProviderFailure('PROVIDER_UNAVAILABLE', true, retryAfterMs);
  return new ProviderFailure('INVALID_SETTINGS');
}

/** @spec spec://modules/translation/FEAT-001-engine#errors */
export function envelopeError(error: unknown, status = 200, retryAfterMs?: number): LinguistyError {
  if (!isRecord(error)) return new ProviderFailure(status === 200 ? 'INVALID_MODEL_RESPONSE' : 'INVALID_SETTINGS');
  const metadata = isRecord(error.metadata) ? error.metadata : {};
  const codes = [error.code, error.type, error.error_type, metadata.error_type].filter((code): code is string => typeof code === 'string');
  if (codes.some(code => ['invalid_api_key', 'authentication', 'authentication_error', 'permission_denied', 'permission_error'].includes(code))) return new ProviderFailure('INVALID_API_KEY');
  if (error.param === 'model' || codes.some(code => ['model_not_found', 'model_not_available', 'model_unavailable', 'invalid_model', 'model_not_supported', 'not_found', 'not_found_error'].includes(code))) return new ProviderFailure('MODEL_NOT_FOUND');
  if (codes.some(code => ['context_length_exceeded', 'payload_too_large', 'string_too_long', 'max_tokens_exceeded'].includes(code))) return new ProviderFailure('CONTEXT_TOO_LARGE');
  if (codes.some(code => ['rate_limit_exceeded', 'rate_limit_error', 'rate_limit'].includes(code))) return new ProviderFailure('RATE_LIMIT', true, retryAfterMs);
  if (codes.some(code => ['timeout', 'timeout_error'].includes(code))) return new ProviderFailure('REQUEST_TIMEOUT');
  if (codes.some(code => ['provider_unavailable', 'provider_overloaded', 'server_error', 'server', 'overloaded_error', 'api_error'].includes(code))) return new ProviderFailure('PROVIDER_UNAVAILABLE', true, retryAfterMs);
  const numericCode = typeof error.code === 'number' ? error.code : typeof error.code === 'string' && /^\d{3}$/.test(error.code) ? Number(error.code) : undefined;
  if (numericCode !== undefined && numericCode >= 400 && numericCode <= 599) return httpError(numericCode, retryAfterMs);
  return new ProviderFailure(status === 200 ? 'INVALID_MODEL_RESPONSE' : 'INVALID_SETTINGS');
}

function cancelBody(response: Response): void {
  if (response.body && !response.body.locked) void response.body.cancel().catch(() => undefined);
}

/** @spec spec://common/PROP-002-quality#resources */
export async function readBounded(response: Response, signal: AbortSignal, onChunk?: (chunk: string) => boolean): Promise<string> {
  const declaredSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_RESPONSE_BYTES) {
    cancelBody(response);
    throw new LinguistyError('INVALID_MODEL_RESPONSE');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', abort, { once: true });
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const parts: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      throwIfCancelled(signal);
      const { value, done } = await withSignal(reader.read(), signal);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new LinguistyError('INVALID_MODEL_RESPONSE');
      }
      let chunk: string;
      try { chunk = decoder.decode(value, { stream: true }); }
      catch { throw new LinguistyError('INVALID_MODEL_RESPONSE', undefined, true); }
      if (onChunk) {
        if (!onChunk(chunk)) { void reader.cancel().catch(() => undefined); return ''; }
      } else parts.push(chunk);
    }
    let tail: string;
    try { tail = decoder.decode(); }
    catch { throw new LinguistyError('INVALID_MODEL_RESPONSE', undefined, true); }
    if (onChunk) onChunk(tail);
    else parts.push(tail);
    return parts.join('');
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
    // A timed-out/custom stream may still have a pending read until cancel settles.
    try { reader.releaseLock(); } catch { /* The stream has already been cancelled. */ }
  }
}

interface RequestOptions<T> {
  path: string; method: 'GET' | 'POST'; body?: unknown;
  operation?: ApiOperation;
  sensitiveTexts?: readonly string[];
  onError?: (entry: ApiErrorInput) => Promise<void> | void;
  parseStream?: (response: Response, signal: AbortSignal) => Promise<T>;
  onReset?: () => void;
}

async function attempt<T>(config: ProviderConfig, fetchImpl: typeof fetch, options: RequestOptions<T>, parse: (data: unknown) => T, signal?: AbortSignal): Promise<T> {
  throwIfCancelled(signal);
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeoutMs);
  let responseStatus: number | undefined;
  let returnedError: unknown;
  try {
    const pending = fetchImpl(`${config.baseUrl}${options.path}`, {
      method: options.method,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal,
    });
    // Also close a late response from an injected fetch implementation that ignores abort.
    void pending.then(response => { if (controller.signal.aborted) cancelBody(response); }, () => undefined);
    const response = await withSignal(pending, controller.signal);
    responseStatus = response.status;
    const retryAfterMs = retryAfter(response.headers);
    if (response.ok && options.parseStream && response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() === 'text/event-stream') {
      return await options.parseStream(response, controller.signal);
    }
    let body: string;
    try { body = await readBounded(response, controller.signal); }
    catch (error) { if (!response.ok && !controller.signal.aborted) throw httpError(response.status, retryAfterMs); throw error; }
    throwIfCancelled(controller.signal);
    let data: unknown;
    try { data = JSON.parse(body); }
    catch { if (!response.ok) throw httpError(response.status, retryAfterMs); throw new ProviderFailure('INVALID_MODEL_RESPONSE', true); }
    if (isRecord(data)) {
      const first = Array.isArray(data.choices) ? data.choices[0] as unknown : undefined;
      returnedError = data.error ?? (isRecord(first) ? first.error : undefined);
    }
    if (isRecord(data) && data.error !== undefined && data.error !== null) {
      // HTTP status remains authoritative when its body has no mapped API code.
      const mapped = envelopeError(data.error, response.status, retryAfterMs);
      const failure = !response.ok && mapped.code === 'INVALID_SETTINGS' ? httpError(response.status, retryAfterMs) : mapped;
      if (failure instanceof ProviderFailure && [400, 422, 501].includes(response.status) && isRecord(data.error)
        && data.error.param === 'stream' && ['unsupported_parameter', 'unsupported_value', 'not_implemented'].includes(String(data.error.code))) failure.streamUnsupported = true;
      throw failure;
    }
    if (!response.ok) throw httpError(response.status, retryAfterMs);
    return parse(data);
  } catch (error) {
    if (signal?.aborted) throw new LinguistyError('CANCELLED');
    let failure: LinguistyError;
    if (timedOut) failure = new LinguistyError('REQUEST_TIMEOUT');
    else if (error instanceof LinguistyError) failure = error;
    // Do not copy fetch errors: some implementations include URL/header/response details.
    else failure = new LinguistyError('NETWORK_ERROR', undefined, true);
    if (failure.code !== 'CANCELLED') {
      failure.diagnostic ??= responseStatus !== undefined && (returnedError !== undefined || responseStatus >= 400)
        ? apiDiagnostic(returnedError, responseStatus)
        : { source: timedOut ? 'timeout' : responseStatus !== undefined ? 'invalid-response' : 'network',
          ...(responseStatus !== undefined ? { httpStatus: responseStatus } : {}) };
    }
    throw failure;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

/** @spec spec://modules/translation/FEAT-001-engine#errors */
export async function performRequest<T>(config: ProviderConfig, fetchImpl: typeof fetch, options: RequestOptions<T>, parse: (data: unknown) => T, signal?: AbortSignal): Promise<T> {
  let retries = 0;
  let malformedRetries = 0;
  let currentOptions = options;
  let fallback = false;
  while (true) {
    throwIfCancelled(signal);
    try { return await attempt(config, fetchImpl, currentOptions, parse, signal); }
    catch (error) {
      options.onReset?.();
      if (error instanceof ProviderFailure && error.streamUnsupported && !fallback && retries < MAX_RETRIES
        && options.parseStream && isRecord(options.body) && options.body.stream === true) {
        fallback = true; retries++;
        currentOptions = { ...options, body: { ...options.body, stream: false }, parseStream: undefined };
        continue;
      }
      const terminal = !(error instanceof LinguistyError) || !error.retryable || retries >= MAX_RETRIES
        || (error.code === 'INVALID_MODEL_RESPONSE' && malformedRetries++ >= 1);
      if (terminal) {
        if (error instanceof LinguistyError && error.code !== 'CANCELLED' && options.onError) {
          const entry: ApiErrorInput = { ...error.diagnostic ?? { source: 'invalid-response' as const },
            operation: options.operation ?? 'translate', providerId: config.providerId,
            model: safeConfiguredModel(config.model, config.apiKey) ?? '', errorCode: error.code, attempts: retries + 1 };
          try { await options.onError(entry); } catch { /* Journal failure never replaces the API failure. */ }
        }
        throw error;
      }
      const retryAfterMs = error instanceof ProviderFailure ? error.retryAfterMs : undefined;
      const waitMs = Math.max(Math.min(MAX_RETRY_DELAY_MS, 500 * 2 ** retries), retryAfterMs ?? 0);
      retries++;
      await delay(waitMs, signal);
    }
  }
}
