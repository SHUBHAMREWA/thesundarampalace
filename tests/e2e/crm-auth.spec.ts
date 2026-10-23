import { expect, test, type Page } from "@playwright/test";

import { E2E_PASSWORD, E2E_USERS, totp } from "./fixtures";

async function freshTotp(secret: string, previous: string): Promise<string> {
  let code = totp(secret);
  while (code === previous) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    code = totp(secret);
  }
  return code;
}

async function signIn(page: Page, email: string) {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe.serial("CRM authentication and permissions", () => {
  let totpSecret = "";
  let lastCode = "";

  test("signed-out visitors are sent to sign-in, with noindex and a nonce CSP", async ({ page }) => {
    const response = await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    const headers = response?.headers() ?? {};
    expect(headers["x-robots-tag"]).toContain("noindex");
    expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
  });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("/admin/sign-in");
    await page.getByLabel("Email").fill(E2E_USERS.superAdmin.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    // Next.js also renders an empty route-announcer alert, so filter by text.
    await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toBeVisible();
  });

  test("Super Admin must set up 2FA before using the CRM", async ({ page }) => {
    await signIn(page, E2E_USERS.superAdmin.email);
    await expect(page).toHaveURL(/\/admin\/security\/two-factor$/);
    await expect(page.getByText("Your role requires two-factor authentication")).toBeVisible();

    await page.getByLabel("Confirm your password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Continue" }).click();
    const keyText = await page.locator("span.font-mono").first().textContent();
    totpSecret = (keyText ?? "").trim();
    expect(totpSecret).toMatch(/^[A-Z2-7]+=*$/);

    lastCode = totp(totpSecret);
    await page.getByLabel("Authentication code").fill(lastCode);
    await page.getByRole("button", { name: "Turn on two-factor authentication" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: /Welcome, E2E/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  });

  test("Super Admin signs in again with password + TOTP and can open settings", async ({ page }) => {
    await signIn(page, E2E_USERS.superAdmin.email);
    await expect(page).toHaveURL(/\/admin\/sign-in\/two-factor$/);
    // Use a code from a new 30-second window so it differs from the setup code.
    await page.getByLabel("Authentication code").fill(await freshTotp(totpSecret, lastCode));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Business details")).toBeVisible();
    await expect(page.getByText("Not set").first()).toBeVisible();
  });

  test("Sales user can use the dashboard but gets 403 on settings", async ({ page }) => {
    await signIn(page, E2E_USERS.sales.email);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
    // Streaming pages can't change the HTTP status once the shell is sent, so
    // assert what matters: the 403 screen renders and no settings data leaks.
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();
    await expect(page.getByText("Business details")).toHaveCount(0);
    expect(await page.content()).not.toContain("Reference numbering");
  });

  test("sign out ends the session", async ({ page }) => {
    await signIn(page, E2E_USERS.sales.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
  });
});
