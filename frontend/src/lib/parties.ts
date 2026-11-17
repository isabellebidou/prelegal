/** Signatory details for one party, shared by every document type. */
export interface PartyDetails {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
}

export const emptyParty: PartyDetails = {
  name: "",
  title: "",
  company: "",
  noticeAddress: "",
};

export function partyFilled(party: PartyDetails): boolean {
  return [party.name, party.title, party.company, party.noticeAddress].every(
    (text) => text.trim() !== "",
  );
}

/** Suggested PDF file name, e.g. "Mutual NDA - Acme Inc - Globex". */
export function documentTitle(
  shortName: string,
  values: { party1: PartyDetails; party2: PartyDetails },
): string {
  const companies = [values.party1.company, values.party2.company]
    .map((c) => c.trim())
    .filter(Boolean);
  return [shortName, ...companies].join(" - ");
}
