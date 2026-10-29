import { expect, test } from "@playwright/test";

import { E2E_USERS } from "./fixtures";
import { signInToDashboard } from "./helpers";

test("CMS edits reach the static website immediately (test #23)", async ({ page }) => {
  await signInToDashboard(page, E2E_USERS.admin.email);

  await test.step("an Admin adds a venue", async () => {
    await page.goto("/admin/cms/halls/new");
    await page.getByLabel("English", { exact: true }).first().fill("E2E Grand Hall");
    await expect(page.getByLabel("Web address")).toHaveValue("e2e-grand-hall");
    await page.locator('input[name="capacity.BANQUET.max"]').fill("250");
    await page.getByLabel("Air conditioning", { exact: true }).check();
    await page.getByLabel("Published on the website").check();
    await page.getByRole("button", { name: "Create venue" }).click();
    await expect(page).toHaveURL(/\/admin\/cms\/halls\/(?!new)[\w-]+$/);
  });

  await test.step("it appears on the static venues pages", async () => {
    await page.goto("/en/venues");
    await expect(page.getByRole("heading", { name: "E2E Grand Hall" })).toBeVisible();
    await expect(page.getByText("Up to 250 guests")).toBeVisible();
    await page.getByRole("link", { name: /View venue/ }).click();
    await expect(page).toHaveURL(/\/en\/venues\/e2e-grand-hall$/);
    await expect(page.getByText("Air conditioning")).toBeVisible();
    // Area was not entered, so it stays a placeholder instead of an invented number.
    await expect(page.getByText("Details coming soon").first()).toBeVisible();
  });

  await test.step("Admins can't change business settings (Super Admin only)", async () => {
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();
  });
});
