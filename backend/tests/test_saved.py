import pytest
from fastapi.testclient import TestClient

from backend.chat import blank
from backend.documents import fields_model
from conftest import sign_up

NDA_FIELDS = blank(fields_model("mutual-nda")).model_dump(by_alias=True)
MESSAGES = [
    {"role": "assistant", "content": "What would you like to create?"},
    {"role": "user", "content": "An NDA with Globex."},
]
DOCUMENT = {
    "documentType": "mutual-nda",
    "title": "Mutual NDA - Acme - Globex",
    "fields": {**NDA_FIELDS, "confidentialityTermLength": "18", "confidentialityTermUnit": "months"},
    "messages": MESSAGES,
}


@pytest.fixture
def ada(api):
    sign_up(api)
    return api


def test_documents_require_sign_in(api):
    assert api.get("/api/documents").status_code == 401
    assert api.post("/api/documents", json=DOCUMENT).status_code == 401
    assert api.get("/api/documents/1").status_code == 401
    assert api.put("/api/documents/1", json=DOCUMENT).status_code == 401
    assert api.delete("/api/documents/1").status_code == 401


def test_save_and_reopen_a_document_with_its_chat(ada):
    created = ada.post("/api/documents", json=DOCUMENT)
    assert created.status_code == 201
    doc = created.json()

    reopened = ada.get(f"/api/documents/{doc['id']}").json()

    assert reopened["documentType"] == "mutual-nda"
    assert reopened["title"] == "Mutual NDA - Acme - Globex"
    assert reopened["fields"]["confidentialityTermUnit"] == "months"
    assert reopened["messages"] == MESSAGES
    assert reopened["createdAt"] and reopened["updatedAt"]


def test_list_shows_summaries_newest_first(ada):
    first = ada.post("/api/documents", json={**DOCUMENT, "title": "First"}).json()
    second = ada.post("/api/documents", json={**DOCUMENT, "title": "Second"}).json()

    listed = ada.get("/api/documents").json()

    assert [d["id"] for d in listed] == [second["id"], first["id"]]
    assert set(listed[0]) == {"id", "documentType", "title", "createdAt", "updatedAt"}


def test_update_replaces_the_document(ada):
    doc = ada.post("/api/documents", json=DOCUMENT).json()
    pilot = blank(fields_model("pilot")).model_dump(by_alias=True)
    pilot["terms"]["pilotPeriod"] = "60 days"
    messages = [*MESSAGES, {"role": "assistant", "content": "Switched to a pilot."}]

    response = ada.put(
        f"/api/documents/{doc['id']}",
        json={"documentType": "pilot", "title": "Pilot", "fields": pilot, "messages": messages},
    )

    assert response.status_code == 200
    updated = ada.get(f"/api/documents/{doc['id']}").json()
    assert (updated["documentType"], updated["title"]) == ("pilot", "Pilot")
    assert updated["fields"]["terms"]["pilotPeriod"] == "60 days"
    assert updated["messages"] == messages
    assert len(ada.get("/api/documents").json()) == 1


def test_delete_removes_the_document(ada):
    doc = ada.post("/api/documents", json=DOCUMENT).json()
    assert ada.delete(f"/api/documents/{doc['id']}").status_code == 204
    assert ada.get(f"/api/documents/{doc['id']}").status_code == 404
    assert ada.get("/api/documents").json() == []


def test_users_only_see_their_own_documents(app):
    with TestClient(app) as ada, TestClient(app) as alan:
        sign_up(ada)
        sign_up(alan, email="alan@example.com", name="Alan Turing")
        doc = ada.post("/api/documents", json=DOCUMENT).json()

        assert alan.get("/api/documents").json() == []
        assert alan.get(f"/api/documents/{doc['id']}").status_code == 404
        assert alan.put(f"/api/documents/{doc['id']}", json=DOCUMENT).status_code == 404
        assert alan.delete(f"/api/documents/{doc['id']}").status_code == 404
        assert ada.get(f"/api/documents/{doc['id']}").status_code == 200


@pytest.mark.parametrize(
    "changes",
    [
        {"documentType": "lease"},
        {"fields": {**NDA_FIELDS, "mndaTermUnit": "weeks"}},
        {"documentType": "pilot"},  # NDA fields don't fit a pilot.
        {"title": ""},
        {"messages": [{"role": "system", "content": "x"}]},
    ],
)
def test_rejects_invalid_documents(ada, changes):
    assert ada.post("/api/documents", json={**DOCUMENT, **changes}).status_code == 422


def test_missing_document_is_404(ada):
    assert ada.get("/api/documents/999").status_code == 404
    assert ada.put("/api/documents/999", json=DOCUMENT).status_code == 404
    assert ada.delete("/api/documents/999").status_code == 404
