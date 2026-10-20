/** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
import { LinguistyError } from '../shared/errors';

const references = ['LGT-response-body', 'LGT-response-json', 'LGT-response-completion', 'LGT-response-content',
  'LGT-response-refusal', 'LGT-response-limit', 'LGT-translation-json', 'LGT-response-output',
  'LGT-response-message', 'LGT-response-phase', 'LGT-response-status', 'LGT-response-part',
  'LGT-response-empty', 'LGT-response-commentary', 'LGT-response-conflict'] as const;
type Reference = typeof references[number];

/** Fixed labels only: this boundary never carries provider messages or response text. */
export function translationErrorReference(value: unknown): Reference | undefined {
  return typeof value === 'string' && references.some(reference => reference === value) ? value as Reference : undefined;
}

export function translationError(reference: Reference, retryable = false): LinguistyError {
  const error = new LinguistyError('INVALID_MODEL_RESPONSE', undefined, retryable);
  error.message += ` [${reference}]`;
  return error;
}

export function translationErrorMessageReference(message: string): Reference | undefined {
  return translationErrorReference(/\[(LGT-[a-z-]+)\]$/.exec(message)?.[1]);
}
