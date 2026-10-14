import { Readability } from '@mozilla/readability';
import { blockText, cleanText, elementText, jobKeywordHits } from './text';
import type { Candidate } from './types';

const MIN_TEXT = 300;

export function genericScore(text: string): number {
  return jobKeywordHits(text) * 500 + Math.min(text.length, 3_000) / 30;
}

export function extractReadability(doc: Document): Candidate | null {
  const article = new Readability(doc.cloneNode(true) as Document, { charThreshold: MIN_TEXT }).parse();
  if (!article?.content) return null;
  const tpl = doc.createElement('template');
  tpl.innerHTML = article.content;
  const text = cleanText(blockText(tpl.content));
  if (text.length < MIN_TEXT) return null;
  return { source: 'readability', text, score: genericScore(text), hints: { title: article.title ?? '' } };
}

function linkTexts(el: Element): string[] {
  return [...el.querySelectorAll('a')].map((a) => a.textContent ?? '').filter(Boolean);
}

/** Picks the DOM block that reads most like a job description: many job phrases, little navigation. */
export function extractHeuristic(doc: Document): Candidate | null {
  let best: { el: Element; score: number } | null = null;
  for (const el of doc.body?.querySelectorAll('main, article, section, div, td') ?? []) {
    const raw = el.textContent ?? '';
    if (raw.length < MIN_TEXT || raw.length > 60_000 || jobKeywordHits(raw) < 2) continue;

    // Job phrases inside links ("Apply", other job titles) belong to navigation, not the description.
    const links = linkTexts(el);
    const linkChars = links.reduce((n, t) => n + t.length, 0);
    const ownText = links.reduce((t, l) => t.replace(l, ' '), raw);
    const score = genericScore(ownText) - (linkChars / raw.length) * 3_000;
    // >= so a nested block wins over its wrapper when they score the same.
    if (!best || score >= best.score) best = { el, score };
  }
  if (!best) return null;
  return { source: 'heuristic', text: elementText(best.el), score: best.score, hints: {} };
}
