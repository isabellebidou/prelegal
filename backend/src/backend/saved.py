"""Documents saved to a user's account. Every query is scoped to the signed-in user."""

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import Field

from backend.auth import CurrentUser, Db
from backend.chat import Message, parse_fields
from backend.documents import document_types
from backend.nda import CamelModel


class DocumentIn(CamelModel):
    document_type: str
    title: str = Field(min_length=1, max_length=200)
    fields: dict[str, Any]
    messages: list[Message]


class DocumentSummary(CamelModel):
    id: int
    document_type: str
    title: str
    created_at: str
    updated_at: str


class SavedDocument(DocumentSummary):
    fields: dict[str, Any]
    messages: list[Message]


def _validated(body: DocumentIn) -> tuple[str, str, str, str]:
    if body.document_type not in document_types():
        raise HTTPException(status_code=422, detail=f"Unknown document type: {body.document_type}")
    fields = parse_fields(body.document_type, body.fields).model_dump(by_alias=True)
    messages = [m.model_dump() for m in body.messages]
    return body.document_type, body.title.strip() or "Untitled", json.dumps(fields), json.dumps(messages)


def _saved(row: sqlite3.Row) -> SavedDocument:
    return SavedDocument(
        **{k: row[k] for k in ("id", "title", "created_at", "updated_at")},
        document_type=row["document_type"],
        fields=json.loads(row["fields"]),
        messages=json.loads(row["messages"]),
    )


def _get(db: sqlite3.Connection, user_id: int, doc_id: int) -> sqlite3.Row:
    row = db.execute("SELECT * FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return row


router = APIRouter(prefix="/api/documents")


@router.get("")
def list_documents(user: CurrentUser, db: Db) -> list[DocumentSummary]:
    rows = db.execute(
        "SELECT id, document_type, title, created_at, updated_at FROM documents"
        " WHERE user_id = ? ORDER BY updated_at DESC, id DESC",
        (user.id,),
    ).fetchall()
    return [DocumentSummary(**row) for row in rows]


@router.post("", status_code=201)
def create_document(body: DocumentIn, user: CurrentUser, db: Db) -> SavedDocument:
    cursor = db.execute(
        "INSERT INTO documents (user_id, document_type, title, fields, messages) VALUES (?, ?, ?, ?, ?)",
        (user.id, *_validated(body)),
    )
    return _saved(_get(db, user.id, cursor.lastrowid))


@router.get("/{doc_id}")
def get_document(doc_id: int, user: CurrentUser, db: Db) -> SavedDocument:
    return _saved(_get(db, user.id, doc_id))


@router.put("/{doc_id}")
def update_document(doc_id: int, body: DocumentIn, user: CurrentUser, db: Db) -> SavedDocument:
    _get(db, user.id, doc_id)
    db.execute(
        "UPDATE documents SET document_type = ?, title = ?, fields = ?, messages = ?,"
        " updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
        (*_validated(body), doc_id, user.id),
    )
    return _saved(_get(db, user.id, doc_id))


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: int, user: CurrentUser, db: Db) -> None:
    _get(db, user.id, doc_id)
    db.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (doc_id, user.id))
