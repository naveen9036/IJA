import { describe, expect, it } from 'vitest';
import { extractJson } from '@/lib/llm/json';

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips code fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('strips reasoning tags from thinking models', () => {
    expect(extractJson('<think>{"wrong":true}</think>\n{"a":1}')).toEqual({ a: 1 });
  });

  it('finds JSON surrounded by prose', () => {
    expect(extractJson('Here you go: {"a":[1,2]} Hope it helps.')).toEqual({ a: [1, 2] });
  });

  it('throws when there is no JSON', () => {
    expect(() => extractJson('no json here')).toThrow();
  });
});
