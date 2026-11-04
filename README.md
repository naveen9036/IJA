# IJA – Intelligent Job Assistant

<p align="center">
  <b>A free, local-first Chrome extension that scores job fit, writes tailored resumes and cover letters, and autofills application forms.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-MV3-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Chrome MV3" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vitest-7E328B?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/Playwright-E71D37?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" />
</p>

---

## What is IJA?

**IJA – Intelligent Job Assistant** is a Chrome (Manifest V3) side-panel extension for job seekers. Upload your resume once, then on any job page IJA:

1. **Scores** how well you match the job.
2. **Writes** a tailored resume (DOCX + PDF).
3. **Writes** a cover letter (DOCX + PDF).
4. **Fills** the application form with one click — it never submits.

Everything runs free (free-tier cloud LLMs or local models), and your data stays in your browser (IndexedDB). No backend is required.

## Status

All code lives on `main`. The `feature/ija-complete-implementation` branch contains the same implementation history.

| Branch | Contents |
|--------|----------|
| `main` | Full implementation: job match scoring, tailored resume & cover letter, form autofill, unit + E2E tests, build config, and documentation. |
| `feature/ija-complete-implementation` | Same implementation as `main` (development branch). |

## Prerequisites

- **Node.js** ≥ 18 (recommended ≥ 20)
- **npm** (comes with Node)
- **Google Chrome** (to load the unpacked extension)
- An API key for at least one LLM provider (Gemini, Groq, or OpenRouter), or **Ollama** running locally for a fully private setup.

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/naveen9036/IJA.git
cd IJA
```

### 2. Install dependencies

```bash
npm install
```

### 3. Verify the code compiles

```bash
npm run compile
```

### 4. Build the extension

```bash
npm run build
```

This outputs the extension to `.output/chrome-mv3`.

### 5. Load into Chrome

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (toggle at top right).
3. Click **Load unpacked** and select the `.output/chrome-mv3` folder.
4. Pin the IJA icon to your toolbar — clicking it opens the side panel.


## How it works

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│  Job page   │◄────►│ Content script   │◄─────┤ Background  │
│  (any site) │ inject │ extract/autofill│     │ service worker│
└─────────────┘      └──────────────────┘      └──────┬──────┘
                                                       │ chrome.scripting
                                                       ▼
                                              ┌──────────────────┐
                                              │ Side panel (UI)  │
                                              │ React + IndexedDB│
                                              └────────┬────────┘
                                                       │ LLM calls only here
                                                       ▼
                                              ┌──────────────────┐
                                              │ Free LLM (Gemini │
                                              │ /Groq/Ollama…)   │
                                              └──────────────────┘
```

1. **Profile** — upload your résumé (PDF/DOCX/TXT); it's parsed and stored locally.
2. **Job** — open a job page, click the IJA icon, then **Analyze**. IJA extracts the job description and scores the match.
3. **Résumé / Letter** — generate tailored documents, review the fabrication checks, then download DOCX or PDF.
4. **Apply** — autofill the form on the current page; review every field before it's filled.
5. **Settings** — pick your LLM provider, add API keys, and consent to cloud calls.

## How to use

1. **Profile** tab — upload your resume (PDF/DOCX/TXT) and review the extracted profile (skills, experience, education, contact info). You can edit it anytime.
2. **Job** tab — open a job page, click the IJA icon, then click **Analyze**. IJA reads the page, extracts the job description, and shows a match score with matched/missing skills.
3. **Resume** tab — generate a tailored resume for the current job, review the diff/fabrication warnings, then download as DOCX or PDF.
4. **Letter** tab — generate a cover letter the same way, then download as DOCX or PDF.
5. **Apply** tab — autofill the application form on the current page. Review each field before it is filled; IJA never auto-submits.
6. **Settings** tab — choose your LLM provider (Gemini, Groq, OpenRouter, or local Ollama), enter API keys, and give consent for cloud calls.

## Features

## Features

- **Works on any job page** — generic extraction pipeline (JSON-LD, Readability, heuristics) plus dedicated LinkedIn, Greenhouse, and Lever adapters.
- **Deterministic match scoring** — skills (40%), keywords (25%), experience (20%), title (10%), logistics (5%). No LLM call needed for scoring, so it's instant and repeatable.
- **No invented facts** — generated resumes and cover letters are verified against your profile; you review diff/warnings before downloading.
- **Safe autofill** — never auto-submits forms, never clicks page buttons, and skips sensitive EEO fields (gender, race, veteran, disability) unless you saved an answer.
- **File attachments** — autofill can attach your generated résumé or cover letter PDF to file inputs.
- **Local-first** — profile, jobs, documents, and saved answers live in IndexedDB. One-click **"Delete all data"** in Settings.
- **Free LLM strategy** — Google Gemini (default, free tier) with automatic fallback to Groq → OpenRouter → Ollama on rate limits or failures.
- **Privacy by design** — API keys live in `chrome.storage.local` and are used only inside extension pages. They never reach web pages or content scripts.

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

