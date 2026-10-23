import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;
const databaseUrl = process.env.E2E_DATABASE_URL ?? "";

/**
 * End-to-end tests run against a production build (`npm run build` first)
 * and a dedicated database that the global setup rebuilds.
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    url: `${baseURL}/api/health/enquiry`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      APP_ENV: "test",
      DATABASE_URL: databaseUrl,
      DIRECT_DATABASE_URL: databaseUrl,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "e2e-secret-e2e-secret-e2e-secret-12345",
      CRON_SECRET: process.env.CRON_SECRET ?? "e2e-cron-secret-12345",
    },
  },
});
