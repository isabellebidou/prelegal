# Prelegal frontend

The Next.js frontend, built as static files (`out/`) that the FastAPI backend
serves. `/` is the landing page: sign in, create an account, or continue as a
guest. `/create/` is the document creator for all 11 Common Paper
documents in `../catalog.json` (`/nda/` redirects there): the user chats with
the AI or edits fields, sees the agreement filled in, and downloads it as a PDF.

## How it works

- `../templates/documents.json` is the document registry shared with the
  backend: each document's name, parties, template and key-term fields.
  `src/lib/templates.ts` reads it and every template at build time.
- The Mutual NDA has dedicated fields and cover page: `src/lib/nda.ts` fills
  `Mutual-NDA-coverpage.md` by replacing exact snippets (it throws if the
  template changes). Its terms take a length in months or years.
- Every other document's cover page is rendered by `CoverPage.tsx` from its
  registry fields. `src/lib/coverLayouts.ts` gives the Cloud Service Agreement
  and Pilot Agreement dedicated layouts; the rest list their key terms.
- `src/components/Chat.tsx` is the AI chat. Each message sends the whole
  conversation, the document type (null until chosen) and its fields to
  `POST /api/chat/message`; the backend picks the document type, asks OpenAI
  (Structured Outputs) and returns a reply, the type and the updated fields.
  The "Edit fields" tab picks the type and edits the same fields by hand.
- `isComplete` in `src/lib/documents.ts` decides when every required field is
  filled; only then is **Download PDF** shown.
- Accounts: `AuthProvider.tsx` holds the signed-in user (the session is an
  HttpOnly cookie). Guests can draft and download; **Save** opens the sign-in
  dialog first. Saved documents keep their fields and chat conversation and
  are listed in **My documents** (`DocumentsModal.tsx`).
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
