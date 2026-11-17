import sqlite3

import jwt
import pytest
from fastapi.testclient import TestClient

from backend.auth import COOKIE
from conftest import sign_up


def test_signup_creates_user_and_signs_in(api):
    user = sign_up(api)

    assert user == {"id": 1, "name": "Ada Lovelace", "email": "ada@example.com"}
    assert api.get("/api/auth/me").json() == user


def test_session_cookie_is_http_only(api):
    response = api.post("/api/auth/signup", json={"name": "Ada", "email": "ada@example.com", "password": "correct horse"})
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{COOKIE}=")
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Secure" not in cookie  # Plain http on localhost unless SECURE_COOKIES=1.


def test_passwords_are_hashed_with_bcrypt(api, app):
    sign_up(api, password="correct horse")
    with sqlite3.connect(app.state.db_path) as conn:
        (stored,) = conn.execute("SELECT password_hash FROM users").fetchone()
    assert stored.startswith("$2b$")
    assert "correct horse" not in stored


def test_email_is_normalized_and_unique(api):
    sign_up(api, email="  Ada@Example.COM ")
    response = api.post("/api/auth/signup", json={"name": "Other", "email": "ada@example.com", "password": "another one"})
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


@pytest.mark.parametrize(
    "body",
    [
        {"name": "Ada", "email": "not-an-email", "password": "correct horse"},
        {"name": "Ada", "email": "ada@example.com", "password": "short"},
        {"name": "   ", "email": "ada@example.com", "password": "correct horse"},
        {"name": "Ada", "email": "ada@example.com", "password": "x" * 73},
    ],
)
def test_signup_validates_input(api, body):
    assert api.post("/api/auth/signup", json=body).status_code == 422


def test_signin_with_correct_password(api):
    sign_up(api)
    api.post("/api/auth/signout")
    assert api.get("/api/auth/me").status_code == 401

    response = api.post("/api/auth/signin", json={"email": "ADA@example.com", "password": "correct horse"})

    assert response.status_code == 200
    assert response.json()["name"] == "Ada Lovelace"
    assert api.get("/api/auth/me").status_code == 200


@pytest.mark.parametrize(
    "email, password",
    [("ada@example.com", "wrong password"), ("nobody@example.com", "correct horse")],
)
def test_signin_rejects_bad_credentials_with_same_message(api, email, password):
    sign_up(api)
    api.post("/api/auth/signout")
    response = api.post("/api/auth/signin", json={"email": email, "password": password})
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."


def test_signout_clears_the_session(api):
    sign_up(api)
    response = api.post("/api/auth/signout")
    assert response.status_code == 204
    assert api.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize("token", ["garbage", None])
def test_me_rejects_invalid_or_foreign_tokens(api, token):
    sign_up(api)
    # A token signed with another secret (e.g. before a restart) is not accepted.
    forged = token or jwt.encode({"sub": "1"}, "another-secret-of-sufficient-length-1234", algorithm="HS256")
    api.cookies.clear()
    api.cookies.set(COOKIE, forged)
    assert api.get("/api/auth/me").status_code == 401


def test_sessions_end_when_the_app_restarts(tmp_path):
    from backend.main import create_app

    with TestClient(create_app(tmp_path / "a.db", tmp_path / "none")) as first:
        sign_up(first)
        cookie = first.cookies.get(COOKIE)
    with TestClient(create_app(tmp_path / "a.db", tmp_path / "none")) as second:
        second.cookies.set(COOKIE, cookie)
        assert second.get("/api/auth/me").status_code == 401


def test_secure_cookies_can_be_enabled(tmp_path, monkeypatch):
    from backend.main import create_app

    monkeypatch.setenv("SECURE_COOKIES", "1")
    with TestClient(create_app(tmp_path / "a.db", tmp_path / "none")) as client:
        response = client.post("/api/auth/signup", json={"name": "Ada", "email": "a@example.com", "password": "correct horse"})
    assert "Secure" in response.headers["set-cookie"]
