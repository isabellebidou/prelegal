from types import SimpleNamespace
from unittest.mock import MagicMock

import httpx2
import pytest
from fastapi.testclient import TestClient
from openai import APIConnectionError

from backend.chat import (
    _client,
    blank,
    detect_turn_model,
    fill_turn_model,
    get_client,
)
from backend.documents import fields_model
from backend.main import create_app

EMPTY_PARTY = {"name": "", "title": "", "company": "", "noticeAddress": ""}
NDA_FIELDS = {
    "purpose": "",
    "effectiveDate": "",
    "mndaTermType": "expires",
    "mndaTermLength": "",
    "mndaTermUnit": "years",
    "confidentialityTermType": "fixed",
    "confidentialityTermLength": "",
    "confidentialityTermUnit": "years",
    "governingLaw": "",
    "jurisdiction": "",
    "modifications": "",
    "party1": EMPTY_PARTY,
    "party2": EMPTY_PARTY,
}
MESSAGES = [
    {"role": "assistant", "content": "What would you like to create?"},
    {"role": "user", "content": "An NDA for exploring a partnership. Governed by Delaware law."},
]
NDA_REQUEST = {"messages": MESSAGES, "documentType": "mutual-nda", "fields": NDA_FIELDS, "today": "2026-11-12"}
NEW_REQUEST = {"messages": MESSAGES, "documentType": None, "fields": None, "today": "2026-11-12"}


@pytest.fixture
def openai_client():
    return MagicMock()


@pytest.fixture
def client(tmp_path, openai_client):
    app = create_app(tmp_path / "test.db", tmp_path / "no-frontend")
    app.dependency_overrides[get_client] = lambda: openai_client
    with TestClient(app) as client:
        yield client


def detect(document_type, reply="ok"):
    return detect_turn_model()(document_type=document_type, reply=reply)


def fill(doc_id, reply="ok", document_type=None, **changes):
    fields = blank(fields_model(doc_id)).model_dump(by_alias=True)
    for key, value in changes.items():
        target = fields["terms"] if "terms" in fields and key in fields["terms"] else fields
        target[key] = value
    return fill_turn_model(doc_id).model_validate(
        {"documentType": document_type or doc_id, "fields": fields, "reply": reply}
    )


def model_answers(openai_client, *turns):
    openai_client.responses.parse.side_effect = [SimpleNamespace(output_parsed=t) for t in turns]


def calls(openai_client):
    return [c.kwargs for c in openai_client.responses.parse.call_args_list]


def test_greeting_lists_the_documents(client):
    reply = client.get("/api/chat/greeting").json()["reply"]
    for name in ["Mutual NDA", "Cloud Service", "Pilot", "Data Processing Agreement", "AI Addendum"]:
        assert name in reply


def test_nda_message_returns_reply_and_updated_fields(client, openai_client):
    model_answers(openai_client, fill("mutual-nda", "Which jurisdiction?", purpose="Partnership", governingLaw="Delaware"))

    response = client.post("/api/chat/message", json=NDA_REQUEST)

    assert response.status_code == 200
    body = response.json()
    assert body["documentType"] == "mutual-nda"
    assert body["reply"] == "Which jurisdiction?"
    assert body["fields"]["purpose"] == "Partnership"
    assert body["fields"]["governingLaw"] == "Delaware"
    assert body["fields"]["party1"] == EMPTY_PARTY


def test_nda_terms_accept_months(client, openai_client):
    model_answers(
        openai_client,
        fill("mutual-nda", mndaTermLength="6", mndaTermUnit="months", confidentialityTermLength="18", confidentialityTermUnit="months"),
    )
    body = client.post("/api/chat/message", json=NDA_REQUEST).json()
    assert (body["fields"]["mndaTermLength"], body["fields"]["mndaTermUnit"]) == ("6", "months")
    assert (body["fields"]["confidentialityTermLength"], body["fields"]["confidentialityTermUnit"]) == ("18", "months")


def test_nda_request_with_months_is_accepted_and_sent_to_model(client, openai_client):
    model_answers(openai_client, fill("mutual-nda"))
    fields = {**NDA_FIELDS, "confidentialityTermLength": "9", "confidentialityTermUnit": "months"}
    assert client.post("/api/chat/message", json={**NDA_REQUEST, "fields": fields}).status_code == 200
    instructions = calls(openai_client)[0]["instructions"]
    assert '"confidentialityTermUnit": "months"' in instructions
    assert "a year and a half is \"18\" months" in instructions  # Terms between whole years.


def test_fill_sends_conversation_fields_and_date_to_model(client, openai_client, monkeypatch):
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    model_answers(openai_client, fill("mutual-nda"))
    client.post("/api/chat/message", json={**NDA_REQUEST, "fields": {**NDA_FIELDS, "jurisdiction": "New Castle, DE"}})

    kwargs = calls(openai_client)[0]
    assert kwargs["model"] == "gpt-4o-mini"
    assert kwargs["text_format"] is fill_turn_model("mutual-nda")
    assert kwargs["input"] == MESSAGES
    assert "2026-11-12" in kwargs["instructions"]
    assert '"jurisdiction": "New Castle, DE"' in kwargs["instructions"]
    assert "Mutual Non-Disclosure Agreement" in kwargs["instructions"]


