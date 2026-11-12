from types import SimpleNamespace
from unittest.mock import MagicMock

import httpx2
import pytest
from fastapi.testclient import TestClient
from openai import APIConnectionError

from backend.chat import ChatTurn, _client, get_client
from backend.main import create_app
from backend.nda import NdaFields

EMPTY_PARTY = {"name": "", "title": "", "company": "", "noticeAddress": ""}
FIELDS = {
    "purpose": "",
    "effectiveDate": "",
    "mndaTermType": "expires",
    "mndaTermYears": "",
    "confidentialityTermType": "years",
    "confidentialityTermYears": "",
    "governingLaw": "",
    "jurisdiction": "",
    "modifications": "",
    "party1": EMPTY_PARTY,
    "party2": EMPTY_PARTY,
}
REQUEST = {
    "messages": [
        {"role": "assistant", "content": "What is the NDA for?"},
        {"role": "user", "content": "Exploring a partnership. Governed by Delaware law."},
    ],
    "fields": FIELDS,
    "today": "2026-11-12",
}


@pytest.fixture
def openai_client():
    return MagicMock()


@pytest.fixture
def client(tmp_path, openai_client):
    app = create_app(tmp_path / "test.db", tmp_path / "no-frontend")
    app.dependency_overrides[get_client] = lambda: openai_client
    with TestClient(app) as client:
        yield client


def model_answers(openai_client, reply, **changes):
    fields = NdaFields.model_validate({**FIELDS, **changes})
    parsed = ChatTurn(reply=reply, fields=fields)
    openai_client.responses.parse.return_value = SimpleNamespace(output_parsed=parsed)


def test_greeting(client):
    response = client.get("/api/chat/greeting")
    assert response.status_code == 200
    assert "Mutual NDA" in response.json()["reply"]


def test_message_returns_reply_and_updated_fields(client, openai_client):
    model_answers(
        openai_client,
        "Got it. Which jurisdiction?",
        purpose="Exploring a partnership.",
        governingLaw="Delaware",
    )

    response = client.post("/api/chat/message", json=REQUEST)

    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Got it. Which jurisdiction?"
    assert body["fields"]["purpose"] == "Exploring a partnership."
    assert body["fields"]["governingLaw"] == "Delaware"
    assert body["fields"]["party1"] == EMPTY_PARTY


def test_message_sends_conversation_fields_and_date_to_model(client, openai_client, monkeypatch):
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    model_answers(openai_client, "ok")
    client.post("/api/chat/message", json={**REQUEST, "fields": {**FIELDS, "jurisdiction": "New Castle, DE"}})

    kwargs = openai_client.responses.parse.call_args.kwargs
    assert kwargs["model"] == "gpt-4o-mini"
    assert kwargs["text_format"] is ChatTurn
    assert kwargs["input"] == REQUEST["messages"]
    assert "2026-11-12" in kwargs["instructions"]
    assert '"jurisdiction": "New Castle, DE"' in kwargs["instructions"]


def test_message_uses_model_from_environment(client, openai_client, monkeypatch):
    monkeypatch.setenv("OPENAI_MODEL", "some-other-model")
    model_answers(openai_client, "ok")
    client.post("/api/chat/message", json=REQUEST)
    assert openai_client.responses.parse.call_args.kwargs["model"] == "some-other-model"


def test_openai_failure_is_502(client, openai_client):
    request = httpx2.Request("POST", "https://api.openai.com/v1/responses")
    openai_client.responses.parse.side_effect = APIConnectionError(request=request)

    response = client.post("/api/chat/message", json=REQUEST)

    assert response.status_code == 502
    assert "try again" in response.json()["detail"]


def test_unparsed_answer_is_502(client, openai_client):
    openai_client.responses.parse.return_value = SimpleNamespace(output_parsed=None)
    assert client.post("/api/chat/message", json=REQUEST).status_code == 502


def test_rejects_invalid_fields(client):
    bad = {**REQUEST, "fields": {**FIELDS, "mndaTermType": "forever"}}
    assert client.post("/api/chat/message", json=bad).status_code == 422


def test_missing_api_key_is_clear_503(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    _client.cache_clear()
    with TestClient(create_app(tmp_path / "test.db", tmp_path / "no-frontend")) as client:
        response = client.post("/api/chat/message", json=REQUEST)
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]
