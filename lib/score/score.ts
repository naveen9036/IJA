import type { JobHints } from '../extract/types';
import type { JobAnalysis } from '../job/schema';
import type { ApplicationInfo, ProfileData } from '../profile/schema';
import { requiredYears, totalYears } from './experience';
import { findSkills, withImplied } from './skills';
import { containsPhrase, contentTokens, isSoftSkill, normalizeForMatch, stem, tokenize } from './text';

export interface ProfileInput {
  data: ProfileData;
  applicationInfo: ApplicationInfo;
  rawText: string;
}

export interface JobInput {
  analysis: JobAnalysis;
  text: string;
  hints?: JobHints;
}

export type ComponentKey = 'skills' | 'keywords' | 'experience' | 'title' | 'logistics';

export interface ComponentScore {
  key: ComponentKey;
  label: string;
  weight: number;
  /** 0..1, or null when the posting or profile lacks the data to judge it. */
  score: number | null;
  detail: string;
}

export interface RequirementMatch {
  text: string;
  /** 0..1 share of the requirement the profile covers. */
  credit: number;
  missing: string[];
  /** False for soft skills and items with nothing checkable. */
  scored: boolean;
}

export interface MatchResult {
  score: number;
  label: string;
  components: ComponentScore[];
  mustHave: RequirementMatch[];
  niceToHave: RequirementMatch[];
  missingKeywords: string[];
  warnings: string[];
  summary: string;
}

export const WEIGHTS: Record<ComponentKey, number> = { skills: 40, keywords: 25, experience: 20, title: 10, logistics: 5 };

interface ProfileContext {
  norm: string;
  tokens: Set<string>;
  skills: Set<string>;
}

function buildContext(p: ProfileInput): ProfileContext {
  const d = p.data;
  const corpus = [
    d.headline,
    d.summary,
    ...d.skills,
    ...d.certifications,
    ...d.experience.flatMap((e) => [e.title, e.company, ...e.bullets]),
    ...d.projects.flatMap((pr) => [pr.name, pr.description, ...pr.tech, ...pr.bullets]),
    ...d.education.flatMap((e) => [e.degree, e.field, e.institution]),
    p.rawText,
  ].join('\n');

  const skills = findSkills(corpus, 'long');
  for (const item of [...d.skills, ...d.certifications, ...d.projects.flatMap((pr) => pr.tech), ...d.education.map((e) => e.degree)]) {
    findSkills(item, 'short').forEach((s) => skills.add(s));
  }
  return { norm: normalizeForMatch(corpus), tokens: new Set(tokenize(corpus).map(stem)), skills: withImplied(skills) };
}

