import { expect, test, type Page } from "@playwright/test";
import {
  chooseDocument,
  COMPLETE_FIELDS,
  createAccountInForm,
  GREETING,
  openCreator,
  signUpViaApi,
  stubChat,
  uniqueEmail,
} from "./helpers";

const preview = (page: Page) => page.locator("article");
const conversation = (page: Page) => page.getByRole("log", { name: "Conversation" });
const status = (page: Page) => page.locator('[aria-live="polite"]').first();

async function say(page: Page, text: string) {
  await page.getByLabel("Message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}

test("shows the draft disclaimer in the app and on the document", async ({ page }) => {
  await stubChat(page);
  await openCreator(page);
  await expect(page.getByRole("note")).toContainText("reviewed by a qualified lawyer");
  await chooseDocument(page, "AI Addendum");
  await expect(preview(page)).toContainText("Draft: subject to legal review before use.");

  // The notice is printed with the document; the app's banner is not.
  await page.emulateMedia({ media: "print" });
  await expect(preview(page).getByText("Draft: subject to legal review")).toBeVisible();
  await expect(page.getByRole("note")).toBeHidden();
});

test("guests can draft and download without signing in", async ({ page }) => {
  await stubChat(page, [{ reply: "All set.", fields: COMPLETE_FIELDS }]);
  await openCreator(page);
  await page.evaluate(() => {
    window.print = () => ((window as { printed?: boolean }).printed = true);
  });

  await say(page, "Here are all the details.");
  await page.getByRole("button", { name: "Download PDF" }).click();

  expect(await page.evaluate(() => (window as { printed?: boolean }).printed)).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "My documents" })).toHaveCount(0);
});

test("a guest is asked to sign in to save, and the draft is then saved", async ({ page }) => {
  await stubChat(page, [{ reply: "Noted.", fields: { governingLaw: "Delaware" } }]);
  await openCreator(page);
  await say(page, "An NDA under Delaware law.");
  await expect(preview(page)).toContainText("Governing Law: Delaware");

  await page.getByRole("button", { name: "Save" }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in to save your document" });
  await expect(dialog).toBeVisible();
  await createAccountInForm(page, "Ada Lovelace", uniqueEmail());

  await expect(dialog).toHaveCount(0);
  await expect(status(page)).toHaveText("Saved");
  // The draft was kept through signing in.
  await expect(preview(page)).toContainText("Governing Law: Delaware");
  await page.getByRole("button", { name: "My documents" }).click();
  await expect(page.getByRole("list", { name: "Saved documents" })).toContainText("Mutual NDA");
});

test("closing the sign-in dialog does not save", async ({ page }) => {
  await stubChat(page);
  await openCreator(page);
  await chooseDocument(page, "Pilot Agreement");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(status(page)).toHaveText("Preview");
});

test("saved documents reopen with their fields and conversation", async ({ page }) => {
  await signUpViaApi(page);
  const pilot = {
    terms: {
      product: "Acme Analytics",
      effectiveDate: "",
      pilotPeriod: "60 days",
      fees: "",
      generalCapAmount: "",
      governingLaw: "Delaware",
      chosenCourts: "",
    },
    party1: { name: "", title: "", company: "Acme", noticeAddress: "" },
    party2: { name: "", title: "", company: "Globex", noticeAddress: "" },
  };
  await stubChat(page, [{ reply: "A pilot it is. When does it start?", documentType: "pilot", fields: pilot }]);
  await openCreator(page);
  await say(page, "Globex wants to trial Acme Analytics for 60 days.");
  await expect(page.getByRole("heading", { name: "Pilot Agreement Creator" })).toBeVisible();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(status(page)).toHaveText("Saved");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();

  // Start over: the editor is empty and the greeting is back.
  await page.getByRole("button", { name: "New document" }).click();
  await expect(page.getByRole("heading", { name: "Document Creator" })).toBeVisible();
  await expect(conversation(page)).toHaveText(GREETING);

  await page.getByRole("button", { name: "My documents" }).click();
  await page.getByRole("button", { name: /^Pilot Agreement - Acme - Globex/ }).click();

  await expect(page.getByRole("heading", { name: "Pilot Agreement Creator" })).toBeVisible();
  await expect(preview(page)).toContainText("60 days");
  await expect(conversation(page)).toContainText("Globex wants to trial Acme Analytics for 60 days.");
  await expect(conversation(page)).toContainText("A pilot it is. When does it start?");
  await expect(status(page)).toHaveText("Saved");

  // Editing marks it unsaved; saving updates the same document.
  await page.getByRole("tab", { name: "Edit fields" }).click();
  await page.getByLabel("Pilot Fees (optional)").fill("$5,000");
  await expect(status(page)).toHaveText("Unsaved changes");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(status(page)).toHaveText("Saved");
  const listed = await (await page.request.get("/api/documents")).json();
  expect(listed).toHaveLength(1);
});

test("documents can be deleted from My documents", async ({ page }) => {
  await signUpViaApi(page);
  await stubChat(page);
  await openCreator(page);
  await chooseDocument(page, "Business Associate Agreement");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(status(page)).toHaveText("Saved");

  await page.getByRole("button", { name: "My documents" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete Business Associate Agreement" }).click();

  await expect(page.getByText("No saved documents yet")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  // The open draft is no longer saved anywhere.
  await expect(status(page)).toHaveText("Preview");
});

test("New document asks before discarding unsaved changes", async ({ page }) => {
  await stubChat(page);
  await openCreator(page);
  await chooseDocument(page, "Mutual Non-Disclosure Agreement");
  await page.getByLabel("Governing law", { exact: true }).fill("Delaware");

  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "New document" }).click();
  await expect(page.getByLabel("Governing law", { exact: true })).toHaveValue("Delaware");

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "New document" }).click();
  await expect(page.getByRole("heading", { name: "Document Creator" })).toBeVisible();
});

test("signing out forgets the saved copy, so another account saves its own", async ({ page }) => {
  await signUpViaApi(page);
  await stubChat(page);
  await openCreator(page);
  await chooseDocument(page, "Service Level Agreement");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(status(page)).toHaveText("Saved");

  await page.getByRole("button", { name: /Account:/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(status(page)).toHaveText("Preview");

  await page.getByRole("button", { name: "Save" }).click();
  await createAccountInForm(page, "Alan Turing", uniqueEmail("alan"));
  await expect(status(page)).toHaveText("Saved");
  const listed = await (await page.request.get("/api/documents")).json();
  expect(listed).toHaveLength(1);
});
