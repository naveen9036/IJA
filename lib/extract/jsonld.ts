import { htmlToText } from './text';
import type { Candidate } from './types';

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function isJobPosting(v: Json): boolean {
  const t = v['@type'];
  return t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'));
}

function findPosting(v: unknown, depth = 0): Json | null {
  if (depth > 5) return null;
  if (Array.isArray(v)) {
    for (const item of v) {
      const found = findPosting(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObj(v)) return null;
  if (isJobPosting(v)) return v;
  return findPosting(v['@graph'], depth + 1) ?? findPosting(v['mainEntity'], depth + 1);
}

function locationOf(p: Json): string {
  if (p['jobLocationType'] === 'TELECOMMUTE') return 'Remote';
  const locs = Array.isArray(p['jobLocation']) ? p['jobLocation'] : [p['jobLocation']];
  return locs
    .map((l) => {
      const a = isObj(l) && isObj(l['address']) ? l['address'] : null;
      if (!a) return '';
      const country = isObj(a['addressCountry']) ? str(a['addressCountry']['name']) : str(a['addressCountry']);
      return [str(a['addressLocality']), str(a['addressRegion']), country].filter(Boolean).join(', ');
    })
    .filter(Boolean)
    .join(' | ');
}

/** Reads a schema.org JobPosting from JSON-LD, which many job boards publish for search engines. */
export function extractJsonLd(doc: Document): Candidate | null {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent ?? '');
    } catch {
      continue;
    }
    const posting = findPosting(data);
    if (!posting) continue;

    const description = htmlToText(str(posting['description']), doc);
    if (description.length < 100) continue;
    const org = posting['hiringOrganization'];
    return {
      source: 'jsonld',
      text: description,
      score: 50_000 + Math.min(description.length, 10_000),
      hints: {
        title: str(posting['title']),
        company: isObj(org) ? str(org['name']) : str(org),
        location: locationOf(posting),
      },
    };
  }
  return null;
}
