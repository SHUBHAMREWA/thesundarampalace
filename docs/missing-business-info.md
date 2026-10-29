# Missing business information

Everything below must come from The Sundaram Palace (owner, manager, accountant or lawyer). Until an item is supplied, the app shows a CMS placeholder or uses a configurable default that is clearly marked. **Nothing here may be invented.**

Status values: **Missing** (nothing received) · **Default** (app runs on an editable placeholder default; business must confirm) · **Received** (supplied, date noted) · **Verified** (checked by the right person).

Last reviewed: 2026-10-23 (Phase 0). Nothing has been received yet.

---

## 0. Blocking before Phase 1 / Phase 2

These affect setup, not just content. Ask first.

| # | Item | Why it blocks | Needed by | Status |
|---|---|---|---|---|
| 0.1 | Who owns the free service accounts (Vercel Hobby, Neon, Cloudinary, Resend, Sentry, GitHub)? Recommended: opened with a business email. Vercel Hobby is a personal account with no team seats, so agree in writing who owns it. | Data ownership and handover. Hard to move later. | Phase 1 | Missing |
| 0.2 | Domain | Email sending (SPF/DKIM), canonical URLs, SEO, SSL. | Phase 2 | **Received 2026-10-23:** purchased at Hostinger. Still needed: the exact domain name and access to Hostinger DNS settings. |
| 0.3 | Does the Hostinger purchase include email or forwarding? Which address should receive replies (e.g. `info@<domain>`)? Sender address for notifications. | Transactional email must come from the business domain. | Phase 2 | Missing |
| 0.4 | City, full address and map pin | Local SEO, contact page, structured data, GST place of supply. | Phase 2 | Missing |
| 0.5 | Number and names of halls / lawns | Everything in the venue section and booking model depends on it. | Phase 2 | Missing |
| 0.6 | Running cost | Decides hosting plans. | Phase 2 launch | **Received 2026-10-23:** free tiers only (Vercel Hobby, Neon Free, Cloudinary Free); nothing to buy now. See `docs/costs.md` for limits and upgrade triggers. |

## 1. Brand and identity

| Item | Needed by | Status | Notes |
|---|---|---|---|
| Logo — vector (SVG/AI/PDF) plus a single-colour version | Phase 1 (placeholder), Phase 2 | Missing | Used on website, CRM, PDFs, favicon. |
| Brand name styling (exact spelling/casing in English, and the official Hindi spelling) | Phase 2 | Missing | Do not guess the Hindi spelling. |
| Brand story / heritage (true facts only: year established, family history, etc.) | Phase 2 | Missing | No "best venue in…" style claims. |
| Tagline (if any) | Phase 2 | Missing | Optional. |
| Owner photo | Phase 2 | Missing | Owner: Mr. Vivek Garg. His welcome message was received 28 Oct 2026 and is on the About page; the portrait frame shows his initials until the photo is uploaded in Admin → Website → About (header photo is chosen there too). Hindi version of the message written by the developer — needs his review. |
| About page text (venue description, location, events hosted) | Phase 2 | **Received 2026-10-28** | Taken from the old site thesundarampalace.com; "best/top" claims left out. Hindi version written by the developer — needs review by a fluent speaker. |

## 2. Photos, video and media

| Item | Needed by | Status | Notes |
|---|---|---|---|
| Professional photos of each hall — empty and decorated | Phase 2 | Missing | Minimum ~2000 px wide, landscape and portrait. |
| Lawn, entrance, stage, dining, bridal/green room, night lighting | Phase 2 | Missing | |
| Food photography | Phase 2 | Missing | |
| Décor theme photos | Phase 2 | Missing | |
| Venue film 30–60 s (for the hero; we compress to ≤ ~3 MB) | Phase 2 | Missing | Poster image fallback is used until then. |
| Drone shots (only if local permissions were obtained) | Phase 5 | Missing | |
| Photographer credit and usage permission for every wedding photo | Phase 2 / 5 | Missing | Stored per asset in the CMS. |
| ~~360° tours or walkthrough videos~~ | — | Not needed | Venue pages show only a title, description and photos (owner decision 28 Oct 2026). |

## 3. Venue spaces (per hall / lawn)

Repeat for every space.

