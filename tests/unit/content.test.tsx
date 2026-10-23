import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { linesOf, parseBlocks, RichText } from "@/lib/content/rich-text";
import { whatsappLink } from "@/lib/contact/links";
import { localizedOptional, localizedRequired, t } from "@/lib/i18n/localized";
import { alternatesFor } from "@/lib/seo/metadata";
import { eventVenueJsonLd } from "@/lib/seo/structured-data";

describe("localized text", () => {
  it("falls back to English when Hindi is empty", () => {
    expect(t({ en: "Venues", hi: "स्थल" }, "hi")).toBe("स्थल");
    expect(t({ en: "Venues", hi: "  " }, "hi")).toBe("Venues");
    expect(t({ en: "Venues" }, "hi")).toBe("Venues");
    expect(t(null, "en")).toBe("");
  });

  it("requires English where needed and stores empty optional text as null", () => {
    expect(localizedRequired.safeParse({ en: " ", hi: "" }).success).toBe(false);
    expect(localizedOptional.parse({ en: "", hi: "" })).toBeNull();
    expect(localizedOptional.parse({ en: "Hello", hi: "" })).toEqual({ en: "Hello" });
  });
});

describe("safe CMS text", () => {
  it("parses the supported subset", () => {
    const blocks = parseBlocks("## Heading\n\nFirst line\nsecond line\n\n- one\n- two\n\n1. a\n2. b");
    expect(blocks.map((b) => b.type)).toEqual(["h2", "p", "ul", "ol"]);
    expect(blocks[1]).toEqual({ type: "p", text: "First line second line" });
  });

  it("never renders raw HTML from content", () => {
    const html = renderToStaticMarkup(<RichText source={'<script>alert(1)</script> <img src=x onerror="alert(1)">'} />);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("only links to safe URLs", () => {
    const html = renderToStaticMarkup(
      <RichText source={"[ok](https://example.test) [bad](javascript:alert(1)) [mail](mailto:a@b.test)"} />,
    );
    expect(html).toContain('href="https://example.test"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('href="mailto:a@b.test"');
    expect(html).not.toContain("javascript:");
  });

  it("splits one-item-per-line fields", () => {
    expect(linesOf("- Stage\n\nLighting \n* Sound")).toEqual(["Stage", "Lighting", "Sound"]);
  });
});

describe("links and SEO helpers", () => {
  it("builds wa.me links with an encoded message", () => {
    expect(whatsappLink("+919876543210", "Namaste & hello")).toBe("https://wa.me/919876543210?text=Namaste%20%26%20hello");
    expect(whatsappLink("+919876543210")).toBe("https://wa.me/919876543210");
  });

  it("produces canonical and hreflang alternates for both languages", () => {
    expect(alternatesFor("hi", "/venues")).toEqual({
      canonical: "/hi/venues",
      languages: { en: "/en/venues", hi: "/hi/venues", "x-default": "/en/venues" },
    });
    expect(alternatesFor("en", "/")?.canonical).toBe("/en");
  });

  it("puts only supplied facts into structured data", () => {
    const minimal = eventVenueJsonLd({ name: "The Sundaram Palace", url: "https://example.test/en" });
    expect(Object.keys(minimal).sort()).toEqual(["@context", "@type", "name", "url"]);
    const full = eventVenueJsonLd({
      name: "The Sundaram Palace",
      url: "https://example.test/en",
      telephone: "+919876543210",
      city: "Test City",
      sameAs: [null, "https://instagram.com/test"],
    });
    expect(full).toMatchObject({ telephone: "+919876543210", address: { addressLocality: "Test City" }, sameAs: ["https://instagram.com/test"] });
    expect(JSON.stringify(full)).not.toMatch(/aggregateRating|review/i);
  });
});
