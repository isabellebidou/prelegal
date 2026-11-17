import { expect, test } from "@playwright/test";
import { createAccountInForm, PASSWORD, signUpViaApi, stubChat, uniqueEmail } from "./helpers";

test.beforeEach(async ({ page }) => {
  await stubChat(page);
});

test("creating an account opens the document creator, signed in", async ({ page }) => {
  await page.goto("/");
  await createAccountInForm(page, "Ada Lovelace", uniqueEmail());

  await expect(page).toHaveURL(/\/create\/$/);
  await expect(page.getByRole("heading", { name: "Document Creator" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Account: Ada Lovelace" })).toBeVisible();
});

test("signing in with the right password, and sign out", async ({ page }) => {
  const { email } = await signUpViaApi(page);
  await page.context().clearCookies();
  await page.goto("/");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/create\/$/);
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
  await expect(page.getByRole("menu")).toContainText(email);
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "My documents" })).toHaveCount(0);

  // The session is really gone, not just hidden.
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
});

test("a wrong password shows an error and stays on the page", async ({ page }) => {
  const { email } = await signUpViaApi(page);
  await page.context().clearCookies();
  await page.goto("/");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("an email already in use cannot sign up again", async ({ page }) => {
  const { email } = await signUpViaApi(page);
  await page.context().clearCookies();
  await page.goto("/");
  await createAccountInForm(page, "Someone Else", email);
  await expect(page.getByRole("alert").filter({ hasText: "already exists" })).toBeVisible();
});

test("requires an email and password", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("guests can continue without an account", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Continue as guest" }).click();
  await expect(page).toHaveURL(/\/create\/$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
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
