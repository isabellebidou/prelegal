/**
 * The supported document types (templates/documents.json) and the values the
 * user fills in for them. The Mutual NDA has its own values (see nda.ts); every
 * other document has key terms from its registry entry plus two parties.
 */

import { mergeAiChanges } from "./merge";
import {
  defaultNdaFormValues,
  formatDate,
  isComplete as isNdaComplete,
  type NdaFormValues,
} from "./nda";
import { emptyParty, partyFilled, type PartyDetails } from "./parties";

export const NDA_ID = "mutual-nda";

export interface TermField {
  key: string;
  label: string;
  kind: "text" | "longtext" | "date";
  description: string;
  optional?: boolean;
}

export interface DocumentType {
  id: string;
  name: string;
  shortName: string;
  summary: string;
  template: string;
  parties: [string, string];
  /** Key terms; absent for the Mutual NDA, which has dedicated fields. */
  fields?: TermField[];
}

export interface GenericValues {
  terms: Record<string, string>;
  party1: PartyDetails;
  party2: PartyDetails;
}

export type DocumentValues = NdaFormValues | GenericValues;

/** The document being drafted; `type` is null until one is chosen. */
export type DocumentState =
  | { type: null; values: null }
  | { type: string; values: DocumentValues };

export const NO_DOCUMENT: DocumentState = { type: null, values: null };

export function defaultValues(doc: DocumentType): DocumentValues {
  if (doc.id === NDA_ID) return defaultNdaFormValues;
  return {
    terms: Object.fromEntries((doc.fields ?? []).map((f) => [f.key, ""])),
    party1: emptyParty,
    party2: emptyParty,
  };
}

/** A key term's value as shown on the cover page, or "" when not (validly) filled. */
export function termText(field: TermField, value: string | undefined): string {
  const text = (value ?? "").trim();
  return field.kind === "date" ? formatDate(text) : text;
}

/** Whether every required field is filled, so the document can be downloaded. */
export function isComplete(doc: DocumentType, values: DocumentValues): boolean {
  if (doc.id === NDA_ID) return isNdaComplete(values as NdaFormValues);
  const generic = values as GenericValues;
  return (
    (doc.fields ?? []).every((f) => f.optional || termText(f, generic.terms[f.key]) !== "") &&
    partyFilled(generic.party1) &&
    partyFilled(generic.party2)
  );
}

export interface ChatTurnResult {
  documentType: string | null;
  fields: DocumentValues | null;
}

/**
 * Applies the AI's answer to the current document. If the AI chose or switched
 * the document type, its fields replace the current ones; otherwise only the
 * fields it changed are taken, keeping edits made while it was replying. If the
 * user picked another document type meanwhile, the stale answer is ignored.
 */
export function applyTurn(
  current: DocumentState,
  sent: DocumentState,
  turn: ChatTurnResult,
): DocumentState {
  if (turn.documentType === null || turn.fields === null) return current;
  if (current.type !== sent.type) return current;
  if (turn.documentType !== sent.type || current.values === null || sent.values === null) {
    return { type: turn.documentType, values: turn.fields };
  }
  return { type: current.type, values: mergeAiChanges(current.values, sent.values, turn.fields) };
}
