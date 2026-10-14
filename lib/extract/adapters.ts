import { elementText, firstText } from './text';
import type { Candidate } from './types';

export interface SiteAdapter {
  name: string;
  hosts: RegExp;
  title: string[];
  company: string[];
  location: string[];
  description: string[];
}

// Selector lists are tried in order; sites change their markup, so the generic pipeline is always the fallback.
export const ADAPTERS: SiteAdapter[] = [
  {
    name: 'LinkedIn',
    hosts: /(^|\.)linkedin\.com$/,
    title: [
      '.job-details-jobs-unified-top-card__job-title h1',
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      '.top-card-layout__title',
    ],
    company: [
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
    ],
    location: [
      '.job-details-jobs-unified-top-card__primary-description-container .tvm__text',
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '.topcard__flavor--bullet',
    ],
    description: ['#job-details', '.jobs-description__content', '.jobs-description-content__text', '.show-more-less-html__markup'],
  },
  {
    name: 'Greenhouse',
    hosts: /(^|\.)greenhouse\.io$/,
    title: ['.job__title h1', 'h1.app-title', 'h1'],
    company: ['.company-name', '.job__header .logo img[alt]'],
    location: ['.job__location', '.location'],
    description: ['.job__description', '#content .job-post-content', '#content'],
  },
  {
    name: 'Lever',
    hosts: /(^|\.)lever\.co$/,
    title: ['.posting-headline h2'],
    company: ['.main-header-logo img[alt]'],
    location: ['.posting-categories .location', '.posting-category.location'],
    description: ['[data-qa="job-description"]', '.section-wrapper.page-full-width', '.content .section-wrapper'],
  },
];

export function findAdapter(hostname: string): SiteAdapter | undefined {
  return ADAPTERS.find((a) => a.hosts.test(hostname));
}

export function extractWithAdapter(doc: Document, hostname: string): Candidate | null {
  const adapter = findAdapter(hostname);
  if (!adapter) return null;

  for (const sel of adapter.description) {
    const el = doc.querySelector(sel);
    if (!el) continue;
    const text = elementText(el);
    if (text.length < 200) continue;
    const companyImg = adapter.company.find((s) => s.endsWith('[alt]'));
    return {
      source: 'adapter',
      adapter: adapter.name,
      text,
      score: 100_000 + Math.min(text.length, 10_000),
      hints: {
        title: firstText(doc, adapter.title),
        company:
          firstText(doc, adapter.company.filter((s) => s !== companyImg)) ||
          (companyImg ? (doc.querySelector(companyImg)?.getAttribute('alt') ?? '').trim() : ''),
        location: firstText(doc, adapter.location),
      },
    };
  }
  return null;
}
