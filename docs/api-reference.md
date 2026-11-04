# API reference — IJA internals

This is an internal reference for the extension's TypeScript modules. It is not a public web API.

## `lib/db.ts` — IndexedDB (Dexie)

`db` instance with tables `profile`, `jobs`, `documents`, `qa`.

```ts
export interface ProfileRecord {
  id: 'me';
  data: ProfileData;
  applicationInfo: ApplicationInfo;
  rawText: string;
  resumeFile?: Blob;
  resumeFileName?: string;
  version: number;
  updatedAt: number;
}
export interface JobRecord {
  id: string;          // normalized job URL key
  url: string;
  pageTitle: string;
  source: ExtractSource;
  adapter?: string;
  hints: JobHints;
  text: string;
  textHash: string;
  analysis: JobAnalysis;
  provider: string;
  capturedAt: number;
}
export const documentId = (jobId: string, type: 'resume' | 'coverLetter') => `${jobId}:${type}`;
export async function getProfile(): Promise<ProfileRecord | undefined>
export async function saveProfile(update: Omit<ProfileRecord,'id'|'version'|'updatedAt'>): Promise<ProfileRecord>
export async function getDocument<T>(jobId, type): Promise<DocumentRecord<T> | undefined>
export async function saveDocument<T>(record: DocumentRecord<T>): Promise<void>
export async function deleteAllData(): Promise<void>
```

## `lib/settings.ts` — LLM provider settings

```ts
export type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'ollama';
export interface ProviderConfig { id, enabled, apiKey, model, backupModel }
export interface Settings { providers: ProviderConfig[]; cloudConsent: boolean }

export async function loadSettings(): Promise<Settings>
export async function saveSettings(settings: Settings): Promise<void>
export function buildChain(settings: Settings): FallbackChain   // usable providers only
export function isUsable(p: ProviderConfig, cloudConsent: boolean): boolean
```

Default order: Gemini → Groq → OpenRouter → Ollama.

## `lib/llm/fallback.ts` — `FallbackChain`

Runs providers in order; retries HTTP 5xx/network with backoff, then falls back. Throws `AllProvidersFailedError` when every provider fails.

```ts
export class FallbackChain {
  complete(req, signal?): Promise<string>        // plain text
  completeJson<T>(schema, req, signal?): Promise<T>  // Zod-validated JSON, one retry
}
```

## `lib/score/score.ts` — deterministic matching

```ts
export interface MatchResult {
  score: number;           // 0..100
  label: string;           // Weak / Partial / Good / Strong match
  components: ComponentScore[];   // skills, keywords, experience, title, logistics
  mustHave: RequirementMatch[];
  niceToHave: RequirementMatch[];
  missingKeywords: string[];
  warnings: string[];
  summary: string;
}
export function scoreMatch(profile, job): MatchResult
export const WEIGHTS = { skills: 40, keywords: 25, experience: 20, title: 10, logistics: 5 }
export function scoreLabel(score: number): string
```

## `lib/autofill/run.ts` — form autofill

```ts
export interface AutofillSummary {
  filled: SummaryRow[];
  review: SummaryRow[];
  skipped: SummaryRow[];
  runs: FrameRun[];
}
export async function autofillTab(tabId, { jobId, overwrite, signal }): Promise<AutofillSummary>
export async function detectTab(tabId): Promise<{ frameId; fields }[]>
export async function saveAnswers(tabId, runs): Promise<number>
```

Never auto-submits; sensitive fields skipped unless a saved answer exists.

## `lib/export/` — document export

```ts
// resumePdf.tsx / letterPdf.tsx
export async function buildResumePdf(content): Promise<Blob>
export async function buildLetterPdf({ letter, contact, company, location }): Promise<Blob>
// resumeDocx.ts / letterDocx.ts
export async function buildResumeDocx(content): Promise<Blob>
export async function buildLetterDocx(...): Promise<Blob>
```

Renderers are loaded with dynamic `import()` (they run only in the side panel).

## Content scripts

- `entrypoints/extract.content.ts` — injected into all frames of the active tab; returns `extractFrame(document, window)`.
- `entrypoints/autofill.content.ts` — exposes `globalThis.__ija` (detect/fill/collect API) on the page.

## Testing

- Unit: `tests/unit/**` — Vitest, jsdom for DOM code.
- E2E: `tests/e2e/**` — Playwright; mocks LLM routes, uses `fixtures.ts` + `helpers.ts` (`mockGemini`, `openPanelFor`, `uploadProfile`).
