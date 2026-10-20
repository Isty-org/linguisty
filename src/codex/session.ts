/** @spec spec://modules/platform/INFRA-004-codex-connection#auth */
import type { ModelInfo } from '../shared/contracts';
import { LinguistyError } from '../shared/errors';
import { digest } from '../providers/config';
import { throwIfCancelled, withSignal } from '../translation/abort';
import { translationResponseFormat } from '../translation/prompt';
import { exchangeAuthCode, openIdConfiguration, PLAN_SCOPE, RESOURCE, type AuthAttempt, type CodexCredentials } from './auth';
import { fetchCodexJson } from './http';
import { CodexFailure } from './failure';
import { boundedText, CODEX_API_ORIGIN, CODEX_AUTH_ORIGIN, object, type CodexReply, type CodexRequest, type CodexStatus } from './protocol';
import { readResponses } from './responses';

/** The connection page owns this object. Credentials never cross its runtime port. */
export class CodexSession {
  private credentials?: CodexCredentials;
  private accountScope?: string;
  private refresh?: Promise<void>;
  private lifetime = new AbortController();
  private generation = 0;
  private authFailure?: LinguistyError;
  private models?: { expiresAt: number; items: ModelInfo[] };
  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}
  status(): CodexStatus {
    return this.credentials ? { connected: true, accountScope: this.accountScope,
      ...(this.credentials.email ? { email: this.credentials.email } : {}) } : { connected: false };
  }
  async connect(attempt: AuthAttempt, callback: string, signal?: AbortSignal): Promise<{ clientId: string }> {
    this.clear();
    const generation = this.generation;
    const credentials = await exchangeAuthCode(attempt, callback, this.fetchImpl, signal);
    const scope = await digest(JSON.stringify([credentials.sub, credentials.clientId]));
    throwIfCancelled(signal);
    if (generation !== this.generation) throw new LinguistyError('CANCELLED');
    this.credentials = credentials; this.accountScope = scope;
    return { clientId: credentials.clientId };
  }
  clear(): void {
    this.generation++; this.lifetime.abort(); this.lifetime = new AbortController();
    this.credentials = undefined; this.accountScope = undefined; this.models = undefined; this.refresh = undefined;
    this.authFailure = undefined;
  }
  async disconnect(signal?: AbortSignal): Promise<boolean> {
    const credentials = this.credentials;
    this.clear();
    if (!credentials?.refreshToken) return false;
    try {
      const configuration = await openIdConfiguration(this.fetchImpl, signal);
      if (!configuration.revocationEndpoint) return false;
      const response = await this.fetchImpl(configuration.revocationEndpoint, { method: 'POST', redirect: 'error', signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
          client_id: credentials.clientId, token: credentials.refreshToken, token_type_hint: 'refresh_token',
        }) });
      await response.body?.cancel();
      return response.ok;
    } catch { return false; }
  }
  private async token(signal?: AbortSignal): Promise<string> {
    throwIfCancelled(signal);
    if (!this.credentials) throw new LinguistyError('CODEX_NOT_CONNECTED');
    if (this.credentials.expiresAt <= Date.now() + 60_000) {
      if (!this.refresh) {
        const generation = this.generation;
        const credentials = this.credentials;
        const lifetime = this.lifetime.signal;
        const controller = new AbortController();
        const abort = () => controller.abort();
        lifetime.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(abort, 30_000);
        const refreshing = (async () => {
          if (!credentials.refreshToken) throw new CodexFailure('refresh', 'credentials');
          const value = await fetchCodexJson('refresh', this.fetchImpl, `${CODEX_AUTH_ORIGIN}/api/accounts/oauth/token`, {
            method: 'POST', redirect: 'error', signal: controller.signal,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
              grant_type: 'refresh_token', client_id: credentials.clientId, refresh_token: credentials.refreshToken, resource: RESOURCE,
            }),
          });
          if (value.scope !== undefined && (typeof value.scope !== 'string' || !value.scope.split(/\s+/).includes(PLAN_SCOPE))) {
            throw new CodexFailure('refresh', 'scope', 'CODEX_PLAN_REQUIRED');
          }
          if (!boundedText(value.access_token, 32_768) || typeof value.token_type !== 'string' || value.token_type.toLowerCase() !== 'bearer'
            || typeof value.expires_in !== 'number' || value.expires_in <= 0 || value.expires_in > 86400
            || (value.refresh_token !== undefined && !boundedText(value.refresh_token, 32_768))) throw new CodexFailure('refresh', 'credentials');
          if (generation !== this.generation || controller.signal.aborted) throw new LinguistyError('CANCELLED');
          this.credentials = { ...credentials, accessToken: value.access_token,
            refreshToken: typeof value.refresh_token === 'string' ? value.refresh_token : credentials.refreshToken,
            expiresAt: Date.now() + value.expires_in * 1000 };
        })().catch(error => {
          const failure = error instanceof LinguistyError ? error : new LinguistyError('CODEX_AUTH_FAILED');
          if (generation === this.generation) { this.clear(); this.authFailure = failure; }
          else if (lifetime.aborted) throw new LinguistyError('CANCELLED');
          throw failure;
        }).finally(() => {
          clearTimeout(timer); lifetime.removeEventListener('abort', abort);
          if (this.refresh === refreshing) this.refresh = undefined;
        });
        this.refresh = refreshing;
      }
      await withSignal(this.refresh, signal);
    }
    throwIfCancelled(signal);
    if (!this.credentials) throw new LinguistyError('CODEX_NOT_CONNECTED');
    return this.credentials.accessToken;
  }
  /** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
  async request(request: CodexRequest, signal?: AbortSignal): Promise<CodexReply> {
    throwIfCancelled(signal);
    if (request.type === 'status') return this.status();
    if (request.type === 'translate' && request.accountScope !== this.accountScope) throw new LinguistyError('CODEX_NOT_CONNECTED');
    const generation = this.generation;
    const lifetime = this.lifetime.signal;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true }); lifetime.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, request.timeoutMs);
    try {
      const token = await this.token(controller.signal);
      const headers = { Authorization: `Bearer ${token}` };
      const models = async (): Promise<ModelInfo[]> => {
        if (this.models && this.models.expiresAt > Date.now()) return this.models.items.map(item => ({ ...item }));
        const value = await fetchCodexJson('models', this.fetchImpl, `${CODEX_API_ORIGIN}/v1/models`, { headers, signal: controller.signal, redirect: 'error' });
        if (!Array.isArray(value.models) || value.models.length > 1_000) throw new CodexFailure('models', 'response', 'INVALID_MODEL_RESPONSE');
        const items: ModelInfo[] = []; const ids = new Set<string>();
        for (const model of value.models) {
          if (!object(model) || model.visibility !== 'list') continue;
          if (!boundedText(model.slug, 200) || !boundedText(model.display_name, 300)) throw new CodexFailure('models', 'response', 'INVALID_MODEL_RESPONSE');
          if (!ids.has(model.slug)) { ids.add(model.slug); items.push({ id: model.slug, name: model.display_name }); }
        }
        if (!items.length) throw new CodexFailure('models', 'response', 'MODEL_NOT_FOUND');
        if (generation !== this.generation || controller.signal.aborted) throw new LinguistyError('CANCELLED');
        this.models = { expiresAt: Date.now() + 15 * 60_000, items };
        return items.map(item => ({ ...item }));
      };
      if (request.type === 'models') return await models();
      const model = request.model === 'default' ? (await models())[0]!.id : request.model;
      const response = await this.fetchImpl(`${CODEX_API_ORIGIN}/v1/responses`, { method: 'POST', redirect: 'error',
        signal: controller.signal, headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, store: false, stream: true,
          text: { format: { type: 'json_schema', ...translationResponseFormat().json_schema } },
          input: request.messages.map(message => ({ role: message.role === 'system' ? 'developer' : 'user', content: message.content })) }),
      });
      const content = await readResponses(response);
      if (generation !== this.generation) throw new LinguistyError('CANCELLED');
      throwIfCancelled(controller.signal);
      return { content };
    } catch (error) {
      if (signal?.aborted) throw new LinguistyError('CANCELLED');
      if (lifetime.aborted && this.authFailure && generation !== this.generation) throw this.authFailure;
      // Refresh failure clears the session and aborts its lifetime; keep the actual auth/plan error.
      if (error instanceof LinguistyError && ['CODEX_AUTH_FAILED', 'CODEX_PLAN_REQUIRED', 'CODEX_NOT_CONNECTED'].includes(error.code)) {
        if (error.code === 'CODEX_AUTH_FAILED') this.clear();
        throw error;
      }
      if (lifetime.aborted) throw new LinguistyError('CANCELLED');
      if (controller.signal.aborted) throw new LinguistyError('REQUEST_TIMEOUT');
      if (error instanceof LinguistyError) {
        throw error;
      }
      throw new LinguistyError('NETWORK_ERROR', undefined, true);
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort); lifetime.removeEventListener('abort', abort);
    }
  }
}
