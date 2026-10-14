import { stem, tokenize } from '../score/text';

export interface QaEntry {
  id?: number;
  key: string;
  question: string;
  answer: string;
  updatedAt: number;
}

export const qaKey = (question: string) => tokenize(question).map(stem).join(' ');

/** Saved answer for a question: exact normalized match first, then token Jaccard >= 0.8. */
export function findSaved(question: string, entries: QaEntry[]): QaEntry | undefined {
  const key = qaKey(question);
  if (!key) return undefined;
  const exact = entries.find((e) => e.key === key);
  if (exact) return exact;

  const tokens = new Set(key.split(' '));
  let best: { e: QaEntry; score: number } | undefined;
  for (const e of entries) {
    const other = new Set(e.key.split(' '));
    const inter = [...tokens].filter((t) => other.has(t)).length;
    const score = inter / (tokens.size + other.size - inter);
    if (score >= 0.8 && (!best || score > best.score)) best = { e, score };
  }
  return best?.e;
}