## LLM providers & API keys

Default provider is **Google Gemini free tier** (`gemini-3.8-flash`). Before the first cloud call you must accept consent: free-tier prompts may be used by the provider to improve their models.

| Provider | Type | Endpoint | Default model | Notes |
|----------|------|----------|---------------|-------|
| **Gemini** | Cloud (free tier) | `generativelanguage.googleapis.com` | `gemini-3.8-flash` | Default; requires consent |
| **Groq** | Cloud (free tier) | `api.groq.com` | `openai/gpt-oss-120b` | Fast; OpenAI-compatible |
| **OpenRouter** | Cloud (free models) | `openrouter.ai` | `:free` models | Pick models ending in `:free` |
| **Ollama** | Local (private) | `http://localhost:11434` | any local model | Start with `OLLAMA_ORIGINS=chrome-extension://*` |

- API keys are stored in `chrome.storage.local` and used only inside the side panel.
- They are **never** sent to web pages or content scripts.
- Automatic fallback chains to the next provider on rate limits (`429`) or failures.

## Privacy & security

- **Local-first**: your profile, jobs, documents, and answers live in IndexedDB in your browser. Nothing is sent to a backend.
- **No remote code**: all assets (fonts, WASM, workers) are bundled locally.
- **CSP**: `script-src 'self' 'wasm-unsafe-eval'` (needed by react-pdf); no `'unsafe-eval'`.
- **Minimal permissions**: `storage`, `activeTab`, `scripting`, plus optional `<all_urls>` site access requested on first Analyze click.
- **Delete all data**: one button in Settings wipes IndexedDB completely.

## Testing

```bash
# Unit tests (Vitest)
npm test

# Type check
npm run compile

# End-to-end tests (Playwright; needs Chrome for Testing)
npm run test:e2e
```

Unit tests live in `tests/unit/`; E2E tests live in `tests/e2e/` with shared fixtures in `tests/fixtures/`.

## Roadmap (phases)

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Setup: WXT scaffold, side panel, Settings, Dexie DB, Gemini + OpenAI-compatible clients | ✅ Done |
| 1 | Profile: upload, parse, structured extraction, editable form | ✅ Done |
| 2 | JD extraction: generic pipeline + LinkedIn/Greenhouse/Lever adapters | ✅ Done |
| 3 | Scoring: skill normalization, weighted score, UI | ✅ Done |
| 4 | Tailored résumé: generation, fabrication check, diff view, DOCX + PDF | ✅ Done |
| 5 | Cover letter: generation, editing, DOCX + PDF | ✅ Done |
| 6 | Autofill: detect, map, fill, file attach, iframes, QA memory | ✅ Done |
| 7 | Hardening: Workday adapter, rate-limit handling, error states, E2E | ✅ Done |
| 8 | Release: privacy policy, Chrome Web Store listing, limited-use disclosure | 📋 Planned |

See `docs/plans/` for step-by-step phase plans and `IMPLEMENTATION_PLAN.md` for the full product plan.

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

Quick summary:
- Use the product name **"IJA – Intelligent Job Assistant"** everywhere.
- LLM calls run only in the side panel — never in content scripts or the service worker.
- Never auto-submit forms or click page buttons.
- Every LLM output is validated with a Zod schema.
- Keep comments minimal; only where the code can't explain itself.

## Deployment

See [docs/deployment.md](./docs/deployment.md) for the full Chrome Web Store publishing checklist.

Quick build:

```bash
npm run compile && npm test && npm run build && npm run zip
```

Upload the resulting `.zip` to the [Chrome Web Store Developer Dashboard](https://chromewebstore.google.com/devconsole/).

## License

Private project — all rights reserved.

## Support

- Issues & feature requests: open a GitHub issue in this repository.
- Documentation: see `docs/` for architecture, API reference, and deployment guides.

---

<p align="center">
  Built with ❤️ for job seekers. <br>
  <b>IJA – Intelligent Job Assistant</b>
</p>
