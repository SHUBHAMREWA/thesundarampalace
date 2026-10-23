import "dotenv/config";

// Tests always run against the dedicated test database, never dev/prod.
process.env.APP_ENV = "test";
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.CRON_SECRET ??= "test-cron-secret-123";
