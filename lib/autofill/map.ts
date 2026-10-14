import type { ApplicationInfo, ProfileData } from '../profile/schema';
import { totalYears } from '../score/experience';
import { tokenize } from '../score/text';
import { findSaved, type QaEntry } from './qa';
import type { FieldDescriptor, FieldOption } from './types';

export type ProfileKey =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'city'
  | 'country'
  | 'location'
  | 'linkedin'
  | 'github'
  | 'website'
  | 'currentCompany'
  | 'currentTitle'
  | 'yearsExperience'
  | 'school'
  | 'degree'
  | 'workAuthorization'
  | 'requiresSponsorship'
  | 'noticePeriod'
  | 'expectedSalary'
  | 'willingToRelocate'
  | 'resumeFile'
  | 'coverLetterFile'
  | 'coverLetterText';

export const KEY_LABEL: Record<ProfileKey, string> = {
  firstName: 'first name',
  lastName: 'last name',
  fullName: 'name',
  email: 'email',
  phone: 'phone',
  city: 'city',
  country: 'country',
  location: 'location',
  linkedin: 'LinkedIn URL',
  github: 'GitHub URL',
  website: 'website',
  currentCompany: 'current company',
  currentTitle: 'current title',
  yearsExperience: 'years of experience',
  school: 'school',
  degree: 'degree',
  workAuthorization: 'work authorization',
  requiresSponsorship: 'sponsorship answer',
  noticePeriod: 'notice period',
  expectedSalary: 'expected salary',
  willingToRelocate: 'relocation answer',
  resumeFile: 'resume file',
  coverLetterFile: 'cover letter',
  coverLetterText: 'cover letter',
};

export interface AutofillContext {
  profile: ProfileData;
  info: ApplicationInfo;
  hasResumeFile: boolean;
  hasCoverLetter: boolean;
  coverLetterText: string;
  qa: QaEntry[];
}

export interface MappedField {
  field: FieldDescriptor;
  source: 'profile' | 'saved' | 'llm' | 'none';
  key?: ProfileKey;
  value?: string;
  optionValue?: string;
  file?: 'resume' | 'coverLetter';
  sensitive?: boolean;
  /** Unanswered field the LLM may answer. */
  askLlm?: boolean;
  /** Not a profile field, so the user's answer can be saved for next time. */
  saveable: boolean;
  reason?: string;
}

const SENSITIVE =
  /\b(gender|sex|race|racial|ethnicity|ethnic|hispanic|latin[oax]|veteran|disabilit\w*|disabled|sexual orientation|lgbt\w*|pronouns?|transgender|date of birth|birth ?date|dob|age)\b/;

const AUTOCOMPLETE: Record<string, ProfileKey> = {
  'given-name': 'firstName',
  'family-name': 'lastName',
  name: 'fullName',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  'address-level2': 'city',
  'country-name': 'country',
  country: 'country',
  organization: 'currentCompany',
  'organization-title': 'currentTitle',
  url: 'website',
};

type Rule = [ProfileKey, RegExp, ('short' | 'any')?];

// Most specific first. 'short' rules skip textareas, which hold questions rather than facts.
const RULES: Rule[] = [
  ['coverLetterText', /cover\s*letter/],
  ['linkedin', /linked\s*in/],
  ['github', /github/],
  ['website', /website|portfolio|personal (site|url|page)|\bblog\b|\burl\b/, 'short'],
  ['firstName', /first\s*name|given\s*name|\bfname\b|forename/, 'short'],
  ['lastName', /last\s*name|family\s*name|surname|\blname\b/, 'short'],
  ['email', /e\s*mail/, 'short'],
  ['phone', /phone|mobile|\btel\b|telephone|\bcell\b/, 'short'],
  ['yearsExperience', /years? of (professional |work |total |industry )?experience|how many years of experience/],
  ['requiresSponsorship', /sponsor/],
  ['workAuthorization', /authori[sz]ed to work|work authori[sz]ation|eligible to work|right to work|legally (authori[sz]ed|eligible)|work permit/],
  ['noticePeriod', /notice period|\bnotice\b/],
  ['expectedSalary', /salary|compensation|pay expectation|desired pay|expected pay/],
  ['willingToRelocate', /relocat/],
  ['currentCompany', /current (company|employer)|company name|\bemployer\b|current organi[sz]ation/, 'short'],
  ['currentTitle', /current (job )?title|job title|current (role|position)|\bheadline\b/, 'short'],
  ['school', /school|university|college|institution/, 'short'],
  ['degree', /\bdegree\b/, 'short'],
  ['city', /\bcity\b|\btown\b/, 'short'],
  ['country', /\bcountry\b/, 'short'],
  ['location', /\blocation\b|where are you (based|located)/, 'short'],
  ['fullName', /\bfull\s*name\b|\byour name\b|^name$|\bname\b/, 'short'],
];

