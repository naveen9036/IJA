/** Pulls a JSON value out of an LLM reply that may include reasoning tags or code fences. */
export function extractJson(text: string): unknown {
  let s = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();

  try {
    return JSON.parse(s);
  } catch {
    const start = s.search(/[[{]/);
    const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (start === -1 || end <= start) throw new Error('No JSON found in model reply');
    return JSON.parse(s.slice(start, end + 1));
  }
}
