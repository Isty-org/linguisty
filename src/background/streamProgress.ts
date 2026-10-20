/** @spec spec://common/PROP-002-quality#resources */
import type { TranslationProgress } from '../shared/contracts';

/** One cumulative snapshot, one send, at most ten sends/second per batch. */
export class StreamProgress {
  private latest?: TranslationProgress;
  private timer?: ReturnType<typeof setTimeout>;
  private sending = false;
  private sequence = 0;
  private lastSent = 0;
  private disposed = false;
  private readonly controller = new AbortController();
  private readonly onAbort = () => this.dispose();
  constructor(private readonly signal: AbortSignal, private readonly send: (progress: TranslationProgress, sequence: number, controller: AbortController) => Promise<unknown>) {
    signal.addEventListener('abort', this.onAbort, { once: true });
    if (signal.aborted) this.dispose();
  }
  push(progress: TranslationProgress): void {
    if (this.disposed) return;
    this.latest = progress;
    this.schedule();
  }
  private schedule(): void {
    if (this.disposed || this.sending || this.timer !== undefined || !this.latest) return;
    this.timer = setTimeout(() => { this.timer = undefined; this.flush(); }, Math.max(100, 100 - (Date.now() - this.lastSent)));
  }
  private flush(): void {
    if (this.disposed || !this.latest) return;
    const progress = this.latest;
    this.latest = undefined; this.sending = true; this.lastSent = Date.now();
    const sequence = ++this.sequence;
    void Promise.resolve().then(() => this.disposed ? undefined : this.send(progress, sequence, this.controller)).catch(() => this.dispose()).finally(() => {
      this.sending = false;
      this.schedule();
    });
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.timer); this.timer = undefined; this.latest = undefined;
    this.signal.removeEventListener('abort', this.onAbort);
    this.controller.abort();
  }
}
