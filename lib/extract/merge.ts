import { jobKeywordHits } from './text';
import type { Candidate, FrameResult, JobHints } from './types';

export interface PageExtraction {
  pageUrl: string;
  pageTitle: string;
  frameUrl: string;
  candidate: Candidate;
}

function eligible(c: Candidate): boolean {
  if (c.source === 'readability' || c.source === 'heuristic') return jobKeywordHits(c.text) >= 2;
  return true;
}

/** Chooses the best job description across all frames and fills missing title/company/location hints. */
export function pickBest(frames: FrameResult[]): PageExtraction | null {
  const top = frames.find((f) => f.isTop) ?? frames[0];
  if (!top) return null;

  let best: { c: Candidate; frame: FrameResult } | null = null;
  for (const frame of frames) {
    for (const c of frame.candidates) {
      if (eligible(c) && (!best || c.score > best.c.score)) best = { c, frame };
    }
  }
  if (!best) return null;

  const hints: JobHints = { ...best.c.hints };
  for (const frame of frames) {
    for (const c of frame.candidates) {
      for (const key of ['title', 'company', 'location'] as const) {
        if (!hints[key] && c.hints[key] && (c.source === 'adapter' || c.source === 'jsonld')) hints[key] = c.hints[key];
      }
    }
  }

  return {
    pageUrl: top.url,
    pageTitle: top.pageTitle,
    frameUrl: best.frame.url,
    candidate: { ...best.c, hints },
  };
}

const TRACKING_PARAMS = /^(utm_|trk|refid$|trackingid$|ref$|src$|source$|gh_src$|lever-|fbclid$|gclid$|ebp$)/i;

/** Stable cache key for a job URL: drops tracking params and fragments. */
export function jobUrlKey(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  url.hash = '';

  const linkedInJobId = /(^|\.)linkedin\.com$/.test(url.hostname) ? url.searchParams.get('currentJobId') : null;
  if (linkedInJobId) return `https://www.linkedin.com/jobs/view/${linkedInJobId}`;

  const kept = [...url.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.test(k)).sort(([a], [b]) => a.localeCompare(b));
  url.search = new URLSearchParams(kept).toString();
  return url.toString().replace(/\/$/, '');
}

/** FNV-1a; only used to detect whether a page's text changed. */
export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
