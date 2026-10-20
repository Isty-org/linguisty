/** @spec spec://modules/translation/FEAT-001-engine#errors */
import type { ApiDiagnostic } from '../shared/contracts';
import { isRecord } from '../translation/parser';

// Provider prose and IDs are free-form and may echo even a short or encoded
// fragment of the page. Only these fixed machine tokens are stored from them.
const knownApiTokens = new Set([
  'invalid_api_key', 'authentication', 'authentication_error', 'permission_denied', 'permission_error',
  'model_not_found', 'model_not_available', 'model_unavailable', 'invalid_model', 'model_not_supported', 'not_found', 'not_found_error',
  'context_length_exceeded', 'payload_too_large', 'string_too_long', 'max_tokens_exceeded',
  'rate_limit_exceeded', 'rate_limit_error', 'rate_limit',
  'timeout', 'timeout_error', 'provider_unavailable', 'provider_overloaded', 'server_error', 'server', 'overloaded_error', 'api_error',
  'invalid_request_error', 'invalid_request', 'bad_request', 'account_restricted', 'insufficient_quota',
  'unsupported_parameter', 'unsupported_value', 'not_implemented',
]);

/** @spec spec://modules/storage/INFRA-002-local-data#contracts */
export function safeApiToken(value: unknown): string | undefined {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 400 && value <= 599 ? String(value) : undefined;
  if (typeof value !== 'string' || value.length > 64) return;
  if (/^[45]\d\d$/u.test(value)) return value;
  return knownApiTokens.has(value) ? value : undefined;
}

/** @spec spec://modules/translation/FEAT-001-engine#errors
 * A model may only come from our validated config, never an API response. */
export function safeConfiguredModel(value: unknown, secret?: string): string | undefined {
  if (typeof value !== 'string' || value.length < 1 || value.length > 200 || !/^[a-z0-9][a-z0-9._:/+@-]*$/iu.test(value)) return;
  if (secret && value.toLowerCase().includes(secret.toLowerCase())) return;
  return value;
}

export interface DiagnosticContext { secrets?: readonly string[]; texts?: readonly string[] }

/** @spec spec://modules/translation/FEAT-001-engine#errors */
export function apiDiagnostic(error: unknown, status: number): ApiDiagnostic {
  const value = isRecord(error) ? error : {};
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const apiCode = safeApiToken(value.code);
  const apiType = safeApiToken(metadata.error_type ?? value.error_type ?? value.type);
  return { source: 'api', httpStatus: status,
    ...(apiCode ? { apiCode } : {}), ...(apiType ? { apiType } : {}),
  };
}
