import { z } from 'zod';

const str = () => z.string().nullish().transform((v) => v ?? '');
const strList = () =>
  z
    .array(z.string())
    .nullish()
    .transform((v) => (v ?? []).map((s) => s.trim()).filter(Boolean));

const bool = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());

const nullableNumber = z.preprocess((v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}, z.number().nullable());

export const JobAnalysisSchema = z.object({
  isJobPosting: bool,
  title: str(),
  company: str(),
  location: str(),
  workMode: str(),
  employmentType: str(),
  seniority: str(),
  yearsExperience: nullableNumber,
  salary: str(),
  mustHave: strList(),
  niceToHave: strList(),
  responsibilities: strList(),
});

export type JobAnalysis = z.output<typeof JobAnalysisSchema>;

export const JOB_JSON_SHAPE = `{
  "isJobPosting": true,
  "title": "",
  "company": "",
  "location": "",
  "workMode": "remote | hybrid | onsite | \\"\\"",
  "employmentType": "full-time | part-time | contract | internship | \\"\\"",
  "seniority": "intern | junior | mid | senior | lead | principal | manager | director | \\"\\"",
  "yearsExperience": 5,
  "salary": "",
  "mustHave": ["skill or qualification"],
  "niceToHave": ["skill or qualification"],
  "responsibilities": ["short phrase"]
}`;
