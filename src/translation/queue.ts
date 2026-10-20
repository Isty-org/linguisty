import { LinguistyError } from '../shared/errors';
import { throwIfCancelled } from './abort';

interface QueuedRequest { start(): void; abort(): void }

/** @spec spec://common/PROP-002-quality#resources */
export class RequestQueue {
  private active = 0;
  private readonly waiting: QueuedRequest[] = [];

  // Background/page scheduling selects the configured concurrency (default 2).
  // This hard ceiling also bounds direct calls to the engine.
  constructor(private readonly concurrency = 4, private readonly maxWaiting = 32) {}

  get activeCount(): number { return this.active; }
  get pendingCount(): number { return this.waiting.length; }

  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    throwIfCancelled(signal);
    if (this.active >= this.concurrency && this.waiting.length >= this.maxWaiting) {
      return Promise.reject(new LinguistyError('RATE_LIMIT'));
    }
    return new Promise<T>((resolve, reject) => {
      const cleanup = () => signal?.removeEventListener('abort', item.abort);
      const item: QueuedRequest = {
        start: () => {
          cleanup();
          if (signal?.aborted) { reject(new LinguistyError('CANCELLED')); return; }
          this.active++;
          void Promise.resolve().then(task).then(resolve, reject).finally(() => {
            this.active--;
            this.pump();
          });
        },
        abort: () => {
          const index = this.waiting.indexOf(item);
          if (index >= 0) this.waiting.splice(index, 1);
          cleanup();
          reject(new LinguistyError('CANCELLED'));
        },
      };
      if (this.active < this.concurrency) item.start();
      else {
        this.waiting.push(item);
        signal?.addEventListener('abort', item.abort, { once: true });
      }
    });
  }

  private pump(): void {
    while (this.active < this.concurrency && this.waiting.length) this.waiting.shift()!.start();
  }
}
