import { expect, test } from "@playwright/test";

test.describe("public website shell", () => {
  test("redirects / to the English site", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Sundaram Palace");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("serves the Hindi locale with lang=hi and switches back", async ({ page }) => {
    await page.goto("/hi");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await page.getByRole("link", { name: "Language" }).click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test("sends security headers and renders a localized 404", async ({ page }) => {
    const response = await page.goto("/en/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    const headers = response?.headers() ?? {};
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  for (const width of [360, 768, 1280, 1536]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/en");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("health endpoint reports the database is reachable", async ({ request }) => {
    const response = await request.get("/api/health/enquiry");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("robots.txt blocks non-production environments", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Disallow: /");
  });
});
