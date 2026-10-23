import { expect, test } from "@playwright/test";

import { noHorizontalOverflow } from "./helpers";

const PAGES = [
  { path: "/en/about", heading: "About us" },
  { path: "/en/venues", heading: "Venues" },
  { path: "/en/catering", heading: "Catering" },
  { path: "/en/decor", heading: "Décor themes" },
  { path: "/en/services", heading: "Celebrations we host" },
  { path: "/en/services/weddings", heading: "Weddings and celebrations" },
  { path: "/en/packages", heading: "Packages" },
  { path: "/en/gallery", heading: "Gallery" },
  { path: "/en/contact", heading: "Contact us" },
  { path: "/en/plan-your-event", heading: "Plan your event" },
  { path: "/en/legal/privacy-policy", heading: "Privacy policy" },
];

test.describe("public pages with CMS placeholders (tests #24, #25, #26)", () => {
  for (const { path, heading } of PAGES) {
    test(`${path} renders its page and fits a 360px phone`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 780 });
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Legal" })).toBeVisible();
      expect(await noHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }

  test("empty pages show placeholders, never invented facts", async ({ page }) => {
    await page.goto("/en/about");
    await expect(page.getByText("This page is being prepared")).toBeVisible();
    await page.goto("/en/legal/privacy-policy");
    await expect(page.getByText("This policy is being finalised")).toBeVisible();
    await page.goto("/en/packages");
    await expect(page.getByText("This page is being prepared")).toBeVisible();
    await expect(page.getByText(/₹/)).toHaveCount(0); // no invented prices
  });

  test("sets canonical and hreflang links", async ({ page }) => {
    await page.goto("/hi/venues");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/hi\/venues$/);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/venues$/);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /\/en\/venues$/);
  });

  test("lists both languages in the sitemap and keeps the CRM out", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/en/venues");
    expect(xml).toContain("/hi/venues");
    expect(xml).toContain('hreflang="hi"');
    expect(xml).not.toContain("/admin");
  });

  test("publishes only truthful structured data", async ({ page }) => {
    await page.goto("/en");
    const data = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) ?? "{}");
    expect(data["@type"]).toBe("EventVenue");
    expect(data.name).toBe("The Sundaram Palace");
    expect(JSON.stringify(data)).not.toMatch(/aggregateRating|review/i);
  });
});
