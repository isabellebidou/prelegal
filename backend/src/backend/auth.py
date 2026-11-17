"""Accounts: sign up and sign in with email and password (bcrypt), sessions as a
JWT in an HttpOnly cookie. The signing secret is per app start unless JWT_SECRET
is set, so sessions end when the server (and its temporary database) restarts.
"""

import sqlite3
from datetime import UTC, datetime, timedelta
from typing import Annotated

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import Field, field_validator

from backend.db import get_db
from backend.nda import CamelModel

COOKIE = "prelegal_session"
SESSION = timedelta(days=7)
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class Credentials(CamelModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=254)
    # bcrypt only uses the first 72 bytes of a password.
    password: str = Field(min_length=1, max_length=72)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, email: object) -> object:
        return email.strip().lower() if isinstance(email, str) else email


class SignUp(Credentials):
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("name")
    @classmethod
    def strip_name(cls, name: str) -> str:
        if not name.strip():
            raise ValueError("Name is required")
        return name.strip()


class User(CamelModel):
    id: int
    name: str
    email: str


Db = Annotated[sqlite3.Connection, Depends(get_db)]


def _start_session(request: Request, response: Response, user_id: int) -> None:
    token = jwt.encode(
        {"sub": str(user_id), "exp": datetime.now(UTC) + SESSION},
        request.app.state.jwt_secret,
        algorithm="HS256",
    )
    response.set_cookie(
        COOKIE,
        token,
        max_age=int(SESSION.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=request.app.state.secure_cookies,
    )


def current_user(request: Request, db: Db) -> User:
    """FastAPI dependency: the signed-in user, or 401."""
    token = request.cookies.get(COOKIE)
    if token:
        try:
            claims = jwt.decode(token, request.app.state.jwt_secret, algorithms=["HS256"])
            row = db.execute("SELECT id, name, email FROM users WHERE id = ?", (int(claims["sub"]),)).fetchone()
        except (jwt.InvalidTokenError, KeyError, ValueError):
            row = None
        if row:
            return User(**row)
    raise HTTPException(status_code=401, detail="Please sign in.")


CurrentUser = Annotated[User, Depends(current_user)]

router = APIRouter(prefix="/api/auth")


@router.post("/signup", status_code=201)
def signup(body: SignUp, request: Request, response: Response, db: Db) -> User:
    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    try:
        cursor = db.execute(
            "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
            (body.email, body.name, password_hash),
        )
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from error
    _start_session(request, response, cursor.lastrowid)
    return User(id=cursor.lastrowid, name=body.name, email=body.email)


@router.post("/signin")
def signin(body: Credentials, request: Request, response: Response, db: Db) -> User:
    row = db.execute("SELECT id, name, email, password_hash FROM users WHERE email = ?", (body.email,)).fetchone()
    if row is None or not bcrypt.checkpw(body.password.encode(), row["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    _start_session(request, response, row["id"])
    return User(id=row["id"], name=row["name"], email=row["email"])


@router.post("/signout", status_code=204)
def signout(request: Request, response: Response) -> None:
    response.delete_cookie(COOKIE, httponly=True, samesite="lax", secure=request.app.state.secure_cookies)


@router.get("/me")
def me(user: CurrentUser) -> User:
    return user
