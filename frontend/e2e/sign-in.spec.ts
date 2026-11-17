import { expect, test, type Page } from "@playwright/test";
import { createAccountInForm, GREETING, openCreator, PASSWORD, signUpViaApi, stubChat, uniqueEmail } from "./helpers";

const signInDialog = (page: Page) => page.getByRole("dialog", { name: "Sign in" });

test.beforeEach(async ({ page }) => {
  await stubChat(page);
});

test("the home page is the app, usable without signing in", async ({ page }) => {
  await openCreator(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Document Creator" })).toBeVisible();
  await expect(page.getByRole("log", { name: "Conversation" })).toContainText(GREETING);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  // No sign-in prompt until the user asks for one.
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("creating an account from the header Sign in button", async ({ page }) => {
  await openCreator(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await createAccountInForm(page, "Ada Lovelace", uniqueEmail());

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Account: Ada Lovelace" })).toBeVisible();
  await expect(page.getByRole("button", { name: "My documents" })).toBeVisible();
});

test("signing in with the right password, and sign out", async ({ page }) => {
  const { email } = await signUpViaApi(page);
  await page.context().clearCookies();
  await openCreator(page);

  await page.getByRole("button", { name: "Sign in" }).click();
  const dialog = signInDialog(page);
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Password").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Account: Ada Lovelace" }).click();
  await expect(page.getByRole("menu")).toContainText(email);
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "My documents" })).toHaveCount(0);

  // The session is really gone, not just hidden.
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
});

test("stays signed in after reloading the page", async ({ page }) => {
  await signUpViaApi(page);
  await openCreator(page);
  await expect(page.getByRole("button", { name: "Account: Ada Lovelace" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Account: Ada Lovelace" })).toBeVisible();
});

test("a wrong password shows an error and keeps the dialog open", async ({ page }) => {
  const { email } = await signUpViaApi(page);
  await page.context().clearCookies();
  await openCreator(page);

  await page.getByRole("button", { name: "Sign in" }).click();
  const dialog = signInDialog(page);
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Password").fill("not the password");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(dialog.getByRole("alert")).toContainText("Incorrect email or password");
  await expect(dialog).toBeVisible();
});

test("an email already in use cannot sign up again", async ({ page }) => {
  const { email } = await signUpViaApi(page);
  await page.context().clearCookies();
  await openCreator(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await createAccountInForm(page, "Someone Else", email);
  await expect(signInDialog(page).getByRole("alert")).toContainText("already exists");
});

test("requires an email and password", async ({ page }) => {
  await openCreator(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await signInDialog(page).getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(signInDialog(page)).toBeVisible();
});

for (const old of ["/create/", "/create", "/nda/"]) {
  test(`the old address ${old} redirects to the home page`, async ({ page }) => {
    await page.goto(old);
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    await expect(page.getByRole("heading", { name: "Document Creator" })).toBeVisible();
  });
}
