import { Font } from '@react-pdf/renderer';
import { THEME } from './layout';

// Without this, react-pdf splits words with hyphens ("architec-ture") at line ends.
Font.registerHyphenationCallback((word) => [word]);

export const PDF_COLORS = { accent: `#${THEME.accent}`, text: `#${THEME.text}`, muted: `#${THEME.muted}` };
