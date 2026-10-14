import { z } from 'zod';

const str = () => z.string().nullish().transform((v) => v ?? '');
const strList = () => z.array(z.string()).nullish().transform((v) => v ?? []);

export const ExperienceSchema = z.object({
  company: str(),
  title: str(),
  location: str(),
  start: str(),
  end: str(),
  bullets: strList(),
});

export const EducationSchema = z.object({
  institution: str(),
  degree: str(),
  field: str(),
  start: str(),
  end: str(),
  grade: str(),
});

export const ProjectSchema = z.object({
  name: str(),
  description: str(),
  tech: strList(),
  bullets: strList(),
});

export const ProfileDataSchema = z.object({
  contact: z
    .object({
      name: str(),
      email: str(),
      phone: str(),
      location: str(),
      links: strList(),
    })
    .nullish()
    .transform((v) => v ?? { name: '', email: '', phone: '', location: '', links: [] }),
  headline: str(),
  summary: str(),
  experience: z.array(ExperienceSchema).nullish().transform((v) => v ?? []),
  education: z.array(EducationSchema).nullish().transform((v) => v ?? []),
  projects: z.array(ProjectSchema).nullish().transform((v) => v ?? []),
  skills: strList(),
  certifications: strList(),
});

export type Experience = z.output<typeof ExperienceSchema>;
export type Education = z.output<typeof EducationSchema>;
export type Project = z.output<typeof ProjectSchema>;
export type ProfileData = z.output<typeof ProfileDataSchema>;

/** Answers that are not in a resume but are asked on most application forms. */
export interface ApplicationInfo {
  workAuthorization: string;
  requiresSponsorship: string;
  noticePeriod: string;
  expectedSalary: string;
  willingToRelocate: string;
}

export const emptyApplicationInfo = (): ApplicationInfo => ({
  workAuthorization: '',
  requiresSponsorship: '',
  noticePeriod: '',
  expectedSalary: '',
  willingToRelocate: '',
});

export const emptyProfileData = (): ProfileData => ProfileDataSchema.parse({});

const cleanList = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);

const trimAll = <T extends Record<string, string | string[]>>(o: T): T =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? cleanList(v) : v.trim()])) as T;

/** Trims text and drops blank list items left over from editing. */
export function cleanProfileData(d: ProfileData): ProfileData {
  return {
    contact: trimAll(d.contact),
    headline: d.headline.trim(),
    summary: d.summary.trim(),
    experience: d.experience.map(trimAll),
    education: d.education.map(trimAll),
    projects: d.projects.map(trimAll),
    skills: cleanList(d.skills),
    certifications: cleanList(d.certifications),
  };
}

/** Shape description embedded in the LLM prompt. */
export const PROFILE_JSON_SHAPE = `{
  "contact": { "name": "", "email": "", "phone": "", "location": "", "links": [""] },
  "headline": "",
  "summary": "",
  "experience": [{ "company": "", "title": "", "location": "", "start": "YYYY-MM", "end": "YYYY-MM or Present", "bullets": [""] }],
  "education": [{ "institution": "", "degree": "", "field": "", "start": "", "end": "", "grade": "" }],
  "projects": [{ "name": "", "description": "", "tech": [""], "bullets": [""] }],
  "skills": [""],
  "certifications": [""]
}`;
