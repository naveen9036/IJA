import { errorFromResponse, LlmError, withTimeout, type ChatRequest, type LlmProvider } from './provider';

/** Works with any OpenAI-compatible endpoint: Groq, OpenRouter, Ollama. */
export class OpenAICompatProvider implements LlmProvider {
  constructor(
    readonly name: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async complete(req: ChatRequest, signal?: AbortSignal): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: compatHeaders(this.apiKey),
      body: JSON.stringify({
        model: this.model,
        temperature: req.temperature ?? 0.2,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        ...(req.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: withTimeout(signal),
    });
    if (!res.ok) throw await errorFromResponse(this.name, res);

    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new LlmError(`${this.name}: empty response`, this.name);
    return text;
  }
}

export async function listCompatModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/models`, { headers: compatHeaders(apiKey), signal: withTimeout() });
  if (!res.ok) throw await errorFromResponse(baseUrl, res);
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((m) => m.id).sort();
}

function compatHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Title': 'IJA',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}
