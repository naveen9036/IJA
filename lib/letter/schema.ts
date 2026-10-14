import { z } from 'zod';

const str = () => z.string().nullish().transform((v) => (v ?? '').trim());

export const CoverLetterSchema = z.object({
  salutation: str(),
  paragraphs: z
    .array(z.string())
    .nullish()
    .transform((v) => (v ?? []).map((s) => s.trim()).filter(Boolean)),
  closing: str(),
});

export type CoverLetter = z.output<typeof CoverLetterSchema>;

export type LetterTone = 'professional' | 'warm' | 'concise';
export type LetterLength = 'short' | 'standard' | 'long';

export interface LetterOptions {
  tone: LetterTone;
  length: LetterLength;
  notes: string;
}

export const TARGET_WORDS: Record<LetterLength, number> = { short: 150, standard: 250, long: 350 };

export const defaultLetterOptions = (): LetterOptions => ({ tone: 'professional', length: 'standard', notes: '' });

export interface LetterContent {
  letter: CoverLetter;
  options: LetterOptions;
}

export const wordCount = (paragraphs: string[]) => paragraphs.join(' ').split(/\s+/).filter(Boolean).length;

/** Plain-text version for the clipboard. */
export function letterText(l: CoverLetter, name: string): string {
  return [l.salutation, ...l.paragraphs, [l.closing || 'Sincerely,', name].filter(Boolean).join('\n')]
    .filter(Boolean)
    .join('\n\n');
}
