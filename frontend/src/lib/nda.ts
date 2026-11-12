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

export type MndaTermType = "expires" | "untilTerminated";
export type ConfidentialityTermType = "years" | "perpetual";

export interface PartyDetails {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
}

export interface NdaFormValues {
  purpose: string;
  /** ISO date string (YYYY-MM-DD) as produced by `<input type="date">`. */
  effectiveDate: string;
  mndaTermType: MndaTermType;
  mndaTermYears: string;
  confidentialityTermType: ConfidentialityTermType;
  confidentialityTermYears: string;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: PartyDetails;
  party2: PartyDetails;
}

const emptyParty: PartyDetails = {
  name: "",
  title: "",
  company: "",
  noticeAddress: "",
};

/**
 * Starting values: everything the user must confirm starts empty, so the
 * preview shows the template placeholders until the chat or form fills them.
 */
export const defaultNdaFormValues: NdaFormValues = {
  purpose: "",
  effectiveDate: "",
  mndaTermType: "expires",
  mndaTermYears: "",
  confidentialityTermType: "years",
  confidentialityTermYears: "",
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

/** "1 year" / "3 years" for a positive whole number, otherwise null. */
function formatYears(value: string): string | null {
  const years = Number(value);
  if (!Number.isInteger(years) || years < 1) return null;
  return `${years} year${years === 1 ? "" : "s"}`;
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

  const mndaYears = formatYears(values.mndaTermYears);
  const confidentialityYears = formatYears(values.confidentialityTermYears);
  const expires = values.mndaTermType === "expires";
  const yearsBased = values.confidentialityTermType === "years";
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
      `${checkbox(expires)}     Expires ${mndaYears ?? "[1 year(s)]"} from Effective Date.`,
    ],
    [
      "- [ ]     Continues until terminated",
      `${checkbox(!expires)}     Continues until terminated`,
    ],
    [
      "- [x]     [1 year(s)] from Effective Date, but in the case of trade secrets",
      `${checkbox(yearsBased)}     ${confidentialityYears ?? "[1 year(s)]"} from Effective Date, but in the case of trade secrets`,
    ],
    ["- [ ]     In perpetuity.", `${checkbox(!yearsBased)}     In perpetuity.`],
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

/** Suggested PDF file name, e.g. "Mutual NDA - Acme Inc - Globex". */
export function documentTitle(values: NdaFormValues): string {
  const companies = [values.party1.company, values.party2.company]
    .map((c) => c.trim())
    .filter(Boolean);
  return ["Mutual NDA", ...companies].join(" - ");
}

/**
 * Whether every required field is filled, so the agreement can be downloaded.
 * Everything except modifications is required; a term's years only when that
 * term option uses them.
 */
export function isComplete(values: NdaFormValues): boolean {
  const filled = (text: string) => text.trim() !== "";
  const partyFilled = (p: PartyDetails) =>
    [p.name, p.title, p.company, p.noticeAddress].every(filled);

  return (
    [values.purpose, values.governingLaw, values.jurisdiction].every(filled) &&
    formatDate(values.effectiveDate) !== "" &&
    (values.mndaTermType === "untilTerminated" || formatYears(values.mndaTermYears) !== null) &&
    (values.confidentialityTermType === "perpetual" ||
      formatYears(values.confidentialityTermYears) !== null) &&
    partyFilled(values.party1) &&
    partyFilled(values.party2)
  );
}

/** Takes each field from `returned` if it differs from `sent`, else from `current`. */
function pickChanged<T extends object>(current: T, sent: T, returned: T): T {
  const result = { ...current };
  for (const key of Object.keys(current) as (keyof T)[]) {
    if (returned[key] !== sent[key]) result[key] = returned[key];
  }
  return result;
}

/**
 * Applies the AI's answer on top of the current values. Only the fields the AI
 * changed from what was sent to it are taken, so edits made in the form while
 * the AI was replying are kept.
 */
export function mergeAiChanges(
  current: NdaFormValues,
  sent: NdaFormValues,
  returned: NdaFormValues,
): NdaFormValues {
  return {
    ...pickChanged(current, sent, returned),
    party1: pickChanged(current.party1, sent.party1, returned.party1),
    party2: pickChanged(current.party2, sent.party2, returned.party2),
  };
}
