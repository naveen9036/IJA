import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { jobUrlKey, pickBest, textHash } from '@/lib/extract/merge';
import { extractFrame } from '@/lib/extract/page';
import { htmlToText } from '@/lib/extract/text';
import type { FrameResult } from '@/lib/extract/types';

function load(fixture: string, url: string) {
  const html = readFileSync(new URL(`../fixtures/${fixture}`, import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url });
  return { dom, frame: extractFrame(dom.window.document, dom.window as unknown as Window) };
}

describe('extractFrame + pickBest on fixtures', () => {
  it('reads JSON-LD JobPosting even when the page body is a client-side shell', () => {
    const { frame } = load('jsonld.html', 'https://careers.northwind.example/jobs/42?utm_source=x');
    const best = pickBest([frame])!;
    expect(best.candidate.source).toBe('jsonld');
    expect(best.candidate.hints).toEqual({
      title: 'Senior Backend Engineer',
      company: 'Northwind Traders',
      location: 'Austin, TX, US',
    });
    expect(best.candidate.text).toContain('- Design and run Go services on Kubernetes');
    expect(best.candidate.text).toContain('5+ years of backend experience');
    expect(best.candidate.text).not.toContain('&lt;');
  });

  it('uses the LinkedIn adapter and ignores the search results list', () => {
    const { frame } = load('linkedin.html', 'https://www.linkedin.com/jobs/search/?currentJobId=222&keywords=platform');
    const best = pickBest([frame])!;
    expect(best.candidate.source).toBe('adapter');
    expect(best.candidate.adapter).toBe('LinkedIn');
    expect(best.candidate.hints).toEqual({ title: 'Platform Engineer', company: 'Contoso', location: 'Seattle, WA' });
    expect(best.candidate.text).toContain('3+ years of experience with Kubernetes');
    expect(best.candidate.text).not.toContain('Data Engineer');
    expect(jobUrlKey(best.pageUrl)).toBe('https://www.linkedin.com/jobs/view/222');
  });

  it('uses the Greenhouse adapter and reads the company from the logo', () => {
    const { frame } = load('greenhouse.html', 'https://job-boards.greenhouse.io/tailspin/jobs/123');
    const best = pickBest([frame])!;
    expect(best.candidate.adapter).toBe('Greenhouse');
    expect(best.candidate.hints).toEqual({ title: 'Data Analyst', company: 'Tailspin Toys', location: 'Remote - US' });
    expect(best.candidate.text).toContain('Advanced SQL');
    expect(best.candidate.text).not.toContain('Submit application');
  });

  it('uses the Lever adapter', () => {
    const { frame } = load('lever.html', 'https://jobs.lever.co/woodgrove/abc-123');
    const best = pickBest([frame])!;
    expect(best.candidate.adapter).toBe('Lever');
    expect(best.candidate.hints).toEqual({
      title: 'Mobile Developer (iOS)',
      company: 'Woodgrove Bank',
      location: 'London, UK',
    });
    expect(best.candidate.text).toContain('Swift, SwiftUI, Combine');
  });

  it('finds the description on an unknown site without structured data', () => {
    const { frame } = load('generic.html', 'https://proseware.example/careers/ml-engineer');
    const best = pickBest([frame])!;
    expect(['readability', 'heuristic']).toContain(best.candidate.source);
    expect(best.candidate.text).toContain('Strong Python and PyTorch skills');
    expect(best.candidate.text).toContain('Train and evaluate NLP models');
    expect(best.candidate.text).not.toContain('Cookie settings');
    expect(best.candidate.text).not.toContain('Account Executive');
  });

  it('heuristic alone skips sidebars full of job links', () => {
    const { frame } = load('generic.html', 'https://proseware.example/careers/ml-engineer');
    const heuristic = frame.candidates.find((c) => c.source === 'heuristic')!;
    expect(heuristic.text).toContain('Strong Python and PyTorch skills');
    expect(heuristic.text).not.toContain('Account Executive');
  });

  it('returns nothing usable for a page that is not a job', () => {
    const { frame } = load('not-a-job.html', 'https://recipes.example/sourdough');
    expect(pickBest([frame])).toBeNull();
  });

  it('prefers highlighted text over everything else', () => {
    const { dom } = load('generic.html', 'https://proseware.example/careers/ml-engineer');
    const doc = dom.window.document;
    const range = doc.createRange();
    range.selectNodeContents(doc.querySelector('.body')!);
    dom.window.getSelection()!.addRange(range);
    const best = pickBest([extractFrame(doc, dom.window as unknown as Window)])!;
    expect(best.candidate.source).toBe('selection');
    expect(best.candidate.text).toContain('PyTorch');
  });
});

describe('pickBest across frames', () => {
  const frame = (over: Partial<FrameResult>): FrameResult => ({
    url: 'https://a.example',
    pageTitle: 'A',
    isTop: false,
    candidates: [],
    ...over,
  });

  it('picks an embedded iframe description but keeps the top page URL', () => {
    const top = frame({ url: 'https://company.example/careers?gh_jid=9', isTop: true, pageTitle: 'Careers' });
    const embed = frame({
      url: 'https://boards.greenhouse.io/embed/job_app?token=9',
      candidates: [{ source: 'adapter', adapter: 'Greenhouse', text: 'x'.repeat(300), score: 100_300, hints: { title: 'Dev' } }],
    });
    const best = pickBest([top, embed])!;
    expect(best.pageUrl).toBe(top.url);
    expect(best.frameUrl).toBe(embed.url);
    expect(best.candidate.hints.title).toBe('Dev');
  });

  it('fills missing hints from JSON-LD in another candidate', () => {
    const f = frame({
      isTop: true,
      candidates: [
        { source: 'selection', text: 'Requirements: Go. Responsibilities: build.', score: 1_000_000, hints: {} },
        { source: 'jsonld', text: 'desc', score: 50_000, hints: { company: 'Acme', title: 'Engineer' } },
      ],
    });
    expect(pickBest([f])!.candidate.hints).toEqual({ company: 'Acme', title: 'Engineer' });
  });

  it('rejects generic candidates without job phrases', () => {
    const f = frame({ isTop: true, candidates: [{ source: 'readability', text: 'Just a blog post.', score: 10, hints: {} }] });
    expect(pickBest([f])).toBeNull();
  });
});

describe('helpers', () => {
  it('normalizes job URLs for caching', () => {
    expect(jobUrlKey('https://x.example/jobs/1/?utm_source=li&gh_src=abc&b=2&a=1#apply')).toBe(
      'https://x.example/jobs/1/?a=1&b=2',
    );
    expect(jobUrlKey('https://x.example/jobs/1/')).toBe('https://x.example/jobs/1');
    expect(jobUrlKey('not a url')).toBe('not a url');
  });

  it('hashes text deterministically', () => {
    expect(textHash('abc')).toBe(textHash('abc'));
    expect(textHash('abc')).not.toBe(textHash('abd'));
  });

  it('converts HTML to text without running scripts', () => {
    const { window } = new JSDOM('');
    const text = htmlToText('<p>Hi</p><script>bad()</script><ul><li>One</li><li>Two</li></ul>', window.document);
    expect(text).toBe('Hi\n- One\n- Two');
  });
});
