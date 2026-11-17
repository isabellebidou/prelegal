import { describe, expect, it } from "vitest";
import { mergeAiChanges } from "./merge";
import { defaultNdaFormValues } from "./nda";

describe("mergeAiChanges", () => {
  const sent = { ...defaultNdaFormValues, governingLaw: "Delaware" };

  it("takes the fields the AI changed", () => {
    const returned = {
      ...sent,
      jurisdiction: "New Castle, DE",
      party1: { ...sent.party1, company: "Acme Inc" },
    };
    expect(mergeAiChanges(sent, sent, returned)).toEqual(returned);
  });

  it("keeps fields edited while the AI was replying", () => {
    const current = {
      ...sent,
      purpose: "Edited in the form",
      party2: { ...sent.party2, name: "Alan Turing" },
    };
    const returned = { ...sent, jurisdiction: "New Castle, DE" };

    const merged = mergeAiChanges(current, sent, returned);

    expect(merged.jurisdiction).toBe("New Castle, DE");
    expect(merged.purpose).toBe("Edited in the form");
    expect(merged.party2.name).toBe("Alan Turing");
    expect(merged.governingLaw).toBe("Delaware");
  });

  it("lets the AI clear a field", () => {
    const returned = { ...sent, governingLaw: "" };
    expect(mergeAiChanges(sent, sent, returned).governingLaw).toBe("");
  });

  it("merges nested key terms field by field", () => {
    const base = { terms: { fees: "", pilotPeriod: "" } };
    const current = { terms: { fees: "$5,000", pilotPeriod: "" } };
    const returned = { terms: { fees: "", pilotPeriod: "60 days" } };
    expect(mergeAiChanges(current, base, returned)).toEqual({
      terms: { fees: "$5,000", pilotPeriod: "60 days" },
    });
  });
});
