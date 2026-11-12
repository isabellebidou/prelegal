# Prelegal frontend

The Next.js frontend, built as static files (`out/`) that the FastAPI backend
serves. `/` is a placeholder sign-in screen (no authentication yet: any name and
email continue). `/nda/` is the Mutual NDA creator: the user fills in the key
terms, sees the Common Paper Mutual NDA filled in, and downloads it as a PDF.

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
- `src/components/Chat.tsx` is the AI chat. Each message sends the whole
  conversation and the current fields to `POST /api/chat/message`; the backend
  asks OpenAI (Structured Outputs) and returns a reply plus the updated fields.
  The "Edit fields" tab (`NdaForm.tsx`) edits the same fields by hand.
- `isComplete` in `src/lib/nda.ts` decides when every required field (all
  except modifications) is filled; only then is **Download PDF** shown.
- **Download PDF** opens the browser print dialog. Print styles hide the form,
  so choosing "Save as PDF" saves just the agreement, with the standard terms
  starting on a new page.

## Scripts

```bash
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev  # http://localhost:3000, API on :8000
npm test          # Vitest unit tests (src/**/*.test.ts)
npm run test:e2e  # Playwright end-to-end tests (e2e/), served by the backend on :3100
npm run lint
npm run build
```

First-time e2e setup: `npx playwright install chromium`. The e2e tests start the
backend, so they also need [uv](https://docs.astral.sh/uv/).

CI (`.github/workflows/frontend.yml`) runs lint, unit tests, build and the
e2e tests on every PR that touches `frontend/`, `backend/` or `templates/`.

Run commands from this `frontend/` directory, because the templates are
resolved relative to it.
