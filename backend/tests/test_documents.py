import json
from pathlib import Path

import pytest
from openai.lib._pydantic import to_strict_json_schema

from backend.chat import detect_turn_model, fill_turn_model
from backend.documents import REGISTRY_PATH, document_types, fields_model
from backend.nda import NdaFields

ROOT = Path(__file__).resolve().parents[2]


def test_registry_covers_every_catalog_template():
    catalog = json.loads((ROOT / "catalog.json").read_text())["templates"]
    catalog_files = {Path(t["filename"]).name for t in catalog} - {"Mutual-NDA-coverpage.md"}
    assert {d.template for d in document_types().values()} == catalog_files
    assert len(document_types()) == 11


def test_every_template_file_exists():
    for doc in document_types().values():
        assert (REGISTRY_PATH.parent / doc.template).is_file(), doc.template


@pytest.mark.parametrize("doc_id", [d for d in document_types() if d != "mutual-nda"])
def test_generic_documents_have_unique_described_fields(doc_id):
    fields = document_types()[doc_id].fields
    keys = [f.key for f in fields]
    assert len(keys) == len(set(keys))
    assert any(not f.optional for f in fields)
    assert all(f.description and f.label for f in fields)
    assert "effectiveDate" in keys


def test_nda_uses_its_dedicated_fields():
    assert fields_model("mutual-nda") is NdaFields


@pytest.mark.parametrize("doc_id", list(document_types()))
def test_every_schema_works_with_structured_outputs(doc_id):
    # Raises if a schema is not valid for OpenAI strict mode.
    schema = to_strict_json_schema(fill_turn_model(doc_id))
    assert schema["required"] == ["documentType", "fields", "reply"]
    to_strict_json_schema(detect_turn_model())


def test_generic_field_descriptions_mark_optional_and_dates():
    schema = fields_model("csa").model_json_schema()
    terms = schema["$defs"][next(k for k in schema["$defs"] if k.endswith("Terms"))]["properties"]
    assert "YYYY-MM-DD" in terms["effectiveDate"]["description"]
    assert "Optional" in terms["technicalSupport"]["description"]
    assert "Optional" not in terms["fees"]["description"]