const norm = (s: string) => tokenize(s).join(' ');

function haystack(f: FieldDescriptor): string {
  return [f.label, f.name, f.idAttr, f.placeholder]
    .join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-[\].]+/g, ' ')
    .toLowerCase();
}

export function keyFor(f: FieldDescriptor): ProfileKey | undefined {
  if (f.kind === 'file') {
    const hay = haystack(f);
    if (/cover/.test(hay)) return 'coverLetterFile';
    return 'resumeFile';
  }
  const auto = f.autocomplete.split(/\s+/).find((t) => AUTOCOMPLETE[t]);
  if (auto) return AUTOCOMPLETE[auto];

  const hay = haystack(f);
  for (const [key, re, scope] of RULES) {
    if (scope === 'short' && f.kind === 'textarea') continue;
    if (re.test(hay)) return key;
  }
  return undefined;
}

function link(links: string[], host: RegExp | null): string {
  return (
    links.find((l) => {
      const h = l.toLowerCase();
      return host ? host.test(h) : !/linkedin\.com|github\.com/.test(h);
    }) ?? ''
  );
}

export function profileValue(key: ProfileKey, ctx: AutofillContext): string {
  const { contact, experience, education } = ctx.profile;
  const names = contact.name.trim().split(/\s+/);
  const locParts = contact.location.split(',').map((s) => s.trim()).filter(Boolean);
  switch (key) {
    case 'firstName':
      return names[0] ?? '';
    case 'lastName':
      return names.length > 1 ? names.slice(1).join(' ') : '';
    case 'fullName':
      return contact.name.trim();
    case 'email':
      return contact.email;
    case 'phone':
      return contact.phone;
    case 'city':
      return locParts[0] ?? '';
    case 'country': {
      const last = locParts.length > 1 ? locParts[locParts.length - 1]! : '';
      // "Austin, TX": a two-letter region is not a country.
      return last.length > 2 ? last : '';
    }
    case 'location':
      return contact.location;
    case 'linkedin':
      return link(contact.links, /linkedin\.com/);
    case 'github':
      return link(contact.links, /github\.com/);
    case 'website':
      return link(contact.links, null);
    case 'currentCompany':
      return experience[0]?.company ?? '';
    case 'currentTitle':
      return experience[0]?.title ?? ctx.profile.headline;
    case 'yearsExperience':
      return experience.length ? String(Math.floor(totalYears(experience))) : '';
    case 'school':
      return education[0]?.institution ?? '';
    case 'degree':
      return [education[0]?.degree, education[0]?.field].filter(Boolean).join(', ');
    case 'workAuthorization':
    case 'requiresSponsorship':
    case 'noticePeriod':
    case 'expectedSalary':
    case 'willingToRelocate':
      return ctx.info[key];
    case 'coverLetterText':
      return ctx.coverLetterText;
    case 'resumeFile':
    case 'coverLetterFile':
      return '';
  }
}

const PLACEHOLDER_OPTION = /^(select|choose|please|--|—|-)/i;

