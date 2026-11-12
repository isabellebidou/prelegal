"""AI chat that gathers the Mutual NDA fields through conversation.

Stateless: each request carries the whole conversation and the current fields,
and the model returns its reply plus the updated fields (Structured Outputs).
"""

import os
from functools import lru_cache
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI, OpenAIError
from pydantic import BaseModel, Field

from backend.nda import CamelModel, NdaFields

GREETING = (
    "Hi! I'll help you put together a Mutual NDA. "
    "To start, what is the NDA for? For example, exploring a partnership with another company."
)

INSTRUCTIONS = """\
You help the user fill in a Common Paper Mutual Non-Disclosure Agreement (MNDA) by chatting.

Today's date is {today}. The current field values are:
{fields}

Each turn:
- Update the fields from what the user says. Keep every other value exactly as it is;
  the user may also have edited fields directly. Never invent values: leave a field
  empty ("") until the user provides it or agrees to a value you proposed.
- A party's name is the person who signs, not the company. Leave it empty until the
  user names that person.
- Dates are YYYY-MM-DD. Year counts are whole numbers as text, e.g. "2".
- Then reply briefly and ask about one or two fields that are still empty. Offer
  sensible suggestions where it helps (e.g. today as the effective date, or 1 year terms).
- Every field except modifications is required. Years are only needed for the term
  option that uses them. Ask whether there are any modifications, but it is fine to have none.
- When every required field is filled, summarize the key terms and tell the user they
  can download the PDF with the Download PDF button.
- Only discuss this NDA. You do not give legal advice.
"""


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(CamelModel):
    messages: list[Message]
    fields: NdaFields
    today: str


class ChatTurn(CamelModel):
    # Fields come first: the model writes them before its reply, so the reply
    # can build on the updated values.
    fields: NdaFields
    reply: str = Field(
        description="Your next chat message to the user. Never empty."
    )


@lru_cache
def _client() -> OpenAI:
    return OpenAI()


def get_client() -> OpenAI:
    try:
        return _client()
    except OpenAIError as error:  # Raised when OPENAI_API_KEY is not set.
        raise HTTPException(status_code=503, detail="The AI is not configured: OPENAI_API_KEY is missing.") from error


router = APIRouter(prefix="/api/chat")


@router.get("/greeting")
def greeting() -> dict[str, str]:
    return {"reply": GREETING}


@router.post("/message")
def message(request: ChatRequest, client: Annotated[OpenAI, Depends(get_client)]) -> ChatTurn:
    instructions = INSTRUCTIONS.format(
        today=request.today,
        fields=request.fields.model_dump_json(by_alias=True, indent=2),
    )
    try:
        response = client.responses.parse(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            instructions=instructions,
            input=[m.model_dump() for m in request.messages],
            text_format=ChatTurn,
        )
    except OpenAIError as error:
        raise HTTPException(status_code=502, detail="The AI service failed. Please try again.") from error

    if response.output_parsed is None:
        raise HTTPException(status_code=502, detail="The AI gave no usable answer. Please try again.")
    return response.output_parsed
