# Phase 7: Hardening

**Goal:** Make the extension reliable on real sites and failure modes. Add real-page fixtures, Workday support, clear error states, and CI.

**Prerequisite:** Phases 0–6 are complete.

**Read first:** `lib/extract/*`, `lib/llm/*`, `lib/autofill/*`, `tests/e2e/fixtures.ts`.

## Steps

- [ ] **1. Real-page fixtures**
  - Save real job pages (File > Save Page As > "Webpage, HTML only") from LinkedIn, Greenhouse, Lever, Workday, Indeed, and two company career sites, into `tests/fixtures/real/`.
  - Remove personal data and tracking scripts first.
  - Add one test case per page to `tests/unit/extract.test.ts` that checks the source, the title hint, and one requirement sentence.
  - Fix adapter selectors where they fail.
  - Done when 20 or more fixtures pass.

- [ ] **2. Workday adapter**
  - Extraction: `[data-automation-id="jobPostingHeader"]`, `[data-automation-id="jobPostingDescription"]`, and the location attribute.
  - Autofill: map the `data-automation-id` values Workday uses for name, email, phone, and address fields.
  - Custom dropdowns (`button[aria-haspopup=listbox]`): open, find the option by text, click it, all inside `fill.ts` behind a `workday` flag. Add a fixture modelled on the saved page.

- [ ] **3. LLM error handling:** `lib/llm/*`
  - Clear messages for:
    - no consent
    - no usable provider
    - all providers rate-limited (include `Retry-After` if present)
    - invalid key
    - offline (`TypeError: Failed to fetch`)
  - Show provider status in Settings (last error and when it happened).

- [ ] **4. Token budget**
  - Central limits in `lib/llm/limits.ts`: JD 12k, resume 30k, tailor 8k JD, letter 6k JD.
  - Truncate at paragraph boundaries.
  - Unit test that every prompt builder respects the limits.

- [ ] **5. Performance**
  - Put a 1.5-second time limit on `extractHeuristic` and stop with the best result so far. Skip elements over 60k characters (already done).
  - Measure on the largest real fixture; target under 300 ms in jsdom.

- [ ] **6. Optional: Chrome built-in AI provider:** `lib/llm/chromeAI.ts`
  - Use the Prompt API (`LanguageModel.availability()` / `create()`) for job analysis only.
  - Hide it when unavailable. Write the feature check so it can be tested; mock it in unit tests.

- [ ] **7. Accessibility**
  - All buttons have names, focus is visible, the score color is never the only signal (the label text is shown), and form inputs have labels.
  - Add `@axe-core/playwright` to one E2E test.

- [ ] **8. Dependency audit**
  - `npm audit --omit=dev`. Record accepted issues and the reason under Notes (current one: mammoth → argparse → sprintf-js, used only by mammoth's CLI).

- [ ] **9. CI:** `.github/workflows/ci.yml`
  - `runs-on: bby-ubuntu`.
  - Use the npm registry `https://artifactory.tools.bestbuy.com/artifactory/api/npm/npm-virtual`.
  - Steps:
    1. `npm ci`
    2. `npm run compile`
    3. `npm test`
    4. `npx playwright install chromium`
    5. `xvfb-run npm run test:e2e`, with `CHROMIUM_PATH` set to Playwright's Chromium (it supports `--load-extension`)
  - Upload `test-results/` when the run fails.

## Verification

```bash
npm run compile && npm test && npm run test:e2e && npm run build
```

CI must pass on a pull request.

## Notes

