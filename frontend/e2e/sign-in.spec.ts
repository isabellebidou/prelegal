import { expect, test } from "@playwright/test";

test("signing in with any name and email opens the document creator", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/create\/$/);
  await expect(page.getByRole("heading", { name: "Document Creator" })).toBeVisible();
});

test("requires a name and email", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("the creator is reachable directly without the trailing slash", async ({ page }) => {
  await page.goto("/create");
  await expect(page).toHaveURL(/\/create\/$/);
  await expect(page.getByRole("heading", { name: "Document Creator" })).toBeVisible();
});

test("the old NDA address redirects to the creator", async ({ page }) => {
  await page.goto("/nda/");
  await expect(page).toHaveURL(/\/create\/$/);
  await expect(page.getByRole("heading", { name: "Document Creator" })).toBeVisible();
});
