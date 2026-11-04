# Deployment — Chrome Web Store

IJA is a Chrome Manifest V3 side-panel extension.

## Build for production

```bash
npm install
npm run compile      # type check must pass
npm test             # unit tests must pass
npm run build        # -> .output/chrome-mv3
npm run zip          # -> .zip (upload to Chrome Web Store)
```

Load unpacked for local testing:
1. `chrome://extensions` → Developer mode → Load unpacked → select `.output/chrome-mv3`.

## Manifest highlights (`wxt.config.ts`)

- Permissions: `storage`, `activeTab`, `scripting`.
- Optional host permission: `<all_urls>` (requested on first Analyze click).
- Host permissions (declared): Gemini, Groq, OpenRouter, Ollama (`localhost:11434`). E2E builds add `<all_urls>`.
- CSP: `script-src 'self' 'wasm-unsafe-eval'` (react-pdf WASM); no `'unsafe-eval'`.
- `action.default_title`: "IJA – Intelligent Job Assistant".

## Publishing checklist

1. Create the `.zip` with `npm run zip`.
2. Go to the [Chrome Web Store Developer Dashboard](https://chromewebstore.google.com/devconsole/) → Add new item → upload the zip.
3. Fill in listing:
   - Name: `IJA – Intelligent Job Assistant`
   - Description: match score, tailored resume, cover letter, and form autofill for any job page.
   - Category: Productivity.
   - Screenshots of the side panel (Job, Resume, Letter, Apply, Profile, Settings tabs).
4. Privacy: data stays in IndexedDB locally; no backend. Link a privacy policy explaining that cloud LLM calls use the user's chosen provider and that free tiers may use prompts for training (user consents in Settings).
5. Publish as unlisted first, then public after review.

## Versioning

Bump `version` in `package.json` / manifest before each store upload.
