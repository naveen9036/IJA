import type { Experience } from '../profile/schema';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Parses resume dates ("2021-03", "03/2021", "Mar 2021", "2021", "Present") into a month index. */
export function parseMonth(raw: string, edge: 'start' | 'end', now = new Date()): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/^(present|current|now|today|ongoing|till date|to date)$/.test(s)) return now.getFullYear() * 12 + now.getMonth();

  let m = s.match(/(\d{4})[-/.](\d{1,2})\b/);
  if (m) return Number(m[1]) * 12 + Number(m[2]) - 1;
  m = s.match(/\b(\d{1,2})[-/.](\d{4})/);
  if (m) return Number(m[2]) * 12 + Number(m[1]) - 1;
  m = s.match(/([a-z]{3})[a-z]*\.?\s*'?(\d{4})/);
  if (m && MONTHS.includes(m[1]!)) return Number(m[2]) * 12 + MONTHS.indexOf(m[1]!);
  m = s.match(/(\d{4})/);
  if (m) return Number(m[1]) * 12 + (edge === 'start' ? 0 : 11);
  return null;
}

/** Total years of experience, counting overlapping roles once. */
export function totalYears(experience: Experience[], now = new Date()): number {
  const intervals: [number, number][] = [];
  for (const e of experience) {
    const start = parseMonth(e.start, 'start', now);
    if (start === null) continue;
    // Missing end dates are counted as one year rather than guessed as current.
    const end = parseMonth(e.end, 'end', now) ?? start + 11;
    if (end >= start) intervals.push([start, end + 1]);
  }
  intervals.sort((a, b) => a[0] - b[0]);

  let months = 0;
  let cur: [number, number] | null = null;
  for (const iv of intervals) {
    if (cur && iv[0] <= cur[1]) cur[1] = Math.max(cur[1], iv[1]);
    else {
      if (cur) months += cur[1] - cur[0];
      cur = [...iv];
    }
  }
  if (cur) months += cur[1] - cur[0];
  return Math.round((months / 12) * 10) / 10;
}

const SENIORITY_YEARS: Record<string, number> = {
  intern: 0,
  entry: 0,
  junior: 1,
  mid: 3,
  senior: 5,
  manager: 5,
  lead: 7,
  staff: 7,
  principal: 9,
  director: 10,
};

/** Required years from the posting, or a typical value for its seniority. */
export function requiredYears(yearsExperience: number | null, seniority: string): { years: number; inferred: boolean } | null {
  if (yearsExperience !== null) return { years: yearsExperience, inferred: false };
  const key = Object.keys(SENIORITY_YEARS).find((k) => seniority.toLowerCase().includes(k));
  return key ? { years: SENIORITY_YEARS[key]!, inferred: true } : null;
}
