/** Lowercases and splits into tokens; keeps tech symbols like c++, c#, node.js. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);
}

/** Space-padded normalized text, so phrases can be matched with includes(` ${phrase} `). */
export function normalizeForMatch(text: string): string {
  return ` ${tokenize(text).join(' ')} `;
}

export function containsPhrase(normalizedText: string, phrase: string): boolean {
  const p = tokenize(phrase).join(' ');
  return !!p && normalizedText.includes(` ${p} `);
}

export const stem = (t: string) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);

const FILLER = new Set(
  `a an the and or of in on at to for with using use via into from by as is are be
  experience experienced years year yrs yr plus least minimum min max strong solid proven excellent good great deep
  hands-on hands knowledge proficiency proficient familiarity familiar understanding ability able skills skill
  working work background track record expertise expert advanced basic preferred required requirement must nice
  have having including such similar related equivalent etc other modern relevant demonstrated professional
  practical prior previous industry production environment environments level degree`.split(/\s+/),
);

/** Words that carry meaning in a requirement after dropping filler and numbers. */
export function contentTokens(text: string): string[] {
  return tokenize(text).filter((t) => !FILLER.has(t) && !/^\d+\+?$/.test(t));
}

const SOFT = new Set(
  `communication communicator written verbal english interpersonal teamwork team player collaboration collaborative
  problem solving solver analytical thinking critical detail oriented attention self motivated starter driven
  organized organizational time management multitasking adaptable flexible fast paced passionate passion curious
  eager learn learner ownership initiative positive attitude independently independent stakeholder presentation`.split(/\s+/),
);

/** True for items like "Excellent communication skills" that a resume can't confirm or deny. */
export function isSoftSkill(text: string): boolean {
  const tokens = contentTokens(text);
  return tokens.length > 0 && tokens.every((t) => SOFT.has(t));
}
