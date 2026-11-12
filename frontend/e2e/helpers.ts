import { expect, type Page } from "@playwright/test";
import { defaultNdaFormValues, type NdaFormValues } from "../src/lib/nda";

export const GREETING = "Hi! What is the NDA for?";

export const COMPLETE_FIELDS: NdaFormValues = {
  purpose: "Exploring a joint venture.",
  effectiveDate: "2026-11-12",
  mndaTermType: "expires",
  mndaTermYears: "2",
  confidentialityTermType: "years",
  confidentialityTermYears: "2",
  governingLaw: "Delaware",
  jurisdiction: "New Castle, DE",
  modifications: "",
  party1: { name: "Ada Lovelace", title: "CEO", company: "Acme Inc", noticeAddress: "ada@acme.example" },
  party2: { name: "Alan Turing", title: "CTO", company: "Globex", noticeAddress: "alan@globex.example" },
};

/**
 * Stubs the chat API so no test calls the real AI. Each call to
 * /api/chat/message answers with the next turn and records the request body.
 */
export async function stubChat(
  page: Page,
  turns: { reply: string; fields: Partial<NdaFormValues> }[] = [],
) {
  const requests: { messages: { role: string; content: string }[]; fields: NdaFormValues; today: string }[] = [];
  await page.route("**/api/chat/greeting", (route) => route.fulfill({ json: { reply: GREETING } }));
  await page.route("**/api/chat/message", (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const turn = turns.shift();
    if (!turn) return route.fulfill({ status: 502, json: { detail: "The AI service failed. Please try again." } });
    return route.fulfill({ json: { reply: turn.reply, fields: { ...defaultNdaFormValues, ...turn.fields } } });
  });
  return requests;
}

/** Opens the NDA creator and waits for the app to hydrate (the greeting is fetched client-side). */
export async function openNdaCreator(page: Page) {
  await page.goto("/nda/");
  await expect(page.getByRole("log", { name: "Conversation" })).toContainText(GREETING);
}
