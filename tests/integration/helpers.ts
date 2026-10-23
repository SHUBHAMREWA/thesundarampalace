import { describe } from "vitest";

/** Integration tests need TEST_DATABASE_URL (local embedded PG or CI service). */
export const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
