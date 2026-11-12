"""FastAPI app: the JSON API under /api, plus the static frontend export at /."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.chat import router as chat_router
from backend.db import connect, init_db

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "prelegal.db"
DEFAULT_STATIC_DIR = BACKEND_DIR.parent / "frontend" / "out"


def create_app(db_path: Path, static_dir: Path) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db(db_path)
        yield

    app = FastAPI(title="Prelegal", lifespan=lifespan)
    # Lets the Next.js dev server (npm run dev) call the API. In production
    # the frontend is served from this app, so requests are same-origin.
    app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])
    app.include_router(chat_router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        with connect(db_path) as conn:
            conn.execute("SELECT 1 FROM users LIMIT 1")
        return {"status": "ok"}

    # Mounted last so /api routes take precedence. Skipped when the frontend
    # has not been built, so the API can run on its own.
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")

    return app


app = create_app(
    db_path=Path(os.environ.get("DB_PATH", DEFAULT_DB_PATH)),
    static_dir=Path(os.environ.get("STATIC_DIR", DEFAULT_STATIC_DIR)),
)
