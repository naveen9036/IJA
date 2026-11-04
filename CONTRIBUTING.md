# Contributing to IJA

Thank you for contributing to **IJA – Intelligent Job Assistant**!

## Ground rules

- Use the product name **"IJA – Intelligent Job Assistant"** everywhere (UI text and manifest). Do not use "Job Application Assistant".
- LLM calls run only in the side panel, through `buildChain(await loadSettings())` — never in content scripts or the service worker.
- API keys never leave extension pages.
- Every LLM output is validated with a Zod schema.
- Generated resumes, cover letters, and autofill values must never invent facts — code checks against the profile and the user reviews before use.
- Never auto-submit forms or click page buttons. Skip sensitive EEO fields (gender, race, veteran, disability) unless the user saved an answer.
- `permissions.request` must be the first `await` in a click handler (user-gesture rule).
- No remote code: bundle WASM, fonts, and workers locally.
- Keep comments to one short line, only where the code can't explain itself.

## Development workflow

```bash
# 1. Install
npm install

# 2. Create a feature branch from feature/ija-complete-implementation
git checkout -b my-feature feature/ija-complete-implementation

# 3. Make changes, then verify
npm run compile
npm test

# 4. Commit with a conventional message
git commit -m "feat(scope): description"

# 5. Push and open a pull request
git push -u origin my-feature
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | WXT dev server |
| `npm run build` | Production extension build |
| `npm run compile` | TypeScript type check (`tsc --noEmit`) |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E tests (needs Chrome for Testing) |

## Conventional commit messages

Use `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, or `test:` prefixes.

Example: `feat(score): add experience component weighting`

## Documentation

If you add user-facing behaviour, update `README.md`. If you change internals, update the relevant file under `docs/` and keep `IMPLEMENTATION_PLAN.md` phase status in sync.

## Code style

- TypeScript strict mode; the WXT tsconfig enables `noUncheckedIndexedAccess`.
- Tailwind CSS 4 — define custom classes with `@utility` in `entrypoints/sidepanel/style.css`.
- Prefer native selects and semantic HTML; icons from `lucide-react`.
