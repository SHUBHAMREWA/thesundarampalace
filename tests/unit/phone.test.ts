import { describe, expect, it } from "vitest";

import { maskPhone, normalizePhone, phoneSchema } from "@/lib/validation/phone";

describe("phone numbers", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["098765-43210", "+919876543210"],
    ["+1 415 555 2671", "+14155552671"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("accepts %s", (input, e164) => {
    expect(normalizePhone(input)).toBe(e164);
  });

  it.each(["12345", "abcdefghij", "", "+91 12345"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("validates through the shared Zod schema", () => {
    expect(phoneSchema.parse(" 98765 43210 ")).toBe("+919876543210");
    expect(phoneSchema.safeParse("123").success).toBe(false);
  });

  it("masks phones for logs", () => {
    expect(maskPhone("+919812345621")).toBe("98******21");
  });
});
