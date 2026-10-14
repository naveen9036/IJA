import { cleanProfileData, type Experience, type ProfileData, type Project } from '../profile/schema';
import { totalYears } from '../score/experience';
import { findSkills, withImplied } from '../score/skills';
import { tokenize } from '../score/text';

export interface VerifyWarning {
  path: string;
  text: string;
  reason: string;
}

export interface VerifyResult {
  resume: ProfileData;
  removed: string[];
  warnings: VerifyWarning[];
}

const norm = (s: string) => tokenize(s).join(' ');
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

export function numbersIn(text: string): string[] {
  return (text.match(NUMBER) ?? []).map((n) => n.replace(/,/g, ''));
}

export function profileText(p: ProfileData): string {
  return [
    p.headline,
    p.summary,
    ...p.skills,
    ...p.certifications,
    ...p.experience.flatMap((e) => [e.title, e.company, e.location, e.start, e.end, ...e.bullets]),
    ...p.projects.flatMap((pr) => [pr.name, pr.description, ...pr.tech, ...pr.bullets]),
    ...p.education.flatMap((e) => [e.institution, e.degree, e.field, e.start, e.end, e.grade]),
  ].join('\n');
}

export function profileSkills(p: ProfileData, text: string): Set<string> {
  const skills = findSkills(text, 'long');
  for (const s of [...p.skills, ...p.certifications, ...p.projects.flatMap((pr) => pr.tech)]) {
    findSkills(s, 'short').forEach((x) => skills.add(x));
  }
  return withImplied(skills);
}

function matchRoles(original: Experience[], tailored: Experience[], removed: string[]): Experience[] {
  const used = new Set<number>();
  const bulletsFor = new Map<number, string[]>();

  for (const t of tailored) {
    const key = `${norm(t.company)}|${norm(t.title)}`;
    let idx = original.findIndex((o, i) => !used.has(i) && `${norm(o.company)}|${norm(o.title)}` === key);
    if (idx === -1) {
      const sameCompany = original.map((_, i) => i).filter((i) => !used.has(i) && norm(original[i]!.company) === norm(t.company));
      if (sameCompany.length === 1) idx = sameCompany[0]!;
    }
    if (idx === -1) {
      removed.push(`Role "${[t.title, t.company].filter(Boolean).join(' at ')}" is not in your profile`);
      continue;
    }
    used.add(idx);
    bulletsFor.set(idx, t.bullets);
  }

  // Original order and facts always win; only bullets come from the tailored version.
  return original.map((o, i) => {
    const bullets = bulletsFor.get(i)?.filter((b) => b.trim());
    return { ...o, bullets: bullets?.length ? bullets : o.bullets };
  });
}

function matchProjects(original: Project[], tailored: Project[], removed: string[]): Project[] {
  const out: Project[] = [];
  for (const t of tailored) {
    const o = original.find((p) => norm(p.name) === norm(t.name));
    if (!o) {
      removed.push(`Project "${t.name}" is not in your profile`);
      continue;
    }
    const allowedTech = new Set(o.tech.map(norm));
    out.push({ ...t, name: o.name, tech: t.tech.filter((x) => allowedTech.has(norm(x))) });
  }
  return out;
}

function filterSkills(tailored: string[], original: string[], known: Set<string>, removed: string[]): string[] {
  const originalNorm = new Set(original.map(norm));
  return tailored.filter((s) => {
    if (originalNorm.has(norm(s))) return true;
    const found = findSkills(s, 'short');
    if (found.size > 0 && [...found].every((x) => known.has(x))) return true;
    removed.push(`Skill "${s}" is not in your profile`);
    return false;
  });
}

/** Rebuilds a tailored resume so it cannot contain facts the original profile doesn't have. */
export function verifyTailored(original: ProfileData, tailored: ProfileData, extraText = ''): VerifyResult {
  const removed: string[] = [];
  const warnings: VerifyWarning[] = [];
  const origText = `${profileText(original)}\n${extraText}`;
  const known = profileSkills(original, origText);
  const years = totalYears(original.experience);
  const allowedNumbers = new Set([...numbersIn(origText), String(Math.floor(years)), String(Math.round(years))]);

  const resume = cleanProfileData({
    contact: original.contact,
    headline: original.headline,
    summary: tailored.summary || original.summary,
    experience: matchRoles(original.experience, tailored.experience, removed),
    education: original.education,
    projects: matchProjects(original.projects, tailored.projects, removed),
    skills: filterSkills(tailored.skills.length ? tailored.skills : original.skills, original.skills, known, removed),
    certifications: original.certifications,
  });

  const check = (path: string, text: string) => {
    for (const n of numbersIn(text)) {
      if (!allowedNumbers.has(n)) warnings.push({ path, text, reason: `number "${n}" is not in your profile` });
    }
    for (const s of findSkills(text, 'long')) {
      if (!known.has(s)) warnings.push({ path, text, reason: `"${s}" is not in your profile` });
    }
  };

  check('Summary', resume.summary);
  resume.experience.forEach((e, i) =>
    e.bullets.forEach((b, j) => check(`${e.title || 'Role'} at ${e.company || `#${i + 1}`}, bullet ${j + 1}`, b)),
  );
  resume.projects.forEach((p) => {
    check(`Project ${p.name}`, p.description);
    p.bullets.forEach((b, j) => check(`Project ${p.name}, bullet ${j + 1}`, b));
  });

  return { resume, removed, warnings };
}
