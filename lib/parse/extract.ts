export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export type ResumeKind = 'pdf' | 'docx' | 'txt';

export function detectKind(file: { name: string; type: string }): ResumeKind | null {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx'))
    return 'docx';
  if (file.type === 'text/plain' || name.endsWith('.txt')) return 'txt';
  return null;
}

/** Collapses PDF/DOCX extraction noise so the LLM prompt stays small. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\t]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractResumeText(file: File): Promise<string> {
  if (file.size > MAX_RESUME_BYTES) throw new Error('File is larger than 5 MB.');
  const kind = detectKind(file);
  if (!kind) throw new Error('Unsupported file type. Upload a PDF, DOCX, or TXT resume.');

  const data = await file.arrayBuffer();
  let text: string;
  if (kind === 'pdf') {
    const { extractPdfText } = await import('./pdf');
    text = await extractPdfText(data);
  } else if (kind === 'docx') {
    const { extractDocxText } = await import('./docx');
    text = await extractDocxText(data);
  } else {
    text = new TextDecoder().decode(data);
  }

  text = normalizeText(text);
  if (text.length < 100) {
    throw new Error('Could not read text from this file. If it is a scanned PDF, upload a text-based PDF or DOCX.');
  }
  return text;
}
