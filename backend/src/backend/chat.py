"""AI chat that picks the document type and gathers its fields through conversation.

Stateless: each request carries the whole conversation, the chosen document type
(if any) and its current fields. Until a type is chosen the model only works out
which document the user needs; afterwards it fills that document's fields
(Structured Outputs, one schema per document type).
"""

import os
import re
from functools import cache, lru_cache
from typing import Annotated, Any, Literal, get_args, get_origin

from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI, OpenAIError
from pydantic import BaseModel, Field, ValidationError, create_model

from backend.documents import DocumentType, document_types, fields_model
from backend.nda import CamelModel

GREETING = (
    "Hi! I can help you draft a legal agreement: a Mutual NDA, a Cloud Service, Pilot, "
    "Design Partner, Professional Services, Partnership or Software License Agreement, "
    "a Service Level Agreement, a Data Processing Agreement, a Business Associate Agreement "
    "or an AI Addendum. What would you like to create?"
)

DETECT_INSTRUCTIONS = """\
You help the user draft a legal agreement from Common Paper standard templates.
These are the only documents you can generate (id: name - when to use it):
{catalog}

Work out which document the user needs:
- If what they ask for clearly matches one, set documentType to its id and reply briefly.
- If they want a document that is not in the list (e.g. an employment contract or a
  lease), set documentType to null. Explain that you can't generate that document,
  suggest the closest one you can generate and why, and ask whether they want it.
- If it is unclear, set documentType to null and ask a question to find out.
You do not give legal advice.
"""

FILL_INSTRUCTIONS = """\
You help the user fill in a Common Paper {name} by chatting.
party1 is the {party1} and party2 is the {party2}.

Today's date is {today}. The current field values are:
{fields}

Each turn:
- Update the fields from what the user says. Keep every other value exactly as it is;
  the user may also have edited fields directly. Never invent values: leave a field
  empty ("") until the user provides it or agrees to a value you proposed. Never use
  placeholders such as "Your Company". Leave a date empty until the user gives or
  confirms one; a suggestion is not agreement.
- A party's name is the person who signs, not the company. Leave it empty until the
  user names that person.
- Dates are YYYY-MM-DD.
{rules}
- Optional fields: {optional}. Ask about them once; it is fine to leave them empty.
  Every other field is required.
- Then reply briefly. While any required field is empty, always end your reply with a
  question about one or two of the empty fields, offering sensible suggestions where
  it helps (e.g. propose today as the effective date; fill it only once they agree).
- When every required field is filled, summarize the key terms and tell the user they
  can download the PDF with the Download PDF button.
- documentType stays "{id}" unless the user clearly asks for a different document;
  then set it to that document's id ({ids}). If they ask for a document not in that
  list, explain you can't generate it and offer the closest one you can.
- Only discuss this document. You do not give legal advice.
"""

NDA_RULES = """\
- The MNDA term and the term of confidentiality are a whole number plus a unit,
  months or years. The length must be digits only, never a decimal: use months when
  the length is under a year or not a whole number of years (half a year is "6"
  months; a year and a half is "18" months), and years otherwise. When asking about a
  term, say it can be given in months or years. A length is only needed for the term
  option that uses it."""


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(CamelModel):
    messages: list[Message]
    document_type: str | None = None
    # Validated against the document type's own fields model in the handler.
    fields: dict[str, Any] | None = None
    today: str


class ChatResponse(CamelModel):
    document_type: str | None
    reply: str
    fields: dict[str, Any] | None


def _document_id_type() -> Any:
    return Literal[tuple(document_types())]


REPLY = Field(description="Your next chat message to the user. Never empty.")


@cache
def detect_turn_model() -> type[BaseModel]:
    return create_model(
        "DetectTurn",
        __base__=CamelModel,
        document_type=(_document_id_type() | None, Field(description="Id of the document the user wants, or null")),
        reply=(str, REPLY),
    )


@cache
def fill_turn_model(doc_id: str) -> type[BaseModel]:
    # Fields come before the reply: the model writes them first, so the reply
    # can build on the updated values.
    return create_model(
        f"{fields_model(doc_id).__name__}Turn",
        __base__=CamelModel,
        document_type=(_document_id_type(), Field(description="Id of the document being drafted")),
        fields=(fields_model(doc_id), ...),
        reply=(str, REPLY),
    )