| Item | Needed by | Status | Notes |
|---|---|---|---|
| Name and short description | Phase 2 | Missing | |
| ~~Area (sq ft) and ceiling height~~ | — | Not needed | Venue pages show only a title, description and photos (owner decision 28 Oct 2026). |
| ~~Capacity per layout: theatre, round table/banquet, floating/standing, cluster~~ | — | Not needed | Venue pages show only a title, description and photos (owner decision 28 Oct 2026). |
| ~~Facilities: AC, power backup, stage, bridal/green room, lift, ramps/accessibility~~ | — | Not needed | Venue pages show only a title, description and photos (owner decision 28 Oct 2026). |
| Parking capacity (cars / two-wheelers) | Phase 2 | Missing | |
| ~~Floor plan (sketch with measurements is fine)~~ | — | Not needed | Venue pages show only a title, description and photos (owner decision 28 Oct 2026). |
| Which spaces can be combined (e.g. Hall A + Hall B) | Phase 3 | Missing | Affects conflict detection. The CRM screen for it was removed with "Halls and slots" (26 Oct 2026); ask the developer to set it up if needed. |
| Suitable event types per space | Phase 2 | Missing | |

## 4. Slots, timings and house rules

| Item | Needed by | Status | Notes |
|---|---|---|---|
| ~~Slot definitions per hall~~ | — | Not needed | Owner decision 26 Oct 2026: staff type each function's times. |
| ~~Setup / teardown buffer per hall~~ | — | Not needed | Owner decision 26 Oct 2026: always 0; include setup time in the function's typed times if needed. |
| Music / DJ cut-off time | Phase 2 (policy page) | Missing | |
| Other house rules (outside vendors, fireworks, alcohol, decoration restrictions, etc.) | Phase 2 | Missing | Only what the business states. |
| Site-visit days and time windows | Phase 5 (Phase 2 form asks preferred date) | Missing | |

## 5. Catering and menus

| Item | Needed by | Status | Notes |
|---|---|---|---|
| Cuisines offered | Phase 2 | Missing | |
| Which categories are offered: Veg, Jain, Non-veg | Phase 2 | Missing | Non-veg pages hidden unless offered. |
| Menus by category and course (welcome drinks, starters, mains, breads, rice, desserts, live counters) | Phase 2 (public), Phase 3 (CRM) | Missing | |
| Menu packages: per-plate rate and selection rules ("choose 3 starters") | Phase 3 | Missing | |
| Minimum guaranteed plates (per menu package) | Phase 3 | Missing | |
| Guest-count lock: how many days before the event | Phase 3 | Missing | |
| Extra-plate rate after the event; is any shortfall refunded? | Phase 3 | Missing | |
| Outside-caterer policy | Phase 2 | Missing | |

## 6. Décor and services

| Item | Needed by | Status | Notes |
|---|---|---|---|
| Décor themes offered; in-house vs partner decorators | Phase 2 | Missing | |
| Services offered (lighting/sound, DJ, photography via partners, etc.) | Phase 2 | Missing | No room booking. |
| ~~Popular / auspicious wedding dates for the season~~ | — | Not needed | Feature removed (owner decision 28 Oct 2026). |
| Partner vendors (décor, photography, DJ…) | Phase 4 | Missing | |

## 7. Commercial policies

| Item | Needed by | Status | Notes |
|---|---|---|---|
| Booking advance % at confirmation | Phase 3 | Missing | Settings → Booking policy (empty = no suggestion). |
| Payment schedule (instalments and due dates relative to the event) | Phase 3 | Missing | |
| Cancellation slabs (days before event → % refundable) | Phase 2 (policy page), Phase 3 (logic) | Missing | |
| Security deposit: amount, what can be deducted, refund timeline | Phase 3 | Missing | |
| Tentative hold duration (default proposal 72 h) and reminder timing (12 h before) | Phase 3 | Default | Settings → Booking policy. |
| Guest-count lock (days before each function; placeholder 7) | Phase 3 | Default | After the lock only a Manager can change guaranteed plates. |
| Quotation validity (placeholder 15 days) | Phase 3 | Default | |
| Are unserved guaranteed plates ever refunded? (placeholder: no) | Phase 3 | Default | |
| Per-plate rates, minimum plates and which menu courses are "choose N" | Phase 3 | Missing | Catalog and pricing → Menu packages. |
| Standard prices of chargeable services (hall rental, décor, lighting…) | Phase 3 | Missing | Catalog and pricing → Services; can also be typed per quotation. |
| Quotation terms, payment terms, booking conditions, bank/UPI details for documents | Phase 3 | Missing | Settings → Document wording; documents print "To be confirmed" until then. |
| Response-time promise shown after enquiry (e.g. "within 2 working hours") | Phase 2 | Missing | Shown on the success screen. |
| Duplicate-enquiry window (same phone within N days updates the open lead; proposal 30 days) | Phase 2 | Default | |

## 8. Tax, invoicing and accounts (confirm with the accountant)

