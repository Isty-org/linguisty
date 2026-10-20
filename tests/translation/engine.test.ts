// @vitest-environment node
/** @spec spec://modules/translation/FEAT-001-engine#dedup */
import { describe, expect, it, vi } from 'vitest';
import { TranslationEngine } from '../../src/translation/engine';
import { buildCacheKey } from '../../src/cache/cacheKey';
import { completion, configFor, deferred, fakeCache, inputFor, jsonResponse, requestBody, translatedResponse } from '../providers/fixtures';

vi.mock('wxt/browser', () => ({ browser: {} }));

/** @spec spec://common/PROP-001-contracts#modules */
describe('translation cache and contextual deduplication', () => {
  /** @spec spec://modules/platform/INFRA-004-codex-connection#requests */
  it('queries a new Codex account instead of returning the former account cache, then caches the new account', async () => {
    const input = { ...inputFor(), nodes: [{ id: 'a', text: 'Hello' }] };
    const cache = fakeCache();
    const codexRequest = vi.fn(async (request: import('../../src/codex/protocol').CodexRequest) => {
      if (request.type !== 'translate') throw new Error('Unexpected non-translation request');
      return { content: JSON.stringify({ translations: [{ id: 'a', text: request.accountScope[0] === 'a' ? 'Первый аккаунт' : 'Второй аккаунт' }] }) };
    });
    const engine = new TranslationEngine(cache, { codexRequest });
    const first = { ...configFor(), providerId: 'codex' as const, accountScope: 'a'.repeat(64) };
    const second = { ...first, accountScope: 'b'.repeat(64) };
    expect((await engine.translate(input, first)).translations[0]!.text).toBe('Первый аккаунт');
    const changed = await engine.translate(input, second);
    expect(changed.translations[0]!.text).toBe('Второй аккаунт'); expect(changed.fromCache).toBe(0);
    expect((await engine.translate(input, second)).fromCache).toBe(1);
    expect(codexRequest).toHaveBeenCalledTimes(2);
    expect(engine.inFlightCount + engine.activeRequestCount + engine.pendingRequestCount).toBe(0);
  });
  it('uses cache hits without fetching and counts every original node', async () => {
    const input = inputFor();
    input.nodes = [{ id: 'a', text: 'Hello' }, { id: 'b', text: 'Hello' }];
    const cache = fakeCache();
    cache.values.set(await buildCacheKey('Hello', input, configFor()), 'Привет');
    const fetchImpl = vi.fn<typeof fetch>();
    const engine = new TranslationEngine(cache, { fetchImpl });
    expect(await engine.translate(input, configFor())).toEqual({ translations: [{ id: 'a', text: 'Привет' }, { id: 'b', text: 'Привет' }], fromCache: 2, cacheHitIds: ['a', 'b'] });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(cache.get).toHaveBeenCalledTimes(1);
    expect(engine.inFlightCount).toBe(0);
  });

  it('translates duplicate text once and remaps all original IDs without losing context', async () => {
    const input = inputFor();
    input.nodes = [{ id: 'a', text: 'Hello', group: 'header' }, { id: 'b', text: 'Hello', group: 'header' }];
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => translatedResponse(init));
    const cache = fakeCache();
    const engine = new TranslationEngine(cache, { fetchImpl });
    const result = await engine.translate(input, configFor());
    expect(result.translations).toEqual([{ id: 'a', text: 'Перевод header: Hello' }, { id: 'b', text: 'Перевод header: Hello' }]);
    expect(result.cacheHitIds).toEqual([]);
    expect(result.fromCache).toBe(result.cacheHitIds?.length);
    const data = JSON.parse(requestBody(fetchImpl.mock.calls[0]![1]).messages[1]!.content);
    expect(data.nodes).toEqual([{ id: 'a', text: 'Hello', group: 'header' }]);
    expect(data.sourceContext).toEqual([{ text: 'Hello', group: 'header' }, { text: 'Hello', group: 'header' }]);
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(engine.inFlightCount).toBe(0);
  });

  it('keeps identical phrases in different groups distinct within the same batch and cache', async () => {
    const input = { ...inputFor(), nodes: [{ id: 'a', text: 'Bank', group: 'river' }, { id: 'b', text: 'Bank', group: 'finance' }] };
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => translatedResponse(init));
    const cache = fakeCache();
    const engine = new TranslationEngine(cache, { fetchImpl });
    const first = await engine.translate(input, configFor());
    const second = await engine.translate({ ...input, nodes: input.nodes.map((node, i) => ({ ...node, id: `new-${i}` })) }, configFor());
    expect(first.translations.map(item => item.text)).toEqual(['Перевод river: Bank', 'Перевод finance: Bank']);
    expect(second.translations.map(item => item.text)).toEqual(first.translations.map(item => item.text));
    expect(second.fromCache).toBe(2);
    expect(first.cacheHitIds).toEqual([]);
    expect(second.cacheHitIds).toEqual(['new-0', 'new-1']);
    expect(cache.values.size).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retains cache keys and source context when hits are removed from the network batch', async () => {
    const input = inputFor();
    const cache = fakeCache();
    cache.values.set(await buildCacheKey(input.nodes[0]!.text, input, configFor()), 'Привет');
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => translatedResponse(init));
    const engine = new TranslationEngine(cache, { fetchImpl });
    const result = await engine.translate(input, configFor());
    expect(result.fromCache).toBe(1);
    expect(result.cacheHitIds).toEqual(['n1']);
    const data = JSON.parse(requestBody(fetchImpl.mock.calls[0]![1]).messages[1]!.content);
    expect(data.nodes).toEqual([input.nodes[1]]);
    expect(data.sourceContext).toEqual(input.nodes.map(node => ({ text: node.text })));
    expect(cache.values.has(await buildCacheKey(input.nodes[1]!.text, input, configFor()))).toBe(true);
    expect((await engine.translate(input, configFor())).fromCache).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent batches with changed transient IDs', async () => {
    const response = deferred<Response>();
    const fetchImpl = vi.fn<typeof fetch>(() => response.promise);
    const cache = fakeCache();
    const engine = new TranslationEngine(cache, { fetchImpl });
    const a = inputFor();
    const b = { ...a, nodes: a.nodes.map(node => ({ ...node, id: `${node.id}-new` })) };
    const first = engine.translate(a, configFor());
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const second = engine.translate(b, configFor());
    await vi.waitFor(() => expect(cache.get).toHaveBeenCalledTimes(4));
    await new Promise(resolve => setImmediate(resolve));
    expect(engine.inFlightCount).toBe(2);
    response.resolve(translatedResponse(fetchImpl.mock.calls[0]![1]));
    const [one, two] = await Promise.all([first, second]);
    expect(one.translations.map(item => item.text)).toEqual(two.translations.map(item => item.text));
    expect(two.translations.map(item => item.id)).toEqual(['n1-new', 'n2-new']);
    expect(two.fromCache).toBe(0);
    expect(one.cacheHitIds).toEqual([]);
    expect(two.cacheHitIds).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(engine.inFlightCount).toBe(0);
  });

  it('returns an explicit empty hit list for an empty batch without reading cache or fetching', async () => {
    const cache = fakeCache();
    const fetchImpl = vi.fn<typeof fetch>();
    const engine = new TranslationEngine(cache, { fetchImpl });
    expect(await engine.translate({ ...inputFor(), nodes: [] }, configFor())).toEqual({ translations: [], fromCache: 0, cacheHitIds: [] });
    expect(cache.get).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(engine.inFlightCount).toBe(0);
  });

  it('reports an actual cached empty translation for a whitespace-only original node', async () => {
    const input = { ...inputFor(), nodes: [{ id: 'blank', text: ' \t ' }] };
    const cache = fakeCache();
    cache.values.set(await buildCacheKey(input.nodes[0]!.text, input, configFor()), '');
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await new TranslationEngine(cache, { fetchImpl }).translate(input, configFor());
    expect(result).toEqual({ translations: [{ id: 'blank', text: '' }], fromCache: 1, cacheHitIds: ['blank'] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports every caller cache-hit ID in a mixed batch with text deduplication and remaps new caller IDs', async () => {
    const input = { ...inputFor(), nodes: [
      { id: 'cached-a', text: 'Hello' }, { id: 'network-a', text: 'New phrase' },
      { id: 'cached-b', text: 'Hello' }, { id: 'network-b', text: 'New phrase' },
    ] };
    const cache = fakeCache();
    cache.values.set(await buildCacheKey('Hello', input, configFor()), 'Привет');
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => translatedResponse(init));
    const engine = new TranslationEngine(cache, { fetchImpl });
    const mixed = await engine.translate(input, configFor());
    expect(mixed.cacheHitIds).toEqual(['cached-a', 'cached-b']);
    expect(mixed.fromCache).toBe(mixed.cacheHitIds?.length);
    expect(new Set(mixed.cacheHitIds).size).toBe(mixed.fromCache);
    expect(mixed.translations.map(item => item.id)).toEqual(['cached-a', 'network-a', 'cached-b', 'network-b']);
    const data = JSON.parse(requestBody(fetchImpl.mock.calls[0]![1]).messages[1]!.content);
    expect(data.nodes).toEqual([{ id: 'network-a', text: 'New phrase' }]);
    const newInput = { ...input, nodes: input.nodes.map(node => ({ ...node, id: `new-${node.id}` })) };
    const allCached = await engine.translate(newInput, configFor());
    expect(allCached.cacheHitIds).toEqual(newInput.nodes.map(node => node.id));
    expect(allCached.fromCache).toBe(allCached.cacheHitIds?.length);
    expect(new Set(allCached.cacheHitIds).size).toBe(4);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(engine.inFlightCount).toBe(0);
  });

  it('invalidates cache for changed neighbors, groups, page, style, languages, instructions, provider or model', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => translatedResponse(init));
    const engine = new TranslationEngine(fakeCache(), { fetchImpl });
    const input = inputFor();
    await engine.translate(input, configFor());
    const variations = [
      { ...input, nodes: [input.nodes[0]!, { ...input.nodes[1]!, text: 'Different neighboring sentence' }] },
      { ...input, nodes: input.nodes.map(node => ({ ...node, group: 'another-context' })) },
      { ...input, pageContext: { ...input.pageContext, title: 'Another page' } },
      { ...input, pageContext: { ...input.pageContext, domain: 'another.test' } },
      { ...input, pageContext: { ...input.pageContext, contentType: 'article' } },
      { ...input, style: 'literal' as const },
      { ...input, sourceLanguage: 'de' },
      { ...input, targetLanguage: 'es' },
      { ...input, customInstructions: 'Formal tone' },
    ];
    for (const variant of variations) expect((await engine.translate(variant, configFor())).fromCache).toBe(0);
    expect((await engine.translate(input, { ...configFor(), model: 'another-model' })).fromCache).toBe(0);
    expect((await engine.translate(input, configFor('openai-compatible'))).fromCache).toBe(0);
    expect((await engine.translate(input, { ...configFor('openai-compatible'), baseUrl: 'https://different-api.test/v1' })).fromCache).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(13);
    expect(engine.inFlightCount).toBe(0);
  });

  it('excludes credentials from persistent cache and reuses a valid cached result with a changed key', async () => {
    const cache = fakeCache();
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => translatedResponse(init));
    const engine = new TranslationEngine(cache, { fetchImpl });
    await engine.translate(inputFor(), configFor());
    expect((await engine.translate(inputFor(), { ...configFor(), apiKey: 'another-synthetic-key' })).fromCache).toBe(2);
    expect(JSON.stringify(Array.from(cache.values))).not.toMatch(/synthetic-test-key|another-synthetic-key/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not share an in-flight request across API credentials', async () => {
    const responses = [deferred<Response>(), deferred<Response>()];
    let requestIndex = 0;
    const fetchImpl = vi.fn<typeof fetch>(() => responses[requestIndex++]!.promise);
    const engine = new TranslationEngine(fakeCache(), { fetchImpl });
    const one = engine.translate(inputFor(), configFor());
    const two = engine.translate(inputFor(), { ...configFor(), apiKey: 'another-synthetic-key' });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    responses.forEach((response, i) => response.resolve(translatedResponse(fetchImpl.mock.calls[i]![1])));
    await Promise.all([one, two]);
    expect(engine.inFlightCount).toBe(0);
  });

  it('continues translating if cache reads/writes fail', async () => {
    const cache = fakeCache();
    cache.get.mockRejectedValue(new Error('IDB unavailable'));
    cache.set.mockRejectedValue(new Error('quota exceeded'));
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => translatedResponse(init));
    const engine = new TranslationEngine(cache, { fetchImpl });
    expect((await engine.translate(inputFor(), configFor())).translations).toHaveLength(2);
    expect(engine.inFlightCount).toBe(0);
  });

  it('does not cache any part of a failed provider batch and allows a fresh request', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => jsonResponse({}, 401))
      .mockImplementation(async (_url, init) => translatedResponse(init));
    const cache = fakeCache();
    const engine = new TranslationEngine(cache, { fetchImpl });
    await expect(engine.translate(inputFor(), configFor())).rejects.toMatchObject({ code: 'INVALID_API_KEY' });
    expect(cache.set).not.toHaveBeenCalled();
    expect(engine.inFlightCount).toBe(0);
    expect((await engine.translate(inputFor(), configFor())).translations).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects a partial/missing-ID response atomically and never caches its valid first item', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => completion('{"translations":[{"id":"n1","text":"Привет"}]}'));
    const cache = fakeCache();
    const engine = new TranslationEngine(cache, { fetchImpl });
    await expect(engine.translate(inputFor(), configFor())).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(cache.set).not.toHaveBeenCalled();
    expect(engine.inFlightCount).toBe(0);
  });
});

