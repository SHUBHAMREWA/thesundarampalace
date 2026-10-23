---
name: luxury-venue-content
description: Use when building public website pages, CMS content models, copy placeholders, galleries, real-wedding stories, offers, the enquiry flow, SEO metadata or structured data for The Sundaram Palace. Keeps the site luxurious and truthful.
---

# Luxury venue website content

Goal: a first impression on par with top Indian luxury hotel venue pages — cinematic visuals, precise facts, effortless enquiry — while never inventing anything.

## Truthfulness rules
- Every fact (capacity, area, ceiling height, facilities, prices, address, phone, years in business, awards) comes from the CMS, entered by the business.
- Until supplied, render a tasteful placeholder in dev/staging (e.g. "Capacity details coming soon") and add the item to `docs/missing-business-info.md`. Never ship invented numbers.
- No fake testimonials, ratings, review counts, or "best venue in…" claims.
- Reviews: link to the Google Business Profile; show quotes only if the business provides them with permission.
- Real-wedding stories require a consent flag + consent date; hide automatically if consent is false.
- Wedding photos need photographer credit and usage permission fields.

## Page content model (CMS)
- Every page: `title_en`, `title_hi`, `metaTitle`, `metaDescription` (both languages), `ogImage`, `slug`, `published`.
- Sections are ordered, toggleable blocks (hero, intro, halls grid, catering, décor, packages, gallery, stories, dates, blog, CTA band, map).
- Hall: name, slug, description, area, ceilingHeight, capacities[{layout, min, max}], facilities[], images[], floorPlan, tourUrl/video, eventTypes[], slotsInfo, active.
- Images always require alt text in English (Hindi optional).

## Copy tone
- Warm, graceful, confident; short sentences. Celebrate families and traditions.
- Avoid clichés and superlatives you can't prove. Prefer concrete sensory detail supplied by the business.
- CTA labels: "Plan your event", "Book a site visit", "Check date availability", "Chat on WhatsApp", "Download brochure".
- Hindi copy must be written or reviewed by a fluent speaker; never machine-translate legal text.

## Enquiry flow (Plan your event)
- 3 steps: event type + date + guests → vision + preferred hall → name + phone (+ email, contact preference) + consent.
- Keep each step to ≤ 3 fields; show progress; allow back.
- Capture UTM params from the landing URL (persist in a first-party cookie/session for the visit) and send with the form.
- Success state shows the lead reference and the response-time promise from Settings, plus a WhatsApp button.

## Date availability check
- Output only Available / Limited / Fully booked — enquire. Never names, references or event types.
- Server-side, rate-limited, briefly cached, can be turned off in Settings.

## SEO
- Server-render public pages; `generateMetadata` from CMS.
- `hreflang` en/hi + canonical; sitemap includes both locales; admin and CRM are `noindex` and disallowed in robots.
- Structured data: `EventVenue`/`LocalBusiness` with only supplied fields (name, address, geo, telephone, url, image, openingHours). No `aggregateRating` unless the business provides a legitimate source and policy allows it.
- Blog posts: `Article` schema, author, dates, featured image.
- One `h1` per page; descriptive slugs (e.g. `/venues/grand-darbar-hall`).

## Performance
- Hero video ≤ ~3 MB, muted, `playsInline`, poster image with priority; image fallback when `prefers-reduced-motion` or `saveData`.
- `next/image` with Cloudinary loader; lazy-load below the fold; avoid layout shift.
- Target LCP < 2.5 s on mid-range mobile over 4G.