| Item | Needed by | Status | Notes |
|---|---|---|---|
| Legal name, GSTIN, registered address, state code | Phase 3 | Missing | **Blocks tax invoices** (the CRM refuses to issue one without them). Settings → Business details. |
| **GST registration type: regular or composition scheme?** | Phase 3 | Missing | A composition taxpayer issues a *bill of supply*, not a tax invoice. Changes the invoice design. |
| Are quoted prices tax-inclusive or tax-exclusive by default? | Phase 3 | Missing | |
| Invoice number prefix and format; credit-note prefix | Phase 3 | Default | Placeholders `SP/26-27/0001` and `SPCN/26-27/0001` (GST limit: 16 characters). Restart each April. |
| Round invoice totals to the nearest rupee? | Phase 3 | Missing | |
| Tax treatment of security-deposit deductions | Phase 3 | Missing | |
| Legally required retention period for invoices and ledgers | Phase 3 | Missing | Accountant/lawyer to confirm; drives the data-retention settings. |

## 9. Contact, location and social

| Item | Needed by | Status | Notes |
|---|---|---|---|
| Exact address and Google Maps pin | Phase 2 | Missing | |
| Phone number(s) for click-to-call | Phase 2 | Missing | |
| WhatsApp number and prefilled message text | Phase 2 | Missing | Is this number on the WhatsApp Business app today? Matters for the API later. |
| WhatsApp API choice and account (Meta Cloud API or Twilio), verified Meta Business account, approved message templates, your per-message rates | WhatsApp bulk | Missing | Enter keys in CRM Settings → WhatsApp (they are tested on save). Templates are created and approved in Meta WhatsApp Manager or Twilio Content Template Builder. |
| Public email address | Phase 2 | Missing | |
| Office / enquiry hours | Phase 2 | Missing | |
| Directions text (from railway station, bus stand, airport) | Phase 2 | Missing | |
| Google Business Profile link (and is it claimed/verified?) | Phase 2 | Missing | Reviews link only; no copied reviews without permission. |
| Instagram, Facebook, YouTube handles | Phase 2 | Missing | |

## 10. People and access

| Item | Needed by | Status | Notes |
|---|---|---|---|
| Staff list with roles (Super Admin, Admin, Manager, Sales, Accounts, Operations) | Phase 1 (admin), Phase 2 (sales) | Missing | |
| Default assignee for new leads and who gets new-lead alerts | Phase 2 | Missing | |
| Who writes or reviews Hindi copy | Phase 2 (UI labels), Phase 5 | Missing | The Hindi site currently falls back to English labels (`messages/hi.json` is almost empty). Legal text is never machine-translated. |

## 11. Real weddings, reviews and brochure

| Item | Needed by | Status | Notes |
|---|---|---|---|
| 3–5 real-wedding stories with written couple consent and consent date | Phase 5 | Missing | Hidden automatically without consent. |
| Any review quotes the business has permission to show | Phase 2 | Missing | Otherwise the site only links to Google. |
| E-brochure PDF (or approval to generate one) | Phase 5 | Missing | |

## 12. Legal and privacy (professional review required)

| Item | Needed by | Status | Notes |
|---|---|---|---|
| Privacy policy | Phase 2 | Missing | Draft structure provided by us; must be reviewed by a qualified professional (DPDP Act, 2023). |
| Terms and conditions | Phase 2 | Missing | |
| Cancellation and refund policy text | Phase 2 | Missing | Must match the slabs in section 7. |
| Consent wording for enquiry, brochure, site visit, greetings | Phase 2 | Default | Enquiry draft is in `messages/en.json` → `enquiry.consent` (notice version `2026-10-draft`). Professional review required; bump the version in Settings when it changes. |
| Data-retention periods per data type | Phase 3 | Default | Proposed defaults in `docs/security.md`. |
| Purpose for collecting identity documents (PAN/Aadhaar), if any | Phase 3 | Missing | If there is no legitimate need, the upload stays disabled. |

## 13. Existing data and systems

| Item | Needed by | Status | Notes |
|---|---|---|---|
| Is there an existing website/domain to redirect from? | Phase 2 | Missing | Old URLs get 301 redirects to protect search ranking. |
| **Already-confirmed future bookings (dates, halls, times)** | Before Phase 3 go-live | Missing | Must be entered before the CRM is used for new bookings, or double-booking checks are blind. |
| Existing customer/enquiry lists (Excel, register) to import | Phase 3 | Missing | Imported only with a lawful basis; not into seeds. |
| Existing invoice series for the current financial year | Phase 3 | Missing | The CRM sequence must continue from the last issued number. |
