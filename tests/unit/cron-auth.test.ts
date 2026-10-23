import { describe, expect, it } from "vitest";

import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";

describe("cron authorization", () => {
  const secret = "a-long-cron-secret-123";

  it("accepts the exact bearer secret", () => {
    expect(isAuthorizedCronRequest(`Bearer ${secret}`, secret)).toBe(true);
  });

  it.each([null, "", secret, `Bearer ${secret}x`, "Bearer wrong", `bearer ${secret}`])(
    "rejects %s",
    (header) => {
      expect(isAuthorizedCronRequest(header, secret)).toBe(false);
    },
  );

  it("rejects everything when no secret is configured", () => {
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
  });
});
