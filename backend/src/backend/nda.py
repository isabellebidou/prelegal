"""Mutual NDA fields, mirroring NdaFormValues in frontend/src/lib/nda.ts.

Fields use camelCase aliases so the JSON matches the frontend exactly.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)


class Party(CamelModel):
    name: str = Field(description="Full name of the person signing for the party (not the company)")
    title: str = Field(description="Signatory's job title")
    company: str = Field(description="Company name")
    notice_address: str = Field(description="Email or postal address for notices")


class NdaFields(CamelModel):
    purpose: str = Field(description="How Confidential Information may be used")
    effective_date: str = Field(description="YYYY-MM-DD, or empty if unknown")
    mnda_term_type: Literal["expires", "untilTerminated"] = Field(
        description="Whether the MNDA expires after a number of years or continues until terminated"
    )
    mnda_term_years: str = Field(description="Whole number of years, used when mndaTermType is 'expires'")
    confidentiality_term_type: Literal["years", "perpetual"] = Field(
        description="Whether confidentiality lasts a number of years or in perpetuity"
    )
    confidentiality_term_years: str = Field(
        description="Whole number of years, used when confidentialityTermType is 'years'"
    )
    governing_law: str = Field(description="US state whose law governs, e.g. Delaware")
    jurisdiction: str = Field(description="City or county and state of the courts, e.g. New Castle, DE")
    modifications: str = Field(description="Optional changes to the standard terms")
    party1: Party
    party2: Party