/** @spec spec://common/PROP-002-quality#resources */
describe('engine cancellation and lifecycle limits', () => {
  it('keeps a shared request alive for another consumer after cancellation', async () => {
    const response = deferred<Response>();
    const fetchImpl = vi.fn<typeof fetch>(() => response.promise);
    const cache = fakeCache();
    const engine = new TranslationEngine(cache, { fetchImpl });
    const a = new AbortController();
    const b = new AbortController();
    const one = engine.translate(inputFor(), configFor(), a.signal).catch(error => error);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const two = engine.translate(inputFor(), configFor(), b.signal);
    // Wait for both lookups/subscriptions, not merely the already existing flight count.
    await vi.waitFor(() => expect(cache.get).toHaveBeenCalledTimes(4));
    await new Promise(resolve => setImmediate(resolve));
    a.abort();
    expect(await one).toMatchObject({ code: 'CANCELLED' });
    expect(fetchImpl.mock.calls[0]![1]?.signal?.aborted).toBe(false);
    response.resolve(translatedResponse(fetchImpl.mock.calls[0]![1]));
    expect((await two).translations).toHaveLength(2);
    expect(engine.inFlightCount).toBe(0);
  });

  it('aborts the request and clears entries when its last consumer cancels; a later retry works', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockImplementation(async (_url, init) => translatedResponse(init));
    const cache = fakeCache();
    const engine = new TranslationEngine(cache, { fetchImpl });
    const controller = new AbortController();
    const first = engine.translate(inputFor(), configFor(), controller.signal).catch(error => error);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    controller.abort();
    expect(await first).toMatchObject({ code: 'CANCELLED' });
    expect(fetchImpl.mock.calls[0]![1]?.signal?.aborted).toBe(true);
    expect(engine.inFlightCount).toBe(0);
    expect(cache.set).not.toHaveBeenCalled();
    expect((await engine.translate(inputFor(), configFor())).translations).toHaveLength(2);
    await vi.waitFor(() => expect(engine.activeRequestCount).toBe(0));
  });

  it('cancels promptly during cache lookup without creating a request', async () => {
    const cache = fakeCache();
    cache.get.mockImplementation(() => new Promise(() => undefined));
    const fetchImpl = vi.fn<typeof fetch>();
    const engine = new TranslationEngine(cache, { fetchImpl });
    const controller = new AbortController();
    const promise = engine.translate(inputFor(), configFor(), controller.signal).catch(error => error);
    await vi.waitFor(() => expect(cache.get).toHaveBeenCalledTimes(2));
    controller.abort();
    expect(await promise).toMatchObject({ code: 'CANCELLED' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(engine.inFlightCount).toBe(0);
  });

  it('cancels promptly if a cache write remains pending', async () => {
    const cache = fakeCache();
    cache.set.mockImplementation(() => new Promise(() => undefined));
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => translatedResponse(init));
    const engine = new TranslationEngine(cache, { fetchImpl });
    const controller = new AbortController();
    const promise = engine.translate(inputFor(), configFor(), controller.signal).catch(error => error);
    await vi.waitFor(() => expect(cache.set).toHaveBeenCalledTimes(2));
    controller.abort();
    expect(await promise).toMatchObject({ code: 'CANCELLED' });
    expect(engine.inFlightCount).toBe(0);
  });

  it('bounds active requests at four and queued requests at 32, then releases all cancellations', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise(() => undefined));
    const engine = new TranslationEngine(fakeCache(), { fetchImpl });
    const controllers = Array.from({ length: 37 }, () => new AbortController());
    const errors: unknown[] = [];
    const promises = controllers.map((controller, i) => engine.translate({ ...inputFor(), pageContext: { ...inputFor().pageContext, title: `Page ${i}` } }, configFor(), controller.signal).catch(error => { errors.push(error); return error; }));
    await vi.waitFor(() => expect(errors).toHaveLength(1));
    expect(errors[0]).toMatchObject({ code: 'RATE_LIMIT' });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(engine.activeRequestCount).toBe(4);
    expect(engine.pendingRequestCount).toBe(32);
    controllers.forEach(controller => controller.abort());
    await Promise.all(promises);
    await vi.waitFor(() => expect(engine.activeRequestCount).toBe(0));
    expect(engine.inFlightCount).toBe(0);
    expect(engine.pendingRequestCount).toBe(0);
  });

  it('repeated success/cancel cycles leave no registry growth or queued requests', async () => {
    let requestIndex = 0;
    const fetchImpl = vi.fn<typeof fetch>((_url, init) => requestIndex++ % 2 === 0
      ? Promise.resolve(translatedResponse(init)) : new Promise(() => undefined));
    const cache = fakeCache();
    const engine = new TranslationEngine(cache, { fetchImpl });
    for (let i = 0; i < 30; i++) {
      cache.values.clear();
      await engine.translate(inputFor(), configFor());
      const cancelled = new AbortController();
      const cancelling = engine.translate({ ...inputFor(), pageContext: { ...inputFor().pageContext, title: `Cancelled page ${i}` } }, configFor(), cancelled.signal).catch(error => error);
      await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2 * i + 2), { interval: 1 });
      cancelled.abort();
      expect(await cancelling).toMatchObject({ code: 'CANCELLED' });
      expect(engine.inFlightCount).toBe(0);
      expect(engine.pendingRequestCount).toBe(0);
      await vi.waitFor(() => expect(engine.activeRequestCount).toBe(0), { interval: 1 });
    }
    await vi.waitFor(() => expect(engine.activeRequestCount).toBe(0));
    expect(cache.values.size).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(60);
  });

  it('routes connection testing and discovery through the same engine API', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => init?.method === 'GET' ? jsonResponse({ data: [{ id: 'a' }] }) : translatedResponse(init));
    const engine = new TranslationEngine(fakeCache(), { fetchImpl });
    expect((await engine.testConnection(configFor())).success).toBe(true);
    expect(await engine.listModels({ ...configFor(), model: '' })).toEqual([{ id: 'a', name: 'a' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(engine.inFlightCount).toBe(0);
  });

  it('rejects connection/discovery cancellation as promises without fetching', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const engine = new TranslationEngine(fakeCache(), { fetchImpl });
    const controller = new AbortController();
    controller.abort();
    await expect(engine.testConnection(configFor(), controller.signal)).rejects.toMatchObject({ code: 'CANCELLED' });
    await expect(engine.listModels(configFor(), controller.signal)).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(engine.pendingRequestCount).toBe(0);
    expect(engine.activeRequestCount).toBe(0);
  });
});
