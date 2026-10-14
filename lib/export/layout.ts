import type { ProfileData } from '../profile/schema';
import { parseMonth } from '../score/experience';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMonth(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (/^(present|current|now)$/i.test(s)) return 'Present';
  if (/^\d{4}$/.test(s)) return s;
  const m = parseMonth(s, 'start');
  return m === null ? s : `${MONTH_NAMES[m % 12]} ${Math.floor(m / 12)}`;
}

export function formatRange(start: string, end: string): string {
  return [formatMonth(start), formatMonth(end)].filter(Boolean).join(' – ');
}

export function contactLine(c: ProfileData['contact']): string {
  return [c.email, c.phone, c.location, ...c.links].filter(Boolean).join(' | ');
}

export function fileName(name: string, company: string, role: string, suffix: string, ext: string): string {
  const base = [name, company, role, suffix]
    .filter(Boolean)
    .join('_')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
    .replace(/_+$/, '');
  return `${base || 'Resume'}.${ext}`;
}

export type SectionKey = 'summary' | 'skills' | 'experience' | 'projects' | 'education' | 'certifications';

export const SECTION_TITLES: Record<SectionKey, string> = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications',
};

/** Non-empty sections in the order both renderers use. */
export function resumeSections(doc: ProfileData): SectionKey[] {
  const has: Record<SectionKey, boolean> = {
    summary: !!doc.summary,
    skills: doc.skills.length > 0,
    experience: doc.experience.length > 0,
    projects: doc.projects.length > 0,
    education: doc.education.length > 0,
    certifications: doc.certifications.length > 0,
  };
  return (Object.keys(SECTION_TITLES) as SectionKey[]).filter((k) => has[k]);
}

export function roleLine(e: ProfileData['experience'][number]): { title: string; meta: string } {
  return {
    title: [e.title, e.company].filter(Boolean).join(' — '),
    meta: [e.location, formatRange(e.start, e.end)].filter(Boolean).join(' · '),
  };
}

export function educationLine(e: ProfileData['education'][number]): { title: string; meta: string } {
  const degree = [e.degree, e.field].filter(Boolean).join(', ');
  return {
    title: [degree, e.institution].filter(Boolean).join(' — '),
    meta: [formatRange(e.start, e.end), e.grade].filter(Boolean).join(' · '),
  };
}
