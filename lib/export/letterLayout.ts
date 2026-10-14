import type { CoverLetter } from '../letter/schema';
import type { ProfileData } from '../profile/schema';
import { contactLine } from './layout';

export interface LetterRenderInput {
  letter: CoverLetter;
  contact: ProfileData['contact'];
  company: string;
  location: string;
  date?: Date;
}

/** Lines shared by the DOCX and PDF letter renderers, top to bottom. */
export function letterBlocks(input: LetterRenderInput) {
  const { letter, contact } = input;
  return {
    name: contact.name,
    contact: contactLine(contact),
    date: (input.date ?? new Date()).toLocaleDateString(undefined, { dateStyle: 'long' }),
    recipient: [input.company, input.location].filter(Boolean),
    salutation: letter.salutation,
    paragraphs: letter.paragraphs,
    closing: letter.closing || 'Sincerely,',
  };
}
