import { errorFromResponse, LlmError, withTimeout, type ChatRequest, type LlmProvider } from './provider';

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType?: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

interface RequestMode {
  /** Put the system prompt in the user message; Gemma models reject `systemInstruction`. */
  inlineSystem: boolean;
  jsonMode: boolean;
}

const NO_SYSTEM_INSTRUCTION = /developer instruction|system instruction/i;
const NO_JSON_MODE = /json mode|response_?mime_?type/i;

export class GeminiProvider implements LlmProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    readonly name = 'Gemini',
  ) {}

  async complete(req: ChatRequest, signal?: AbortSignal): Promise<string> {
    const mode: RequestMode = { inlineSystem: /^gemma/i.test(this.model), jsonMode: !!req.json };
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.send(req, mode, signal);
      } catch (e) {
        if (!(e instanceof LlmError) || e.status !== 400 || attempt >= 2) throw e;
        if (!mode.inlineSystem && NO_SYSTEM_INSTRUCTION.test(e.message)) mode.inlineSystem = true;
        else if (mode.jsonMode && NO_JSON_MODE.test(e.message)) mode.jsonMode = false;
        else throw e;
      }
    }
  }

  private async send(req: ChatRequest, mode: RequestMode, signal?: AbortSignal): Promise<string> {
    const userText = mode.inlineSystem ? `${req.system}\n\n${req.user}` : req.user;
    const res = await fetch(`${GEMINI_BASE_URL}/models/${encodeURIComponent(this.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        ...(mode.inlineSystem ? {} : { systemInstruction: { parts: [{ text: req.system }] } }),
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: {
          temperature: req.temperature ?? 0.2,
          ...(mode.jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      }),
      signal: withTimeout(signal),
    });
    if (!res.ok) throw await errorFromResponse(this.name, res);

    const data = (await res.json()) as GeminiResponse;
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const text = parts
      .filter((p) => !p.thought && p.text)
      .map((p) => p.text)
      .join('');
    if (!text) {
      const media = parts.find((p) => p.inlineData)?.inlineData?.mimeType;
      if (media) {
        throw new LlmError(
          `${this.name}: "${this.model}" returns ${media}, not text. Choose a text model such as gemini-3.8-flash.`,
          this.name,
        );
      }
      const reason = data.promptFeedback?.blockReason ?? candidate?.finishReason ?? 'no candidates';
      throw new LlmError(
        `${this.name}: "${this.model}" returned no text (finish reason: ${reason}). Try a text model such as gemini-3.8-flash.`,
        this.name,
      );
    }
    return text;
  }
}

/** Models that only produce audio, images, video, or embeddings can't answer text prompts. */
const NON_TEXT_MODEL = /tts|image|banana|live|audio|transcribe|embedding|veo|imagen|lyria|robotics|aqa|omni|deep-research|antigravity/i;

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
    .filter((name) => !NON_TEXT_MODEL.test(name))
    .sort();
}