export function matchRequirement(text: string, ctx: ProfileContext): RequirementMatch {
  if (isSoftSkill(text)) return { text, credit: 0, missing: [], scored: false };

  const skills = findSkills(text);
  if (skills.size > 0) {
    const missing = [...skills].filter((s) => !ctx.skills.has(s));
    const have = skills.size - missing.length;
    const anyOf = /\bor\b/i.test(text);
    const credit = anyOf ? (have > 0 ? 1 : 0) : have / skills.size;
    return { text, credit, missing: credit === 1 ? [] : missing, scored: true };
  }

  const content = contentTokens(text);
  if (content.length === 0) return { text, credit: 0, missing: [], scored: false };
  const credit = containsPhrase(ctx.norm, content.join(' '))
    ? 1
    : content.filter((t) => ctx.tokens.has(stem(t))).length / content.length;
  return { text, credit, missing: credit >= 0.5 ? [] : [text], scored: true };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (x: number) => Math.round(x * 100);

function skillsComponent(must: RequirementMatch[], nice: RequirementMatch[]): ComponentScore {
  const m = must.filter((r) => r.scored);
  const n = nice.filter((r) => r.scored);
  const mustAvg = avg(m.map((r) => r.credit));
  const niceAvg = avg(n.map((r) => r.credit));
  const score = mustAvg !== null && niceAvg !== null ? 0.8 * mustAvg + 0.2 * niceAvg : (mustAvg ?? niceAvg);
  const met = m.filter((r) => r.credit >= 0.5).length;
  return {
    key: 'skills',
    label: 'Required skills',
    weight: WEIGHTS.skills,
    score,
    detail: m.length ? `${met} of ${m.length} must-have requirements met` : 'No must-have requirements found',
  };
}

function keywordsComponent(job: JobInput, ctx: ProfileContext): { component: ComponentScore; missing: string[] } {
  const jd = findSkills(job.text, 'long');
  for (const item of [...job.analysis.mustHave, ...job.analysis.niceToHave]) findSkills(item).forEach((s) => jd.add(s));
  const missing = [...jd].filter((s) => !ctx.skills.has(s)).sort();
  const have = jd.size - missing.length;
  return {
    missing,
    component: {
      key: 'keywords',
      label: 'Technology overlap',
      weight: WEIGHTS.keywords,
      score: jd.size >= 3 ? have / jd.size : null,
      detail: jd.size ? `${have} of ${jd.size} technologies in the posting appear in your profile` : 'No technologies detected',
    },
  };
}

function experienceComponent(job: JobInput, profile: ProfileInput): ComponentScore {
  const req = requiredYears(job.analysis.yearsExperience, job.analysis.seniority);
  const years = totalYears(profile.data.experience);
  const base = { key: 'experience' as const, label: 'Experience', weight: WEIGHTS.experience };
  if (!req) return { ...base, score: null, detail: `About ${years} years; posting doesn't state a requirement` };
  return {
    ...base,
    score: req.years === 0 ? 1 : Math.min(1, years / req.years),
    detail: `About ${years} years vs ${req.years}+ ${req.inferred ? `typical for ${job.analysis.seniority}` : 'required'}`,
  };
}

const TITLE_NOISE = new Set(
  'senior sr junior jr lead principal staff head chief i ii iii iv v intern associate entry level mid the of and for'.split(' '),
);
const TITLE_SYNONYMS: Record<string, string> = { developer: 'engineer', dev: 'engineer', programmer: 'engineer', swe: 'engineer' };

function titleTokens(title: string): Set<string> {
  return new Set(
    tokenize(title)
      .filter((t) => !TITLE_NOISE.has(t))
      .map((t) => TITLE_SYNONYMS[t] ?? stem(t)),
  );
}

function titleComponent(job: JobInput, profile: ProfileInput): ComponentScore {
  const base = { key: 'title' as const, label: 'Role fit', weight: WEIGHTS.title };
  const jobTitle = titleTokens(job.analysis.title || job.hints?.title || '');
  const pastTitles = [profile.data.headline, ...profile.data.experience.map((e) => e.title)].filter(Boolean);
  if (jobTitle.size === 0 || pastTitles.length === 0) return { ...base, score: null, detail: 'Not enough title information' };

  const best = Math.max(
    ...pastTitles.map((t) => {
      const tokens = titleTokens(t);
      return [...jobTitle].filter((x) => tokens.has(x)).length / jobTitle.size;
    }),
  );
  const detail =
    best >= 0.67 ? 'Matches your past titles' : best >= 0.34 ? 'Partly related to your past titles' : 'Different from your past titles';
  return { ...base, score: best, detail };
}

const NO_SPONSORSHIP =
  /\b(no|not|unable to|cannot|can['’]?t|won['’]?t|will not|does not|do not|without)\b[^.\n]{0,40}\bsponsor/i;
const LOCATION_NOISE = new Set('remote hybrid onsite on site office usa us united states area metro greater'.split(' '));

function logisticsComponent(job: JobInput, profile: ProfileInput, warnings: string[]): ComponentScore {
  const base = { key: 'logistics' as const, label: 'Location & eligibility', weight: WEIGHTS.logistics };
  const info = profile.applicationInfo;

  if (/^\s*y/i.test(info.requiresSponsorship) && NO_SPONSORSHIP.test(job.text)) {
    warnings.push('The posting says it does not sponsor work visas, and your profile says you need sponsorship.');
    return { ...base, score: 0, detail: 'Sponsorship not offered' };
  }
  if (/remote/i.test(job.analysis.workMode) || /^\s*remote\b/i.test(job.analysis.location)) {
    return { ...base, score: 1, detail: 'Remote role' };
  }

  const jobLoc = new Set(tokenize(job.analysis.location || job.hints?.location || '').filter((t) => !LOCATION_NOISE.has(t)));
  const myLoc = tokenize(profile.data.contact.location).filter((t) => !LOCATION_NOISE.has(t));
  if (jobLoc.size === 0 || myLoc.length === 0) return { ...base, score: null, detail: 'Location not compared' };
  if (myLoc.some((t) => jobLoc.has(t))) return { ...base, score: 1, detail: 'Near your location' };
  if (/^\s*y/i.test(info.willingToRelocate)) return { ...base, score: 0.7, detail: 'Different location; you are open to relocating' };
  return { ...base, score: 0.3, detail: `Located in ${job.analysis.location || job.hints?.location}` };
}

export function scoreLabel(score: number): string {
  if (score >= 75) return 'Strong match';
  if (score >= 55) return 'Good match';
  if (score >= 35) return 'Partial match';
  return 'Weak match';
}

/** Deterministic match score; no LLM call, so it is instant and stable for the same inputs. */
export function scoreMatch(profile: ProfileInput, job: JobInput): MatchResult {
  const ctx = buildContext(profile);
  const mustHave = job.analysis.mustHave.map((r) => matchRequirement(r, ctx));
  const niceToHave = job.analysis.niceToHave.map((r) => matchRequirement(r, ctx));
  const warnings: string[] = [];
  const keywords = keywordsComponent(job, ctx);

  const components = [
    skillsComponent(mustHave, niceToHave),
    keywords.component,
    experienceComponent(job, profile),
    titleComponent(job, profile),
    logisticsComponent(job, profile, warnings),
  ];

  const scored = components.filter((c): c is ComponentScore & { score: number } => c.score !== null);
  const weight = scored.reduce((s, c) => s + c.weight, 0);
  const score = weight ? pct(scored.reduce((s, c) => s + c.weight * c.score, 0) / weight) : 0;
  const label = weight ? scoreLabel(score) : 'Not enough data';

  const missingMust = [...new Set(mustHave.flatMap((r) => r.missing))];
  const skills = components[0]!;
  const experience = components[2]!;
  const summary = [
    `${label} (${score}/100).`,
    skills.score !== null && `${skills.detail}${missingMust.length ? `; missing: ${missingMust.slice(0, 4).join(', ')}` : ''}.`,
    experience.score !== null && `${experience.detail}.`,
    ...warnings,
  ]
    .filter(Boolean)
    .join(' ');

  return { score, label, components, mustHave, niceToHave, missingKeywords: keywords.missing, warnings, summary };
}
