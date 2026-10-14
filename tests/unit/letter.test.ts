import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { JobRecord } from '@/lib/db';
import { buildLetterDocx } from '@/lib/export/letterDocx';
import type { LetterRenderInput } from '@/lib/export/letterLayout';
import { defaultLetterOptions, letterText, wordCount, type CoverLetter } from '@/lib/letter/schema';
import { verifyLetter } from '@/lib/letter/verify';
import { buildLetterPrompt, MAX_LETTER_JD_CHARS, MAX_LETTER_NOTES_CHARS } from '@/lib/letter/write';
import { ProfileDataSchema } from '@/lib/profile/schema';

const profile = ProfileDataSchema.parse({
  contact: { name: 'Sam Lee', email: 'sam@example.com', location: 'Berlin, Germany' },
  skills: ['Python', 'PyTorch'],
  experience: [{ company: 'Fabrikam', title: 'ML Engineer', start: '2020-01', end: 'Present', bullets: ['Cut latency by 30%'] }],
});

const job = {
  text: 'Proseware is hiring. We serve 200 insurers. ' + 'x'.repeat(MAX_LETTER_JD_CHARS),
  hints: {},
  analysis: { title: 'ML Engineer', company: 'Proseware', mustHave: ['Python'], niceToHave: [] },
} as unknown as JobRecord;

const para = (words: number, extra = '') => `${extra} ${'word '.repeat(words)}`.trim();

const check = (letter: CoverLetter, notes = '') =>
  verifyLetter(letter, {
    profile,
    rawText: '',
    jobText: job.text,
    company: 'Proseware',
    options: { ...defaultLetterOptions(), notes },
  });

describe('buildLetterPrompt', () => {
  it('includes notes, rules, and caps the job text and notes', () => {
    const p = buildLetterPrompt(profile, job, null, { tone: 'warm', length: 'short', notes: 'Referred by Alex. ' + 'n'.repeat(1000) });
    expect(p.system).toMatch(/cover letter/);
    expect(p.system).toMatch(/untrusted/);
    expect(p.user).toContain('Referred by Alex.');
    expect(p.user).toContain('about 150 words');
    expect(p.user).not.toContain('n'.repeat(MAX_LETTER_NOTES_CHARS));
    expect(p.user).not.toContain('x'.repeat(MAX_LETTER_JD_CHARS));
  });
});

describe('verifyLetter', () => {
  const good: CoverLetter = {
    salutation: 'Dear Hiring Manager,',
    paragraphs: [para(80, 'I want to join Proseware.'), para(80, 'I cut latency by 30% with PyTorch.'), para(80, 'You serve 200 insurers.')],
    closing: 'Sincerely,',
  };

  it('accepts a letter backed by the profile and job text', () => {
    expect(check(good).warnings).toEqual([]);
  });

  it('flags placeholders, invented numbers and skills, and a missing company', () => {
    const { warnings } = check({
      ...good,
      paragraphs: [para(80, 'Dear [Company], I grew revenue 45% using Kafka.'), para(160)],
    });
    const reasons = warnings.map((w) => w.reason);
    expect(reasons).toEqual(
      expect.arrayContaining([
        'placeholder "[Company]" needs replacing',
        'number "45" is not in your profile or the job',
        '"Kafka" is not in your profile',
        'the company name "Proseware" is not mentioned',
      ]),
    );
  });

  it('allows numbers the user put in the notes', () => {
    const letter = { ...good, paragraphs: [...good.paragraphs.slice(0, 2), para(80, 'I led a team of 12 at Proseware events.')] };
    expect(check(letter).warnings.some((w) => w.reason.includes('"12"'))).toBe(true);
    expect(check(letter, 'I led a team of 12').warnings).toEqual([]);
  });

  it('warns when the length is far from the target and fills defaults', () => {
    const { letter, warnings } = check({ salutation: '', paragraphs: ['Proseware rocks.', ' '], closing: '' });
    expect(letter.salutation).toBe('Dear Hiring Manager,');
    expect(letter.closing).toBe('Sincerely,');
    expect(letter.paragraphs).toEqual(['Proseware rocks.']);
    expect(warnings.map((w) => w.reason)).toContain('2 words; the target is about 250');
  });
});

describe('letter text and renderers', () => {
  const letter: CoverLetter = { salutation: 'Dear Ms. Rivera,', paragraphs: ['First at Proseware.', 'Second.'], closing: 'Best regards,' };
  const input: LetterRenderInput = { letter, contact: profile.contact, company: 'Proseware', location: 'Berlin', date: new Date(2026, 9, 14) };

  it('builds clipboard text with the signature', () => {
    expect(letterText(letter, 'Sam Lee')).toBe('Dear Ms. Rivera,\n\nFirst at Proseware.\n\nSecond.\n\nBest regards,\nSam Lee');
    expect(wordCount(letter.paragraphs)).toBe(4);
  });

  it('DOCX contains company, salutation, and signature in order', async () => {
    const blob = await buildLetterDocx(input);
    const text = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))['word/document.xml']!).replace(/<[^>]+>/g, ' ');
    const order = ['Sam Lee', 'Proseware', 'Dear Ms. Rivera,', 'First at Proseware.', 'Best regards,'].map((t) => text.indexOf(t));
    expect(order.every((i, n) => i > -1 && (n === 0 || i > order[n - 1]!))).toBe(true);
    expect(text.lastIndexOf('Sam Lee')).toBeGreaterThan(text.indexOf('Best regards,'));
  });

  it('PDF contains company, salutation, and signature', async () => {
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const { LetterPdf } = await import('@/lib/export/letterPdf');
    const buf = await renderToBuffer(LetterPdf({ input }));
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: new Uint8Array(buf) });
    const content = await (await (await task.promise).getPage(1)).getTextContent();
    await task.destroy();
    const text = content.items.map((i) => ('str' in i ? i.str : '')).join(' ');
    for (const t of ['Proseware', 'Dear Ms. Rivera,', 'Best regards,', 'Sam Lee']) expect(text).toContain(t);
  });
});
