"""The supported document types, read from templates/documents.json.

The same file drives the frontend's forms and previews. Each type gets its own
Pydantic fields model, so Structured Outputs return exactly that document's fields.
"""

import json
from functools import cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, create_model

from backend.nda import CamelModel, NdaFields, Party

REGISTRY_PATH = Path(__file__).resolve().parents[3] / "templates" / "documents.json"


class TermField(BaseModel):
    key: str
    label: str
    kind: Literal["text", "longtext", "date"]
    description: str
    optional: bool = False


class DocumentType(CamelModel):
    id: str
    name: str
    short_name: str
    summary: str
    template: str
    parties: tuple[str, str]
    fields: list[TermField] = []


@cache
def document_types() -> dict[str, DocumentType]:
    raw = json.loads(REGISTRY_PATH.read_text())["documents"]
    return {doc["id"]: DocumentType.model_validate(doc) for doc in raw}


def _description(field: TermField) -> str:
    text = field.description
    if field.kind == "date":
        text += ". YYYY-MM-DD"
    if field.optional:
        text += ". Optional: may stay empty"
    return text


@cache
def fields_model(doc_id: str) -> type[BaseModel]:
    """The fields model for a document type: the NDA's own, or one built from the registry."""
    if doc_id == "mutual-nda":
        return NdaFields
    doc = document_types()[doc_id]
    terms = create_model(
        f"{doc.short_name.replace(' ', '')}Terms",
        __config__=ConfigDict(extra="forbid"),
        **{f.key: (str, Field(description=_description(f))) for f in doc.fields},
    )
    party = "Signatory details for the {}"
    return create_model(
        f"{doc.short_name.replace(' ', '')}Fields",
        __base__=CamelModel,
        terms=(terms, ...),
        party1=(Party, Field(description=party.format(doc.parties[0]))),
        party2=(Party, Field(description=party.format(doc.parties[1]))),
    )
