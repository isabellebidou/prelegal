# Prelegal frontend

A Next.js prototype for creating a Mutual Non-Disclosure Agreement (Jira PL-3).
The user fills in the key terms in a form, sees the Common Paper Mutual NDA with
those terms filled in, and downloads the completed agreement as a PDF.

## How it works

- `src/lib/templates.ts` reads `../templates/Mutual-NDA-coverpage.md` and
  `../templates/Mutual-NDA.md` at build time, so the repository's templates are
  the single source of the agreement text.
- `src/lib/nda.ts` fills the cover page by replacing exact snippets of the
  template with the (markdown-escaped) form values. Empty values keep the
  template's placeholder. If the template changes and a snippet is no longer
  found, it throws, and the unit tests fail.
- `src/components/NdaDocument.tsx` renders the markdown with `react-markdown`
  (GFM + sanitized inline HTML).
- **Download PDF** opens the browser print dialog. Print styles hide the form,
  so choosing "Save as PDF" saves just the agreement, with the standard terms
  starting on a new page.

## Scripts

```bash
npm install
npm run dev     # http://localhost:3000
npm test          # Vitest unit tests (src/**/*.test.ts)
npm run test:e2e  # Playwright end-to-end tests (e2e/), against a production build on :3100
npm run lint
npm run build
```

First-time e2e setup: `npx playwright install chromium`.

CI (`.github/workflows/frontend.yml`) runs lint, unit tests, build and the
e2e tests on every PR that touches `frontend/` or `templates/`.

Run commands from this `frontend/` directory, because the templates are
resolved relative to it.
