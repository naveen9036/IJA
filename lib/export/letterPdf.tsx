import { Document, Page, pdf, StyleSheet, Text, View, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import { letterBlocks, type LetterRenderInput } from './letterLayout';
import { PDF_COLORS } from './pdfTheme';

const s = StyleSheet.create({
  page: { padding: 54, fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.45, color: PDF_COLORS.text },
  name: { fontFamily: 'Helvetica-Bold', fontSize: 18, lineHeight: 1.2, color: PDF_COLORS.accent },
  contact: { fontSize: 9.5, color: PDF_COLORS.muted, marginBottom: 18, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: PDF_COLORS.accent },
  block: { marginBottom: 12 },
  recipient: { marginBottom: 12 },
});

export function LetterPdf({ input }: { input: LetterRenderInput }): ReactElement<DocumentProps> {
  const b = letterBlocks(input);
  return (
    <Document title={`${b.name} - Cover Letter`} author={b.name}>
      <Page size="LETTER" style={s.page}>
        <Text style={s.name}>{b.name}</Text>
        <Text style={s.contact}>{b.contact}</Text>
        <Text style={s.block}>{b.date}</Text>
        {b.recipient.length > 0 && (
          <View style={s.recipient}>
            {b.recipient.map((r, i) => (
              <Text key={i}>{r}</Text>
            ))}
          </View>
        )}
        <Text style={s.block}>{b.salutation}</Text>
        {b.paragraphs.map((p, i) => (
          <Text key={i} style={s.block}>
            {p}
          </Text>
        ))}
        <Text>{b.closing}</Text>
        <Text>{b.name}</Text>
      </Page>
    </Document>
  );
}

export function buildLetterPdf(input: LetterRenderInput): Promise<Blob> {
  return pdf(<LetterPdf input={input} />).toBlob();
}
