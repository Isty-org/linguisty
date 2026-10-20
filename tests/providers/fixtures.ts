import { vi } from 'vitest';
import type { ProviderConfig, ProviderId, TranslationCache, TranslationInput } from '../../src/shared/contracts';
import { OPENROUTER_BASE_URL } from '../../src/shared/constants';

export function configFor(providerId: ProviderId = 'openrouter'): ProviderConfig {
  return { providerId, baseUrl: providerId === 'openrouter' ? OPENROUTER_BASE_URL : 'http://localhost:8877/v1', model: 'test/model', apiKey: 'synthetic-test-key', timeoutMs: 25_000 };
}

export function inputFor(): TranslationInput {
  return {
    nodes: [{ id: 'n1', text: 'Hello' }, { id: 'n2', text: 'Price: $12 / 3 kg' }],
    pageContext: { title: 'Product page', domain: 'example.test', contentType: 'product' },
    sourceLanguage: 'en', targetLanguage: 'ru', style: 'natural', customInstructions: '',
  };
}

export function jsonResponse(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), { status, headers });
}

export function completion(content: string): Response {
  return jsonResponse({ choices: [{ message: { content }, finish_reason: 'stop' }] });
}

export function requestBody(init?: RequestInit) {
  return JSON.parse(String(init?.body)) as { model: string; stream: boolean; response_format?: unknown; provider?: unknown; messages: { role: string; content: string }[] };
}

export function translatedResponse(init?: RequestInit): Response {
  const body = requestBody(init);
  const data = JSON.parse(body.messages[1]!.content) as { nodes: { id: string; text: string; group?: string }[] };
  return completion(JSON.stringify({ translations: data.nodes.map(node => ({ id: node.id, text: `Перевод ${node.group ?? ''}: ${node.text}` })) }));
}

export function fakeCache() {
  const values = new Map<string, string>();
  return {
    values,
    get: vi.fn(async (key: string) => values.get(key)),
    set: vi.fn(async (key: string, text: string) => { values.set(key, text); }),
    clear: vi.fn(async () => { values.clear(); }),
    stats: vi.fn(async () => ({ entries: values.size, estimatedBytes: 0, hits: 0, misses: 0 })),
    prune: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
  } satisfies TranslationCache & { values: Map<string, string> };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
