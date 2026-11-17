import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { coverLayout } from "./coverLayouts";
import {
  applyTurn,
  defaultValues,
  isComplete,
  NDA_ID,
  NO_DOCUMENT,
  termText,
  type DocumentState,
  type DocumentType,
  type GenericValues,
} from "./documents";
import { defaultNdaFormValues } from "./nda";
import { documentTitle } from "./parties";

const TEMPLATES = path.join(__dirname, "../../../templates");
const documents: DocumentType[] = JSON.parse(
  fs.readFileSync(path.join(TEMPLATES, "documents.json"), "utf-8"),
).documents;
const byId = (id: string) => documents.find((d) => d.id === id)!;

const party = (company: string) => ({
  name: `${company} Signer`,
  title: "CEO",
  company,
  noticeAddress: `legal@${company.toLowerCase()}.example`,
});

function completePilot(): GenericValues {
  return {
    terms: {
      product: "Analytics",
      effectiveDate: "2026-11-17",
      pilotPeriod: "60 days",
      fees: "",
      generalCapAmount: "$10,000",
      governingLaw: "Delaware",
      chosenCourts: "New Castle, DE",
    },
    party1: party("Acme"),
    party2: party("Globex"),
  };
}

describe("registry", () => {
  it("has all 11 documents, each with an existing template", () => {
    expect(documents).toHaveLength(11);
    for (const doc of documents) {
      expect(fs.existsSync(path.join(TEMPLATES, doc.template)), doc.template).toBe(true);
    }
  });

  it.each(documents.filter((d) => d.id !== NDA_ID).map((d) => [d.id, d] as const))(
    "%s cover page shows every key term exactly once",
    (_, doc) => {
      const keys = coverLayout(doc).sections.flatMap((s) => s.keys);
      expect([...keys].sort()).toEqual(doc.fields!.map((f) => f.key).sort());
    },
  );

  it("gives the CSA and Pilot dedicated layouts", () => {
    expect(coverLayout(byId("csa")).sections.map((s) => s.heading)).toEqual([
      "Order Form",
      "Key Terms",
    ]);
    expect(coverLayout(byId("pilot")).sections.map((s) => s.heading)).toEqual([
      "Pilot Details",
      "Key Terms",
    ]);
    expect(coverLayout(byId("dpa")).sections.map((s) => s.heading)).toEqual(["Key Terms"]);
  });
});

describe("defaultValues", () => {
  it("uses the dedicated NDA values", () => {
    expect(defaultValues(byId(NDA_ID))).toEqual(defaultNdaFormValues);
  });

  it("starts every key term empty", () => {
    const values = defaultValues(byId("pilot")) as GenericValues;
    expect(Object.keys(values.terms)).toEqual(byId("pilot").fields!.map((f) => f.key));
    expect(Object.values(values.terms).every((v) => v === "")).toBe(true);
  });
});

describe("isComplete", () => {
  const pilot = byId("pilot");

  it("is true with every required field, without optional ones", () => {
    expect(isComplete(pilot, completePilot())).toBe(true);
  });

  it("is false for the starting values of every document", () => {
    for (const doc of documents) expect(isComplete(doc, defaultValues(doc))).toBe(false);
  });

  it("needs each required term, a valid date and both parties", () => {
    const values = completePilot();
    expect(isComplete(pilot, { ...values, terms: { ...values.terms, pilotPeriod: " " } })).toBe(false);
    expect(isComplete(pilot, { ...values, terms: { ...values.terms, effectiveDate: "2026-02-30" } })).toBe(false);
    expect(isComplete(pilot, { ...values, party2: { ...values.party2, title: "" } })).toBe(false);
  });
});

describe("termText", () => {
  const [date, text] = [byId("pilot").fields![1], byId("pilot").fields![2]];

  it("formats dates and trims text", () => {
    expect(termText(date, "2026-11-17")).toBe("November 17, 2026");
    expect(termText(date, "soon")).toBe("");
    expect(termText(text, "  60 days ")).toBe("60 days");
    expect(termText(text, undefined)).toBe("");
  });
});

describe("documentTitle", () => {
  it("names the PDF after the document and the companies filled in", () => {
    expect(documentTitle("Mutual NDA", { party1: party("Acme Inc"), party2: party("Globex") })).toBe(
      "Mutual NDA - Acme Inc - Globex",
    );
    expect(documentTitle("Pilot Agreement", completePilot())).toBe("Pilot Agreement - Acme - Globex");
    expect(documentTitle("AI Addendum", defaultValues(byId("ai-addendum")) as GenericValues)).toBe(
      "AI Addendum",
    );
  });
});

describe("applyTurn", () => {
  const pilot: DocumentState = { type: "pilot", values: defaultValues(byId("pilot")) };

  it("keeps the state when the AI has not chosen a document", () => {
    expect(applyTurn(NO_DOCUMENT, NO_DOCUMENT, { documentType: null, fields: null })).toBe(NO_DOCUMENT);
  });

  it("takes the document the AI chose, with its fields", () => {
    const fields = completePilot();
    expect(applyTurn(NO_DOCUMENT, NO_DOCUMENT, { documentType: "pilot", fields })).toEqual({
      type: "pilot",
      values: fields,
    });
  });

  it("replaces the fields when the AI switches document", () => {
    const fields = defaultValues(byId("csa"));
    expect(applyTurn(pilot, pilot, { documentType: "csa", fields })).toEqual({ type: "csa", values: fields });
  });

  it("merges the AI's changes with edits made meanwhile", () => {
    const sent = pilot.values as GenericValues;
    const current = { type: "pilot", values: { ...sent, terms: { ...sent.terms, fees: "$1" } } };
    const returned = { ...sent, terms: { ...sent.terms, pilotPeriod: "30 days" } };

    const next = applyTurn(current, pilot, { documentType: "pilot", fields: returned });

    expect((next.values as GenericValues).terms).toMatchObject({ fees: "$1", pilotPeriod: "30 days" });
  });

  it("ignores a stale answer when the user picked another document meanwhile", () => {
    const current: DocumentState = { type: "dpa", values: defaultValues(byId("dpa")) };
    expect(applyTurn(current, pilot, { documentType: "pilot", fields: completePilot() })).toBe(current);
  });
});
