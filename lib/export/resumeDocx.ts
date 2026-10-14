import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import type { ResumeDoc } from '../resume/schema';
import { contactLine, educationLine, resumeSections, roleLine, SECTION_TITLES, type SectionKey } from './layout';

const BULLETS = 'ija-bullets';

const heading = (text: string) =>
  new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22 })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } },
    spacing: { before: 200, after: 80 },
  });

const bullet = (text: string) => new Paragraph({ text, numbering: { reference: BULLETS, level: 0 }, spacing: { after: 20 } });

const entry = (title: string, meta: string) => [
  new Paragraph({ children: [new TextRun({ text: title, bold: true })], spacing: { before: 120 } }),
  ...(meta ? [new Paragraph({ children: [new TextRun({ text: meta, italics: true, color: '555555' })] })] : []),
];

function section(key: SectionKey, doc: ResumeDoc): Paragraph[] {
  switch (key) {
    case 'summary':
      return [new Paragraph({ text: doc.summary })];
    case 'skills':
      return [new Paragraph({ text: doc.skills.join(', ') })];
    case 'experience':
      return doc.experience.flatMap((e) => {
        const r = roleLine(e);
        return [...entry(r.title, r.meta), ...e.bullets.map(bullet)];
      });
    case 'projects':
      return doc.projects.flatMap((p) => [
        ...entry(p.name, p.tech.join(', ')),
        ...(p.description ? [new Paragraph({ text: p.description })] : []),
        ...p.bullets.map(bullet),
      ]);
    case 'education':
      return doc.education.flatMap((e) => {
        const r = educationLine(e);
        return entry(r.title, r.meta);
      });
    case 'certifications':
      return doc.certifications.map(bullet);
  }
}

export async function buildResumeDocx(doc: ResumeDoc): Promise<Blob> {
  const children = [
    new Paragraph({
      children: [new TextRun({ text: doc.contact.name, bold: true, size: 36 })],
      alignment: AlignmentType.CENTER,
    }),
    ...(doc.headline ? [new Paragraph({ text: doc.headline, alignment: AlignmentType.CENTER })] : []),
    new Paragraph({
      children: [new TextRun({ text: contactLine(doc.contact), size: 19 })],
      alignment: AlignmentType.CENTER,
    }),
    ...resumeSections(doc).flatMap((key) => [heading(SECTION_TITLES[key]), ...section(key, doc)]),
  ];

  const document = new Document({
    creator: doc.contact.name,
    title: `${doc.contact.name} - Resume`,
    styles: { default: { document: { run: { font: 'Calibri', size: 21 } } } },
    numbering: {
      config: [
        {
          reference: BULLETS,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [{ properties: { page: { margin: { top: 864, right: 864, bottom: 864, left: 864 } } }, children }],
  });
  return Packer.toBlob(document);
}
