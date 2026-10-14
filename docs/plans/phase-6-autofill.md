# Phase 6: Form Autofill (any site)

**Goal:** With one click, fill the application form on the current page (including iframes and open shadow DOM) from the profile, saved answers, and the generated documents. Highlight what was filled and what needs review. Never submit the form.

**Prerequisites:** Phases 4–5 are complete (`documents`, `currentJobId`).

**Read first:** `lib/job/capture.ts` (permission and injection pattern), `entrypoints/extract.content.ts`, `lib/profile/schema.ts` (`ApplicationInfo`), `lib/db.ts`, `lib/score/text.ts`.

**New dependencies:** none.

## Design

The fill runs in two passes, without messaging listeners:

1. **Detect:** inject `/content-scripts/autofill.js` into all frames. It defines `globalThis.__ija = { detect, fill, collect }` in the extension's isolated world and returns `detect()`, a `FrameFields` value.
2. **Map** (in the side panel): turn the fields into values, using pure functions and at most one batched LLM call.
3. **Fill:** run `browser.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, func: (plan) => globalThis.__ija.fill(plan), args: [plan] })` for each frame. Results come back as `FillResult[]`.

`args` must be JSON-serializable, so send the resume file as a base64 string. Profile data only ever goes to the isolated world, never the page's main world.

## Steps

- [x] **1. Types:** `lib/autofill/types.ts`
  - `FieldDescriptor { id; kind: 'text' | 'email' | 'tel' | 'url' | 'number' | 'date' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file' | 'contenteditable'; label; name; idAttr; autocomplete; placeholder; required; options?: { value; label }[]; accept?; maxLength?; currentValue }`.
  - `FrameFields { frameUrl; fields: FieldDescriptor[] }`.
  - `FillPlan { items: { id; value?: string; optionValue?: string; checked?: boolean; file?: { name; type; base64 } }[] }`.
  - `FillResult { id; status: 'filled' | 'skipped' | 'failed'; reason? }`.

- [x] **2. Detection:** `lib/autofill/detect.ts` (runs in the page; must work in jsdom)
  - Walk `document` and every open `shadowRoot`, recursively.
  - Include `input` (excluding hidden, submit, button, reset, image, password, search), `textarea`, `select`, `[contenteditable=true]`.
  - Group radios by `name` into one field.
  - Skip invisible elements: `getClientRects().length === 0`, `display:none`, `visibility:hidden`, or `aria-hidden` on an ancestor. In jsdom, check only the style attributes.
  - Find each field's label, in this order: `label[for]`, wrapping `<label>`, `aria-labelledby`, `aria-label`, fieldset `legend` (for radios), preceding sibling or parent text (40 characters or less), `placeholder`, then a humanized `name`/`id`.
  - Give each element `data-ija-id="f<n>"`. `id` is that value.

- [x] **3. Field mapping:** `lib/autofill/map.ts` (pure)
  - `ProfileKey`:
    - name and contact: `firstName`, `lastName`, `fullName`, `email`, `phone`, `city`, `country`, `location`
    - links: `linkedin`, `github`, `website`
    - current job: `currentCompany`, `currentTitle`, `yearsExperience`
    - education: `school`, `degree`
    - from `ApplicationInfo`: `workAuthorization`, `requiresSponsorship`, `noticePeriod`, `expectedSalary`, `willingToRelocate`
    - files: `resumeFile`, `coverLetterFile`, `coverLetterText`
  - Match in this order:
    1. `autocomplete` token (`given-name`, `family-name`, `name`, `email`, `tel`, `address-level2`, `country-name`, `organization`, `organization-title`, `url`)
    2. a regex table over `label` + `name` + `idAttr` + `placeholder`, most specific first (e.g. `/linked\s?in/` before `/url|website/`; `/first\s*name|given/` before `/name/`)
  - Values:
    - split `contact.name` into first and last
    - pick LinkedIn/GitHub/website from `contact.links` by host
    - current role is `experience[0]`
    - `yearsExperience` is `Math.floor(totalYears())`
  - Select and radio values go through `chooseOption(value, options)`: compare normalized labels; for yes/no questions, map Yes/No/True/False; pick the best token overlap; return `null` below 0.5.
  - **Sensitive fields:** labels matching gender, race, ethnicity, veteran, disability, sexual orientation, pronoun, or age/date of birth become `skip: 'sensitive'` unless a saved answer exists (step 5).
  - Files:
    - The resume `<input type=file>` gets the tailored resume PDF if it exists, otherwise the original upload.
    - A cover letter file input gets the cover letter PDF.
    - Text fields labelled "cover letter" get the letter text.

- [x] **4. LLM fallback:** `lib/autofill/answer.ts`
  - Unmapped `textarea` fields, text fields that look like questions, and unmapped selects/radios go into **one** batched `completeJson` call.
  - Input: the questions with their options, the profile, the job title and company, and saved answers.
  - Rules:
    - Answer only from the profile.
    - For options, return an exact option value or `null`.
    - Return `null` when unsure.
    - At most 120 words per free-text answer.
    - Never answer sensitive questions.
  - Schema: `{ answers: { id: string; value: string | null }[] }`.

- [x] **5. Saved answers**
  - Add `db.version(4)` with `qa: '++id, &key'`, `{ key, question, answer, updatedAt }`.
  - The `key` is the normalized question (lowercase, punctuation removed, `stem`med tokens joined).
  - Lookup: exact key first, then token Jaccard ≥ 0.8.
  - Saved answers take priority over the LLM.

