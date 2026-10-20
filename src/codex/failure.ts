/** @spec spec://modules/platform/INFRA-004-codex-connection#auth */
import type { ErrorCode } from '../shared/contracts';
import { LinguistyError } from '../shared/errors';

const stages = ['callback', 'token', 'discovery', 'identity', 'jwks', 'refresh', 'models'] as const;
const reasons = ['format', 'state', 'provider', 'client', 'code', 'issuer', 'endpoint', 'algorithm', 'nonce',
  'audience', 'expiry', 'issued_at', 'not_before', 'subject', 'key', 'signature', 'scope', 'credentials', 'http', 'network', 'response'] as const;
export type CodexStage = typeof stages[number];
type CodexReason = typeof reasons[number];

/** Only fixed labels and an HTTP status, never provider text, claims or credentials. */
export class CodexFailure extends LinguistyError {
  constructor(readonly stage: CodexStage, readonly reason: CodexReason, code: ErrorCode = 'CODEX_AUTH_FAILED',
    readonly status?: number, retryable = false) { super(code, undefined, retryable); }
}

/** Shown only by the owning connection page; not added to the shared error/port contract. */
export function codexErrorReference(error: unknown): string | undefined {
  if (!(error instanceof CodexFailure) || !stages.includes(error.stage) || !reasons.includes(error.reason)) return;
  const status = Number.isInteger(error.status) && error.status! >= 100 && error.status! <= 599 ? `-${error.status}` : '';
  return `LGT-${error.stage}-${error.reason}${status}`;
}
