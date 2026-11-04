import type { z } from 'zod';
import { extractJson } from './json';
import { LlmError, type ChatRequest, type LlmProvider } from './provider';

export interface ChainResult<T> {
  value: T;
  provider: string;
}

export interface ChainOptions {
  /** Waits before retrying a provider that is temporarily unavailable (HTTP 5xx or network error). */
  retryDelaysMs: number[];
}

const TRANSIENT_STATUS = new Set([500, 502, 503, 504]);

function isTransient(e: unknown): boolean {
  if (e instanceof LlmError) return e.status !== undefined && TRANSIENT_STATUS.has(e.status);
  return e instanceof TypeError;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });
}

function describe(name: string, e: unknown, attempts: number): string {
  const tries = attempts > 1 ? ` (tried ${attempts} times)` : '';
  if (e instanceof LlmError && e.status !== undefined) {
    if (TRANSIENT_STATUS.has(e.status)) return `${name} is busy or unavailable right now${tries}.`;
    if (e.status === 429) return `${name} reached its free-tier limit.`;
    if (e.status === 401 || e.status === 403) return `${name} rejected the API key.`;
  }
  if (e instanceof TypeError) return `${name} could not be reached; check your connection${tries}.`;
  return e instanceof LlmError ? e.message : `${name}: ${(e as Error).message}`;
}

export class AllProvidersFailedError extends Error {
  constructor(readonly reasons: string[]) {
    super(
      `Couldn't get an AI response.\n${reasons.map((r) => `• ${r}`).join('\n')}\n` +
        'Try again in a minute, or turn on a backup provider in Settings.',
    );
    this.name = 'AllProvidersFailedError';
  }
}

export class FallbackChain {
  constructor(
    readonly providers: LlmProvider[],
    private readonly options: ChainOptions = { retryDelaysMs: [1500, 4000] },
  ) {
    if (providers.length === 0) throw new Error('No AI provider is set up yet. Add a free API key in Settings.');
  }

  /** Tries providers in order, retrying temporary outages before moving on to the next one. */
  async complete(req: ChatRequest, signal?: AbortSignal): Promise<ChainResult<string>> {
    const reasons: string[] = [];
    for (const p of this.providers) {
      for (let attempt = 0; ; attempt++) {
        try {
          return { value: await p.complete(req, signal), provider: p.name };
        } catch (e) {
          if (signal?.aborted) throw e;
          const delay = this.options.retryDelaysMs[attempt];
          if (isTransient(e) && delay !== undefined) {
            await sleep(delay, signal);
            continue;
          }
          reasons.push(describe(p.name, e, attempt + 1));
          break;
        }
      }
    }
    throw new AllProvidersFailedError(reasons);
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
