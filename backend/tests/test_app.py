import sqlite3

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app


@pytest.fixture
def static_dir(tmp_path):
    out = tmp_path / "out"
    (out / "nda").mkdir(parents=True)
    (out / "index.html").write_text("<h1>Sign in</h1>")
    (out / "nda" / "index.html").write_text("<h1>NDA</h1>")
    (out / "404.html").write_text("<h1>Not found</h1>")
    return out


@pytest.fixture
def db_path(tmp_path):
    return tmp_path / "data" / "test.db"


@pytest.fixture
def client(db_path, static_dir):
    # The context manager runs the lifespan, which creates the database.
    with TestClient(create_app(db_path, static_dir)) as client:
        yield client


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_startup_creates_users_table(client, db_path):
    with sqlite3.connect(db_path) as conn:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert "users" in tables


def test_startup_recreates_database_from_scratch(db_path, static_dir):
    with TestClient(create_app(db_path, static_dir)):
        with sqlite3.connect(db_path) as conn:
            conn.execute("INSERT INTO users (email, name) VALUES ('a@example.com', 'A')")

    with TestClient(create_app(db_path, static_dir)):
        with sqlite3.connect(db_path) as conn:
            assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_serves_frontend_pages(client):
    assert "Sign in" in client.get("/").text
    assert "NDA" in client.get("/nda/").text


def test_unknown_api_route_is_404(client):
    response = client.get("/api/nope")
    assert response.status_code == 404


def test_runs_without_built_frontend(db_path, tmp_path):
    with TestClient(create_app(db_path, tmp_path / "missing")) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404
