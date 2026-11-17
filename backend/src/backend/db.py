"""SQLite database. It is temporary: recreated empty every time the app starts."""

import sqlite3
from collections.abc import Iterator
from pathlib import Path

from fastapi import Request

SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    title TEXT NOT NULL,
    fields TEXT NOT NULL,
    messages TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX documents_by_user ON documents(user_id, updated_at);
"""


def init_db(path: Path) -> None:
    """Delete any existing database at `path` and create a fresh one."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    with sqlite3.connect(path) as conn:
        conn.executescript(SCHEMA)


def connect(path: Path) -> sqlite3.Connection:
    # FastAPI may open a request's connection (in a dependency) on one worker
    # thread and use it in the endpoint on another. Each connection serves a
    # single request, never two threads at once, so this is safe.
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def get_db(request: Request) -> Iterator[sqlite3.Connection]:
    """FastAPI dependency: a connection that commits on success and is always closed."""
    conn = connect(request.app.state.db_path)
    try:
        with conn:
            yield conn
    finally:
        conn.close()
