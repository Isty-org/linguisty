import type { RuntimeMessage, Settings, TranslationResult } from '../../src/shared/contracts';
import { DEFAULT_SETTINGS } from '../../src/shared/constants';

export type BatchMessage = Extract<RuntimeMessage, { type: 'TRANSLATE_BATCH' }>;
export type BeginMessage = Extract<RuntimeMessage, { type: 'BEGIN_PAGE_SESSION' }>;
export interface PendingBatch {
  message: BatchMessage;
  resolve(result?: TranslationResult): void;
  reject(error: unknown): void;
}

export function pageSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, model: 'test-model', ...overrides };
}

export function makeTransport() {
  const messages: RuntimeMessage[] = [];
  const batches: PendingBatch[] = [];
  let beginHandler = async (_message: BeginMessage) => ({ sessionId: 'route-session', settings: pageSettings() });
  const sendMessage = <T>(message: RuntimeMessage): Promise<T> => {
    messages.push(message);
    if (message.type === 'TRANSLATE_BATCH') {
      return new Promise<TranslationResult>((resolve, reject) => {
        batches.push({
          message, reject,
          resolve(result = { translations: message.nodes.map(node => ({ id: node.id, text: `Перевод ${node.text}` })), fromCache: 0 }) { resolve(result); },
        });
      }) as Promise<T>;
    }
    if (message.type === 'BEGIN_PAGE_SESSION') return beginHandler(message) as Promise<T>;
    return Promise.resolve(undefined as T);
  };
  return { messages, batches, sendMessage, onBegin(handler: typeof beginHandler) { beginHandler = handler; } };
}

export function measureText(node: Text): readonly DOMRectReadOnly[] {
  if (node.parentElement?.closest('[data-no-layout]')) return [];
  const top = Number(node.parentElement?.closest('[data-top]')?.getAttribute('data-top') ?? 0);
  return [new DOMRect(0, top, 100, 20)];
}

export async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}
