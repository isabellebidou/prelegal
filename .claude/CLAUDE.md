# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation (PL-7) drafts all 11 document types via AI chat. The app is the home page at / (the only landing page). Anyone can draft and download as a guest; the sign-in / create-account dialog only appears from the header Sign in button or from Save.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use OpenAI. An OPENAI_API_KEY is in .env in the project root
Use `gpt-4o-mini` as the model. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.


## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
Consider statically building the frontend and serving it via FastAPI, if that will work.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

## Implementation Status

### Completed (PL-4)
- Docker multi-stage build (Node frontend + Python backend)
- FastAPI backend with SQLite (fresh DB each container start)
- Next.js static export served by FastAPI at localhost:8000
- SQLite users table (no auth endpoints yet); GET /api/health
- Fake sign-in screen at / (no authentication); NDA creator at /nda (now redirects to /)
- Start/stop scripts for Mac, Linux, Windows
- Mutual NDA form with live preview and PDF download

### Completed (PL-5)
- AI chat interface for NDA creation, with an "Edit fields" tab to edit the same fields by hand
- Use OpenAI for the AI calls. An OPENAI_API_KEY is in .env in the project root
- Use `gpt-4o-mini` as the model
- Structured outputs for reliable field extraction from conversation
- Live preview updates as AI extracts fields from chat
- AI greets user, asks questions conversationally, and confirms when complete
- Download button appears when all required fields are gathered (everything except modifications)
- Stateless chat: POST /api/chat/message takes the conversation + current fields, returns reply + fields

### Completed (PL-6, PR #6)
- Support for all 11 document types from catalog.json
- AI detects document type from user requests and routes accordingly
- Dedicated cover pages for Mutual NDA (fills Mutual-NDA-coverpage.md), Cloud Service Agreement and Pilot Agreement (layouts in frontend/src/lib/coverLayouts.ts)
- Generic key-terms cover page for the remaining documents (Design Partner, SLA, Professional Services, Partnership, Software License, DPA, BAA, AI Addendum); all render standard terms below and download as PDF
- Auto-focus chat input after sending messages
- AI always asks follow-on questions when more information is needed
- Unsupported document requests get the closest supported document offered instead
- Document registry in templates/documents.json, shared by backend and frontend
- Single creator page (now at /; /create and /nda redirect there); "Edit fields" tab has a document type picker
- NDA terms (MNDA term and term of confidentiality) take a length in months or years; fractional years display as months (1.5 years -> 18 months)
- One Structured Outputs schema per document type, built from the registry (backend/src/backend/documents.py)
- Backend clears placeholder company names the model invents (e.g. "Your Company")

### Completed (PL-7, PR #8)
- Functional user authentication with JWT tokens in HttpOnly cookies (secret per server start unless JWT_SECRET is set; SECURE_COOKIES=1 adds the Secure flag)
- User signup and signin with email/password (bcrypt password hashing)
- Guests can draft and download; Save asks guests to sign in or create an account in a dialog, then saves
- Document persistence - users can save documents (fields + chat conversation) to their account
- My Documents modal to view, load, and delete saved documents; reopening restores the chat
- User menu with sign out functionality
- New Document button to start fresh (asks before discarding unsaved changes)
- Auth context for managing user state across the app
- Protected document save/load endpoints, scoped to the signed-in user
- Disclaimer: banner in the app and a "Draft: subject to legal review" line printed on every document
- UI polish with the brand colour scheme: header bar, welcome preview, dialogs
- One landing page: / is the app; no separate sign-in page (/create and /nda redirect to /)
- Fixed: SQLite connection now usable across FastAPI worker threads (check_same_thread=False)

### Known issues
- The AI fills in the effective date on its first turn without asking (seen 6/6 in live runs, once with the wrong year). Prompting alone did not stop it; fix in the backend (drop dates the user never gave).
- Jira PL-8 ("sign up and sign in screen") was closed as a duplicate of PL-7.

### Planned (PL-9): Deployment, auto-deploy on push to main

