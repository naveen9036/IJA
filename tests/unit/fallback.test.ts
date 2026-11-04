import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { FallbackChain } from '@/lib/llm/fallback';
import { LlmError, type LlmProvider } from '@/lib/llm/provider';

const provider = (name: string, impl: () => Promise<string>): LlmProvider => ({ name, complete: vi.fn(impl) });
const req = { system: 's', user: 'u' };

describe('FallbackChain', () => {
  it('requires at least one provider', () => {
    expect(() => new FallbackChain([])).toThrow(/Settings/);
  });

  it('falls back to the next provider on rate limit', async () => {
    const a = provider('A', async () => {
      throw new LlmError('A: HTTP 429 rate limit reached', 'A', 429);
    });
    const b = provider('B', async () => 'hello');
    await expect(new FallbackChain([a, b]).complete(req)).resolves.toEqual({ value: 'hello', provider: 'B' });
  });

  it('explains every provider failure in plain words', async () => {
    const a = provider('A', async () => {
      throw new LlmError('A: HTTP 429', 'A', 429);
    });
    const b = provider('B', async () => {
      throw new Error('bad request');
    });
    await expect(new FallbackChain([a, b]).complete(req)).rejects.toThrow(
      /A reached its free-tier limit\.[\s\S]*B: bad request[\s\S]*backup provider in Settings/,
    );
  });

  it('retries a busy provider (503) before moving on', async () => {
    let calls = 0;
    const a = provider('A', async () => {
      if (++calls < 3) throw new LlmError('A: HTTP 503', 'A', 503);
      return 'finally';
    });
    const chain = new FallbackChain([a], { retryDelaysMs: [0, 0] });
    await expect(chain.complete(req)).resolves.toEqual({ value: 'finally', provider: 'A' });
    expect(calls).toBe(3);
  });

  it('falls back after retries are used up and says how often it tried', async () => {
    const a = provider('A', async () => {
      throw new LlmError('A: HTTP 503', 'A', 503);
    });
    const b = provider('B', async () => {
      throw new TypeError('Failed to fetch');
    });
    const chain = new FallbackChain([a, b], { retryDelaysMs: [0] });
    await expect(chain.complete(req)).rejects.toThrow(
      /A is busy or unavailable right now \(tried 2 times\)\.[\s\S]*B could not be reached/,
    );
    expect(a.complete).toHaveBeenCalledTimes(2);
  });

  it('stops immediately when aborted', async () => {
    const ctrl = new AbortController();
    const a = provider('A', async () => {
      ctrl.abort();
      throw new Error('aborted');
    });
    const b = provider('B', async () => 'unused');
    await expect(new FallbackChain([a, b]).complete(req, ctrl.signal)).rejects.toThrow('aborted');
    expect(b.complete).not.toHaveBeenCalled();
  });

  it('retries once with the validation error when JSON is invalid', async () => {
    const replies = ['{"n":"not a number"}', '{"n":5}'];
    const a = provider('A', async () => replies.shift()!);
    const result = await new FallbackChain([a]).completeJson(req, z.object({ n: z.number() }));
    expect(result.value).toEqual({ n: 5 });
    const secondCall = vi.mocked(a.complete).mock.calls[1]![0];
    expect(secondCall.json).toBe(true);
    expect(secondCall.user).toMatch(/previous reply was invalid/);
  });

  it('gives up after two invalid replies', async () => {
    const a = provider('A', async () => 'not json');
    await expect(new FallbackChain([a]).completeJson(req, z.object({ n: z.number() }))).rejects.toThrow(
      /invalid JSON/,
    );
  });
});