def blank(model: type[BaseModel]) -> BaseModel:
    """An instance with every text field empty and every choice at its first option."""
    values = {}
    for name, info in model.model_fields.items():
        if isinstance(info.annotation, type) and issubclass(info.annotation, BaseModel):
            values[name] = blank(info.annotation)
        elif get_origin(info.annotation) is Literal:
            values[name] = get_args(info.annotation)[0]
        else:
            values[name] = ""
    return model.model_validate(values)


def detect_instructions() -> str:
    catalog = "\n".join(f"- {d.id}: {d.name} - {d.summary}" for d in document_types().values())
    return DETECT_INSTRUCTIONS.format(catalog=catalog)


def fill_instructions(doc: DocumentType, fields: BaseModel, today: str) -> str:
    optional = [f.label for f in doc.fields if f.optional] or ["none"]
    if doc.id == "mutual-nda":
        optional = ["modifications"]
    return FILL_INSTRUCTIONS.format(
        name=doc.name,
        party1=doc.parties[0],
        party2=doc.parties[1],
        today=today,
        fields=fields.model_dump_json(by_alias=True, indent=2),
        rules=NDA_RULES if doc.id == "mutual-nda" else "",
        optional=", ".join(optional),
        id=doc.id,
        ids=", ".join(document_types()),
    )


@lru_cache
def _client() -> OpenAI:
    return OpenAI()


def get_client() -> OpenAI:
    try:
        return _client()
    except OpenAIError as error:  # Raised when OPENAI_API_KEY is not set.
        raise HTTPException(status_code=503, detail="The AI is not configured: OPENAI_API_KEY is missing.") from error


def ask(client: OpenAI, instructions: str, messages: list[Message], text_format: type[BaseModel]) -> Any:
    try:
        response = client.responses.parse(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            instructions=instructions,
            input=[m.model_dump() for m in messages],
            text_format=text_format,
        )
    except OpenAIError as error:
        raise HTTPException(status_code=502, detail="The AI service failed. Please try again.") from error

    if response.output_parsed is None:
        raise HTTPException(status_code=502, detail="The AI gave no usable answer. Please try again.")
    return response.output_parsed


# The model sometimes turns "our company" into a company literally named "Your Company".
PLACEHOLDER_COMPANY = re.compile(r"^\s*(your|my|our|the)\s+company(\s+name)?\s*$", re.IGNORECASE)


def clear_placeholder_companies(fields: dict[str, Any]) -> dict[str, Any]:
    for key in ("party1", "party2"):
        if PLACEHOLDER_COMPANY.match(fields[key]["company"]):
            fields[key]["company"] = ""
    return fields


def parse_fields(doc_id: str, fields: dict[str, Any] | None) -> BaseModel:
    model = fields_model(doc_id)
    if fields is None:
        return blank(model)
    try:
        return model.model_validate(fields)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail=error.errors(include_url=False)) from error


router = APIRouter(prefix="/api/chat")


@router.get("/greeting")
def greeting() -> dict[str, str]:
    return {"reply": GREETING}


@router.post("/message")
def message(request: ChatRequest, client: Annotated[OpenAI, Depends(get_client)]) -> ChatResponse:
    doc_id = request.document_type
    if doc_id is not None and doc_id not in document_types():
        raise HTTPException(status_code=422, detail=f"Unknown document type: {doc_id}")

    if doc_id is None:
        detected = ask(client, detect_instructions(), request.messages, detect_turn_model())
        if detected.document_type is None:
            return ChatResponse(document_type=None, reply=detected.reply, fields=None)
        doc_id, fields = detected.document_type, blank(fields_model(detected.document_type))
    else:
        fields = parse_fields(doc_id, request.fields)

    def fill(doc_id: str, fields: BaseModel) -> Any:
        doc = document_types()[doc_id]
        return ask(client, fill_instructions(doc, fields, request.today), request.messages, fill_turn_model(doc_id))

    turn = fill(doc_id, fields)
    if turn.document_type != doc_id:
        # The user switched documents: start the new one from blank fields.
        # The conversation still holds what they said, so shared details carry over.
        doc_id = turn.document_type
        turn = fill(doc_id, blank(fields_model(doc_id)))

    fields = clear_placeholder_companies(turn.fields.model_dump(by_alias=True))
    return ChatResponse(document_type=doc_id, reply=turn.reply, fields=fields)
