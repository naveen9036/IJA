import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import { letterBlocks, type LetterRenderInput } from './letterLayout';

export async function buildLetterDocx(input: LetterRenderInput): Promise<Blob> {
  const b = letterBlocks(input);
  const para = (text: string, after = 200) => new Paragraph({ text, spacing: { after } });

  const children = [
    new Paragraph({ children: [new TextRun({ text: b.name, bold: true, size: 32 })], alignment: AlignmentType.LEFT }),
    new Paragraph({ children: [new TextRun({ text: b.contact, size: 19, color: '444444' })], spacing: { after: 300 } }),
    para(b.date, 300),
    ...b.recipient.map((r, i) => para(r, i === b.recipient.length - 1 ? 300 : 0)),
    para(b.salutation),
    ...b.paragraphs.map((p) => para(p)),
    para(b.closing, 0),
    para(b.name, 0),
  ];

  const document = new Document({
    creator: b.name,
    title: `${b.name} - Cover Letter`,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } }, children }],
  });
  return Packer.toBlob(document);
}
