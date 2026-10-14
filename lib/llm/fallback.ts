import type { z } from 'zod';
import { extractJson } from './json';
import { LlmError, type ChatRequest, type LlmProvider } from './provider';

export interface ChainResult<T> {
  value: T;
  provider: string;
}

export class FallbackChain {
  constructor(readonly providers: LlmProvider[]) {
    if (providers.length === 0) throw new Error('No LLM provider configured. Add a free API key in Settings.');
  }

  /** Tries each provider in order; any failure moves on to the next one. */
  async complete(req: ChatRequest, signal?: AbortSignal): Promise<ChainResult<string>> {
    const errors: string[] = [];
    for (const p of this.providers) {
      try {
        return { value: await p.complete(req, signal), provider: p.name };
      } catch (e) {
        if (signal?.aborted) throw e;
        errors.push(e instanceof LlmError ? e.message : `${p.name}: ${(e as Error).message}`);
      }
    }
    throw new Error(`All providers failed:\n${errors.join('\n')}`);
  }

  /** Requests JSON, validates it, and retries once with the validation error if it is invalid. */
  async completeJson<S extends z.ZodType>(
    req: ChatRequest,
    schema: S,
    signal?: AbortSignal,
  ): Promise<ChainResult<z.output<S>>> {
    let request: ChatRequest = { ...req, json: true };
    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const { value: text, provider } = await this.complete(request, signal);
      try {
        const parsed = schema.safeParse(extractJson(text));
        if (parsed.success) return { value: parsed.data, provider };
        lastError = parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
      } catch (e) {
        lastError = (e as Error).message;
      }
      request = {
        ...request,
        user: `${req.user}\n\nYour previous reply was invalid (${lastError}). Reply with only valid JSON matching the requested shape.`,
      };
    }
    throw new Error(`Model returned invalid JSON: ${lastError}`);
  }
}
