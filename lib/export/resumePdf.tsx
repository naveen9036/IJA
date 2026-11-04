import { Document, Page, pdf, StyleSheet, Text, View, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import type { ResumeDoc } from '../resume/schema';
import {
  contactLines,
  educationLine,
  resumeSections,
  roleLine,
  SECTION_TITLES,
  skillLines,
  type EntryLine,
  type SectionKey,
} from './layout';
import { PDF_COLORS } from './pdfTheme';

// Built-in Helvetica only: no font files are fetched.
const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 42,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.35,
    color: PDF_COLORS.text,
  },
  name: { fontFamily: 'Helvetica-Bold', fontSize: 20, lineHeight: 1.15, textAlign: 'center', color: PDF_COLORS.accent },
  headline: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, textAlign: 'center', marginTop: 3 },
  contact: { fontSize: 9.5, textAlign: 'center', color: PDF_COLORS.muted, marginTop: 1 },
  heading: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: PDF_COLORS.accent,
    letterSpacing: 0.4,
    marginTop: 12,
    marginBottom: 5,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.accent,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 6 },
  rowMain: { flex: 1, paddingRight: 8 },
  bold: { fontFamily: 'Helvetica-Bold' },
  dates: { fontFamily: 'Helvetica-Oblique', color: PDF_COLORS.muted },
  tech: { fontFamily: 'Helvetica-Oblique', fontSize: 9.5, color: PDF_COLORS.muted, marginTop: 1 },
  techLabel: { fontFamily: 'Helvetica-BoldOblique' },
  skillLine: { marginBottom: 2 },
  bulletRow: { flexDirection: 'row', marginTop: 2, paddingLeft: 6 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1 },
});

const Bullet = ({ text }: { text: string }) => (
  <View style={s.bulletRow} wrap={false}>
    <Text style={s.bulletDot}>•</Text>
    <Text style={s.bulletText}>{text}</Text>
  </View>
);

const Entry = ({ line }: { line: EntryLine }) => (
  <View style={s.row} wrap={false}>
    <Text style={s.rowMain}>
      <Text style={s.bold}>{line.title}</Text>
      {line.org ? `${line.title ? '  |  ' : ''}${line.org}` : ''}
    </Text>
    {line.dates ? <Text style={s.dates}>{line.dates}</Text> : null}
  </View>
);

const Tech = ({ items }: { items: string[] }) =>
  items.length ? (
    <Text style={s.tech}>
      <Text style={s.techLabel}>Technologies: </Text>
      {items.join(', ')}
    </Text>
  ) : null;

function Section({ k, doc }: { k: SectionKey; doc: ResumeDoc }) {
  switch (k) {
    case 'summary':
      return <Text>{doc.summary}</Text>;
    case 'skills':
      return (
        <>
          {skillLines(doc).map((l, i) => (
            <Text key={i} style={s.skillLine}>
              {l.label ? <Text style={s.bold}>{`${l.label}: `}</Text> : null}
              {l.items.join(', ')}
            </Text>
          ))}
        </>
      );
    case 'experience':
      return (
        <>
          {doc.experience.map((e, i) => (
            <View key={i}>
              <Entry line={roleLine(e)} />
              <Tech items={e.tech} />
              {e.bullets.map((b, j) => (
                <Bullet key={j} text={b} />
              ))}
            </View>
          ))}
        </>
      );
    case 'projects':
      return (
        <>
          {doc.projects.map((p, i) => (
            <View key={i}>
              <Entry line={{ title: p.name, org: '', dates: '' }} />
              <Tech items={p.tech} />
              {p.description ? <Text style={{ marginTop: 1 }}>{p.description}</Text> : null}
              {p.bullets.map((b, j) => (
                <Bullet key={j} text={b} />
              ))}
            </View>
          ))}
        </>
      );
    case 'education':
      return (
        <>
          {doc.education.map((e, i) => (
            <Entry key={i} line={educationLine(e)} />
          ))}
        </>
      );
    case 'certifications':
      return (
        <>
          {doc.certifications.map((c, i) => (
            <Bullet key={i} text={c} />
          ))}
        </>
      );
    case 'languages':
      return <Text>{doc.languages.join(', ')}</Text>;
  }
}

export function ResumePdf({ doc }: { doc: ResumeDoc }): ReactElement<DocumentProps> {
  return (
    <Document title={`${doc.contact.name} - Resume`} author={doc.contact.name}>
      <Page size="LETTER" style={s.page}>
        <Text style={s.name}>{doc.contact.name}</Text>
        {doc.headline ? <Text style={s.headline}>{doc.headline}</Text> : null}
        {contactLines(doc.contact).map((line, i) => (
          <Text key={i} style={s.contact}>
            {line}
          </Text>
        ))}
        {resumeSections(doc).map((k) => (
          <View key={k}>
            <Text style={s.heading} minPresenceAhead={40}>
              {SECTION_TITLES[k].toUpperCase()}
            </Text>
            <Section k={k} doc={doc} />
          </View>
        ))}
      </Page>
    </Document>
  );
}

export function buildResumePdf(doc: ResumeDoc): Promise<Blob> {
  return pdf(<ResumePdf doc={doc} />).toBlob();
}