Target architecture (cheap, minimal code change):
- **Frontend on AWS Amplify Hosting**: the Next.js static export (frontend/out). Amplify's GitHub connection builds and deploys on every push to main.
- **Backend on Railway**: the existing Dockerfile (FastAPI). Railway's GitHub integration redeploys on every push to main. Amplify cannot run the Python backend.
- **Database: SQLite on a Railway volume** (no extra cost). One replica only. Move to Railway Postgres later if backups or several instances are needed.
- **One origin for the browser**: an Amplify rewrite proxies `/api/<*>` to the Railway URL (status 200), so the frontend keeps calling `/api/...`, the HttpOnly session cookie stays first-party (SameSite=Lax works) and no CORS change is needed. `NEXT_PUBLIC_API_URL` stays empty.

Code and config changes:
- `db.py`: create tables only if missing (`CREATE TABLE IF NOT EXISTS`); wipe the database only when `RESET_DB=1` (keep that for the local Docker demo via the start scripts). Update the "created from scratch" line in Technical design.
- Dockerfile: listen on `${PORT:-8000}` (Railway sets PORT).
- `railway.json`: Dockerfile builder, healthcheck path `/api/health`, restart on failure.
- `amplify.yml` at the repo root: appRoot `frontend`, `npm ci`, `npm run build`, artifacts `out/`. The build reads `../templates`, which is in the cloned repo.
- Amplify rewrites: `/api/<*>` -> `https://<railway-domain>/api/<*>` (200); `/create` and `/nda` keep working through the static redirect pages.
- Railway variables: `OPENAI_API_KEY`, fixed `JWT_SECRET` (sessions survive redeploys), `SECURE_COOKIES=1`, `DB_PATH=/data/prelegal.db` with the volume mounted at `/data`.
- Optional: `ALLOWED_ORIGINS` env var instead of the hard-coded localhost:3000 CORS origin, only needed if the browser ever calls Railway directly.

Deploy only after CI passes:
- Railway: enable "Wait for CI" on the service, so a push to main deploys only when the GitHub Actions checks pass.
- Amplify builds on push by itself; to gate it on CI, turn off auto-build and call an Amplify incoming webhook from a GitHub Actions job that runs after the test job on main (webhook URL stored as a GitHub secret).

Tests:
- Backend: data survives an app restart without `RESET_DB`; `RESET_DB=1` wipes it; `DB_PATH` on a fresh directory creates the schema.
- Container: the image starts on a custom `PORT` and answers `/api/health`.
- Post-deploy smoke test (GitHub Actions job after deploy): through the Amplify URL, `GET /api/health`, `GET /api/chat/greeting`, sign up, `GET /api/auth/me` with the cookie, save and list a document, then delete it.
- Existing CI (lint, unit, e2e) must stay green; it is the gate for both deploys.

Tooling (Railway plugin or MCP?):
- Not needed for deployments: push-to-main deploys come from the native GitHub integrations of Railway and Amplify, set up once in their dashboards.
- Optional for convenience: the Railway CLI (`railway logs`, `railway variables`) or a Railway MCP server would let Claude read logs and set variables from the terminal. Use it for diagnosis, not as the deploy path.

### Testing
- Backend: `cd backend && uv run pytest`
- Frontend: `cd frontend && npm run lint && npm test && npm run test:e2e`

### Current API Endpoints
- `GET /api/chat/greeting` - Get AI greeting
- `POST /api/chat/message` - Send chat message (+ documentType and fields) and get AI reply, documentType and fields
- `GET /api/health` - Health check
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/signin` - Sign in and receive JWT cookie
- `POST /api/auth/signout` - Clear auth cookie
- `GET /api/auth/me` - Get current user info
- `GET /api/documents` - List user's saved documents (auth required)
- `POST /api/documents` - Save new document (auth required)
- `GET /api/documents/{id}` - Get specific document (auth required)
- `PUT /api/documents/{id}` - Update document (auth required)
- `DELETE /api/documents/{id}` - Delete document (auth required)
