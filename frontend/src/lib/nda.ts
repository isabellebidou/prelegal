/**
 * Fills the Common Paper Mutual NDA cover page template with the values a
 * user enters in the form.
 *
 * The template (templates/Mutual-NDA-coverpage.md) is filled by replacing
 * exact snippets of its text. If the template changes so that a snippet is no
 * longer found, `fillCoverPage` throws rather than silently producing an
 * incomplete document.
 *
 * Empty form values leave the template's original placeholder in place, so
 * the preview shows exactly what still needs to be filled in.
 */

import { emptyParty, partyFilled, type PartyDetails } from "./parties";

export type { PartyDetails } from "./parties";
export type MndaTermType = "expires" | "untilTerminated";
export type ConfidentialityTermType = "fixed" | "perpetual";
export type TermUnit = "months" | "years";

export interface NdaFormValues {
  purpose: string;
  /** ISO date string (YYYY-MM-DD) as produced by `<input type="date">`. */
  effectiveDate: string;
  mndaTermType: MndaTermType;
  /** Whole number of `mndaTermUnit`s, e.g. "18" months. */
  mndaTermLength: string;
  mndaTermUnit: TermUnit;
  confidentialityTermType: ConfidentialityTermType;
  confidentialityTermLength: string;
  confidentialityTermUnit: TermUnit;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: PartyDetails;
  party2: PartyDetails;
}

/**
 * Starting values: everything the user must confirm starts empty, so the
 * preview shows the template placeholders until the chat or form fills them.
 */
export const defaultNdaFormValues: NdaFormValues = {
  purpose: "",
  effectiveDate: "",
  mndaTermType: "expires",
  mndaTermLength: "",
  mndaTermUnit: "years",
  confidentialityTermType: "fixed",
  confidentialityTermLength: "",
  confidentialityTermUnit: "years",
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  party1: emptyParty,
  party2: emptyParty,
};

/** Escapes text so markdown/HTML in user input is rendered literally. */
export function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!|<>~&]/g, "\\$&");
}

/** Escaped text for a paragraph; line breaks are kept as hard breaks. */
function paragraphText(text: string): string {
  return escapeMarkdown(text.trim()).replace(/\r?\n/g, "\\\n");
}

/** Escaped text for a table cell, which must stay on one markdown line. */
function cellText(text: string): string {
  return escapeMarkdown(text.trim()).replace(/\r?\n/g, "<br>");
}

/** Formats `YYYY-MM-DD` as e.g. "November 11, 2026"; "" if not a valid date. */
export function formatDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return "";
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

/**
 * "1 year", "3 years", "6 months", "18 months" for a positive whole number of
 * the unit, otherwise null. Lengths below a year or between whole years are
 * given in months, so a fractional number of years that is a whole number of
 * months (e.g. 1.5 years) is shown in months ("18 months").
 */
export function formatDuration(length: string, unit: TermUnit): string | null {
  let count = Number(length.trim());
  if (!length.trim() || !(count > 0)) return null;
  if (unit === "years" && !Number.isInteger(count)) {
    count = Math.round(count * 12 * 1e6) / 1e6;
    unit = "months";
  }
  if (!Number.isInteger(count)) return null;
  const word = unit === "months" ? "month" : "year";
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function checkbox(checked: boolean): string {
  return checked ? "- [x]" : "- [ ]";
}

/**
 * Applies [find, replacement] pairs to `template`. Every `find` is located in
 * the original template (never in already-substituted text), so user input
 * can't be mistaken for a later snippet.
 */
function replaceSnippets(
  template: string,
  replacements: readonly (readonly [string, string])[],
): string {
  const located = replacements
    .map(([find, replacement]) => {
      const index = template.indexOf(find);
      if (index === -1) {
        throw new Error(`Mutual NDA cover page template is missing: "${find}"`);
      }
      return { start: index, end: index + find.length, replacement };
    })
    .sort((a, b) => a.start - b.start);

  let result = "";
  let cursor = 0;
  for (const { start, end, replacement } of located) {
    result += template.slice(cursor, start) + replacement;
    cursor = end;
  }
  return result + template.slice(cursor);
}

export function fillCoverPage(template: string, values: NdaFormValues): string {
  // Each entry: [exact template text, replacement]. Replacements keep the
  // template text when the corresponding form value is empty.
  const fill = (find: string, value: string, render: (v: string) => string) =>
    [find, value.trim() ? render(value) : find] as const;

  const mndaLength = formatDuration(values.mndaTermLength, values.mndaTermUnit);
  const confidentialityLength = formatDuration(
    values.confidentialityTermLength,
    values.confidentialityTermUnit,
  );
  const expires = values.mndaTermType === "expires";
  const fixed = values.confidentialityTermType === "fixed";
  const { party1: p1, party2: p2 } = values;

  const replacements: (readonly [string, string])[] = [
    fill(
      "[Evaluating whether to enter into a business relationship with the other party.]",
      values.purpose,
      paragraphText,
    ),
    fill("[Today’s date]", formatDate(values.effectiveDate), (d) => d),
    [
      "- [x]     Expires [1 year(s)] from Effective Date.",
      `${checkbox(expires)}     Expires ${mndaLength ?? "[1 year(s)]"} from Effective Date.`,
    ],
    [
      "- [ ]     Continues until terminated",
      `${checkbox(!expires)}     Continues until terminated`,
    ],
    [
      "- [x]     [1 year(s)] from Effective Date, but in the case of trade secrets",
      `${checkbox(fixed)}     ${confidentialityLength ?? "[1 year(s)]"} from Effective Date, but in the case of trade secrets`,
    ],
    ["- [ ]     In perpetuity.", `${checkbox(!fixed)}     In perpetuity.`],
    fill("[Fill in state]", values.governingLaw, escapeMarkdown),
    fill(
      "[Fill in city or county and state, i.e. “courts located in New Castle, DE”]",
      values.jurisdiction,
      escapeMarkdown,
    ),
    [
      "List any modifications to the MNDA",
      values.modifications.trim() ? paragraphText(values.modifications) : "None.",
    ],
    ["| Print Name | |", `| Print Name | ${cellText(p1.name)} | ${cellText(p2.name)} |`],
    ["| Title | | |", `| Title | ${cellText(p1.title)} | ${cellText(p2.title)} |`],
    ["| Company | | |", `| Company | ${cellText(p1.company)} | ${cellText(p2.company)} |`],
    [
      "<label>Use either email or postal address</label> | | |",
      `<label>Use either email or postal address</label> | ${cellText(p1.noticeAddress)} | ${cellText(p2.noticeAddress)} |`,
    ],
  ];

  return replaceSnippets(template, replacements);
}

/**
 * Whether every required field is filled, so the agreement can be downloaded.
 * Everything except modifications is required; a term's length only when that
 * term option uses it.
 */
export function isComplete(values: NdaFormValues): boolean {
  const filled = (text: string) => text.trim() !== "";

  return (
    [values.purpose, values.governingLaw, values.jurisdiction].every(filled) &&
    formatDate(values.effectiveDate) !== "" &&
    (values.mndaTermType === "untilTerminated" ||
      formatDuration(values.mndaTermLength, values.mndaTermUnit) !== null) &&
    (values.confidentialityTermType === "perpetual" ||
      formatDuration(values.confidentialityTermLength, values.confidentialityTermUnit) !== null) &&
    partyFilled(values.party1) &&
    partyFilled(values.party2)
  );
}
