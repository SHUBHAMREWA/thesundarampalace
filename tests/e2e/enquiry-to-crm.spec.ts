import { expect, test, type Page } from "@playwright/test";

import { E2E_USERS } from "./fixtures";
import { signIn } from "./helpers";

async function fillEvent(page: Page) {
  await page.getByLabel("Type of event").selectOption({ label: "Wedding" });
  await page.getByLabel(/Approximate number of guests/).fill("350");
}

test.describe.serial("enquiry → lead → CRM (tests #1, #2, #4)", () => {
  let reference = "";

  test("validates the form in the browser", async ({ page }) => {
    await page.goto("/en/plan-your-event");
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByText("This field is required").first()).toBeVisible();
    await fillEvent(page);
    await page.getByLabel("Full name").fill("E2E Visitor");
    await page.getByLabel("Mobile number").fill("12345");
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByText("Enter a valid mobile number")).toBeVisible();
    await expect(page.getByText("Please agree so that we can contact you")).toBeVisible();
    // Nothing was lost while fixing errors.
    await expect(page.getByLabel("Full name")).toHaveValue("E2E Visitor");
  });

  test("a visitor from a campaign sends an enquiry and gets a reference", async ({ page }) => {
    await page.goto("/en?utm_source=e2e&utm_medium=test&utm_campaign=launch");
    await page.getByRole("link", { name: "Plan your event" }).first().click();
    await expect(page).toHaveURL(/\/en\/plan-your-event$/);
    await fillEvent(page);
    await page.getByLabel(/Tell us about your vision/).fill("Three functions over two days.");
    await page.getByLabel("Full name").fill("E2E Visitor Sharma");
    await page.getByLabel("Mobile number").fill("90000 11122");
    await page.getByLabel(/I agree that The Sundaram Palace may contact me/).check();
    await page.waitForTimeout(2600); // the form rejects bot-speed submissions
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByText("Thank you — we've received your enquiry")).toBeVisible();
    const text = (await page.getByText(/Your reference is/).textContent()) ?? "";
    reference = /SP-L-\d{4}-\d{5}/.exec(text)?.[0] ?? "";
    expect(reference).not.toBe("");
  });

  test("the quick form on the contact page works too", async ({ page }) => {
    await page.goto("/en/contact");
    await page.getByLabel("Type of event").selectOption({ label: "Reception" });
    await page.getByLabel("Full name").fill("E2E Contact Page");
    await page.getByLabel("Mobile number").fill("+91 90000 11133");
    await page.getByLabel(/I agree that The Sundaram Palace may contact me/).check();
    await page.waitForTimeout(2600);
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByText(/Your reference is SP-L-/)).toBeVisible();
  });

  test("Sales sees the unassigned lead with its campaign and works on it", async ({ page }) => {
    await signIn(page, E2E_USERS.sales.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("button", { name: "Leads and customers" }).click();
    await page.getByRole("link", { name: "All leads" }).click();
    await page.getByLabel("Search by name, phone or reference").fill(reference);
    await page.getByRole("button", { name: "Apply" }).click();
    await page.getByRole("link", { name: "E2E Visitor Sharma" }).click();

    await expect(page.getByRole("heading", { name: "E2E Visitor Sharma" })).toBeVisible();
    await expect(page.getByText("Three functions over two days.")).toBeVisible();
    await expect(page.getByText("launch").first()).toBeVisible();
    await expect(page.getByText(/source=e2e/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Chat on WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/919000011122\?text=/);

    await page.getByLabel("What happened?").fill("Called, will visit on Sunday.");
    await page.getByRole("button", { name: "Log activity" }).click();
    await expect(page.getByText("Called, will visit on Sunday.")).toBeVisible();

    await page.locator('select[name="statusKey"]').selectOption({ label: "Contacted" });
    await page.getByRole("button", { name: "Update status" }).click();
    await expect(page.getByText(/New → Contacted/)).toBeVisible();

    // Sales can't assign leads.
    await expect(page.getByRole("button", { name: "Save assignment" })).toHaveCount(0);
  });
});
