/**
 * How each document's cover page is laid out. The Cloud Service Agreement and
 * Pilot Agreement have dedicated layouts (an order form / pilot details plus
 * key terms); every other document lists its key terms in one section.
 */

import type { DocumentType } from "./documents";

export interface CoverSection {
  heading: string;
  keys: string[];
}

export interface CoverLayout {
  intro: string;
  sections: CoverSection[];
}

const KEY_TERMS = ["effectiveDate", "generalCapAmount", "governingLaw", "chosenCourts"];

function standardIntro(name: string, coverPage = "this Cover Page"): string {
  return (
    `This ${name} consists of: (1) ${coverPage} (“Cover Page”) and (2) the Common Paper ` +
    `${name} Standard Terms (“Standard Terms”). Any modifications of the Standard Terms ` +
    "should be made on the Cover Page, which will control over conflicts with the Standard Terms."
  );
}

const DEDICATED: Record<string, (doc: DocumentType) => CoverLayout> = {
  csa: (doc) => ({
    intro: standardIntro(doc.name, "this Cover Page, including the Order Form below"),
    sections: [
      {
        heading: "Order Form",
        keys: ["cloudService", "subscriptionPeriod", "fees", "technicalSupport", "nonRenewalNoticeDate"],
      },
      { heading: "Key Terms", keys: KEY_TERMS },
    ],
  }),
  pilot: (doc) => ({
    intro: standardIntro(doc.name),
    sections: [
      { heading: "Pilot Details", keys: ["product", "pilotPeriod", "fees"] },
      { heading: "Key Terms", keys: KEY_TERMS },
    ],
  }),
};

export function coverLayout(doc: DocumentType): CoverLayout {
  const dedicated = DEDICATED[doc.id];
  if (dedicated) return dedicated(doc);
  return {
    intro: standardIntro(doc.name),
    sections: [{ heading: "Key Terms", keys: (doc.fields ?? []).map((f) => f.key) }],
  };
}
