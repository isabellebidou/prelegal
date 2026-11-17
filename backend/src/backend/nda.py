"""Mutual NDA fields, mirroring NdaFormValues in frontend/src/lib/nda.ts.

Fields use camelCase aliases so the JSON matches the frontend exactly.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

TermUnit = Literal["years", "months"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)


class Party(CamelModel):
    name: str = Field(description="Full name of the person signing for the party (not the company)")
    title: str = Field(description="Signatory's job title")
    company: str = Field(
        description="Company name exactly as the user gave it. Empty if not given yet: never a placeholder like 'Your Company'"
    )
    notice_address: str = Field(description="Email or postal address for notices")


class NdaFields(CamelModel):
    purpose: str = Field(description="How Confidential Information may be used")
    effective_date: str = Field(description="YYYY-MM-DD, or empty if unknown")
    mnda_term_type: Literal["expires", "untilTerminated"] = Field(
        description="Whether the MNDA expires after a fixed length or continues until terminated"
    )
    mnda_term_length: str = Field(
        description="Whole number of mndaTermUnit, used when mndaTermType is 'expires', e.g. '18'"
    )
    mnda_term_unit: TermUnit = Field(description="Unit of mndaTermLength")
    confidentiality_term_type: Literal["fixed", "perpetual"] = Field(
        description="Whether confidentiality lasts a fixed length or in perpetuity"
    )
    confidentiality_term_length: str = Field(
        description="Whole number of confidentialityTermUnit, used when confidentialityTermType is 'fixed', e.g. '6'"
    )
    confidentiality_term_unit: TermUnit = Field(description="Unit of confidentialityTermLength")
    governing_law: str = Field(description="US state whose law governs, e.g. Delaware")
    jurisdiction: str = Field(description="City or county and state of the courts, e.g. New Castle, DE")
    modifications: str = Field(description="Optional changes to the standard terms")
    party1: Party
    party2: Party
