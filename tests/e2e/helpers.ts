import { expect, type Page } from "@playwright/test";

import { E2E_PASSWORD, totp } from "./fixtures";

export async function signIn(page: Page, email: string) {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Signs in a user whose role requires 2FA, enrolling it on first use. Returns the TOTP secret. */
export async function signInWithNew2fa(page: Page, email: string): Promise<string> {
  await signIn(page, email);
  await expect(page).toHaveURL(/\/admin\/security\/two-factor$/);
  await page.getByLabel("Confirm your password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  const secret = ((await page.locator("span.font-mono").first().textContent()) ?? "").trim();
  await page.getByLabel("Authentication code").fill(totp(secret));
  await page.getByRole("button", { name: "Turn on two-factor authentication" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  return secret;
}

export async function noHorizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
