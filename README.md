# Prelegal

Draft legal agreements from [Common Paper](https://github.com/CommonPaper) templates.

## Run

Requires Docker. Secrets such as `OPENAI_API_KEY` go in `.env` in the project root.

```bash
scripts/start-mac.sh     # or start-linux.sh, or scripts/start-windows.ps1
scripts/stop-mac.sh      # or stop-linux.sh, or scripts/stop-windows.ps1
```

The app runs at http://localhost:8000. If that port is taken, pick another with
`PRELEGAL_PORT=8080 scripts/start-mac.sh` (PowerShell: `$env:PRELEGAL_PORT = 8080`).
The SQLite database is recreated empty on every start.

## Layout

- `frontend/`: Next.js app, built as static files ([README](frontend/README.md))
- `backend/`: FastAPI app (uv project). It serves `/api/*` and the built frontend.
- `templates/`: agreement templates, listed in `catalog.json`
- `scripts/`: start/stop scripts

## Develop

```bash
cd backend && uv run pytest                                   # backend tests
cd backend && uv run uvicorn backend.main:app --reload        # API (+ frontend/out if built) on :8000
cd frontend && npm run dev                                     # frontend dev server on :3000
```
