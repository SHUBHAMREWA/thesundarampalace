import { expect, type Page } from "@playwright/test";

import { E2E_PASSWORD } from "./fixtures";

export async function signIn(page: Page, email: string) {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Signs in a user without 2FA (it is optional) and waits for the dashboard. */
export async function signInToDashboard(page: Page, email: string) {
  await signIn(page, email);
  await expect(page).toHaveURL(/\/admin$/);
}

export async function noHorizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
