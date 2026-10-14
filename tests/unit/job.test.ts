import { describe, expect, it } from 'vitest';
import { buildJobPrompt, MAX_JOB_CHARS } from '@/lib/job/analyze';
import { JobAnalysisSchema } from '@/lib/job/schema';
import type { PageExtraction } from '@/lib/extract/merge';

const page = (text: string): PageExtraction => ({
  pageUrl: 'https://x.example/job',
  pageTitle: 'Job',
  frameUrl: 'https://x.example/job',
  candidate: { source: 'heuristic', text, score: 1, hints: { company: 'Acme' } },
});

describe('JobAnalysisSchema', () => {
  it('coerces loose model output', () => {
    const a = JobAnalysisSchema.parse({
      isJobPosting: 'true',
      title: 'Dev',
      yearsExperience: '5+',
      mustHave: ['Go', ' ', 'SQL '],
      niceToHave: null,
    });
    expect(a.isJobPosting).toBe(true);
    expect(a.yearsExperience).toBe(5);
    expect(a.mustHave).toEqual(['Go', 'SQL']);
    expect(a.niceToHave).toEqual([]);
    expect(a.company).toBe('');
  });

  it('treats unknown years as null', () => {
    expect(JobAnalysisSchema.parse({ isJobPosting: true, yearsExperience: 'n/a' }).yearsExperience).toBeNull();
  });

  it('requires isJobPosting', () => {
    expect(JobAnalysisSchema.safeParse({ title: 'x' }).success).toBe(false);
  });
});

describe('buildJobPrompt', () => {
  it('marks page text as untrusted, includes hints, and caps length', () => {
    const p = buildJobPrompt(page('y'.repeat(MAX_JOB_CHARS + 5_000)));
    expect(p.system).toMatch(/untrusted/);
    expect(p.user).toContain('Company: Acme');
    expect(p.user.length).toBeLessThan(MAX_JOB_CHARS + 2_000);
  });
});
