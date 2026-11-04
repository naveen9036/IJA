import type { ProfileData } from '../profile/schema';
import { parseMonth } from '../score/experience';
import { SKILL_GROUP_ORDER, skillGroupOf } from '../score/skills';

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

const shortLink = (url: string) => url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');

/** Resume header contact lines: location, phone, email on the first; links on the second. */
export function contactLines(c: ProfileData['contact']): string[] {
  return [[c.location, c.phone, c.email].filter(Boolean).join(' | '), c.links.map(shortLink).join(' | ')].filter(Boolean);
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

export type SectionKey = 'summary' | 'skills' | 'experience' | 'projects' | 'education' | 'certifications' | 'languages';

export const SECTION_TITLES: Record<SectionKey, string> = {
  summary: 'Professional Summary',
  skills: 'Technical Skills',
  experience: 'Professional Experience',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications & Awards',
  languages: 'Languages',
};

/** Non-empty sections in the order both renderers use. */
export function resumeSections(doc: ProfileData): SectionKey[] {
  const has: Record<SectionKey, boolean> = {
    summary: !!doc.summary,
    skills: doc.skills.length > 0 || doc.skillGroups.length > 0,
    experience: doc.experience.length > 0,
    projects: doc.projects.length > 0,
    education: doc.education.length > 0,
    certifications: doc.certifications.length > 0,
    languages: doc.languages.length > 0,
  };
  return (Object.keys(SECTION_TITLES) as SectionKey[]).filter((k) => has[k]);
}

export interface SkillLine {
  /** Empty when the skills are shown as one plain list. */
  label: string;
  items: string[];
}

/** The resume's own skill categories, or categories derived from the skill dictionary. */
export function skillLines(doc: ProfileData): SkillLine[] {
  const groups = doc.skillGroups.filter((g) => g.skills.length);
  if (groups.length) return groups.map((g) => ({ label: g.name, items: g.skills }));

  const byGroup = new Map<string, string[]>();
  for (const s of doc.skills) {
    const g = skillGroupOf(s);
    byGroup.set(g, [...(byGroup.get(g) ?? []), s]);
  }
  if (byGroup.size <= 1) return doc.skills.length ? [{ label: '', items: doc.skills }] : [];
  return SKILL_GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({ label: g, items: byGroup.get(g)! }));
}

export interface EntryLine {
  title: string;
  /** Company/institution and location, shown after the title. */
  org: string;
  dates: string;
}

export function roleLine(e: ProfileData['experience'][number]): EntryLine {
  return { title: e.title, org: [e.company, e.location].filter(Boolean).join(', '), dates: formatRange(e.start, e.end) };
}

export function educationLine(e: ProfileData['education'][number]): EntryLine {
  return {
    title: [e.degree, e.field].filter(Boolean).join(', '),
    org: [e.institution, e.grade].filter(Boolean).join(', '),
    dates: formatRange(e.start, e.end),
  };
}

/** Shared look for both renderers. */
export const THEME = { accent: '1F3A68', text: '1F2937', muted: '4B5563' };
