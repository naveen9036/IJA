export type ExtractSource = 'selection' | 'adapter' | 'jsonld' | 'readability' | 'heuristic';

export interface JobHints {
  title?: string;
  company?: string;
  location?: string;
}

export interface Candidate {
  source: ExtractSource;
  text: string;
  hints: JobHints;
  score: number;
  adapter?: string;
}

export interface FrameResult {
  url: string;
  pageTitle: string;
  isTop: boolean;
  candidates: Candidate[];
}
