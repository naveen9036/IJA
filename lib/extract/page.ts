import { extractWithAdapter } from './adapters';
import { extractHeuristic, extractReadability } from './generic';
import { extractJsonLd } from './jsonld';
import { cleanText } from './text';
import type { Candidate, FrameResult } from './types';

const MIN_SELECTION = 100;

function safe(fn: () => Candidate | null): Candidate | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

/** Runs every extractor on one frame. Executed inside the page by the content script. */
export function extractFrame(doc: Document, win: Window): FrameResult {
  const result: FrameResult = {
    url: win.location.href,
    pageTitle: doc.title,
    isTop: win === win.top,
    candidates: [],
  };
  const hostname = win.location.hostname;
  const structured = [safe(() => extractWithAdapter(doc, hostname)), safe(() => extractJsonLd(doc))];
  // Pages that render the description client-side may still publish JSON-LD, so only skip the text-based extractors.
  const hasText = (doc.body?.textContent?.trim().length ?? 0) >= MIN_SELECTION;

  const selection = hasText ? cleanText(win.getSelection()?.toString() ?? '') : '';
  if (selection.length >= MIN_SELECTION) {
    result.candidates.push({ source: 'selection', text: selection, score: 1_000_000, hints: {} });
  }

  for (const c of [
    ...structured,
    hasText ? safe(() => extractReadability(doc)) : null,
    hasText ? safe(() => extractHeuristic(doc)) : null,
  ]) {
    if (c) result.candidates.push(c);
  }
  return result;
}
