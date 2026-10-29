import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  attributionSchema,
  enquirySchema,
  fieldErrorsOf,
  todayIST,
} from "@/lib/validation/enquiry";
import {
  buildUploadSignature,
  signParams,
  verifyUploadResponse,
} from "@/server/media/cloudinary-sign";

const valid = {
  eventTypeKey: "wedding",
  preferredDate: "",
  guestsApprox: "350",
  message: "Two functions",
  preferredHallSlug: "",
  fullName: "Test Customer 01",
  phone: "98765 43210",
  email: "",
  contactPreference: "whatsapp",
  consent: true,
};

describe("enquiry validation (test #2)", () => {
  it("accepts a valid enquiry and normalises it", () => {
    const parsed = enquirySchema.parse(valid);
    expect(parsed.phone).toBe("+919876543210");
    expect(parsed.guestsApprox).toBe(350);
    expect(parsed.preferredDate).toBeUndefined();
    expect(parsed.email).toBeUndefined();
  });

  it.each([
    [{ eventTypeKey: "" }, "eventTypeKey", "required"],
    [{ fullName: "A" }, "fullName", "required"],
    [{ phone: "12345" }, "phone", "invalidPhone"],
    [{ email: "not-an-email" }, "email", "invalidEmail"],
    [{ guestsApprox: "0" }, "guestsApprox", "invalidGuests"],
    [{ preferredDate: "2020-01-01" }, "preferredDate", "invalidDate"],
    [{ consent: false }, "consent", "consentRequired"],
  ])("rejects %o", (patch, field, code) => {
    const result = enquirySchema.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrorsOf(result.error)[field]).toBe(code);
  });

  it("accepts today's date in India", () => {
    expect(
      enquirySchema.safeParse({ ...valid, preferredDate: todayIST() }).success,
    ).toBe(true);
  });

  it("tolerates missing or malformed attribution", () => {
    expect(
      attributionSchema.parse({ utm: { source: "google" } }).utm.source,
    ).toBe("google");
    expect(attributionSchema.parse("garbage")).toEqual({
      utm: {},
      referrer: null,
      landingPage: "/",
    });
  });
});

describe("Cloudinary signatures", () => {
  it("signs sorted params with the secret (Cloudinary's algorithm)", () => {
    const expected = createHash("sha1")
      .update("folder=a&timestamp=1secret")
      .digest("hex");
    expect(signParams({ timestamp: 1, folder: "a" }, "secret")).toBe(expected);
  });

  it("includes the allowed formats in the signed upload params", () => {
    const signed = buildUploadSignature(
      { folder: "sundaram/dev/halls", timestamp: 1700000000 },
      "secret",
    );
    expect(signed.params.allowed_formats).toContain("webp");
    expect(signed.params.allowed_formats).toContain("mov");
    expect(signed.params.eager).toBeUndefined();
    expect(signed.signature).toBe(signParams(signed.params, "secret"));
  });

  it("signs the pre-built video sizes for video uploads", () => {
    const signed = buildUploadSignature(
      {
        folder: "sundaram/dev/hero",
        timestamp: 1700000000,
        eager: "w_720/mp4",
      },
      "secret",
    );
    expect(signed.params).toMatchObject({
      eager: "w_720/mp4",
      eager_async: "true",
    });
    expect(signed.signature).toBe(signParams(signed.params, "secret"));
  });

  it("verifies Cloudinary's response signature and rejects forgeries", () => {
    const signature = createHash("sha1")
      .update("public_id=sundaram/x&version=123secret")
      .digest("hex");
    expect(
      verifyUploadResponse(
        { public_id: "sundaram/x", version: 123, signature },
        "secret",
      ),
    ).toBe(true);
    expect(
      verifyUploadResponse(
        { public_id: "sundaram/y", version: 123, signature },
        "secret",
      ),
    ).toBe(false);
    expect(
      verifyUploadResponse(
        { public_id: "sundaram/x", version: 123, signature: "short" },
        "secret",
      ),
    ).toBe(false);
  });
});
