import type { ProfileData } from '../profile/schema';
import { numbersIn, profileSkills, profileText, type VerifyWarning } from '../resume/verify';
import { totalYears } from '../score/experience';
import { findSkills } from '../score/skills';
import { TARGET_WORDS, wordCount, type CoverLetter, type LetterOptions } from './schema';

const PLACEHOLDER = /\[[^\]]+\]|\{[^}]+\}|<[^>]+>/;

export interface LetterCheckInput {
  profile: ProfileData;
  rawText: string;
  jobText: string;
  company: string;
  options: LetterOptions;
}

/** Flags anything in the letter the profile, job text, or user's notes don't support. */
export function verifyLetter(letter: CoverLetter, input: LetterCheckInput): { letter: CoverLetter; warnings: VerifyWarning[] } {
  const clean: CoverLetter = {
    salutation: letter.salutation.trim() || 'Dear Hiring Manager,',
    paragraphs: letter.paragraphs.map((p) => p.trim()).filter(Boolean),
    closing: letter.closing.trim() || 'Sincerely,',
  };
  const warnings: VerifyWarning[] = [];

  const ownText = `${profileText(input.profile)}\n${input.rawText}\n${input.options.notes}`;
  const known = profileSkills(input.profile, ownText);
  const years = totalYears(input.profile.experience);
  const allowedNumbers = new Set([
    ...numbersIn(ownText),
    ...numbersIn(input.jobText),
    String(Math.floor(years)),
    String(Math.round(years)),
  ]);

  const parts: [string, string][] = [
    ['Salutation', clean.salutation],
    ...clean.paragraphs.map((p, i): [string, string] => [`Paragraph ${i + 1}`, p]),
    ['Closing', clean.closing],
  ];
  for (const [path, text] of parts) {
    const ph = text.match(PLACEHOLDER);
    if (ph) warnings.push({ path, text, reason: `placeholder "${ph[0]}" needs replacing` });
    for (const n of numbersIn(text)) {
      if (!allowedNumbers.has(n)) warnings.push({ path, text, reason: `number "${n}" is not in your profile or the job` });
    }
    for (const s of findSkills(text, 'long')) {
      if (!known.has(s)) warnings.push({ path, text, reason: `"${s}" is not in your profile` });
    }
  }

  const body = clean.paragraphs.join(' ');
  if (input.company && !body.toLowerCase().includes(input.company.toLowerCase())) {
    warnings.push({ path: 'Letter', text: '', reason: `the company name "${input.company}" is not mentioned` });
  }
  const words = wordCount(clean.paragraphs);
  const target = TARGET_WORDS[input.options.length];
  if (words < target * 0.6 || words > target * 1.4) {
    warnings.push({ path: 'Letter', text: '', reason: `${words} words; the target is about ${target}` });
  }

  return { letter: clean, warnings };
}
