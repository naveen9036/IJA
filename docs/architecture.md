# Architecture — IJA – Intelligent Job Assistant

IJA is a Chrome Manifest V3 side-panel extension. It runs entirely in the extension boundary; no backend is required.

## Data flow

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  Job page   │◄────►│ Content script│◄─────┤ Service worker │
│  (any site) │  inject │ extract/autofill│     (background.ts)  │
└─────────────┘      └──────────────┘      └──────┬────────┘
                                                 │ chrome.scripting
                                                 ▼
                                      ┌──────────────────┐
                                      │  Side panel (UI) │
                                      │  React + IndexedDB│
                                      └────────┬─────────┘
                                               │ LLM calls only here
                                               ▼
                                      ┌──────────────────┐
                                      │  Free LLM (Gemini│
                                      │  /Groq/Ollama…)  │
                                      └──────────────────┘
```

- **Service worker (`entrypoints/background.ts`)**: opens the side panel on toolbar click. Does not make LLM calls.
- **Content scripts** (`extract.content.ts`, `autofill.content.ts`): injected on demand via `chrome.scripting.executeScript` when the user clicks Analyze/Apply. They never run on page load.
- **Side panel (React)**: holds the UI tabs, makes LLM calls, builds DOCX/PDF exports, reads/writes IndexedDB.

## Storage

Dexie (IndexedDB), database `ija`, version 4:

| Table | Purpose |
|-------|---------|
| `profile` | Parsed + editable resume profile (`id: 'me'`) |
| `jobs` | Captured job descriptions + analyses |
| `documents` | Generated resume/cover letter content per job |
| `qa` | Saved autofill answers for reuse |

Add tables with a new `db.version(n)` — never edit old versions.

## LLM boundary

- Providers: Gemini (default), Groq, OpenRouter, Ollama (local).
- `lib/settings.ts`: `buildChain()` builds a `FallbackChain` over usable providers in order, with per-provider backup models and automatic fallback on HTTP 429/5xx/network errors.
- All LLM output passes through Zod schemas (`completeJson`).
- `lib/llm/provider.ts`: `REQUEST_TIMEOUT_MS = 120_000`.
- Cloud calls require user consent (`cloudConsent`). Local-only path: Ollama.

## Core modules

- `lib/extract/` — job description extraction pipeline (selection, JSON-LD, Readability, heuristic, `pickBest`), plus site adapters.
- `lib/job/capture.ts` — requests site access (`activeTab`/`<all_urls>` on first Analyze click), injects the extractor, caches by URL + text hash.
- `lib/score/score.ts` — deterministic match score (skills 40, keywords 25, experience 20, title 10, logistics 5). No LLM call.
- `lib/resume/tailor.ts` + `verify.ts` — LLM tailoring with fabrication guard against the profile.
- `lib/letter/write.ts` + `verify.ts` — cover letter generation + verification.
- `lib/autofill/run.ts` — detect → map → (optional LLM answers) → fill. Builds resume/cover letter PDFs for file inputs.
- `lib/export/` — shared layout, DOCX (`docx`) and PDF (`@react-pdf/renderer`) renderers, downloaded via dynamic `import()`.

## Security & permissions

Permissions: `storage`, `activeTab`, `scripting`. Optional host permission `<all_urls>` requested on first Analyze click (site access). Content Security Policy allows `script-src 'self' 'wasm-unsafe-eval'` (react-pdf WASM) — no `'unsafe-eval'`.

## Build & load

```
npm run build        # -> .output/chrome-mv3
npm run zip          # -> .zip for Chrome Web Store
```

Load `.output/chrome-mv3` as an unpacked extension in `chrome://extensions` (Developer mode).
