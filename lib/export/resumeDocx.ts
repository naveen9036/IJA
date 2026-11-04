import { AlignmentType, BorderStyle, Document, LevelFormat, Packer, Paragraph, Tab, TabStopType, TextRun } from 'docx';
import type { ResumeDoc } from '../resume/schema';
import {
  contactLines,
  educationLine,
  resumeSections,
  roleLine,
  SECTION_TITLES,
  skillLines,
  THEME,
  type EntryLine,
  type SectionKey,
} from './layout';

const BULLETS = 'ija-bullets';
// US Letter width (12240 twips) minus 0.6" margins on both sides.
const MARGIN = 864;
const RIGHT_EDGE = 12240 - 2 * MARGIN;

const heading = (text: string) =>
  new Paragraph({
    keepNext: true,
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: THEME.accent, characterSpacing: 8 })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: THEME.accent, space: 1 } },
    spacing: { before: 240, after: 100 },
  });

const bullet = (text: string) =>
  new Paragraph({ children: [new TextRun(text)], numbering: { reference: BULLETS, level: 0 }, spacing: { after: 30 } });

/** Title | org on the left, dates right-aligned on the same line. */
const entry = (line: EntryLine) =>
  new Paragraph({
    keepNext: true,
    tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_EDGE }],
    spacing: { before: 120, after: 20 },
    children: [
      new TextRun({ text: line.title, bold: true }),
      ...(line.org ? [new TextRun({ text: `${line.title ? '  |  ' : ''}${line.org}` })] : []),
      ...(line.dates ? [new TextRun({ children: [new Tab(), line.dates], italics: true, color: THEME.muted })] : []),
    ],
  });

const tech = (items: string[]) =>
  items.length
    ? [
        new Paragraph({
          keepNext: true,
          spacing: { after: 30 },
          children: [
            new TextRun({ text: 'Technologies: ', bold: true, italics: true, size: 19, color: THEME.muted }),
            new TextRun({ text: items.join(', '), italics: true, size: 19, color: THEME.muted }),
          ],
        }),
      ]
    : [];

function section(key: SectionKey, doc: ResumeDoc): Paragraph[] {
  switch (key) {
    case 'summary':
      return [new Paragraph({ children: [new TextRun(doc.summary)], alignment: AlignmentType.JUSTIFIED })];
    case 'skills':
      return skillLines(doc).map(
        (l) =>
          new Paragraph({
            spacing: { after: 40 },
            children: [...(l.label ? [new TextRun({ text: `${l.label}: `, bold: true })] : []), new TextRun(l.items.join(', '))],
          }),
      );
    case 'experience':
      return doc.experience.flatMap((e) => [entry(roleLine(e)), ...tech(e.tech), ...e.bullets.map(bullet)]);
    case 'projects':
      return doc.projects.flatMap((p) => [
        entry({ title: p.name, org: '', dates: '' }),
        ...tech(p.tech),
        ...(p.description ? [new Paragraph({ children: [new TextRun(p.description)], spacing: { after: 30 } })] : []),
        ...p.bullets.map(bullet),
      ]);
    case 'education':
      return doc.education.map((e) => entry(educationLine(e)));
    case 'certifications':
      return doc.certifications.map(bullet);
    case 'languages':
      return [new Paragraph({ children: [new TextRun(doc.languages.join(', '))] })];
  }
}

export async function buildResumeDocx(doc: ResumeDoc): Promise<Blob> {
  const children = [
    new Paragraph({
      children: [new TextRun({ text: doc.contact.name, bold: true, size: 40, color: THEME.accent })],
      alignment: AlignmentType.CENTER,
    }),
    ...(doc.headline
      ? [
          new Paragraph({
            children: [new TextRun({ text: doc.headline, bold: true, size: 21 })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 40 },
          }),
        ]
      : []),
    ...contactLines(doc.contact).map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line, size: 19, color: THEME.muted })],
          alignment: AlignmentType.CENTER,
        }),
    ),
    ...resumeSections(doc).flatMap((key) => [heading(SECTION_TITLES[key]), ...section(key, doc)]),
  ];

  const document = new Document({
    creator: doc.contact.name,
    title: `${doc.contact.name} - Resume`,
    styles: { default: { document: { run: { font: 'Calibri', size: 21, color: THEME.text } } } },
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
              style: { paragraph: { indent: { left: 360, hanging: 240 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 720, right: MARGIN, bottom: 720, left: MARGIN } },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(document);
}
