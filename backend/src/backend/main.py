"""FastAPI app: the JSON API under /api, plus the static frontend export at /."""

import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.auth import router as auth_router
from backend.chat import router as chat_router
from backend.db import connect, init_db
from backend.saved import router as documents_router

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "prelegal.db"
DEFAULT_STATIC_DIR = BACKEND_DIR.parent / "frontend" / "out"


def create_app(db_path: Path, static_dir: Path) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db(db_path)
        yield

    app = FastAPI(title="Prelegal", lifespan=lifespan)
    app.state.db_path = db_path
    app.state.jwt_secret = os.environ.get("JWT_SECRET") or secrets.token_urlsafe(32)
    app.state.secure_cookies = os.environ.get("SECURE_COOKIES") == "1"
    # Lets the Next.js dev server (npm run dev) call the API with the session
    # cookie. In production the frontend is served from this app (same origin).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(chat_router)
    app.include_router(auth_router)
    app.include_router(documents_router)

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
