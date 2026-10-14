import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { JobRecord } from '@/lib/db';
import { buildResumeDocx } from '@/lib/export/resumeDocx';
import { fileName, formatMonth, formatRange, resumeSections } from '@/lib/export/layout';
import { ProfileDataSchema, type ProfileData } from '@/lib/profile/schema';
import { buildTailorPrompt, MAX_TAILOR_JD_CHARS } from '@/lib/resume/tailor';
import { verifyTailored } from '@/lib/resume/verify';
import { totalYears } from '@/lib/score/experience';

const original: ProfileData = ProfileDataSchema.parse({
  contact: { name: 'Jane Doe', email: 'jane@example.com', phone: '+1 555 0100', location: 'Austin, TX', links: [] },
  headline: 'Platform Engineer',
  summary: 'Platform engineer.',
  skills: ['Kubernetes', 'Terraform', 'Go', 'PostgreSQL'],
  experience: [
    {
      company: 'Acme',
      title: 'Senior Platform Engineer',
      start: '2021-03',
      end: 'Present',
      bullets: ['Built a Kubernetes platform used by 40 teams', 'Cut CI time by 60%'],
    },
    { company: 'Globex', title: 'DevOps Engineer', start: '2018-01', end: '2021-02', bullets: ['Wrote Terraform modules'] },
  ],
  education: [{ institution: 'UT Austin', degree: 'B.S.', field: 'Computer Science', end: '2017' }],
  projects: [{ name: 'kube-lint', description: 'Linter for manifests', tech: ['Go'], bullets: [] }],
});

const tailored = (over: Partial<ProfileData>): ProfileData => ({ ...structuredClone(original), ...over });

describe('verifyTailored', () => {
  it('removes invented roles and restores facts and missing roles', () => {
    const t = tailored({
      experience: [
        { company: 'Acme', title: 'Staff Platform Engineer', location: '', start: '2019-01', end: 'Present', bullets: ['Led platform work'] },
        { company: 'Initech', title: 'CTO', location: '', start: '2015', end: '2017', bullets: ['Ran everything'] },
      ],
    });
    const { resume, removed } = verifyTailored(original, t);
    expect(resume.experience.map((e) => [e.company, e.title, e.start])).toEqual([
      ['Acme', 'Senior Platform Engineer', '2021-03'],
      ['Globex', 'DevOps Engineer', '2018-01'],
    ]);
    expect(resume.experience[0]!.bullets).toEqual(['Led platform work']);
    expect(resume.experience[1]!.bullets).toEqual(['Wrote Terraform modules']);
    expect(removed).toEqual(['Role "CTO at Initech" is not in your profile']);
  });

  it('always keeps contact, education, and certifications from the profile', () => {
    const t = tailored({
      contact: { ...original.contact, email: 'fake@x.com' },
      education: [{ institution: 'MIT', degree: 'PhD', field: 'CS', start: '', end: '', grade: '' }],
      certifications: ['CKA'],
    });
    const { resume } = verifyTailored(original, t);
    expect(resume.contact.email).toBe('jane@example.com');
    expect(resume.education[0]!.institution).toBe('UT Austin');
    expect(resume.certifications).toEqual([]);
  });

  it('removes invented skills and projects', () => {
    const t = tailored({
      skills: ['Kubernetes', 'Rust', 'k8s', 'SQL'],
      projects: [{ name: 'Secret Startup', description: '', tech: [], bullets: [] }],
    });
    const { resume, removed } = verifyTailored(original, t);
    expect(resume.skills).toEqual(['Kubernetes', 'k8s', 'SQL']);
    expect(resume.projects).toEqual([]);
    expect(removed).toEqual(expect.arrayContaining(['Skill "Rust" is not in your profile', 'Project "Secret Startup" is not in your profile']));
  });

  it('warns about new numbers and technologies in rewritten text', () => {
    const t = tailored({
      summary: 'Engineer with 12 years of experience.',
      experience: [
        { ...original.experience[0]!, bullets: ['Built a Kubernetes platform used by 40 teams', 'Cut CI time by 75% with Kafka'] },
        original.experience[1]!,
      ],
    });
    const { warnings } = verifyTailored(original, t);
    const reasons = warnings.map((w) => `${w.path}: ${w.reason}`);
    expect(reasons).toContain('Summary: number "12" is not in your profile');
    expect(reasons).toContain('Senior Platform Engineer at Acme, bullet 2: number "75" is not in your profile');
    expect(reasons).toContain('Senior Platform Engineer at Acme, bullet 2: "Kafka" is not in your profile');
    expect(reasons.some((r) => r.includes('"40"'))).toBe(false);
  });

  it('allows the computed total years of experience', () => {
    const years = Math.floor(totalYears(original.experience));
    const { warnings } = verifyTailored(original, tailored({ summary: `Engineer with ${years} years of experience.` }));
    expect(warnings).toEqual([]);
  });
});

