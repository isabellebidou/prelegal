import { expect, test, type Page } from "@playwright/test";
import { COMPLETE_FIELDS, GREETING, openNdaCreator, stubChat } from "./helpers";

const conversation = (page: Page) =>
  page.getByRole("log", { name: "Conversation" });
const messageBox = (page: Page) => page.getByLabel("Message");

test("greets the user and focuses the message box", async ({ page }) => {
  await stubChat(page);
  await openNdaCreator(page);
  await expect(messageBox(page)).toBeFocused();
  await expect(page.getByRole("button", { name: "Download PDF" })).toHaveCount(0);
});

test("fills the agreement from the AI's answer and sends the conversation", async ({ page }) => {
  const requests = await stubChat(page, [
    {
      reply: "Got it. Who are the **two parties**?",
      fields: { purpose: "Exploring a joint venture.", governingLaw: "Delaware" },
    },
  ]);
  await openNdaCreator(page);

  await messageBox(page).fill("A joint venture, under Delaware law.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(conversation(page)).toContainText("A joint venture, under Delaware law.");
  await expect(conversation(page)).toContainText("Got it. Who are the two parties?");
  // The AI's markdown is rendered, not shown as asterisks.
  await expect(conversation(page).locator("strong")).toHaveText("two parties");
  await expect(page.locator("article")).toContainText("Exploring a joint venture.");
  await expect(page.locator("article")).toContainText("Governing Law: Delaware");
  await expect(messageBox(page)).toBeFocused();
  await expect(messageBox(page)).toHaveValue("");

  expect(requests).toHaveLength(1);
  expect(requests[0].messages).toEqual([
    { role: "assistant", content: GREETING },
    { role: "user", content: "A joint venture, under Delaware law." },
  ]);
  expect(requests[0].fields.purpose).toBe("");
  expect(requests[0].today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("shows Download PDF once the chat has gathered every required field", async ({ page }) => {
  await stubChat(page, [{ reply: "All set. You can download the PDF.", fields: COMPLETE_FIELDS }]);
  await openNdaCreator(page);

  await messageBox(page).fill("Here are all the details...");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await expect(page.locator("article")).toContainText("Alan Turing");
});

test("keeps the message to resend when the AI fails", async ({ page }) => {
  await stubChat(page); // No turns: every message gets a 502.
  await openNdaCreator(page);

  await messageBox(page).fill("Acme and Globex");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "try again" })).toBeVisible();
  await expect(messageBox(page)).toHaveValue("Acme and Globex");
  await expect(conversation(page)).not.toContainText("Acme and Globex");
});

test("sends fields edited in the form, and keeps the chat when switching tabs", async ({ page }) => {
  const requests = await stubChat(page, [
    { reply: "Noted.", fields: { governingLaw: "California" } },
  ]);
  await openNdaCreator(page);

  await page.getByRole("tab", { name: "Edit fields" }).click();
  await page.getByLabel("Governing law", { exact: true }).fill("California");
  await page.getByRole("tab", { name: "Chat" }).click();

  await expect(conversation(page)).toContainText(GREETING);
  await messageBox(page).fill("That's right.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(conversation(page)).toContainText("Noted.");
  expect(requests[0].fields.governingLaw).toBe("California");
});

test("keeps form edits made while the AI is replying", async ({ page }) => {
  await stubChat(page);
  let reply!: () => void;
  const replied = new Promise<void>((resolve) => (reply = resolve));
  await page.route("**/api/chat/message", async (route) => {
    await replied;
    const { fields } = route.request().postDataJSON();
    // The AI fills the jurisdiction and echoes everything else as it was sent.
    await route.fulfill({
      json: { reply: "Noted.", fields: { ...fields, jurisdiction: "New Castle, DE" } },
    });
  });
  await openNdaCreator(page);

  await messageBox(page).fill("Courts in New Castle, DE.");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByRole("tab", { name: "Edit fields" }).click();
  await page.getByLabel("Governing law", { exact: true }).fill("Delaware");
  reply();

  await expect(page.locator("article")).toContainText("New Castle, DE");
  await expect(page.locator("article")).toContainText("Governing Law: Delaware");
  await expect(page.getByLabel("Governing law", { exact: true })).toHaveValue("Delaware");
});