/** Picks the option that best matches a value; null when nothing matches well. */
export function chooseOption(value: string, options: FieldOption[]): string | null {
  const opts = options.filter((o) => o.value !== '' && norm(o.label) && !PLACEHOLDER_OPTION.test(o.label.trim()));
  if (!value.trim() || opts.length === 0) return null;

  const yn = /^\s*(yes|y|true)\b/i.test(value) ? 'yes' : /^\s*(no|n|false)\b/i.test(value) ? 'no' : null;
  if (yn) {
    const o = opts.find((x) => new RegExp(`^(${yn === 'yes' ? 'yes|true' : 'no|false'})\\b`, 'i').test(x.label.trim()));
    if (o) return o.value;
  }

  const v = norm(value);
  const exact = opts.find((o) => norm(o.label) === v || norm(o.value) === v);
  if (exact) return exact.value;

  const vt = new Set(v.split(' '));
  let best: { o: FieldOption; score: number } | null = null;
  for (const o of opts) {
    const lt = new Set(norm(o.label).split(' '));
    const score = [...vt].filter((t) => lt.has(t)).length / vt.size;
    if (!best || score > best.score || (score === best.score && o.label.length < best.o.label.length)) best = { o, score };
  }
  return best && best.score >= 0.5 ? best.o.value : null;
}

const looksLikeQuestion = (label: string) => /\?\s*$/.test(label) || label.split(/\s+/).length >= 4;

export function withValue(m: MappedField, value: string): MappedField {
  const f = m.field;
  if (f.kind === 'select' || f.kind === 'radio') {
    const optionValue = chooseOption(value, f.options ?? []);
    if (optionValue === null) return { ...m, value, reason: `no option matches "${value}"`, askLlm: true };
    return { ...m, value, optionValue };
  }
  if (f.kind === 'checkbox') {
    if (/^\s*(yes|true|y)\b/i.test(value)) return { ...m, value: 'Yes', optionValue: 'true' };
    if (/^\s*(no|false|n)\b/i.test(value)) return { ...m, value: 'No', optionValue: 'false' };
    return { ...m, reason: 'check this box yourself' };
  }
  return { ...m, value };
}

export function mapField(field: FieldDescriptor, ctx: AutofillContext): MappedField {
  const hay = haystack(field);
  const saved = findSaved(field.label, ctx.qa);

  if (SENSITIVE.test(hay)) {
    const base: MappedField = { field, source: 'none', sensitive: true, saveable: true };
    if (!saved) return { ...base, reason: 'personal question; answer it yourself or save an answer' };
    return withValue({ ...base, source: 'saved' }, saved.answer);
  }

  const key = keyFor(field);
  if (key === 'resumeFile') {
    return ctx.hasResumeFile
      ? { field, source: 'profile', key, file: 'resume', value: 'Resume', saveable: false }
      : { field, source: 'none', key, saveable: false, reason: 'upload your resume in Profile' };
  }
  if (key === 'coverLetterFile') {
    return ctx.hasCoverLetter
      ? { field, source: 'profile', key, file: 'coverLetter', value: 'Cover letter', saveable: false }
      : { field, source: 'none', key, saveable: false, reason: 'generate a cover letter in the Letter tab' };
  }

  if (key) {
    const value = profileValue(key, ctx);
    if (value) {
      const m = withValue({ field, source: 'profile', key, saveable: false }, value);
      // The profile value doesn't fit this field's options, so a saved answer (or the user's) is better.
      if (m.askLlm) return saved ? withValue({ field, source: 'saved', key, saveable: true }, saved.answer) : { ...m, saveable: true };
      return m;
    }
    if (saved) return withValue({ field, source: 'saved', key, saveable: true }, saved.answer);
    return {
      field,
      source: 'none',
      key,
      saveable: true,
      reason: key === 'coverLetterText' ? 'generate a cover letter in the Letter tab' : `add your ${KEY_LABEL[key]} in Profile`,
    };
  }

  if (saved) return withValue({ field, source: 'saved', saveable: true }, saved.answer);
  if (field.kind === 'checkbox') return { field, source: 'none', saveable: true, reason: 'check this box yourself' };

  const askLlm =
    field.kind === 'textarea' ||
    field.kind === 'select' ||
    field.kind === 'radio' ||
    field.kind === 'contenteditable' ||
    looksLikeQuestion(field.label);
  return { field, source: 'none', saveable: true, askLlm, reason: askLlm ? 'no answer found' : 'unknown field' };
}
