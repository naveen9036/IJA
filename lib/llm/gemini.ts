import { errorFromResponse, LlmError, withTimeout, type ChatRequest, type LlmProvider } from './provider';

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export class GeminiProvider implements LlmProvider {
  readonly name = 'Gemini';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async complete(req: ChatRequest, signal?: AbortSignal): Promise<string> {
    const res = await fetch(`${GEMINI_BASE_URL}/models/${encodeURIComponent(this.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.user }] }],
        generationConfig: {
          temperature: req.temperature ?? 0.2,
          ...(req.json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
      signal: withTimeout(signal),
    });
    if (!res.ok) throw await errorFromResponse(this.name, res);

    const data = (await res.json()) as GeminiResponse;
    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => !p.thought && p.text)
      .map((p) => p.text)
      .join('');
    if (!text) {
      const reason = data.promptFeedback?.blockReason ?? candidate?.finishReason ?? 'empty response';
      throw new LlmError(`${this.name}: ${reason}`, this.name);
    }
    return text;
  }
}

export async function listGeminiModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${GEMINI_BASE_URL}/models?pageSize=1000`, {
    headers: { 'x-goog-api-key': apiKey },
    signal: withTimeout(),
  });
  if (!res.ok) throw await errorFromResponse('Gemini', res);
  const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .sort();
}