- [x] **6. Filling:** `lib/autofill/fill.ts` (runs in the page)
  - Text, textarea, and number fields:
    - use the native setter: `Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')!.set!.call(el, v)`
    - then dispatch `input` and `change` (both `bubbles: true`) and `blur`
  - `select`: set the value, dispatch `change`. Radio and checkbox: `click()` only if the state differs.
  - `contenteditable`: `focus()`, `document.execCommand('insertText', false, v)`; if that fails, set `textContent` and dispatch `input`.
  - File:
    - decode the base64 into a `File`
    - create a `DataTransfer`, `items.add(file)`, set `input.files = dt.files`
    - dispatch `input` and `change`
    - skip if `accept` excludes the type
  - Don't overwrite non-empty fields unless `plan.overwrite`.
  - Highlight with inline `outline: 2px solid #16a34a` (filled) or `#f59e0b` (needs review), plus `data-ija-status`. Remove the outline on the next user `input`.
  - Never call `form.submit()`, `requestSubmit()`, or click buttons.
  - `collect(ids)` returns the current values (used by "Save answers").

- [x] **7. Content script:** `entrypoints/autofill.content.ts`
  - `registration: 'runtime'`, `matches: []`.
  - `main()` sets `globalThis.__ija`, but only once per frame, and returns `{ frameUrl, fields: detect() }`.

- [x] **8. Orchestrator:** `lib/autofill/run.ts`
  - `detectTab(tabId)`: `executeScript({ allFrames: true, files })` returns `{ frameId, result }[]`.
  - `buildPlans(frames, profile, docs, qa, chain)`: map the fields, then make one LLM call for leftovers.
  - `fillTab(tabId, plans)`: run `executeScript` with `func` and `args` for each frame.
  - Return a summary `{ filled, review: { label, value }[], skipped: { label, reason }[] }`.

- [x] **9. Apply tab:** `entrypoints/sidepanel/AutofillView.tsx`, added after Letter in `TABS`
  - **Autofill this page**: `requestSiteAccess()` must be the first `await`.
  - Show counts. The "Needs review" list has a **Copy** button per value (for custom dropdowns that couldn't be filled). The "Skipped" list shows reasons.
  - **Fill again** (for the next step of multi-step forms), **Overwrite filled fields** checkbox.
  - **Save my answers for next time**: calls `collect` on question-type fields and writes to `qa`.
  - Note shown at the bottom: "IJA never submits forms. Review everything before you submit."

- [x] **10. Fixtures:** `tests/fixtures/forms/`
  - `basic.html`: labels, a select, radios, a file input, and a sensitive select.
  - `react-like.html`: inline script for controlled inputs that ignore `.value =` without an `input` event.
  - `shadow.html`: a custom element with an open shadow root containing fields.
  - `iframe-host.html`: embeds `basic.html` from another origin.
  - Every form has a `submit` listener that sets `window.__submitted = true`.

- [x] **11. Unit tests:** `tests/unit/autofill.test.ts` (jsdom)
  - Label resolution for each strategy.
  - Shadow DOM detection.
  - Mapping table (first/last name, LinkedIn vs website, sponsorship yes/no to options).
  - `chooseOption` edge cases.
  - Sensitive fields are skipped.
  - QA lookup (exact match and Jaccard match).

- [x] **12. E2E test:** `tests/e2e/autofill.spec.ts`
  - Serve the fixtures with `context.route`.
  - Check:
    - all of `basic.html` is filled
    - the React-like form keeps its values after `blur`
    - shadow fields are filled
    - iframe fields are filled
    - `input.files[0].name` ends with `.pdf`
    - the sensitive select is still empty
    - `window.__submitted` is falsy
  - Then: change one free-text answer, click **Save my answers**, reload, autofill again. The saved answer is used and the LLM mock gets no question.

## Verification

```bash
npm run compile && npm test && npm run test:e2e && npm run build
```

Then try it by hand on a real Greenhouse or Lever application page. Don't submit.

## Out of scope

Workday's custom widgets and site-specific combobox drivers (Phase 7), CAPTCHA, auto-navigation between form steps.

## Notes

- Step 1: Added `FillItem.review` (outline only), a `FillResult` status of `'marked'`, and a `PageApi` type for `globalThis.__ija`.
- Step 2: The page-side code is split into `detect.ts`, `fill.ts`, and `page.ts`. `createPageApi(doc)` keeps one element registry per frame, so `fill` and `collect` find the elements `detect` tagged.
  - Radios use the group label (`legend`, `role=radiogroup` label, or text before the group) before the option's own `<label>`.
  - Preceding-text labels allow up to 300 characters, not 40, because real questions are long.
- Step 3:
  - Text fields: a profile value that doesn't match a field's options (e.g. "EU citizen" for a Yes/No question) falls back to a saved answer, then to the LLM.
  - Checkboxes are only set from a saved Yes/No answer.
  - `yearsExperience` only matches general "years of (professional/work/total) experience" questions; skill-specific ones go to the LLM.
  - `country` is filled only when the last part of the location is longer than two letters (so "Austin, TX" doesn't fill "TX").
- Step 4: Question ids are `${frameId}:${fieldId}` because field ids repeat across frames. At most 30 questions are sent. If no provider is set up, or the call fails, the fill still runs and those fields are listed for review.
- Step 8: The tailored resume PDF is rebuilt at fill time from the saved document; otherwise the original upload is used. "Skipped" includes sensitive fields and fields that already had a value.
- Step 9: The tab is called **Apply**. The header wraps so six tabs fit.
- Step 12: Content scripts run in an isolated world, so a page's own `.value` overrides don't see the extension's writes. The React-like fixture therefore checks the page's state object after the `input`/`blur` events, which is what frameworks rely on.
- Manual check still to do: a real Greenhouse or Lever application page (don't submit).

