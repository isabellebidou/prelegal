import { expect, type Page } from "@playwright/test";
import { defaultNdaFormValues, type NdaFormValues } from "../src/lib/nda";

export const GREETING = "Hi! What would you like to create?";

export const COMPLETE_FIELDS: NdaFormValues = {
  purpose: "Exploring a joint venture.",
  effectiveDate: "2026-11-12",
  mndaTermType: "expires",
  mndaTermLength: "2",
  mndaTermUnit: "years",
  confidentialityTermType: "fixed",
  confidentialityTermLength: "18",
  confidentialityTermUnit: "months",
  governingLaw: "Delaware",
  jurisdiction: "New Castle, DE",
  modifications: "",
  party1: { name: "Ada Lovelace", title: "CEO", company: "Acme Inc", noticeAddress: "ada@acme.example" },
  party2: { name: "Alan Turing", title: "CTO", company: "Globex", noticeAddress: "alan@globex.example" },
};

export interface StubTurn {
  reply: string;
  /** Defaults to the Mutual NDA; null means the AI has not chosen a document. */
  documentType?: string | null;
  /** NDA turns are merged over the default NDA values; others are sent as is. */
  fields?: object;
}

export interface ChatRequestBody {
  messages: { role: string; content: string }[];
  documentType: string | null;
  fields: Record<string, unknown> | null;
  today: string;
}

/**
 * Stubs the chat API so no test calls the real AI. Each call to
 * /api/chat/message answers with the next turn and records the request body.
 */
export async function stubChat(page: Page, turns: StubTurn[] = []) {
  const requests: ChatRequestBody[] = [];
  await page.route("**/api/chat/greeting", (route) => route.fulfill({ json: { reply: GREETING } }));
  await page.route("**/api/chat/message", (route) => {
    requests.push(route.request().postDataJSON());
    const turn = turns.shift();
    if (!turn) return route.fulfill({ status: 502, json: { detail: "The AI service failed. Please try again." } });
    const documentType = turn.documentType === undefined ? "mutual-nda" : turn.documentType;
    const fields =
      documentType === null ? null : documentType === "mutual-nda" ? { ...defaultNdaFormValues, ...turn.fields } : turn.fields;
    return route.fulfill({ json: { reply: turn.reply, documentType, fields } });
  });
  return requests;
}

/** Opens the document creator and waits for the app to hydrate (the greeting is fetched client-side). */
export async function openCreator(page: Page) {
  await page.goto("/create/");
  await expect(page.getByRole("log", { name: "Conversation" })).toContainText(GREETING);
}

/** Picks a document type by hand in the "Edit fields" tab. */
export async function chooseDocument(page: Page, name: string) {
  await page.getByRole("tab", { name: "Edit fields" }).click();
  await page.getByLabel("Document type").selectOption({ label: name });
}

/** A unique email, so parallel tests sharing one backend don't collide. */
export function uniqueEmail(name = "ada"): string {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export const PASSWORD = "correct horse battery";

/** Creates an account through the API; the browser context gets the session cookie. */
export async function signUpViaApi(page: Page, name = "Ada Lovelace", email = uniqueEmail()) {
  const response = await page.request.post("/api/auth/signup", { data: { name, email, password: PASSWORD } });
  expect(response.status()).toBe(201);
  return { name, email };
}

/** Fills in the "Create account" form (on the landing page or in the sign-in dialog). */
export async function createAccountInForm(page: Page, name: string, email: string) {
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}
