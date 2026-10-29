import { expect, test, type Page } from "@playwright/test";

import { gstinCheckChar } from "../../src/lib/validation/gst";
import { E2E_USERS } from "./fixtures";
import { signIn, signInToDashboard } from "./helpers";

/**
 * Phase 3 end to end (fake data only): catalog → customer → booking with a
 * function → quotation sent and accepted → confirmed → payment → GST
 * invoice → documents, then a role check for sales staff.
 */

function futureDate(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

async function confirmDialog(page: Page, button: string, confirm = button) {
  await page.getByRole("button", { name: button, exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: confirm, exact: true }).click();
  await expect(dialog).toBeHidden();
}

test.describe.configure({ mode: "serial" });

let bookingUrl = "";

test("an owner sets up pricing and takes a booking from enquiry to tax invoice", async ({ page }) => {
  test.slow();
  await signInToDashboard(page, E2E_USERS.owner.email);

  await test.step("business details needed for invoices", async () => {
    await page.goto("/admin/settings");
    const base = "09AAAAA0000A1Z";
    await page.getByLabel("Legal name (for invoices)").fill("E2E Sample Venue Pvt Ltd");
    await page.getByLabel("GSTIN", { exact: true }).fill(base + gstinCheckChar(base));
    await page.getByLabel("Venue state (GST)").selectOption({ label: "Uttar Pradesh (09)" });
    await page.getByLabel("Full address").fill("Sample road, Sample city");
    await page.getByRole("button", { name: "Save business details" }).click();
    await expect(page.getByText("Settings saved").first()).toBeVisible();
  });

  await test.step("catalog: tax category and a chargeable service", async () => {
    await page.goto("/admin/catalog?tab=taxes");
    const add = page.locator("form").filter({ has: page.getByRole("button", { name: "Add tax category" }) });
    await add.getByLabel("Name", { exact: true }).fill("E2E sample hall tax");
    await add.getByLabel("SAC code", { exact: true }).fill("997212");
    await add.getByLabel("GST rate (%)").fill("18");
    await add.getByRole("button", { name: "Add tax category" }).click();
    await expect(page.getByText("E2E sample hall tax · SAC 997212")).toBeVisible();

    await page.goto("/admin/catalog?tab=services");
    const service = page.locator("form").filter({ has: page.getByRole("button", { name: "Add service" }) });
    await service.getByLabel("Name", { exact: true }).fill("E2E hall rental");
    await service.getByLabel("Category", { exact: true }).selectOption({ label: "Venue / hall rental" });
    await service.getByLabel("Tax category").selectOption({ index: 1 });
    await service.getByLabel("Default price (₹, optional)").fill("100000");
    await service.getByRole("button", { name: "Add service" }).click();
    await expect(page.getByText("E2E hall rental").first()).toBeVisible();
  });

  await test.step("a new customer and a booking", async () => {
    await page.goto("/admin/customers/new");
    await page.getByLabel("Full name", { exact: true }).fill("E2E Test Customer");
    await page.getByLabel("Mobile number").fill("9000099001");
    await page.getByLabel("State (place of supply)").selectOption({ label: "Uttar Pradesh (09)" });
    await page.getByRole("button", { name: "Create customer" }).click();
    await expect(page).toHaveURL(/\/admin\/customers\/(?!new)[\w-]+$/);
    await page.getByRole("link", { name: "New booking" }).click();
    await page.getByLabel("Event name", { exact: true }).fill("E2E sample wedding");
    await page.getByLabel("Event type", { exact: true }).selectOption({ label: "Wedding" });
    await page.getByLabel("Start as").selectOption("TENTATIVE");
    await page.getByRole("button", { name: "Create booking" }).click();
    await expect(page).toHaveURL(/\/admin\/bookings\/(?!new)[\w-]+$/);
    bookingUrl = page.url();
  });

  await test.step("a function with an availability check", async () => {
    const form = page.getByRole("form", { name: "Add function" });
    await form.getByLabel("Function name", { exact: true }).fill("Wedding");
    await form.getByLabel("Function type", { exact: true }).selectOption({ label: "Wedding" });
    await form.getByLabel("Date", { exact: true }).fill(futureDate(5));
    await form.getByLabel("Hall", { exact: true }).selectOption({ label: "E2E Booking Hall" });
    await form.getByLabel("Starts (24h, IST)").fill("19:00");
    await form.getByLabel("Ends (earlier time = next day)").fill("01:00");
    await form.getByRole("button", { name: "Check availability" }).click();
    await expect(page.getByText(/^Available:/)).toBeVisible();
    await form.getByRole("button", { name: "Add function" }).click();
    await expect(page.getByText("7:00 pm – 1:00 am (next day)")).toBeVisible();
  });

  await test.step("quotation: draft, line from the catalogue, sent, accepted", async () => {
    await page.getByRole("link", { name: "Quotations" }).click();
    await page.getByRole("button", { name: "Start a quotation" }).click();
    const line = page.getByRole("form", { name: "Add line" });
    await line.getByLabel("From catalogue").selectOption({ index: 1 });
    await expect(line.getByLabel("Description", { exact: true })).toHaveValue("E2E hall rental");
    await line.getByRole("button", { name: "Add line" }).click();
    await expect(page.getByText("₹1,18,000.00").first()).toBeVisible();
    await confirmDialog(page, "Mark as sent");
    await expect(page.getByText("Sent", { exact: false }).first()).toBeVisible();
    await confirmDialog(page, "Customer accepted");
    await expect(page.getByText("accepted").first()).toBeVisible();
  });

  await test.step("confirm the booking", async () => {
    await page.getByRole("link", { name: "Overview" }).click();
    await confirmDialog(page, "Confirm booking");
    await expect(page.getByText("Confirmed").first()).toBeVisible();
  });

  await test.step("record a payment and issue the GST invoice", async () => {
    await page.getByRole("link", { name: "Payments and invoices" }).click();
    const pay = page.getByRole("form", { name: "Record a payment" });
    await pay.getByLabel("Amount (₹)").fill("50000");
    await pay.getByLabel("Method", { exact: true }).selectOption({ label: "UPI" });
    await pay.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText(/Payment SP-R-\d{4}-\d{2}-\d{5}/)).toBeVisible();
    await expect(page.getByText("₹68,000.00").first()).toBeVisible(); // balance due
    await page.getByRole("form", { name: "Invoice the accepted quotation" }).getByRole("button", { name: "Issue tax invoice" }).click();
    await expect(page.getByText(/^SP\/\d{2}-\d{2}\/0001/)).toBeVisible();
  });

  await test.step("documents: preview shows only ticked fields, then a PDF", async () => {
    await page.getByRole("link", { name: "Documents" }).click();
    const preview = page.frameLocator('iframe[title="Document preview"]');
    await expect(preview.getByText("E2E Test Customer")).toBeVisible();
    await expect(preview.getByText("₹1,18,000.00").first()).toBeVisible();
    await page.getByLabel("Customer name").uncheck();
    await page.getByRole("button", { name: "Update preview" }).click();
    await expect(preview.getByText("E2E hall rental").first()).toBeVisible();
    await expect(preview.getByText("E2E Test Customer")).toHaveCount(0);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Generate PDF" }).click();
    expect((await download).suggestedFilename()).toMatch(/Q1\.pdf$/);
  });

  await test.step("the calendar shows the confirmed function", async () => {
    await page.goto("/admin/calendar");
    await expect(page.getByRole("link", { name: /Wedding · E2E Booking Hall/ }).first()).toBeVisible();
  });
});

test("sales staff don't see money", async ({ browser }) => {
  const sales = await browser.newPage();
  await signIn(sales, E2E_USERS.sales.email);
  await expect(sales).toHaveURL(/\/admin$/);
  await sales.goto(bookingUrl);
  await expect(sales.getByRole("heading", { name: "E2E sample wedding" })).toBeVisible();
  await expect(sales.getByRole("link", { name: "Payments and invoices" })).toHaveCount(0);
  await sales.close();
});
