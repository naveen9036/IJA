import { Document, Page, pdf, StyleSheet, Text, View, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import type { ResumeDoc } from '../resume/schema';
import { contactLine, educationLine, resumeSections, roleLine, SECTION_TITLES, type SectionKey } from './layout';

// Built-in Helvetica only: no font files are fetched.
const s = StyleSheet.create({
  page: { padding: 43, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.35, color: '#111' },
  name: { fontFamily: 'Helvetica-Bold', fontSize: 18, textAlign: 'center' },
  center: { textAlign: 'center' },
  contact: { textAlign: 'center', fontSize: 9, color: '#333', marginBottom: 4 },
  heading: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginTop: 10,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 0.75,
    borderBottomColor: '#999',
  },
  entryTitle: { fontFamily: 'Helvetica-Bold', marginTop: 6 },
  meta: { fontFamily: 'Helvetica-Oblique', color: '#555' },
  bulletRow: { flexDirection: 'row', marginLeft: 8, marginTop: 1 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1 },
});

const Bullet = ({ text }: { text: string }) => (
  <View style={s.bulletRow} wrap={false}>
    <Text style={s.bulletDot}>•</Text>
    <Text style={s.bulletText}>{text}</Text>
  </View>
);

const Entry = ({ title, meta }: { title: string; meta: string }) => (
  <View wrap={false}>
    <Text style={s.entryTitle}>{title}</Text>
    {meta ? <Text style={s.meta}>{meta}</Text> : null}
  </View>
);

function Section({ k, doc }: { k: SectionKey; doc: ResumeDoc }) {
  switch (k) {
    case 'summary':
      return <Text>{doc.summary}</Text>;
    case 'skills':
      return <Text>{doc.skills.join(', ')}</Text>;
    case 'experience':
      return (
        <>
          {doc.experience.map((e, i) => {
            const r = roleLine(e);
            return (
              <View key={i}>
                <Entry title={r.title} meta={r.meta} />
                {e.bullets.map((b, j) => (
                  <Bullet key={j} text={b} />
                ))}
              </View>
            );
          })}
        </>
      );
    case 'projects':
      return (
        <>
          {doc.projects.map((p, i) => (
            <View key={i}>
              <Entry title={p.name} meta={p.tech.join(', ')} />
              {p.description ? <Text>{p.description}</Text> : null}
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
          {doc.education.map((e, i) => {
            const r = educationLine(e);
            return <Entry key={i} title={r.title} meta={r.meta} />;
          })}
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
  }
}

export function ResumePdf({ doc }: { doc: ResumeDoc }): ReactElement<DocumentProps> {
  return (
    <Document title={`${doc.contact.name} - Resume`} author={doc.contact.name}>
      <Page size="LETTER" style={s.page}>
        <Text style={s.name}>{doc.contact.name}</Text>
        {doc.headline ? <Text style={s.center}>{doc.headline}</Text> : null}
        <Text style={s.contact}>{contactLine(doc.contact)}</Text>
        {resumeSections(doc).map((k) => (
          <View key={k}>
            <Text style={s.heading}>{SECTION_TITLES[k].toUpperCase()}</Text>
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
