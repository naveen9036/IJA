import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiProvider, listGeminiModels } from '@/lib/llm/gemini';

type Body = { systemInstruction?: unknown; contents: { parts: { text: string }[] }[]; generationConfig: Record<string, unknown> };

function mockFetch(...responses: [number, object][]) {
  const bodies: Body[] = [];
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    if (init.body) bodies.push(JSON.parse(init.body as string) as Body);
    const [status, json] = responses.shift() ?? [500, {}];
    return new Response(JSON.stringify(json), { status });
  });
  vi.stubGlobal('fetch', fetchMock);
  return bodies;
}

const ok = { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] };
const err = (message: string) => ({ error: { code: 400, message, status: 'INVALID_ARGUMENT' } });
const req = { system: 'SYSTEM RULES', user: 'USER TEXT', json: true };

afterEach(() => vi.unstubAllGlobals());

describe('GeminiProvider', () => {
  it('sends a system instruction and JSON mode by default', async () => {
    const bodies = mockFetch([200, ok]);
    await expect(new GeminiProvider('k', 'gemini-3.8-flash').complete(req)).resolves.toBe('{"ok":true}');
    expect(bodies[0]!.systemInstruction).toEqual({ parts: [{ text: 'SYSTEM RULES' }] });
    expect(bodies[0]!.generationConfig.responseMimeType).toBe('application/json');
  });

  it('puts the system prompt in the user message for Gemma models', async () => {
    const bodies = mockFetch([200, ok]);
    await new GeminiProvider('k', 'gemma-4-27b-it').complete(req);
    expect(bodies[0]!.systemInstruction).toBeUndefined();
    expect(bodies[0]!.contents[0]!.parts[0]!.text).toBe('SYSTEM RULES\n\nUSER TEXT');
  });

  it('retries without a system instruction or JSON mode when the model rejects them', async () => {
    const bodies = mockFetch(
      [400, err('Developer instruction is not enabled for this model')],
      [400, err('JSON mode is not enabled for this model')],
      [200, ok],
    );
    await expect(new GeminiProvider('k', 'some-model').complete(req)).resolves.toBe('{"ok":true}');
    expect(bodies).toHaveLength(3);
    expect(bodies[1]!.systemInstruction).toBeUndefined();
    expect(bodies[2]!.generationConfig.responseMimeType).toBeUndefined();
    expect(bodies[2]!.contents[0]!.parts[0]!.text).toContain('SYSTEM RULES');
  });

  it('does not retry other 400 errors', async () => {
    const bodies = mockFetch([400, err('Invalid model name')]);
    await expect(new GeminiProvider('k', 'bad').complete(req)).rejects.toThrow(/HTTP 400.*Invalid model name/);
    expect(bodies).toHaveLength(1);
  });

  it('explains when a model returns audio instead of text', async () => {
    mockFetch([200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16' } }] }, finishReason: 'STOP' }] }]);
    await expect(new GeminiProvider('k', 'gemini-3.8-flash-tts').complete(req)).rejects.toThrow(
      /"gemini-3.8-flash-tts" returns audio\/L16, not text/,
    );
  });

  it('explains an empty reply instead of showing a bare finish reason', async () => {
    mockFetch([200, { candidates: [{ content: { parts: [] }, finishReason: 'STOP' }] }]);
    await expect(new GeminiProvider('k', 'x').complete(req)).rejects.toThrow(/returned no text \(finish reason: STOP\)/);
  });
});

describe('listGeminiModels', () => {
  it('lists only text models that support generateContent', async () => {
    const models = [
      'gemini-3.8-flash',
      'gemini-3.8-flash-tts',
      'gemini-3.8-flash-lite-tts',
      'gemini-3.8-live',
      'gemini-3.1-flash-image',
      'gemini-3.5-flash-lite',
      'gemini-embedding-001',
      'gemma-4-27b-it',
    ].map((name) => ({ name: `models/${name}`, supportedGenerationMethods: ['generateContent'] }));
    mockFetch([200, { models: [...models, { name: 'models/old', supportedGenerationMethods: ['embedContent'] }] }]);
    await expect(listGeminiModels('k')).resolves.toEqual(['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemma-4-27b-it']);
  });
});
