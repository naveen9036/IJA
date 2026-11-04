import { describe, expect, it } from 'vitest';
import type { JobAnalysis } from '@/lib/job/schema';
import { parseMonth, requiredYears, totalYears } from '@/lib/score/experience';
import { scoreMatch, type ProfileInput } from '@/lib/score/score';
import { findSkills, withImplied } from '@/lib/score/skills';
import { isSoftSkill } from '@/lib/score/text';
import { emptyApplicationInfo, ProfileDataSchema } from '@/lib/profile/schema';

const NOW = new Date(2026, 9, 14);

describe('findSkills', () => {
  it('maps aliases to one name', () => {
    expect([...findSkills('k8s, Postgres, ReactJS, sklearn')].sort()).toEqual(
      ['Kubernetes', 'PostgreSQL', 'React', 'scikit-learn'].sort(),
    );
  });

  it('only matches common-word skills in prose with exact capitalization', () => {
    const prose = 'We go to market fast and react to feedback; you will be the owner of the rest of the stack.';
    const found = findSkills(prose, 'long');
    for (const s of ['Go', 'React', 'REST', "Bachelor's degree"]) expect(found.has(s)).toBe(false);
    expect(findSkills('Services are written in Go and React, exposed over REST.', 'long')).toEqual(
      new Set(['Go', 'React', 'REST']),
    );
  });

  it('matches short list items case-insensitively', () => {
    expect(findSkills('go')).toEqual(new Set(['Go']));
    expect(findSkills('B.S. in Computer Science')).toEqual(new Set(["Bachelor's degree"]));
  });

  it('adds implied categories', () => {
    const s = withImplied(new Set(['PostgreSQL', 'PhD', 'AWS']));
    for (const x of ['SQL', "Master's degree", "Bachelor's degree", 'Cloud']) expect(s.has(x)).toBe(true);
  });
});

describe('soft skills', () => {
  it('detects items a resume cannot prove', () => {
    expect(isSoftSkill('Excellent written and verbal communication skills')).toBe(true);
    expect(isSoftSkill('Strong Python skills')).toBe(false);
  });
});

describe('experience', () => {
  it('parses common date formats', () => {
    expect(parseMonth('2021-03', 'start')).toBe(2021 * 12 + 2);
    expect(parseMonth('03/2021', 'start')).toBe(2021 * 12 + 2);
    expect(parseMonth('March 2021', 'start')).toBe(2021 * 12 + 2);
    expect(parseMonth('2019', 'start')).toBe(2019 * 12);
    expect(parseMonth('2019', 'end')).toBe(2019 * 12 + 11);
    expect(parseMonth('Present', 'end', NOW)).toBe(2026 * 12 + 9);
    expect(parseMonth('', 'start')).toBeNull();
  });

  it('counts overlapping roles once', () => {
    const e = (start: string, end: string) => ({ company: '', title: '', location: '', start, end, bullets: [], tech: [] });
    expect(totalYears([e('2020-01', '2021-12'), e('2021-01', '2022-12')], NOW)).toBe(3);
    expect(totalYears([e('2018-01', '2018-12'), e('2020-01', '2020-06')], NOW)).toBe(1.5);
    expect(totalYears([e('2015-01', '')], NOW)).toBe(1);
  });

  it('infers required years from seniority when not stated', () => {
    expect(requiredYears(4, 'senior')).toEqual({ years: 4, inferred: false });
    expect(requiredYears(null, 'Senior')).toEqual({ years: 5, inferred: true });
    expect(requiredYears(null, '')).toBeNull();
  });
});

const job = (over: Partial<JobAnalysis> = {}): JobAnalysis => ({
  isJobPosting: true,
  title: 'Machine Learning Engineer',
  company: 'Proseware',
  location: 'Berlin, Germany',
  workMode: 'hybrid',
  employmentType: 'full-time',
  seniority: 'mid',
  yearsExperience: 3,
  salary: '',
  mustHave: ['Python', 'PyTorch', 'Docker', 'a major cloud', 'Excellent communication skills'],
  niceToHave: ['Kubernetes'],
  responsibilities: [],
  ...over,
});

