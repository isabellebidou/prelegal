import { expect, test, type Page } from "@playwright/test";
import { chooseDocument, COMPLETE_FIELDS, openCreator, stubChat } from "./helpers";

const preview = (page: Page) => page.locator("article");
const messageBox = (page: Page) => page.getByLabel("Message");

async function say(page: Page, text: string) {
  await messageBox(page).fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}

const party = (company: string) => ({
  name: `${company} Signer`,
  title: "CEO",
  company,
  noticeAddress: `legal@${company.toLowerCase()}.example`,
});

const PILOT_FIELDS = {
  terms: {
    product: "Acme Analytics",
    effectiveDate: "",
    pilotPeriod: "60 days",
    fees: "",
    generalCapAmount: "",
    governingLaw: "Delaware",
    chosenCourts: "",
  },
  party1: party("Acme"),
  party2: party("Globex"),
};

test("starts with no document and invites the user to choose one", async ({ page }) => {
  await stubChat(page);
  await openCreator(page);
  await expect(page.getByRole("heading", { name: "Document Creator" })).toBeVisible();
  await expect(preview(page)).toContainText("Tell the AI what agreement you need");
  await expect(page.getByRole("button", { name: "Download PDF" })).toHaveCount(0);
});

test("the AI detects the document type and fills its cover page", async ({ page }) => {
  const requests = await stubChat(page, [
    { reply: "A Pilot Agreement fits. When should it start?", documentType: "pilot", fields: PILOT_FIELDS },
  ]);
  await openCreator(page);

  await say(page, "Globex wants to trial Acme Analytics for 60 days, Delaware law.");

  await expect(page.getByRole("heading", { name: "Pilot Agreement Creator" })).toBeVisible();
  const doc = preview(page);
  await expect(doc.getByRole("heading", { name: "PILOT DETAILS" })).toBeVisible();
  await expect(doc).toContainText("60 days");
  await expect(doc).toContainText("Acme Analytics");
  await expect(doc).toContainText("[Fill in General Cap Amount]");
  // The Pilot Agreement standard terms follow the cover page.
  await expect(doc).toContainText("Pilot Access");
  await expect(doc.locator("table tr", { hasText: "Company" })).toContainText("Globex");
  await expect(messageBox(page)).toBeFocused();
  expect(requests[0].documentType).toBeNull();

  // The next message carries the chosen type and its fields.
  await say(page, "Start today.");
  await expect(page.getByRole("alert").filter({ hasText: "try again" })).toBeVisible();
  expect(requests[1].documentType).toBe("pilot");
  expect(requests[1].fields).toEqual(PILOT_FIELDS);
});

test("offers the closest document when the request is unsupported", async ({ page }) => {
  const reply = "I can't generate an employment contract. The closest is a Professional Services Agreement. Want that?";
  await stubChat(page, [{ reply, documentType: null }]);
  await openCreator(page);

  await say(page, "I need an employment contract.");

  await expect(page.getByRole("log", { name: "Conversation" })).toContainText(reply);
  await expect(page.getByRole("heading", { name: "Document Creator" })).toBeVisible();
  await expect(preview(page)).toContainText("Tell the AI what agreement you need");
});

test("the AI can switch to another document mid-conversation", async ({ page }) => {
  await stubChat(page, [
    { reply: "Let's do an NDA.", fields: { governingLaw: "Delaware" } },
    {
      reply: "Switching to a Cloud Service Agreement.",
      documentType: "csa",
      fields: { terms: { governingLaw: "Delaware" }, party1: party("Acme"), party2: party("Globex") },
    },
  ]);
  await openCreator(page);

  await say(page, "An NDA please, Delaware.");
  await expect(page.getByRole("heading", { name: "Mutual NDA Creator" })).toBeVisible();
  await say(page, "Actually, we are selling them our SaaS product.");

  await expect(page.getByRole("heading", { name: "Cloud Service Agreement Creator" })).toBeVisible();
  await expect(preview(page).getByRole("heading", { name: "ORDER FORM" })).toBeVisible();
});

test("a document chosen by hand can be completed and downloaded", async ({ page }) => {
  await stubChat(page);
  await openCreator(page);
  await page.evaluate(() => {
    const w = window as unknown as { printedTitle?: string };
    window.print = () => {
      w.printedTitle = document.title;
    };
  });
  await chooseDocument(page, "Cloud Service Agreement");

  const terms = page.getByRole("group", { name: "Key terms" });
  await terms.getByLabel("Cloud Service", { exact: true }).fill("Acme Analytics");
  await terms.getByLabel("Effective Date", { exact: true }).fill("2027-01-01");
  await terms.getByLabel("Subscription Period", { exact: true }).fill("1 year");
  await terms.getByLabel("Fees", { exact: true }).fill("$2,000 per month");
  await terms.getByLabel("General Cap Amount", { exact: true }).fill("12 months of fees");
  await terms.getByLabel("Governing Law", { exact: true }).fill("Delaware");
  await expect(page.getByRole("button", { name: "Download PDF" })).toHaveCount(0);
  await terms.getByLabel("Chosen Courts", { exact: true }).fill("New Castle, DE");
  for (const [role, company] of [["Provider", "Acme"], ["Customer", "Globex"]] as const) {
    const group = page.getByRole("group", { name: role });
    const p = party(company);
    await group.getByLabel("Company", { exact: true }).fill(p.company);
    await group.getByLabel("Signatory name", { exact: true }).fill(p.name);
    await group.getByLabel("Title", { exact: true }).fill(p.title);
    await group.getByLabel("Notice address", { exact: true }).fill(p.noticeAddress);
  }

  const doc = preview(page);
  await expect(doc).toContainText("January 1, 2027");
  await expect(doc).toContainText("$2,000 per month");
  // Optional terms left empty read "None."
  await expect(doc.locator("div", { hasText: /^Technical Support/ })).toContainText("None.");
  await expect(doc.locator("thead")).toContainText("PROVIDER");

  await page.getByRole("button", { name: "Download PDF" }).click();
  expect(await page.evaluate(() => (window as { printedTitle?: string }).printedTitle)).toBe(
    "Cloud Service Agreement - Acme - Globex",
  );
});

test("every document type can be chosen and previewed", async ({ page }) => {
  await stubChat(page);
  await openCreator(page);
  await page.getByRole("tab", { name: "Edit fields" }).click();
  const select = page.getByLabel("Document type");
  const names = (await select.locator("option").allTextContents()).slice(1);
  expect(names).toHaveLength(11);

  for (const name of names) {
    await select.selectOption({ label: name });
    // Each preview opens with the document's own title.
    await expect(preview(page).locator("h1").first()).toHaveText(name);
  }
});

test("NDA chat turns with months show in the preview", async ({ page }) => {
  await stubChat(page, [
    {
      reply: "Done.",
      fields: { ...COMPLETE_FIELDS, mndaTermLength: "6", mndaTermUnit: "months" },
    },
  ]);
  await openCreator(page);
  await say(page, "NDA for 6 months, confidentiality 18 months.");

  await expect(preview(page)).toContainText("Expires 6 months from Effective Date.");
  await expect(preview(page)).toContainText("18 months from Effective Date");
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
});
