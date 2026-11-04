# IJA – Intelligent Job Assistant

**IJA** is a Chrome (Manifest V3) side-panel extension for job seekers. Upload your resume once, then on any job page IJA:

1. **Scores** how well you match the job.
2. **Writes** a tailored resume (DOCX + PDF).
3. **Writes** a cover letter (DOCX + PDF).
4. **Fills** the application form with one click — it never submits.

Everything runs free (free-tier cloud LLMs or local models), and your data stays in your browser (IndexedDB). No backend is required.

## Status

| Branch | Contents |
|--------|----------|
| `feature/ija-complete-implementation` | Full implementation: job match scoring, tailored resume & cover letter, form autofill, unit + E2E tests, build config. |
| `main` | Intentionally empty — all code lives on the feature branch above. |

## Quick start

```bash
# Install dependencies
npm install

# Type check
npm run compile

# Run unit tests
npm test

# Build the extension (output -> .output/chrome-mv3)
npm run build
```

Load the extension:
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `.output/chrome-mv3` folder.
4. Pin the IJA icon to your toolbar. Clicking it opens the side panel.

## How to use

1. **Profile** tab — upload your resume (PDF/DOCX/TXT) and review the extracted profile (skills, experience, education, contact info). You can edit it anytime.
2. **Job** tab — open a job page, click the IJA icon, then click **Analyze**. IJA reads the page, extracts the job description, and shows a match score with matched/missing skills.
3. **Resume** tab — generate a tailored resume for the current job, review the diff/fabrication warnings, then download as DOCX or PDF.
4. **Letter** tab — generate a cover letter the same way, then download as DOCX or PDF.
5. **Apply** tab — autofill the application form on the current page. Review each field before it is filled; IJA never auto-submits.
6. **Settings** tab — choose your LLM provider (Gemini, Groq, OpenRouter, or local Ollama), enter API keys, and give consent for cloud calls.

## Features

- **Any job page:** generic extraction pipeline (JSON-LD, Readability, heuristics) plus LinkedIn/Greenhouse/Lever adapters.
- **Deterministic scoring:** skill, keyword, experience, title, and logistics components — no LLM call required for scoring.
- **No invented facts:** generated resumes and letters are checked against your profile; you review before downloading.
- **Safe autofill:** never auto-submits, never fills sensitive EEO fields unless you saved an answer; file attachments (resume/cover letter) supported.
- **Local-first:** profile, jobs, and documents live in IndexedDB. One-click "Delete all data" in Settings.
- **Free LLM strategy:** Gemini (default, free tier) with automatic fallback to Groq → OpenRouter → Ollama on rate limits or failures.

## Tech stack

| Layer | Tech |
|-------|------|
| Extension framework | [WXT](https://wxt.dev) (Manifest V3) |
| UI | React 19 + Tailwind CSS 4 + lucide-react |
| Local database | Dexie (IndexedDB) |
| Parsing | pdf.js, mammoth (DOCX) |
| Export | docx (DOCX), @react-pdf/renderer (PDF) |
| Testing | Vitest (unit) + Playwright (E2E) |
| Language | TypeScript |

## Repository layout

```
IJA/
  entrypoints/
    background.ts           # service worker: opens side panel on toolbar click
    sidepanel/              # React UI (Job, Resume, Letter, Apply, Profile, Settings)
    extract.content.ts      # JD extraction (injected on demand)
    autofill.content.ts     # form detection API (injected on demand)
  lib/
    db.ts                   # Dexie schema: profile, jobs, documents, qa
    settings.ts             # LLM provider config + fallback chain
    llm/                    # Gemini + OpenAI-compatible providers + fallback chain
    extract/                # job description extraction pipeline
    job/                    # job capture + analysis
    score/                  # deterministic match scoring
    resume/                 # tailoring + fabrication verification
    letter/                 # cover letter writing + verification
    autofill/               # detect, map, answer, fill orchestration
    export/                 # shared layout, DOCX + PDF renderers, downloads
    parse/                  # resume PDF/DOCX/TXT reading + structuring
  tests/
    unit/                   # Vitest unit tests
    e2e/                    # Playwright end-to-end tests
  docs/
    plans/                  # phase-by-phase implementation plans
  wxt.config.ts             # extension manifest config
  package.json
```

## LLM providers & privacy

Default provider is **Google Gemini free tier** (`gemini-3.8-flash`). Before the first cloud call you must accept consent: free-tier prompts may be used by the provider to improve their models.

Available providers:
- **Gemini** (cloud, free tier) — `generativelanguage.googleapis.com`
- **Groq** (cloud, free tier) — OpenAI-compatible
- **OpenRouter** (cloud, free `:free` models)
- **Ollama** (local, private) — `http://localhost:11434` (start with `OLLAMA_ORIGINS=chrome-extension://*`)

API keys are stored in `chrome.storage.local` and only used inside extension pages (side panel). They are never sent to web pages or content scripts.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start WXT dev server |
| `npm run build` | Production build → `.output/chrome-mv3` |
| `npm run zip` | Create `.zip` for Chrome Web Store submission |
| `npm run compile` | `tsc --noEmit` type check |
| `npm test` | Run Vitest unit tests |
| `npm run test:e2e` | Build E2E variant + run Playwright |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Private project — all rights reserved.

---

For the technical design, see [docs/architecture.md](./docs/architecture.md). For publishing to the Chrome Web Store, see [docs/deployment.md](./docs/deployment.md).