const JOB_TEXT =
  'We are looking for a Machine Learning Engineer. Train NLP models with PyTorch, deploy with Docker on AWS. ' +
  'Requirements: 3+ years of experience, strong Python skills.';

const profile = (data: object, info: Partial<ProfileInput['applicationInfo']> = {}): ProfileInput => ({
  data: ProfileDataSchema.parse(data),
  applicationInfo: { ...emptyApplicationInfo(), ...info },
  rawText: '',
});

const mlEngineer = profile({
  contact: { location: 'Berlin, Germany' },
  headline: 'Machine Learning Engineer',
  skills: ['Python', 'PyTorch', 'Docker', 'AWS', 'NLP'],
  experience: [
    { title: 'ML Engineer', company: 'Fabrikam', start: '2021-01', end: 'Present', bullets: ['Trained NLP models'] },
    { title: 'Data Scientist', company: 'Contoso', start: '2019-01', end: '2020-12', bullets: [] },
  ],
});

const designer = profile({
  contact: { location: 'Lisbon, Portugal' },
  headline: 'Product Designer',
  skills: ['Figma', 'Sketch', 'User research'],
  experience: [{ title: 'Product Designer', company: 'Litware', start: '2024-01', end: 'Present', bullets: [] }],
});

describe('scoreMatch', () => {
  it('scores a strong candidate high and explains it', () => {
    const m = scoreMatch(mlEngineer, { analysis: job(), text: JOB_TEXT });
    expect(m.score).toBeGreaterThanOrEqual(75);
    expect(m.label).toBe('Strong match');
    expect(m.mustHave.find((r) => r.text === 'a major cloud')?.credit).toBe(1);
    expect(m.mustHave.find((r) => r.text.includes('communication'))?.scored).toBe(false);
    expect(m.summary).toMatch(/4 of 4 must-have requirements met/);
  });

  it('scores an unrelated candidate low and lists what is missing', () => {
    const m = scoreMatch(designer, { analysis: job(), text: JOB_TEXT });
    expect(m.score).toBeLessThan(35);
    expect(m.missingKeywords).toEqual(expect.arrayContaining(['Python', 'PyTorch', 'Docker']));
    expect(m.summary).toMatch(/missing: Python, PyTorch, Docker/);
  });

  it('gives partial credit for "and" and full credit for "or"', () => {
    const m = scoreMatch(mlEngineer, { analysis: job({ mustHave: ['Python and Scala', 'Java or Python'] }), text: '' });
    expect(m.mustHave.map((r) => r.credit)).toEqual([0.5, 1]);
    expect(m.mustHave[0]!.missing).toEqual(['Scala']);
  });

  it('matches requirements outside the skill dictionary by words', () => {
    const m = scoreMatch(mlEngineer, { analysis: job({ mustHave: ['NLP model training', 'Underwriting domain'] }), text: '' });
    expect(m.mustHave[0]!.credit).toBeGreaterThanOrEqual(0.5);
    expect(m.mustHave[1]!.credit).toBe(0);
  });

  it('warns when sponsorship is needed but not offered', () => {
    const p = { ...mlEngineer, applicationInfo: { ...mlEngineer.applicationInfo, requiresSponsorship: 'Yes' } };
    const m = scoreMatch(p, { analysis: job(), text: `${JOB_TEXT} We are unable to sponsor visas for this role.` });
    expect(m.warnings[0]).toMatch(/does not sponsor/);
    expect(m.components.find((c) => c.key === 'logistics')?.score).toBe(0);
  });

  it('treats remote roles as a location match', () => {
    const m = scoreMatch(designer, { analysis: job({ workMode: 'remote' }), text: JOB_TEXT });
    expect(m.components.find((c) => c.key === 'logistics')?.score).toBe(1);
  });

  it('leaves out components it cannot judge instead of scoring them zero', () => {
    const m = scoreMatch(mlEngineer, {
      analysis: job({ yearsExperience: null, seniority: '', location: '', workMode: '' }),
      text: 'Python',
    });
    const byKey = Object.fromEntries(m.components.map((c) => [c.key, c.score]));
    expect(byKey.experience).toBeNull();
    expect(byKey.logistics).toBeNull();
    expect(m.score).toBeGreaterThanOrEqual(75);
  });
});
