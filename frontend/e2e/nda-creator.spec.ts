import { expect, test, type Page } from "@playwright/test";

const party = (page: Page, name: "Party 1" | "Party 2") =>
  page.getByRole("group", { name });

const preview = (page: Page) => page.locator("article");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Wait for hydration: the effective date is filled in client-side.
  await expect(page.getByLabel("Effective date", { exact: true })).not.toHaveValue("");
});

test("updates the NDA preview live as the form is filled in", async ({ page }) => {
  await page.getByLabel("Purpose", { exact: true }).fill("Exploring a joint venture.");
  await page.getByLabel("Governing law", { exact: true }).fill("Delaware");
  await page.getByLabel("Jurisdiction", { exact: true }).fill("New Castle, DE");
  await page.getByLabel("Modifications", { exact: true }).fill("Section 5 is deleted.");

  for (const [name, values] of [
    ["Party 1", ["Acme Inc", "Ada Lovelace", "CEO", "ada@acme.example"]],
    ["Party 2", ["Globex", "Alan Turing", "CTO", "alan@globex.example"]],
  ] as const) {
    const group = party(page, name);
    await group.getByLabel("Company", { exact: true }).fill(values[0]);
    await group.getByLabel("Signatory name", { exact: true }).fill(values[1]);
    await group.getByLabel("Title", { exact: true }).fill(values[2]);
    await group.getByLabel("Notice address", { exact: true }).fill(values[3]);
  }

  const doc = preview(page);
  await expect(doc).toContainText("Exploring a joint venture.");
  await expect(doc).toContainText("Governing Law: Delaware");
  await expect(doc).toContainText("Jurisdiction: New Castle, DE");
  await expect(doc).toContainText("Section 5 is deleted.");
  await expect(doc).not.toContainText("[Fill in");

  const rows = doc.locator("table tr");
  await expect(rows.filter({ hasText: "Print Name" })).toContainText("Ada Lovelace");
  await expect(rows.filter({ hasText: "Print Name" })).toContainText("Alan Turing");
  await expect(rows.filter({ hasText: "Company" })).toContainText("Acme Inc");
  await expect(rows.filter({ hasText: "Company" })).toContainText("Globex");
  await expect(rows.filter({ hasText: "Notice Address" })).toContainText(
    "alan@globex.example",
  );
});

test("reflects the term options in the cover page checkboxes", async ({ page }) => {
  const doc = preview(page);
  const box = (text: string) =>
    doc.locator("li", { hasText: text }).locator('input[type="checkbox"]');

  await page.getByLabel("MNDA term in years", { exact: true }).fill("2");
  await page.getByLabel("Term of confidentiality in years", { exact: true }).fill("3");
  await expect(doc).toContainText("Expires 2 years from Effective Date.");
  await expect(doc).toContainText("3 years from Effective Date");
  await expect(box("Expires")).toBeChecked();
  await expect(box("In perpetuity")).not.toBeChecked();

  await page.getByLabel("Continues until terminated", { exact: true }).check();
  await page.getByLabel("In perpetuity", { exact: true }).check();
  await expect(box("Expires")).not.toBeChecked();
  await expect(box("Continues until terminated")).toBeChecked();
  await expect(box("In perpetuity")).toBeChecked();
  await expect(page.getByLabel("MNDA term in years", { exact: true })).toBeDisabled();
});

test("defaults the effective date to today and follows changes", async ({ page }) => {
  const today = await page.evaluate(() =>
    new Date().toLocaleDateString("en-US", { dateStyle: "long" }),
  );
  const doc = preview(page);
  await expect(doc).toContainText(today);

  // Editing another field must not freeze or drop the default date.
  await page.getByLabel("Governing law", { exact: true }).fill("Delaware");
  await expect(doc).toContainText(today);

  await page.getByLabel("Effective date", { exact: true }).fill("2027-01-15");
  await expect(doc).toContainText("January 15, 2027");
});

test("keeps entered values when scrolling, without reloading", async ({ page }) => {
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });

  await page.getByLabel("Governing law", { exact: true }).fill("Delaware");
  await party(page, "Party 2").getByLabel("Company", { exact: true }).fill("Globex");
  await page.mouse.wheel(0, 2000);
  await page.locator("aside").evaluate((el) => (el.scrollTop = 0));
  await page.waitForTimeout(2000);

  expect(navigations).toBe(0);
  await expect(page.getByLabel("Governing law", { exact: true })).toHaveValue("Delaware");
  await expect(party(page, "Party 2").getByLabel("Company", { exact: true })).toHaveValue("Globex");
  await expect(preview(page)).toContainText("Governing Law: Delaware");
});

test("renders user input literally, not as markdown or HTML", async ({ page }) => {
  await page.getByLabel("Governing law", { exact: true }).fill("<b>bold</b> *stars* [link](x)");
  const doc = preview(page);
  await expect(doc).toContainText("Governing Law: <b>bold</b> *stars* [link](x)");
  await expect(doc.locator("b, em, a[href='x']")).toHaveCount(0);
});

test("Download PDF prints with a file name from the companies", async ({ page }) => {
  await page.evaluate(() => {
    const w = window as unknown as { printedTitle?: string };
    window.print = () => {
      w.printedTitle = document.title;
    };
  });
  await party(page, "Party 1").getByLabel("Company", { exact: true }).fill("Acme Inc");
  await party(page, "Party 2").getByLabel("Company", { exact: true }).fill("Globex");
  const originalTitle = await page.title();

  await page.getByRole("button", { name: "Download PDF" }).click();
  expect(await page.evaluate(() => (window as { printedTitle?: string }).printedTitle)).toBe(
    "Mutual NDA - Acme Inc - Globex",
  );

  // The title is restored once printing finishes.
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page).toHaveTitle(originalTitle);
});

test("prints only the agreement, with standard terms on a new page", async ({ page }) => {
  await page.getByLabel("Governing law", { exact: true }).fill("Delaware");
  await page.emulateMedia({ media: "print" });

  await expect(page.locator("aside")).toBeHidden();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeHidden();
  await expect(preview(page)).toBeVisible();

  const pdf = (await page.pdf({ format: "A4" })).toString("latin1");
  expect(pdf.startsWith("%PDF")).toBe(true);
  const pages = pdf.match(/\/Type\s*\/Page[^s]/g) ?? [];
  expect(pages.length).toBeGreaterThanOrEqual(2);
});
