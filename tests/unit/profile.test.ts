import { describe, expect, it } from 'vitest';
import { detectKind, normalizeText } from '@/lib/parse/extract';
import { buildStructurePrompt } from '@/lib/parse/structure';
import { cleanProfileData, ProfileDataSchema } from '@/lib/profile/schema';

describe('ProfileDataSchema', () => {
  it('fills missing and null fields with defaults', () => {
    const p = ProfileDataSchema.parse({ contact: { name: 'Ann', email: null }, experience: [{ company: 'Acme' }] });
    expect(p.contact).toEqual({ name: 'Ann', email: '', phone: '', location: '', links: [] });
    expect(p.experience[0]).toEqual({ company: 'Acme', title: '', location: '', start: '', end: '', bullets: [], tech: [] });
    expect(p.skills).toEqual([]);
    expect(p.skillGroups).toEqual([]);
    expect(p.languages).toEqual([]);
  });
});

describe('cleanProfileData', () => {
  it('trims text and removes blank list items', () => {
    const p = ProfileDataSchema.parse({
      headline: '  Engineer ',
      skills: [' Go', '', '  '],
      experience: [{ company: ' Acme ', bullets: ['Did X ', '', ' '] }],
    });
    const c = cleanProfileData(p);
    expect(c.headline).toBe('Engineer');
    expect(c.skills).toEqual(['Go']);
    expect(c.experience[0]?.company).toBe('Acme');
    expect(c.experience[0]?.bullets).toEqual(['Did X']);
  });
});

describe('resume text helpers', () => {
  it('detects file kinds by MIME type or extension', () => {
    expect(detectKind({ name: 'cv.PDF', type: '' })).toBe('pdf');
    expect(detectKind({ name: 'cv', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe(
      'docx',
    );
    expect(detectKind({ name: 'cv.txt', type: '' })).toBe('txt');
    expect(detectKind({ name: 'cv.doc', type: 'application/msword' })).toBeNull();
  });

  it('normalizes whitespace', () => {
    expect(normalizeText('a\u00a0\u00a0b\r\n\r\n\r\n\r\nc  d \n e')).toBe('a b\n\nc d\ne');
  });

  it('caps resume text in the prompt', () => {
    const prompt = buildStructurePrompt('x'.repeat(50_000));
    expect(prompt.user.length).toBeLessThan(31_000);
    expect(prompt.system).toMatch(/Never invent/);
  });
});
