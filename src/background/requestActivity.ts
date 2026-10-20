/** @spec spec://modules/platform/INFRA-001-extension#runtime */
export const REQUEST_ACTIVITY_INTERVAL_MS = 20_000;

/**
 * Shares one activity timer across deadline-bounded requests. getPlatformInfo is
 * a parent-process API in Firefox and resets its event-page idle timer; Chrome
 * documents the same API for extending a worker during a finite operation.
 * No results, request payloads, storage writes, ports or new permissions.
 * @spec spec://common/PROP-002-quality#resources
 */
export class RequestActivity {
  private timer?: ReturnType<typeof setTimeout>;
  private pending = false;
  private disposed = false;
  private readonly releases = new Set<() => void>();

  constructor(private readonly touch: () => Promise<unknown>) {}

  // The caller must supply the abortable deadline promise, never the raw fetch.
  track<T>(bounded: Promise<T>, signal: AbortSignal): Promise<T> {
    if (this.disposed || signal.aborted) return bounded;
    const release = () => {
      signal.removeEventListener('abort', release);
      this.releases.delete(release);
      if (!this.releases.size) {
        clearTimeout(this.timer);
        this.timer = undefined;
      }
    };
    this.releases.add(release);
    signal.addEventListener('abort', release, { once: true });
    this.schedule();
    return bounded.finally(release);
  }

  private schedule(): void {
    if (this.disposed || !this.releases.size || this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.pending) {
        this.pending = true;
        const settled = () => { this.pending = false; };
        try { void this.touch().then(settled, settled); }
        catch { settled(); }
      }
      this.schedule();
    }, REQUEST_ACTIVITY_INTERVAL_MS);
  }

  dispose(): void {
    this.disposed = true;
    for (const release of this.releases) release();
  }
}