def test_new_conversation_detects_type_then_fills_it(client, openai_client):
    model_answers(
        openai_client,
        detect("pilot"),
        fill("pilot", "Who signs for Acme?", pilotPeriod="60 days", governingLaw="Delaware"),
    )

    body = client.post("/api/chat/message", json=NEW_REQUEST).json()

    assert body["documentType"] == "pilot"
    assert body["reply"] == "Who signs for Acme?"
    assert body["fields"]["terms"]["pilotPeriod"] == "60 days"
    assert body["fields"]["terms"]["governingLaw"] == "Delaware"
    detect_call, fill_call = calls(openai_client)
    assert detect_call["text_format"] is detect_turn_model()
    assert "csa: Cloud Service Agreement" in detect_call["instructions"]
    assert fill_call["text_format"] is fill_turn_model("pilot")
    assert '"pilotPeriod": ""' in fill_call["instructions"]


def test_unsupported_document_gets_reply_without_type(client, openai_client):
    reply = "I can't generate an employment contract. The closest is a Professional Services Agreement."
    model_answers(openai_client, detect(None, reply))

    body = client.post("/api/chat/message", json=NEW_REQUEST).json()

    assert body == {"documentType": None, "reply": reply, "fields": None}
    assert len(calls(openai_client)) == 1
    assert "closest" in calls(openai_client)[0]["instructions"]


@pytest.mark.parametrize("placeholder", ["Your Company", "our company", "  My Company Name "])
def test_placeholder_company_names_are_cleared(client, openai_client, placeholder):
    party1 = {**EMPTY_PARTY, "company": placeholder}
    party2 = {**EMPTY_PARTY, "company": "Initech"}
    model_answers(openai_client, fill("csa", party1=party1, party2=party2))
    request = {**NDA_REQUEST, "documentType": "csa", "fields": blank(fields_model("csa")).model_dump(by_alias=True)}

    body = client.post("/api/chat/message", json=request).json()

    assert body["fields"]["party1"]["company"] == ""
    assert body["fields"]["party2"]["company"] == "Initech"


def test_real_company_names_are_kept(client, openai_client):
    party1 = {**EMPTY_PARTY, "company": "Your Company Ltd"}
    model_answers(openai_client, fill("mutual-nda", party1=party1))
    body = client.post("/api/chat/message", json=NDA_REQUEST).json()
    assert body["fields"]["party1"]["company"] == "Your Company Ltd"


def test_switching_document_restarts_with_new_fields(client, openai_client):
    model_answers(
        openai_client,
        fill("mutual-nda", document_type="csa"),
        fill("csa", "What is the subscription period?", governingLaw="Delaware"),
    )

    body = client.post("/api/chat/message", json=NDA_REQUEST).json()

    assert body["documentType"] == "csa"
    assert body["reply"] == "What is the subscription period?"
    assert set(body["fields"]["terms"]) >= {"subscriptionPeriod", "generalCapAmount"}
    assert calls(openai_client)[1]["text_format"] is fill_turn_model("csa")


def test_every_document_type_can_be_filled(client, openai_client):
    from backend.documents import document_types

    for doc_id in document_types():
        model_answers(openai_client, fill(doc_id))
        fields = blank(fields_model(doc_id)).model_dump(by_alias=True)
        response = client.post("/api/chat/message", json={**NDA_REQUEST, "documentType": doc_id, "fields": fields})
        assert response.status_code == 200, doc_id
        assert response.json()["documentType"] == doc_id


def test_generic_fields_are_validated(client):
    fields = blank(fields_model("csa")).model_dump(by_alias=True)
    fields["terms"]["madeUp"] = "x"
    request = {**NDA_REQUEST, "documentType": "csa", "fields": fields}
    assert client.post("/api/chat/message", json=request).status_code == 422


def test_rejects_unknown_document_type(client):
    assert client.post("/api/chat/message", json={**NDA_REQUEST, "documentType": "lease"}).status_code == 422


def test_rejects_invalid_nda_fields(client):
    for bad in [{"mndaTermType": "forever"}, {"confidentialityTermUnit": "weeks"}]:
        request = {**NDA_REQUEST, "fields": {**NDA_FIELDS, **bad}}
        assert client.post("/api/chat/message", json=request).status_code == 422


def test_message_uses_model_from_environment(client, openai_client, monkeypatch):
    monkeypatch.setenv("OPENAI_MODEL", "some-other-model")
    model_answers(openai_client, fill("mutual-nda"))
    client.post("/api/chat/message", json=NDA_REQUEST)
    assert calls(openai_client)[0]["model"] == "some-other-model"


def test_openai_failure_is_502(client, openai_client):
    request = httpx2.Request("POST", "https://api.openai.com/v1/responses")
    openai_client.responses.parse.side_effect = APIConnectionError(request=request)

    response = client.post("/api/chat/message", json=NDA_REQUEST)

    assert response.status_code == 502
    assert "try again" in response.json()["detail"]


def test_unparsed_answer_is_502(client, openai_client):
    openai_client.responses.parse.return_value = SimpleNamespace(output_parsed=None)
    assert client.post("/api/chat/message", json=NEW_REQUEST).status_code == 502


def test_missing_api_key_is_clear_503(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    _client.cache_clear()
    with TestClient(create_app(tmp_path / "test.db", tmp_path / "no-frontend")) as client:
        response = client.post("/api/chat/message", json=NDA_REQUEST)
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]
