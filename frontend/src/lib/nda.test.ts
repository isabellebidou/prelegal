import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultNdaFormValues,
  documentTitle,
  escapeMarkdown,
  fillCoverPage,
  formatDate,
  type NdaFormValues,
} from "./nda";

const template = fs.readFileSync(
  path.join(__dirname, "../../../templates/Mutual-NDA-coverpage.md"),
  "utf-8",
);

const filled: NdaFormValues = {
  purpose: "Exploring a joint venture.",
  effectiveDate: "2026-11-11",
  mndaTermType: "expires",
  mndaTermYears: "2",
  confidentialityTermType: "years",
  confidentialityTermYears: "3",
  governingLaw: "Delaware",
  jurisdiction: "New Castle, DE",
  modifications: "",
  party1: {
    name: "Ada Lovelace",
    title: "CEO",
    company: "Acme Inc",
    noticeAddress: "ada@acme.example",
  },
  party2: {
    name: "Alan Turing",
    title: "CTO",
    company: "Globex",
    noticeAddress: "1 Main St\nSpringfield",
  },
};

describe("fillCoverPage", () => {
  it("fills every field from the form", () => {
    const doc = fillCoverPage(template, filled);

    expect(doc).toContain("Exploring a joint venture\\.");
    expect(doc).toContain("### Effective Date\nNovember 11, 2026");
    expect(doc).toContain("- [x]     Expires 2 years from Effective Date.");
    expect(doc).toContain("- [ ]     Continues until terminated");
    expect(doc).toContain("- [x]     3 years from Effective Date, but in the case");
    expect(doc).toContain("- [ ]     In perpetuity.");
    expect(doc).toContain("Governing Law: Delaware");
    expect(doc).toContain("Jurisdiction: New Castle, DE");
    expect(doc).toContain("None.");
    expect(doc).toContain("| Print Name | Ada Lovelace | Alan Turing |");
    expect(doc).toContain("| Title | CEO | CTO |");
    expect(doc).toContain("| Company | Acme Inc | Globex |");
    expect(doc).toContain("| ada@acme\\.example | 1 Main St<br>Springfield |");
    expect(doc).not.toContain("[Fill in");
    expect(doc).not.toContain("[Today’s date]");
  });

  it("checks the alternative term options", () => {
    const doc = fillCoverPage(template, {
      ...filled,
      mndaTermType: "untilTerminated",
      confidentialityTermType: "perpetual",
    });

    expect(doc).toContain("- [ ]     Expires 2 years from Effective Date.");
    expect(doc).toContain("- [x]     Continues until terminated");
    expect(doc).toContain("- [ ]     3 years from Effective Date");
    expect(doc).toContain("- [x]     In perpetuity.");
  });

  it("keeps the template placeholders for empty or invalid values", () => {
    const doc = fillCoverPage(template, {
      ...defaultNdaFormValues,
      purpose: "  ",
      mndaTermYears: "0",
      confidentialityTermYears: "",
    });

    expect(doc).toContain(
      "[Evaluating whether to enter into a business relationship with the other party.]",
    );
    expect(doc).toContain("[Today’s date]");
    expect(doc).toContain("Expires [1 year(s)] from Effective Date.");
    expect(doc).toContain("- [x]     [1 year(s)] from Effective Date");
    expect(doc).toContain("[Fill in state]");
    expect(doc).toContain("| Print Name |  |  |");
  });

  it("uses singular 'year' for a one-year term", () => {
    const doc = fillCoverPage(template, { ...filled, mndaTermYears: "1" });
    expect(doc).toContain("Expires 1 year from Effective Date.");
  });

  it("escapes markdown and HTML in user input", () => {
    const doc = fillCoverPage(template, {
      ...filled,
      governingLaw: "<script>alert(1)</script>",
      party1: { ...filled.party1, company: "A | B *Corp*" },
    });

    expect(doc).not.toContain("<script>");
    expect(doc).toContain("\\<script\\>");
    expect(doc).toContain("| A \\| B \\*Corp\\* |");
  });

  it("keeps multi-line modifications as hard line breaks", () => {
    const doc = fillCoverPage(template, {
      ...filled,
      modifications: "Section 5 is deleted\nSection 9 applies",
    });
    expect(doc).toContain("Section 5 is deleted\\\nSection 9 applies");
  });

  it("does not mistake user input for template text", () => {
    const doc = fillCoverPage(template, {
      ...filled,
      purpose: "List any modifications to the MNDA",
      modifications: "Section 5 is deleted",
    });
    expect(doc).toContain("### Purpose\n<label>How Confidential Information may be used</label>\n\nList any modifications to the MNDA");
    expect(doc).toContain("### MNDA Modifications\nSection 5 is deleted");
  });

  it("throws when the template no longer matches", () => {
    expect(() => fillCoverPage("# Unrelated", filled)).toThrow(/template is missing/);
  });
});

describe("formatDate", () => {
  it("formats ISO dates without time zone drift", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
  });

  it("rejects malformed or impossible dates", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("2026-02-30")).toBe("");
    expect(formatDate("11/11/2026")).toBe("");
  });
});

describe("escapeMarkdown", () => {
  it("backslash-escapes markdown punctuation", () => {
    expect(escapeMarkdown("[a](b) _c_ #d")).toBe("\\[a\\]\\(b\\) \\_c\\_ \\#d");
  });
});

describe("documentTitle", () => {
  it("names the PDF after the companies that are filled in", () => {
    expect(documentTitle(filled)).toBe("Mutual NDA - Acme Inc - Globex");
    expect(documentTitle(defaultNdaFormValues)).toBe("Mutual NDA");
  });
});
