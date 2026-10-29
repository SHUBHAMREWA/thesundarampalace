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

  test("2FA is optional: Super Admin uses the CRM without it, then turns it on", async ({ page }) => {
    await signIn(page, E2E_USERS.superAdmin.email);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: /Welcome, E2E/ })).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Two-factor authentication" }).click();
    await expect(page).toHaveURL(/\/admin\/security\/two-factor$/);
    await expect(page.getByRole("link", { name: "Not now, back to the dashboard" })).toBeVisible();

    await page.getByLabel("Confirm your password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Continue" }).click();
    const keyText = await page.locator("span.font-mono").first().textContent();
    totpSecret = (keyText ?? "").trim();
    expect(totpSecret).toMatch(/^[A-Z2-7]+=*$/);

    lastCode = totp(totpSecret);
    await page.getByLabel("Authentication code").fill(lastCode);
    await page.getByRole("button", { name: "Turn on two-factor authentication" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    // Settings sits in the sidebar's Admin menu.
    await page.getByRole("button", { name: "Admin", exact: true }).click();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  });

  test("Super Admin signs in again with password + TOTP and can open settings", async ({ page }) => {
    // May wait up to 30 s for the next authenticator window before the settings steps.
    test.slow();
    await signIn(page, E2E_USERS.superAdmin.email);
    await expect(page).toHaveURL(/\/admin\/sign-in\/two-factor$/);
    // Use a code from a new 30-second window so it differs from the setup code.
    lastCode = await freshTotp(totpSecret, lastCode);
    await page.getByLabel("Authentication code").fill(lastCode);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("button", { name: "Admin", exact: true }).click();
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Business details", { exact: true })).toBeVisible();

    // A bad value is rejected without losing the other fields.
    await page.getByLabel("Office hours").fill("Every day, 10:00–19:00");
    await page.getByLabel("WhatsApp number").fill("123");
    await page.getByRole("button", { name: "Save business details" }).click();
    await expect(page.getByText("Enter a valid phone number")).toBeVisible();
    await expect(page.getByLabel("Office hours")).toHaveValue("Every day, 10:00–19:00");

    await page.getByLabel("WhatsApp number").fill("90000 22233");
    await page.getByRole("button", { name: "Save business details" }).click();
    await expect(page.getByText("Settings saved. The website is updated.")).toBeVisible();

    // The static contact page picks it up straight away.
    await page.goto("/en/contact");
    await expect(page.getByRole("link", { name: "Chat on WhatsApp" }).first()).toHaveAttribute("href", /^https:\/\/wa\.me\/919000022233/);
    await expect(page.getByText("Every day, 10:00–19:00")).toBeVisible();
  });

  test("Super Admin turns 2FA off again and then signs in with only a password", async ({ page }) => {
    test.slow();
    await signIn(page, E2E_USERS.superAdmin.email);
    await expect(page).toHaveURL(/\/admin\/sign-in\/two-factor$/);
    lastCode = await freshTotp(totpSecret, lastCode);
    await page.getByLabel("Authentication code").fill(lastCode);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/security/two-factor");
    await expect(page.getByText("Two-factor authentication is on for your account.")).toBeVisible();
    await page.getByLabel("Confirm your password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Turn off two-factor authentication" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, E2E_USERS.superAdmin.email);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("Sales user can use the dashboard but gets 403 on settings", async ({ page }) => {
    await signIn(page, E2E_USERS.sales.email);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
    // Streaming pages can't change the HTTP status once the shell is sent, so
    // assert what matters: the 403 screen renders and no settings data leaks.
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();
    await expect(page.getByText("Business details", { exact: true })).toHaveCount(0);
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
