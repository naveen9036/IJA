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
        max_tokens: 8192,
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
  const data = (await res.json()) as { data?: { id: string; owned_by?: string }[] };

  // Exclude non-chat models (audio, vision-only, guard/safety classifiers, embeddings)
  const SKIP = /whisper|prompt-guard|safeguard|embed|tts|rerank|moderat/i;
  const ids = (data.data ?? []).map((m) => m.id).filter((id) => !SKIP.test(id));

  // Sort known chat model families to the top
  const CHAT_FIRST = /llama|mixtral|gemma|qwen|deepseek|mistral|phi|falcon|command|gpt-oss/i;
  ids.sort((a, b) => {
    const aChat = CHAT_FIRST.test(a) ? 0 : 1;
    const bChat = CHAT_FIRST.test(b) ? 0 : 1;
    if (aChat !== bChat) return aChat - bChat;
    return a.localeCompare(b);
  });
  return ids;
}

function compatHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Title': 'IJA',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}
