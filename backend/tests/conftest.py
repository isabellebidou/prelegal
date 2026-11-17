import pytest
from fastapi.testclient import TestClient

from backend.main import create_app


@pytest.fixture
def app(tmp_path):
    return create_app(tmp_path / "test.db", tmp_path / "no-frontend")


@pytest.fixture
def api(app):
    """A client with the lifespan (fresh database) running, signed out."""
    with TestClient(app) as client:
        yield client


def sign_up(client, email="ada@example.com", name="Ada Lovelace", password="correct horse"):
    response = client.post("/api/auth/signup", json={"name": name, "email": email, "password": password})
    assert response.status_code == 201, response.text
    return response.json()
