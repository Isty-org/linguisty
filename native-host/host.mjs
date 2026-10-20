/** @spec spec://modules/platform/INFRA-003-local-cli#resources */
import { validateRequest } from './protocol.mjs';
import { resolveCli, runCli } from './cli.mjs';
const codes = new Set(['CLI_NOT_FOUND', 'CLI_LOGIN_REQUIRED', 'CLI_EXECUTION_FAILED', 'REQUEST_TIMEOUT',
  'CANCELLED', 'RATE_LIMIT', 'CONTEXT_TOO_LARGE', 'INVALID_MODEL_RESPONSE']);
export function createHost(send, config = {}, dependencies = {}) {
  const queue = [];
  const pending = new Map();
  let active = false;
  let closed = false;
  const runner = dependencies.run ?? runCli;
  const resolver = dependencies.resolve ?? resolveCli;
  function finish(job, data, code) {
    if (job.finished) return;
    job.finished = true;
    clearTimeout(job.timer);
    pending.delete(job.request.id);
    const queued = queue.indexOf(job);
    if (queued >= 0) queue.splice(queued, 1);
    if (!closed) send({ version: 1, id: job.request.id, ...(code ? { ok: false, code } : { ok: true, data }) });
  }
  function pump() {
    if (active || closed) return;
    const job = queue.shift();
    if (!job) return;
    if (job.finished) { pump(); return; }
    active = true;
    void runner(job.request, config, job.controller.signal).then(
      content => finish(job, { content }),
      error => finish(job, undefined, codes.has(error.message) ? error.message : 'CLI_EXECUTION_FAILED'),
    ).finally(() => { active = false; pump(); });
  }
  return {
    receive(raw) {
      if (closed) return;
      let request;
      try { request = validateRequest(raw); }
      catch {
        if (typeof raw?.id === 'string' && /^[\w-]{1,80}$/.test(raw.id)) send({ version: 1, id: raw.id, ok: false, code: 'INVALID_MODEL_RESPONSE' });
        return;
      }
      if (request.type === 'cancel') {
        const job = pending.get(request.id);
        if (job) { job.controller.abort(); finish(job, undefined, 'CANCELLED'); }
        return;
      }
      if (pending.has(request.id)) return;
      if (pending.size >= 16) { send({ version: 1, id: request.id, ok: false, code: 'RATE_LIMIT' }); return; }
      const job = { request, controller: new AbortController(), finished: false };
      pending.set(request.id, job);
      job.timer = setTimeout(() => { job.controller.abort(); finish(job, undefined, 'REQUEST_TIMEOUT'); }, request.timeoutMs);
      if (request.type === 'status') {
        void resolver(request.providerId, config).then(() => finish(job, { available: true }),
          () => finish(job, undefined, 'CLI_NOT_FOUND'));
      } else { queue.push(job); pump(); }
    },
    resources: () => ({ pending: pending.size, queued: queue.filter(job => !job.finished).length, active: Number(active) }),
    close() {
      closed = true;
      for (const job of pending.values()) { job.controller.abort(); clearTimeout(job.timer); }
      pending.clear(); queue.length = 0;
    },
  };
}
