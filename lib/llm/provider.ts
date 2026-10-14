export interface ChatRequest {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
}

export interface LlmProvider {
  readonly name: string;
  complete(req: ChatRequest, signal?: AbortSignal): Promise<string>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export const REQUEST_TIMEOUT_MS = 120_000;

export function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export async function errorFromResponse(provider: string, res: Response): Promise<LlmError> {
  const body = (await res.text().catch(() => '')).slice(0, 300);
  const hint = res.status === 429 ? 'rate limit reached' : res.status === 401 || res.status === 403 ? 'invalid API key' : body;
  return new LlmError(`${provider}: HTTP ${res.status} ${hint}`.trim(), provider, res.status);
}
