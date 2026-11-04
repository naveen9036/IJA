# Phase 8: Release of IJA – Intelligent Job Assistant (Chrome Web Store)

**Goal:** Ship a store-ready build with a clear privacy story and the minimum permissions.

**Prerequisite:** Phase 7 is complete and CI passes.

## Steps

- [ ] **1. Icons:** Already done: `public/icon/16|32|48|128.png`, rendered from `assets/icon.svg`. Still to do: 1280×800 store screenshots of the Job, Resume, and Apply tabs, using made-up profile data.
- [ ] **2. Manifest review**
  - Already done: the rename in `wxt.config.ts` (`name: 'IJA – Intelligent Job Assistant'`, `short_name: 'IJA'`, matching `action.default_title`) and in `package.json`. Check the description is 132 characters or less.
  - Check the built `manifest.json`.
  - Permissions are exactly `storage`, `activeTab`, `scripting`, `sidePanel`; host permissions are only the AI provider endpoints; `optional_host_permissions: ['<all_urls>']`.
  - No `<all_urls>` in `host_permissions` (that is E2E builds only).
  - Bump `version` in `package.json`.
- [ ] **3. Privacy policy:** `PRIVACY.md`, also published at a public URL
  - Data is stored only in the browser (IndexedDB and `chrome.storage.local`).
  - What is sent to which AI provider, and when: resume text when parsing; job page text when analyzing; profile and job when writing the resume, letter, or form answers.
  - Free tiers may use data for training, and the user must agree in Settings.
  - No analytics, no own servers, no data sale.
  - "Delete all data" removes everything.
- [ ] **4. Store listing text**
  - Listing name: **IJA – Intelligent Job Assistant**. Before submitting, search the Web Store for "IJA" to make sure no other extension uses the name.
  - Short description (132 characters or less) and full description.
  - A justification for each permission:
    - `activeTab`/`scripting`: read the job page and fill forms when the user clicks
    - `sidePanel`: the UI
    - `storage`: local data
    - optional all-sites access: job pages and forms live on any domain
    - provider hosts: AI calls the user configured
  - Limited Use disclosure for user data.
- [ ] **5. Clean-profile test**
  - Fresh Chrome profile: install from `npm run zip` output (`.output/*.zip`).
  - Run the full flow with a real free Gemini key: upload resume, analyze a LinkedIn job, score, tailored resume, cover letter, autofill on Greenhouse (don't submit), delete all data.
- [ ] **6. Submit**
  - Upload the zip as **Unlisted** first. Fix any review feedback, then make it Public.
  - Tag the release in git.

## Verification

- `npm run zip` produces a zip under 10 MB.
- The manifest check from step 2 passes.
- The clean-profile run completes with no console errors (check `chrome://extensions` > Errors).

## Notes