describe('buildTailorPrompt', () => {
  it('includes the rules and caps the job text', () => {
    const job = {
      text: 'z'.repeat(MAX_TAILOR_JD_CHARS + 1000),
      hints: {},
      analysis: { title: 'SRE', company: 'Contoso', mustHave: ['Kubernetes'], niceToHave: [] },
    } as unknown as JobRecord;
    const p = buildTailorPrompt(original, job, null);
    expect(p.system).toMatch(/Never add, rename, or change employers/);
    expect(p.system).toMatch(/untrusted/);
    expect(p.user).toContain('SRE at Contoso');
    expect(p.user).not.toContain('z'.repeat(MAX_TAILOR_JD_CHARS + 1));
  });
});

describe('layout', () => {
  it('formats dates', () => {
    expect(formatMonth('2021-03')).toBe('Mar 2021');
    expect(formatMonth('2017')).toBe('2017');
    expect(formatMonth('present')).toBe('Present');
    expect(formatRange('2021-03', 'Present')).toBe('Mar 2021 – Present');
    expect(formatRange('', '2017')).toBe('2017');
  });

  it('builds safe file names', () => {
    expect(fileName('Jane Doe', 'Contoso, Inc.', 'Sr. Engineer / Platform', '', 'pdf')).toBe('Jane_Doe_Contoso_Inc_Sr_Engineer_Platform.pdf');
    expect(fileName('José Núñez', 'A'.repeat(100), 'X', '', 'docx')).toMatch(/^Jose_Nunez_A+\.docx$/);
    expect(fileName('', '', '', '', 'pdf')).toBe('Resume.pdf');
  });

  it('skips empty sections', () => {
    expect(resumeSections({ ...original, certifications: [], projects: [] })).toEqual(['summary', 'skills', 'experience', 'education']);
  });
});

describe('renderers', () => {
  it('DOCX contains the name, sections in order, and bullets', async () => {
    const blob = await buildResumeDocx(original);
    const xml = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))['word/document.xml']!);
    const text = xml.replace(/<[^>]+>/g, ' ');
    expect(text).toContain('Jane Doe');
    const order = ['SUMMARY', 'SKILLS', 'EXPERIENCE', 'PROJECTS', 'EDUCATION'].map((h) => text.indexOf(h));
    expect(order.every((i, n) => i > -1 && (n === 0 || i > order[n - 1]!))).toBe(true);
    expect(text).toContain('Cut CI time by 60%');
    expect(xml).toContain('w:numPr');
  });

  it('PDF contains the name and experience', async () => {
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const { ResumePdf } = await import('@/lib/export/resumePdf');
    const buf = await renderToBuffer(ResumePdf({ doc: original }));
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: new Uint8Array(buf) });
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map((i) => ('str' in i ? i.str : '')).join(' ');
    await task.destroy();
    expect(text).toContain('Jane Doe');
    expect(text).toContain('EXPERIENCE');
    expect(text).toContain('Built a Kubernetes platform used by 40 teams');
  });
});
