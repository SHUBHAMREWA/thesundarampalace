# MASTER DEVELOPMENT PROMPT — THE SUNDARAM PALACE (v2)
## Luxury Wedding & Banquet Venue Website + Complete Mini CRM

You are a senior full-stack software architect, UI/UX designer, database engineer, security engineer, SEO specialist, and experienced QA engineer.

Your task is to design and build a production-quality web application for **The Sundaram Palace**, a premium wedding venue and banquet hall in India.

The public website must create a first impression comparable to India's leading luxury hotel brands' venue and wedding pages: cinematic visuals, precise venue facts, and an effortless path to enquire. The business scope is **venue and banquet halls only**.

The project must include:
1. A luxury public-facing website.
2. A complete internal CRM and booking management system built for banquet operations.
3. A CMS to manage website content, images, packages, menus, and blogs.
4. A booking-based payment, deposit, and GST invoice system.
5. A customizable PDF and print generation system.
6. Secure customer records and document management.
7. WhatsApp-first communication and reminders.
8. A maintainable architecture that can be extended in the future.

The user will develop and maintain this project using **Claude Code**. The code must remain in the user's control and be suitable for GitHub version control.

Do not create a superficial demo. Build a functional application with working forms, real database persistence, validation, authentication, permissions, error handling, and tested business workflows.

Project skills live in `.claude/skills/`. Load the relevant skill before working in its area (design system, banquet rules, billing, PDFs, data privacy, website content, database changes, phase reports).

---

# 1. BUSINESS CONTEXT

Business name: The Sundaram Palace

Business type: Wedding venue, banquet hall, and event destination.

The business serves customers organizing weddings, engagements, receptions, sangeet, haldi, mehendi, birthdays, corporate events, and other celebrations.

The application must help the business manage:
- Website enquiries and site-visit requests.
- Leads and follow-ups.
- Customer profiles.
- Main event bookings with hall slots.
- Multiple sub-events within a booking.
- Bride and groom information.
- Event packages, catering menus, and services.
- Per-plate pricing and final guest counts.
- Quotations (with versions) and booking confirmations.
- Advance payments, instalments, security deposits, refunds, and outstanding balances.
- GST tax invoices.
- Event schedules, kitchen sheets, and operational tasks.
- Customer documents and photos.
- PDF generation and printing.
- Website content, gallery, menus, décor themes, real-wedding stories, and blog posts.
- WhatsApp and email notifications.
- Staff access, reports, and activity history.

Important business constraint:

**Room booking is not part of the current business scope. Do not create room-booking workflows or advertise room-booking services on the public website.**

Do not add unsupported amenities, awards, ratings, customer testimonials, or claims about the venue. Use actual information supplied by the business. Where information is missing, create editable CMS placeholders rather than inventing facts. Keep a running list of missing business information in `docs/missing-business-info.md`.

---

# 2. REQUIRED TECHNOLOGY STACK

## Frontend and application framework
- Next.js using the App Router.
- React.
- TypeScript with strict mode enabled.
- Tailwind CSS.
- shadcn/ui for accessible, reusable interface components.
- Lucide icons.
- React Hook Form.
- Zod for form validation.
- An i18n solution suitable for the App Router for Hindi + English on the public website.

Use current stable, mutually compatible versions at implementation time. Avoid unnecessary dependencies.

## Backend
Use Next.js server-side functionality for backend logic:
- Server Components where appropriate.
- Server Actions or Route Handlers where appropriate.
- Shared server-side service modules for business logic.
- Server-only database access.
- Authorization checks on every protected operation.

Do not create a separate Node.js backend unless a specific requirement justifies it. The PDF rendering service (Section 14) is one such justified exception if the main host cannot run Chromium.

## Database
- PostgreSQL.
- Prisma ORM.
- Prisma migrations.
- Foreign keys, indexes, unique constraints, transactions, and appropriate deletion rules.

Do not use in-memory arrays, browser local storage, or mock data as the permanent database.

## Image and video management
- Cloudinary for public website photos, hero video, banners, gallery images, menus, décor themes, and other suitable media.
- Use optimized image delivery, responsive sizing, and supported modern formats (AVIF/WebP).
- Hero video: compressed, muted, looping, with a poster image fallback for slow connections and reduced-motion users.
- Keep Cloudinary credentials on the server.
- Use signed upload flows or another secure upload method.

Sensitive customer documents must not be uploaded as ordinary public gallery assets. Design a separate private document-storage mechanism with strict access control. Evaluate whether Cloudinary authenticated assets are appropriate; otherwise use an appropriate private object-storage provider. Do not expose private document URLs.

## PDF generation
Use HTML/CSS-based templates with Playwright and Chromium PDF generation in a compatible server environment.

Serverless platforms such as Vercel may not run Chromium reliably. Decide this in Phase 1, not at the end: either deploy a small separate PDF rendering service on a container-capable host (for example Render) with an authenticated internal API, or choose an alternative reliable renderer. Document the decision in `docs/architecture.md`.

## Messaging
- WhatsApp Business messaging through an approved WhatsApp Business API provider, using pre-approved templates.
- Transactional email through a reputable provider, sent from the business domain with SPF and DKIM configured.
- SMS only if needed, and only with Indian DLT template registration.

Build a notification abstraction so providers can be swapped. Until a provider is configured, notifications are recorded in the database and shown in the CRM; do not claim messages are sent.

## Hosting and deployment
Preferred services:
- Vercel for the Next.js application, subject to plan terms. Free hobby-type plans may not permit commercial use; verify and flag this.
- PostgreSQL through a managed provider with automated backups.
- Render or similar for the PDF service and as an alternative host.
- Cloudinary for media delivery.
- GitHub for version control.
- The business's own domain with SSL.

Free-tier preference:
- Use free tiers where practical and currently available.
- Do not introduce paid services without explaining why they are needed.
- Verify current limits, commercial-use terms, database pause/expiry rules, storage limits, and hosting restrictions before deployment.
- Never promise that all production usage will remain free indefinitely.

For production customer and payment records, use persistent database storage with daily automated backups and a tested restore. Do not rely on an expiring or auto-pausing free database without a migration and backup plan.

## Monitoring
- Error tracking for server and client errors.
- Uptime monitoring for the homepage and enquiry endpoint.
- Alerts to the business owner when the enquiry form fails.

---

# 3. PROJECT ARCHITECTURE AND CODE QUALITY

Build a modular monolithic application.

The public website, CMS, and CRM share one codebase and one design system.

Suggested structure:

```
src/
  app/
    (website)/[locale]/
    (auth)/
    admin/
    api/
  components/
    ui/
    shared/
    forms/
    tables/
    layout/
    website/
  modules/
    leads/
    customers/
    bookings/
    halls/
    slots/
    menus/
    payments/
    invoices/
    deposits/
    documents/
    events/
    services/
    packages/
    vendors/
    staff/
    notifications/
    cms/
    blogs/
    reports/
    settings/
  lib/
    auth/
    db/
    validation/
    permissions/
    storage/
    pdf/
    money/
    seo/
    i18n/
    analytics/
    utils/
  server/
    services/
    repositories/
    policies/

prisma/
  schema.prisma
  migrations/
  seed.ts

tests/
docs/
public/
.claude/skills/
```

This structure is a starting point, not a reason to create unnecessary abstraction. Keep code readable and maintainable.

Requirements:
- Use reusable components and shared business services.
- Keep business logic out of presentation components.
- Separate server-only code from client-side code.
- Avoid duplicated validation rules.
- Avoid giant files and overly complicated abstractions.
- Use TypeScript types throughout.
- Use database migrations rather than manually editing production tables.
- Never hardcode secrets or production credentials.
- Add an `.env.example` containing placeholder values only.
- Add a useful `.gitignore`.
- Document installation, development, testing, migration, backup, and deployment procedures.
- Never commit `.env` files, API secrets, private documents, or customer data.
- Seed data must be clearly fake sample data for development only, never real customers.

Before making major architectural decisions, document them in `docs/architecture.md`.

---

# 4. GLOBAL DESIGN SYSTEM AND CONSISTENT THEME

This requirement is mandatory. Load the `sundaram-design-system` skill before any UI work.

The entire public website, CRM, CMS, forms, tables, dialogs, PDF previews, and admin dashboard must use one consistent design system.

Create and maintain:
- `src/app/globals.css`
- Central CSS custom properties/design tokens.
- A Tailwind theme configuration appropriate for the installed Tailwind version.
- Reusable shadcn/ui components themed with the tokens.
- Shared typography and spacing rules.
- Shared responsive breakpoints.
- Consistent focus, hover, disabled, loading, success, warning, and error states.

Do not introduce arbitrary styles independently on every page.

## Visual direction: "Rose Mahal"

A sophisticated Indian luxury identity that is royal and soft rather than red and heavy: berry-rose maroon, blush pink, lavender, pearl ivory, and a restrained champagne-gold accent.

Palette tokens:

| Token | Hex | Use |
|---|---|---|
| `--color-primary` | `#8E3B5A` | Primary buttons, links, key headings |
| `--color-primary-hover` | `#7A3150` | Hover/active state of primary |
| `--color-primary-deep` | `#4A1F33` | Footer, hero overlays, dark sections |
| `--color-blush` | `#F3D9E1` | Soft section backgrounds, chips |
| `--color-lavender` | `#DCD0EA` | Secondary accents, badges, highlights |
| `--color-gold` | `#C9A96E` | Thin dividers, icons, ornaments only |
| `--color-bg` | `#FBF7F5` | Page background (pearl ivory) |
| `--color-surface` | `#FFFFFF` | Cards, forms, tables |
| `--color-text` | `#2E2230` | Body text (plum charcoal) |
| `--color-text-muted` | `#6B5A66` | Secondary text |
| `--color-border` | `#E8DCE1` | Hairlines and input borders |

Status colors (CRM): use clear, standard green / amber / red / blue tokens so staff read status instantly; keep them separate from brand tokens.

Usage rules:
- Roughly 60% ivory/white, 25% blush and lavender, 10% primary, 5% gold.
- White text on primary and primary-deep only. Never use gold or blush as text on ivory (insufficient contrast).
- Gold is an accent: no large gold backgrounds, no heavy ornamental borders, no gradients beyond subtle image overlays.

Typography:
- Display/headings: Cormorant Garamond (or Playfair Display) via `next/font`.
- Body/UI: Inter (or Manrope) via `next/font`.
- Hindi: Tiro Devanagari Hindi (or Noto Serif Devanagari) for Hindi pages.

All tokens remain adjustable centrally.

### Public website design
The public website should feel luxurious, elegant, spacious, royal but modern, visually rich, trustworthy, and mobile-first.

Use high-quality venue and wedding imagery supplied through Cloudinary. Use strong typography, generous whitespace, excellent image composition, subtle motion (respecting reduced-motion), and clear calls to action.

### CRM design
The CRM is operationally efficient rather than decorative. Include:
- Persistent sidebar navigation on desktop; responsive mobile navigation.
- Clear page headings and breadcrumbs.
- Searchable and filterable tables with pagination.
- Consistent forms and readable status badges.
- Empty states, loading skeletons, and error states.
- Confirmation dialogs for destructive actions.
- Toast notifications where appropriate.

Use the same tokens as the public website with a more functional layout (mostly ivory, white, and primary).

### Global CSS rules
1. Define shared CSS variables for colors, typography, spacing, shadows, radius, and layout.
2. Use shared components instead of duplicate buttons, inputs, cards, and modals.
3. Avoid inline styles for normal styling.
4. Do not introduce arbitrary hex colors outside the token file.
5. Meet WCAG AA color contrast.
6. Support keyboard navigation and visible focus states.
7. Respect reduced-motion preferences.
8. Ensure responsive layouts on mobile, tablet, laptop, and desktop.
9. Avoid horizontal overflow.
10. Test that theme changes propagate across the whole application.

Document the design system in `docs/design-system.md`.

---

# 5. PUBLIC WEBSITE

Load the `luxury-venue-content` skill before building public pages.

All factual content (capacities, areas, facilities, menus, policies, contact details) comes from the CMS and must be supplied by the business. Use clearly marked placeholders until then.

## Homepage
- Full-screen hero with a muted looping venue film (poster image fallback), main headline, and introduction.
- Primary CTA "Plan your event" and secondary CTAs for WhatsApp and call.
- Venue spaces overview with key facts per hall.
- Wedding and celebration services.
- Catering highlight.
- Décor themes preview.
- Featured packages.
- Gallery preview.
- Real-wedding stories preview (only consented stories).
- Genuine reviews section linking to the Google Business Profile (no fabricated reviews).
- Auspicious/popular wedding dates for the season (CMS-editable).
- Wedding inspiration/blog preview.
- Location, map, and contact section.
- Instagram strip (optional, if an approved integration is configured).
- Footer with navigation, contact, social links, and legal links.

## About page
Editable venue introduction, brand story, heritage, and genuine venue information.

## Venue spaces (halls and lawns)
Listing page plus one detail page per hall/lawn with:
- Name and description.
- Hero image and gallery.
- Area (sq ft) and ceiling height, if verified.
- Capacity per seating layout (theatre, round table/banquet, floating/standing, cluster), if verified.
- Facilities (AC, power backup, stage, bridal/green room, parking, lift, accessibility), if verified.
- Floor plan image (CMS upload).
- 360° tour or walkthrough video, if available.
- Suitable event types.
- Bookable slots (Morning, Evening, Full day) as informational text.
- Enquiry and site-visit CTAs.

## Catering
- Cuisine styles offered.
- Sample menus by category (Veg, Jain, Non-veg if offered), managed in the CMS from the same Menu data the CRM uses (public/private visibility flag).
- Live counters and speciality items.
- Food photography.
- Statement about outside caterers only as configured by the business.

## Décor themes
Gallery of theme setups (floral, royal, pastel, mandap styles, stage designs), each with photos and description.

## Services
Pages or sections for:
- Weddings and celebrations.
- Engagements and receptions.
- Haldi, mehendi, and sangeet.
- Catering.
- Decoration.
- Corporate and social events.
- Other configurable event services.

Do not advertise room booking.

## Packages
Configurable packages with name, description, included services, optional add-ons, terms, and enquiry CTA. Public prices display only when enabled by an authorized administrator.

## Real weddings
Story pages for actual events: couple names only with written consent, event type, hall used, photos with photographer credit, short story. Consent flag and consent date stored in the CMS; unpublished if consent is withdrawn.

## Gallery
Cloudinary-managed images and videos with categories (halls, décor, food, events), captions, alt text, featured images, responsive layouts, and pagination or progressive loading.

## E-brochure
Downloadable PDF brochure uploaded via the CMS. Optional gate (name + phone) that creates a lead with source "Brochure download".

## Plan your event (enquiry flow)
See Section 7.

## Date availability check
A public "Check date availability" tool:
- Input: date (and optionally hall).
- Output only: Available / Limited / Fully booked — enquire. Never reveal customer names, booking details, or which events are booked.
- Computed server-side from confirmed bookings and active holds, cached briefly, rate-limited.
- Always followed by an enquiry CTA. Can be disabled in settings.

## Book a site visit
Slot picker for site visits (configurable days and times). Creates or updates a lead with a site-visit date and notifies the assigned staff.

## Contact
Editable contact details, Google Maps embed, directions (e.g. from railway station, bus stand, airport — CMS-editable text), floating WhatsApp button (wa.me link with a prefilled message), click-to-call, and the enquiry form. Do not invent contact details.

## Offers and landing pages
CMS-managed landing pages for seasonal or off-season offers and ad campaigns, with their own SEO fields and an enquiry form that tags the lead with the campaign.

## Blogs
Listing page, individual posts, categories and tags, featured image, author, publication date, search/filtering, related posts, social sharing metadata, and SEO metadata.

## Language
Hindi + English toggle for public pages. CMS content supports both languages per field; fall back to English when Hindi is empty. Use proper `hreflang` tags.

## Legal and utility pages
Privacy policy, terms and conditions, cancellation and refund policy, cookie/consent notice, custom 404 page, and error pages. Legal text must be reviewed before production. Do not invent legal certifications.

## Website performance budget
- Largest Contentful Paint under ~2.5 s on a mid-range phone over 4G.
- Hero video under ~3 MB, poster image prioritized; lazy-load everything below the fold.
- No layout shift from images or fonts.

---

# 6. WEBSITE CMS

Authorized administrators manage website content without editing source code.

CMS functionality for:
- Homepage sections and their order/visibility.
- Headings and text (English + Hindi).
- Hero video, poster, and banners.
- Halls: descriptions, facts, capacities per layout, facilities, floor plans, tours, images.
- Catering content and public menus.
- Décor themes.
- Service pages and packages.
- Real-wedding stories with consent fields.
- Gallery categories and media.
- Popular/auspicious dates list.
- E-brochure file.
- Offer/landing pages.
- Contact information, map embed, directions, WhatsApp number and prefilled message.
- Google reviews link.
- Blog posts.
- Navigation and footer content.
- SEO metadata per page.

Blog workflow: Draft, Preview, Publish, Unpublish, and scheduled publication if a reliable scheduling mechanism exists.

Image and video upload to Cloudinary with file type and size validation and required alt text.

The CMS persists data in PostgreSQL. Do not hardcode website content that should be editable.

Use safe rendering for user-entered content. Avoid unsafe HTML injection; use a structured rich-text format with sanitization.

---

# 7. ENQUIRY FLOW AND LEADS CRM

## "Plan your event" form
A short, elegant 3-step form (one compact single-step version for the footer/contact page):
1. Event type and preferred date (optional) and approximate guests (optional).
2. Message / vision (optional) and preferred hall (optional).
3. Full name (mandatory) and phone number (mandatory), email (optional), preferred contact method (WhatsApp / call / email).

Do not ask for extensive customer profile information here.

Suggested event types: Wedding, Engagement, Reception, Sangeet, Haldi/Mehendi, Birthday, Anniversary, Corporate event, Other.

Validate Indian mobile numbers (10 digits, optional +91) without rejecting valid international formats.

Add:
- Server-side validation.
- Spam protection (honeypot + rate limiting; a privacy-friendly CAPTCHA only if spam appears).
- Clear success and failure messages (success shows lead reference and expected response time from settings).
- Accessible labels.
- Duplicate enquiry detection (same phone within a configurable window updates the existing open lead and logs activity).
- Privacy notice and explicit consent checkbox for being contacted, with the consent text version stored.

On successful submission:
1. Save the lead in PostgreSQL.
2. Generate a unique human-readable lead reference (e.g. `SP-L-2026-00042`).
3. Set initial status `NEW`.
4. Record creation timestamp, source page, UTM parameters (source, medium, campaign, term, content), referrer, and language.
5. Make it visible in the CRM Leads module.
6. Notify the assigned/default staff (WhatsApp and/or email when configured; always an in-app notification).
7. Do not automatically create a booking.

## Lead sources
Configurable list, auto-filled where possible: Website form, Brochure download, Site-visit form, Offer page, WhatsApp, Phone call, Walk-in, Instagram, Facebook, Google Ads, Wedding portal, Referral, Repeat customer, Other.

## Lead fields (CRM)
Lead source and campaign, assigned staff member, follow-up date, internal notes, estimated budget, expected guest count, preferred hall and slot, interested services, menu preference (Veg/Jain/Non-veg), site-visit date and outcome, quotation status, lost reason (configurable list: price, date unavailable, chose another venue, postponed, no response, other).

## Lead statuses
Configurable, validated. Initial: New, Contacted, Follow-up, Site Visit Scheduled, Site Visit Done, Quotation Sent, Negotiation, Won, Lost.

Support: search, filters, sorting, pagination, lead detail view, follow-up reminders, activity history (calls, WhatsApp, visits, notes), staff assignment, conversion to an existing customer, conversion into a booking, and a "Chat on WhatsApp" action that opens a prefilled chat.

Prevent duplicate customer creation when converting a lead.

---

# 8. CUSTOMER MANAGEMENT

Create a separate CRM navigation tab named **Customers**. Customer information must not be mixed into the public enquiry form.

## Customer fields
Mandatory: full name, mobile number.

Optional: WhatsApp number, email, GSTIN (for business customers), company name, marital status, date of birth, age (calculated from DOB, not stored), marriage anniversary, spouse name, customer category, profession, state, city, locality, full address, customer photo, documents, internal notes, communication consent flags (WhatsApp, email, SMS, greetings).

Marital status options: Single, Married, Other, Prefer not to say. When Married, show spouse name and anniversary. Do not make sensitive or unnecessary fields compulsory.

## Customer categories
Initial: High Value Client, Mid-Level Client, Budget Client. Managed in settings. Category is a business decision by authorized staff; never inferred from sensitive personal characteristics.

## Profession dropdown
Government Employee, Farmer, Businessman, Doctor, Contractor, Politician, Teacher, Professor, Engineer / IT, Other (with optional text).

## Customer profile page
Customer information, contact details, address, previous enquiries, current and past bookings, quotations and generated documents, invoices, payment summaries, activity timeline, authorized uploaded documents, notes and preferences, consent status.

Search by name and mobile number. Duplicate detection for phone numbers with an authorized merge-review workflow.

## Greetings and repeat business
Only when the customer has opted in: optional birthday and anniversary greetings (WhatsApp/email templates) and a "past customers" list for repeat-business offers. If greetings are not used, do not collect DOB and anniversary by default.

## Customer data handling
Customer names, phone numbers, dates of birth, marital information, and documents are private business records. Apply role-based access, server-side authorization, secure upload/download, data minimization, audit logging, configurable retention and deletion procedures, no public indexing, and no sensitive fields in unnecessary API responses.

Do not store unnecessary copies of Aadhaar or PAN details. Never store full Aadhaar numbers in plain database fields.

---

# 9. HALLS, SLOTS, AND BOOKING MANAGEMENT

Load the `banquet-business-rules` skill before working on halls, slots, bookings, holds, or conflicts.

## Halls (venue spaces)
Each hall/lawn has: name, slug, description, area, ceiling height, capacity per layout, facilities, images, floor plan, active flag, setup buffer (hours before), teardown buffer (hours after), and whether it can be combined with another space.

## Slots
Configurable slot definitions per hall, e.g.:
- Morning (e.g. 08:00–15:00).
- Evening (e.g. 18:00–01:00 next day).
- Full day.
- Custom time range.

Times are examples only; real times come from settings. Slots may cross midnight; handle this correctly.

## Create booking workflow
1. Search existing customers by name or mobile number.
2. Select the customer, or create one if authorized.
3. Enter main event details.
4. Add one or more sub-events, each with date, hall, and slot.
5. Check availability (slots + buffers) and see conflicts.
6. Select package, menu, and per-plate rate where applicable.
7. Add services and custom line items.
8. Define pricing, discount, tax, deposit, and terms.
9. Optionally place a tentative hold.
10. Record payment information.
11. Save the booking.
12. Generate documents as required.

## Booking fields
Unique booking reference (e.g. `SP-B-2026-00017`), customer, main event name and type, start and end dates, expected guest count, booking status, selected package, menu selections, service line items, pricing, discount, tax configuration, security deposit, cancellation policy (snapshotted), total booking amount, notes, internal instructions, created by, timestamps.

## Booking statuses
Initial: Enquiry Hold, Tentative, Quotation Sent, Confirmed, In Progress, Completed, Cancelled. Managed centrally. Tentative and holds are never treated as confirmed.

## Tentative date holds
- Authorized staff can place a hold on hall + date + slot for a configurable period (default from settings, e.g. 3 days).
- Holds show on the calendar distinctly from confirmed bookings.
- Before expiry, notify the assigned staff; on expiry, release the hold automatically (or via a scheduled job) and log it.
- A second hold on the same slot is allowed only as a waitlist entry and is clearly marked.

## Availability and conflicts
- Calendar showing all sub-events by hall, date, and slot, with confirmed, tentative, and hold states visually distinct.
- Conflict = same hall, overlapping time once setup and teardown buffers are applied, and at least one side confirmed (holds and tentatives produce warnings).
- Use proper timestamp comparisons in the configured time zone and database-safe logic (transaction or exclusion-constraint approach) so two staff cannot confirm the same slot simultaneously.
- Warnings explain the conflict (which booking reference, which hall, which time). Authorized overrides require explicit confirmation and an audit log entry.
- Different halls do not conflict unless they are configured as combined spaces.

## Booking detail page
Customer details, main event, sub-events, halls and slots, menus and plate counts, services, package and pricing, quotation versions, payments, deposit, invoices and balance, bride and groom details where applicable, documents, generated PDFs, tasks and notes, and activity timeline. Editable according to role and booking status.

## Cancellation
- Configurable cancellation slabs (e.g. % refundable by days before the event); actual values come from the business.
- The slab in force is snapshotted on the booking at confirmation.
- Cancelling a booking shows the computed refund per the policy, allows an authorized override with a reason, records refund entries in the ledger, and releases the slots.

---

# 10. SUB-EVENT MANAGEMENT

A booking may include multiple events: Haldi, Mehendi, Sangeet, Engagement, Wedding, Reception, and custom functions.

Each sub-event has: name, event type, date, hall, slot (or custom start/end time), expected guest count, menu and plate count, services required, assigned staff, special instructions, internal notes, and status.

Allow users to add, edit, reorder, and remove sub-events subject to permissions and booking status rules.

A booking supports multiple dates. The main booking date is never assumed to be the date of every sub-event. Show all sub-events in the calendar and booking detail page. Availability is checked per sub-event.

---

# 11. BRIDE AND GROOM DETAILS

When the main event type is Wedding or another marriage event, show a dedicated section for both parties.

Bride: full name, mobile number, optional additional contact details, optional documents.

Groom: full name, mobile number, optional additional contact details, optional documents.

Optional document categories: PAN Card, Aadhaar Card (masked/redacted copies preferred), Other.

Collect identity documents only when the business has a legitimate need and applicable rules permit it. Fields are optional unless a justified requirement is configured.

Protect files with private storage and strict authorization. Never display sensitive document images in public pages, public gallery URLs, or unrestricted PDF exports. Document access must be audit-logged.

---

# 12. PACKAGES, MENUS, AND SERVICES

## Service categories
Venue/hall rental, Catering, Decoration, Lighting and sound, Other event services. Room booking is excluded.

## Package management
Each package: name, description, applicable event types, included services, quantity/unit, default price or per-plate rate, minimum guaranteed plates, optional add-ons, terms, active/inactive.

## Menu builder
- Menu categories: Veg, Jain, Non-veg (only if offered), and custom.
- Menu items grouped by course (welcome drinks, starters, main course, breads, rice, desserts, live counters).
- Menu packages with a per-plate rate and item-selection rules (e.g. choose 3 starters from a list).
- Public/private visibility per menu for the website.
- A menu is selected per sub-event; the selection is snapshotted on the booking.

## Per-plate pricing and guest counts
- Line item type "Plates": quantity = guaranteed plates, unit price = per-plate rate.
- Minimum guaranteed plates per package/hall/slot (configurable).
- Final guest count lock date (configurable days before the event); changes after lock require authorization.
- After the event, record actual plates served; extra plates beyond the guarantee are billed at the configured rate as a new line item; shortfall below the guarantee is not refunded unless the policy says so.

## Season and date pricing
Optional pricing rules: peak/off-peak seasons, weekends, and named high-demand dates (e.g. popular muhurat dates). Rules adjust default prices on new quotations only; historic bookings never change.

## Booking line items
Package items, menu/plate items, individual services, custom line items, quantity, unit price, discount, tax category (SAC code), line total.

Snapshot descriptions and prices on the booking so later package or menu edits do not alter historical bookings, quotations, or invoices.

Use decimal-safe database types for money. Never use floating-point arithmetic for financial calculations. All totals are calculated and validated server-side.

## Quotation versions
- A booking can have multiple quotation versions (v1, v2, v3…), each an immutable snapshot of line items, terms, and totals.
- One version can be marked "Accepted" with date and who recorded it; the booking pricing follows the accepted version.
- Show differences between versions.

---

# 13. PAYMENTS, DEPOSITS, AND GST INVOICES

Load the `india-billing-gst` skill before working on money, tax, invoices, deposits, or refunds.

## Payment ledger
Each booking has its own ledger. Customers often pay in multiple instalments.

Payment summary: total booking amount, total received, refunds and adjustments, security deposit held, outstanding balance, payment status.

Payment record fields: booking, amount, date, method, transaction reference, receipt reference, recorded by, notes, status, creation timestamp, idempotency key.

Methods: Cash, UPI, Bank Transfer, Card (recorded offline), Cheque, Other.

Support: advance payments, configurable booking-advance percentage, multiple instalments, partial and full payments, payment schedule with due dates, payment receipts, payment history, outstanding balance, refunds and adjustments, and due reminders (in-app, WhatsApp/email when configured).

## Security deposit
- Optional refundable deposit per booking, tracked separately from revenue.
- After the event, record deductions (damage, extra hours, extra plates if policy allows) with reasons, then the refund.
- Deposits are never counted as revenue in reports unless deducted.

## Financial integrity
- Use a transaction when recording a payment and updating related records.
- Calculate balances server-side: Outstanding = Total booking amount (accepted, incl. tax) + post-event charges − Net payments received (payments − refunds), with deposits handled separately.
- Never silently edit or delete financial history; corrections are reversal/adjustment entries with reasons and audit log.
- Protect against duplicate submissions with idempotency keys.
- Never store card numbers, CVVs, UPI PINs, or other payment authentication secrets.
- Do not claim online payments are supported until a real payment gateway is integrated and tested.

## GST tax invoices
Distinct from payment receipts.
- Business details: legal name, GSTIN, address, state code (from settings).
- Customer details: name, address, GSTIN if provided, place of supply.
- Line items with SAC codes, taxable value, rate, and tax split: CGST + SGST for intra-state supply, IGST for inter-state supply.
- Invoice numbering per financial year (April–March) with a configurable prefix, sequential and gap-free, generated inside a transaction.
- Support tax-inclusive and tax-exclusive pricing.
- Credit notes for cancellations or reductions instead of editing issued invoices.
- Amount in words (Indian numbering: lakh, crore).
- Rates, SAC codes, and treatment are configurable and must be validated by the business's accountant before official use. Do not hardcode tax rates.

---

# 14. PDF GENERATION AND CUSTOM PRINT FIELDS

Load the `pdf-documents` skill before working on templates or rendering. Mandatory feature.

Users choose exactly which booking fields appear in a generated PDF or printout.

## Workflow
1. Open a booking.
2. Select Generate PDF or Print.
3. Choose a document type.
4. Choose a template.
5. Tick or untick individual fields.
6. Preview.
7. Generate a PDF or print.
8. Optionally save the selection as a reusable preset.

## Document types
Quotation (per version), Booking Confirmation, Payment Receipt, Payment Statement, GST Tax Invoice, Credit Note, Security Deposit Settlement, Event Function Sheet, Kitchen/Menu Sheet (menu per sub-event with plate counts, dietary notes), Custom Booking Summary, and the public E-brochure (if generated rather than uploaded).

## Selectable fields
Customer name, mobile, email, address, GSTIN; main event details and date; sub-events with dates, halls, and slots; bride details; groom details; hall information; guest/plate counts; menus; package information; services; itemized pricing; discount; tax details; total; payments received; deposit; pending balance; payment schedule; payment terms; cancellation policy; booking conditions; internal notes (authorized only); custom notes.

Never include identity documents by default. Sensitive fields are excluded unless an authorized user explicitly selects them for a legitimate purpose. Fields required by law on a tax invoice cannot be unticked.

## Templates
Elegant Royal (Rose Mahal styling), Minimal Professional, Detailed Quotation, Compact Booking Summary, Kitchen Sheet (high-contrast, large text, no prices).

Admins can preview templates, set defaults per document type, configure branding/logo, headings, footer, business contact details, standard terms, and save print presets.

## PDF requirements
A4 print-ready layout, correct page breaks, repeated table headers on multipage tables, embedded consistent fonts (including Devanagari if Hindi text appears), readable text, INR formatting with Indian digit grouping (₹1,25,000.00), no clipped content, no blank extra pages, logo and branding, generated timestamp in Asia/Kolkata, unique document reference, download and print controls.

Store document metadata and version history in the database. Store generated PDFs in private object storage where needed.

Render only from trusted server-side templates with escaped data; never from arbitrary user HTML. Test on realistic sample bookings including long multi-day weddings.

---

# 15. TASKS, STAFF, VENDORS, AND EVENT OPERATIONS

## Staff and roles
Initial roles: Super Admin, Admin, Manager, Sales / Enquiry Team, Accounts, Event Operations, Kitchen (view-only kitchen sheets).

Implement a permissions matrix rather than relying only on role names:
- Sales: leads, permitted customer info, quotations.
- Accounts: payments, invoices, deposits, financial reports.
- Event Operations: assigned events, function sheets, tasks.
- Kitchen: kitchen sheets for upcoming events only.
- Managers: bookings, holds, overrides within limits, operations.
- Super Admin: system configuration and permissions.

Restrict sensitive customer documents and financial operations to authorized roles. Two-factor authentication is required for Super Admin, Admin, and Accounts.

## Task management
Tasks link to leads, customers, bookings, or sub-events. Fields: title, description, assignee, due date, priority, status, related booking, completion timestamp. Include task templates (e.g. an event checklist generated when a booking is confirmed).

## Vendor management
Vendor name, contact, service category, notes, event assignments. Optionally mark "partner vendors" for décor, photography, DJ, etc.

## Expenses
Booking-related expenses: category, vendor, amount, date, payment status, notes, booking. Estimated booking profitability only when revenue and expense data exist; never presented as audited results.

## Inventory (later phase)
Optional tracking of décor items, furniture, and crockery assigned per event.

## Event-day staff view
Installable mobile-friendly web app (PWA) view for operations staff: today's events, halls, timings, function sheet, tasks, and contacts. No financial data unless permitted.

---

# 16. DASHBOARD AND REPORTING

Role-appropriate dashboards.

Admin: new leads, follow-ups due, holds expiring, upcoming bookings, booking status summary, revenue recorded, outstanding payments, upcoming events, hall occupancy by month, recent activities.

Sales: assigned leads, follow-ups due, site visits scheduled, quotations sent, conversion status.

Accounts: payments received, outstanding balances, payments due, deposits held, invoices issued, recent payment activity.

Operations: upcoming events, sub-event schedules by hall, assigned and overdue tasks, event instructions.

Reports (with date range, status, event type, hall, staff, source/campaign filters): lead conversion by source and campaign, booking reports, hall/slot occupancy, revenue summaries, outstanding balances, payment reports, GST invoice register, deposit register, expense summaries, staff task reports.

Reports derive from actual database records only. Do not fabricate statistics. Use database aggregation and pagination. Provide CSV/Excel export for authorized roles.

---

# 17. SEARCH, FILTERING, AND NAVIGATION

CRM navigation: Dashboard, Leads, Customers, Bookings, Calendar, Halls and Slots, Menus, Payments, Invoices, Packages and Services, Staff and Tasks, Vendors, Expenses, Documents, Notifications, Website CMS, Blogs, Reports, Settings.

Provide search by name, phone, and booking/lead reference; filters; sorting; pagination; clear filter controls; empty states; useful table actions; responsive mobile views; and a global quick search.

Avoid tables with excessive columns. Use detail pages and focused actions.

---

# 18. SEO AND LOCAL VISIBILITY

Implement:
- Server-rendered or statically generated public pages.
- Unique title and meta description per page (both languages).
- Canonical URLs and `hreflang` for Hindi/English.
- XML sitemap and correct robots.txt.
- Open Graph and social-sharing metadata.
- Descriptive image alt text (required field in CMS).
- Clean URL slugs, breadcrumbs, internal linking.
- Blog metadata.
- Structured data using only truthful information: an appropriate LocalBusiness / EventVenue type, address, geo, opening hours, and contact only as supplied; no ratings or reviews markup unless genuinely sourced and permitted.
- Custom 404 and redirect handling.
- Image optimization and good Core Web Vitals.
- Indexing controls: noindex for admin, CRM, private PDFs, and documents.

Local visibility launch tasks (documented checklist, done by the business with guidance):
- Claim and complete the Google Business Profile with correct name, address, phone, categories, photos, and website link.
- Keep name/address/phone consistent across the website, profile, and social pages.

Do not add unsupported claims, fake reviews, fake ratings, or keyword-stuffed text. SEO settings are editable in the CMS.

---

# 19. ANALYTICS AND CONSENT

- Privacy-friendly analytics (or GA4) loaded only after consent where required.
- Track conversions: enquiry submitted, WhatsApp click, call click, brochure download, site-visit booked, date-check used.
- Optional Meta/Google Ads pixels only behind consent and only if the business requests them.
- UTM parameters and referrer stored on each lead for source reporting.
- Never send personal data (names, phones) to analytics tools.

---

# 20. NOTIFICATIONS AND WHATSAPP

Load the `secure-customer-data` skill before building messaging, since it handles personal data.

- Notification abstraction with channels: in-app, email, WhatsApp, SMS (optional).
- Events: new lead, site visit booked, hold expiring, quotation sent, payment received, payment due, event reminder (staff and customer), post-event feedback request, opt-in greetings.
- WhatsApp messages use pre-approved templates from the provider; free-form messages only within the allowed customer-service window.
- Each customer message respects the customer's consent flags.
- Every sent/failed message is logged with status; no message content containing sensitive documents.
- "Chat on WhatsApp" actions in the CRM open wa.me links with prefilled text (works without any API).
- Post-event: feedback form link and a request to leave a Google review (only genuine, no incentives that violate platform rules).

---

# 21. SECURITY AND PRIVACY

Load the `secure-customer-data` skill before working on auth, permissions, uploads, or personal data.

Implement: secure authentication, server-side authorization, permissions matrix, secure sessions, 2FA for privileged roles, input validation, output escaping, protection against common web vulnerabilities (OWASP Top 10), CSRF protection where relevant, security headers and a content security policy, rate limiting for public endpoints (enquiry, date check, site visit, brochure), secure file upload validation (type sniffing, size limits), private document access, environment-based secrets, database access controls, audit logs, error handling without leaking secrets, and backup and recovery documentation.

Customer documents: no public URLs, authorization on every download (short-lived signed URLs), no unnecessary copies, excluded from ordinary PDFs by default, access logged.

Financial records: transactions, full history, reversal/adjustment entries instead of deletion, duplicate-submission protection, server-side calculations.

Do not log passwords, tokens, payment secrets, or unnecessary personal information.

## Indian data protection
Design for the Digital Personal Data Protection (DPDP) Act, 2023 and its Rules:
- Clear privacy notice and purpose-specific consent at collection (enquiry, brochure, site visit, greetings).
- Store consent records (what, when, which notice version).
- Collect only what is needed; optional fields stay optional.
- Support access, correction, and deletion requests through an admin workflow, while retaining financial/tax records for legally required periods.
- Configurable retention periods per data type.
- Breach-response notes in `docs/security.md`.
Have the privacy policy and consent text reviewed by a qualified professional before production.

---

# 22. GLOBAL SETTINGS

Authorized users configure:
- Business name, legal name, logo, GSTIN, state code, address, contact details, WhatsApp number, office hours.
- Default currency (INR), date/time formatting, time zone (`Asia/Kolkata`).
- GST settings, SAC codes, tax-inclusive/exclusive default, invoice prefixes, financial-year numbering.
- Document numbering for leads, bookings, quotations, receipts, invoices, credit notes.
- Halls, slots, setup/teardown buffers, combinable spaces.
- Hold duration and reminder timing.
- Booking-advance percentage, payment schedule defaults, security deposit defaults.
- Cancellation slabs.
- Minimum plates and guest-count lock days.
- Season/date pricing rules.
- Booking statuses, lead statuses, lead sources, lost reasons.
- Customer categories, profession options, event types, service categories, menu categories.
- Package terms and standard terms and conditions.
- PDF branding and default templates.
- Notification channels, templates, and preferences.
- Public date-check on/off and site-visit availability.
- Website SEO defaults and languages.
- Data-retention periods.

Do not hardcode tax rates or business policies in logic. Validate tax treatment with the business's accountant before official invoices.

Store timestamps in UTC and format them in the configured time zone. Handle slots that cross midnight.

---

# 23. CLOUDINARY INTEGRATION

- Server-side upload authorization and secure credentials.
- File type and size validation; required alt text for public images.
- Responsive transformations and modern formats.
- Video optimization for the hero film and tours.
- Logical asset groups: hero/banners, halls, floor plans, catering, décor, real weddings, gallery, blog, brochure, customer profile photos.
- Removal/replacement workflow and database records for asset metadata (including photographer credit and usage permission for wedding photos).
- Folder naming is not a security boundary.

Private documents use a separate secured private-storage provider behind a storage abstraction so the provider can change without rewriting the CRM.

---

# 24. DATABASE DESIGN

Load the `db-change-safety` skill before changing the Prisma schema or migrations.

Design a normalized relational schema in Prisma. Potential entities:

User, Role, Permission, UserRole, TwoFactorSecret, Lead, LeadActivity, LeadSource, Customer, CustomerAddress, CustomerDocument, ConsentRecord, Hall, HallLayoutCapacity, SlotDefinition, Booking, BookingSubEvent, SlotReservation (hold/tentative/confirmed per hall + time range), BookingLineItem, BookingSnapshot, Quotation, QuotationVersion, Menu, MenuCategory, MenuItem, MenuPackage, SubEventMenuSelection, PricingRule, CancellationPolicy, BrideGroomDetails, Payment, PaymentAdjustment, PaymentSchedule, SecurityDeposit, DepositTransaction, Invoice, InvoiceLine, CreditNote, NumberSequence (per document type and financial year), Expense, Vendor, Task, TaskTemplate, UploadedAsset, GeneratedDocument, DocumentTemplate, DocumentPreset, Notification, MessageLog, ActivityLog, WebsitePage, PageSection, Translation, GalleryCategory, DecorTheme, RealWeddingStory, OfferPage, SiteVisitSlot, BlogPost, BlogCategory, SiteSettings, Service, Package.

Adjust based on actual workflow needs. Avoid tables created solely to match this list.

Important relationships:
- A lead can be linked to a customer; a customer has many leads and bookings.
- A booking belongs to a customer and has many sub-events, line items, quotation versions, payments, invoices, documents.
- A sub-event has a hall, a slot reservation, menu selections, and tasks.
- Slot reservations prevent double-confirmation for the same hall and overlapping time range (consider a PostgreSQL exclusion constraint on a time range for confirmed reservations, or transactional checks with row locking).
- Users create and update business records.

Use foreign keys, unique references, search/filter indexes, constraints, Decimal for money, appropriate nullability, timestamps, explicit deletion policies (soft delete for customers/bookings; no cascade deletes of financial records), and transactions for multi-step financial and booking operations.

Document the ERD or relationship overview in `docs/database-design.md`.

---

# 25. TESTING AND QUALITY ASSURANCE

Do not consider the application complete merely because pages render. Use Vitest (unit/integration) and Playwright (end-to-end). Load the `phase-quality-gate` skill at the end of every phase.

Critical test cases:
1. Public enquiry submission creates a lead with UTM data and notifies staff.
2. Invalid enquiry data is rejected.
3. Duplicate submissions are handled safely.
4. Leads can be searched, assigned, and converted without duplicating customers.
5. Customer records persist correctly; consent is recorded.
6. Booking creation links the correct customer.
7. Multiple sub-events can be created with different dates, halls, and slots.
8. Slot conflicts including setup/teardown buffers and midnight-crossing slots are detected correctly.
9. Two concurrent confirmations of the same slot cannot both succeed.
10. Holds expire and release correctly.
11. Per-plate totals, minimum guarantees, and extra-plate billing calculate correctly.
12. Quotation versions are immutable and the accepted version drives pricing.
13. Multiple partial payments update the balance correctly.
14. Refunds, adjustments, and deposits are reflected accurately and deposits are not counted as revenue.
15. GST split (CGST/SGST vs IGST), rounding, and amount-in-words are correct.
16. Invoice numbers are sequential per financial year with no gaps or duplicates under concurrency.
17. Cancellation slabs compute the correct refund.
18. Unauthorized users cannot access protected modules or financial data.
19. Private documents cannot be downloaded without authorization.
20. Public date check never reveals booking details.
21. PDF field selection controls the generated output; legally required invoice fields cannot be removed.
22. PDF templates render correctly over multiple pages, including Hindi text.
23. CMS edits persist in both languages.
24. Blogs publish with correct SEO metadata and hreflang.
25. Responsive layouts work on common screen sizes; no horizontal overflow.
26. Important pages have useful loading and error states.
27. Database migrations apply in a clean environment.
28. Lighthouse/performance budget is met on the homepage and hall pages.

Run type checking, linting, unit tests, integration tests, production build, and relevant end-to-end tests. Fix errors before declaring completion. Never claim a feature works unless implemented and tested.

---

# 26. FREE-TIER AND COST MANAGEMENT

Keep the application free or low-cost to build and operate where feasible:
- Avoid paid dependencies unless necessary; prefer open-source libraries.
- Minimize database queries; optimize images, video, and bandwidth.
- Avoid excessive scheduled jobs (one daily/hourly job for holds, reminders, and backups checks is enough).
- Keep the architecture simple.
- Provide a cost and usage checklist in `docs/costs.md` listing each service, its plan, limits, and what happens when limits are reached.

Before production, verify current terms and limits of Vercel, Render, the PostgreSQL provider, Cloudinary, email provider, WhatsApp provider, and any other integration. Do not assume free plans permit commercial use.

Expected unavoidable or likely costs to flag to the user: domain, possibly a commercial hosting plan, a non-expiring database with backups, and WhatsApp Business messaging fees.

If free-tier choices conflict with reliability, privacy, or security, explain the trade-off and propose alternatives rather than silently weakening security.

---

# 27. DEVELOPMENT WORKFLOW FOR CLAUDE CODE

Work in phases. Do not generate the entire application as a single unreviewed code dump. The website and lead capture ship first so the business starts receiving enquiries early.

## Phase 0 — Discovery and planning
- Inspect the repository; identify whether it is empty or initialized.
- Read this prompt, `CLAUDE.md`, all skills, and reference material.
- List missing business information in `docs/missing-business-info.md` (use the content checklist in Section 28).
- Decide hosting, database, private storage, PDF rendering, and messaging providers; document constraints.
- Create: `docs/architecture.md`, `docs/database-design.md`, `docs/design-system.md`, `docs/implementation-plan.md`, `docs/deployment.md`, `docs/security.md`, `docs/costs.md`.
- Do not invent missing business facts. Ask focused questions only when a missing decision materially affects implementation; otherwise use documented, configurable defaults.

## Phase 1 — Foundation
- Initialize the application, TypeScript, linting, formatting, and tests.
- Configure the Rose Mahal design system and fonts.
- Set up PostgreSQL, Prisma, migrations, and fake seed data.
- Environment validation.
- Authentication, permissions matrix, 2FA for privileged roles.
- Reusable UI components and layouts (website + CRM).
- Error tracking, backups configuration, and CI (type check, lint, test, build).

## Phase 2 — Website and leads MVP
- Homepage, About, Halls (listing + detail), Catering, Décor, Services, Packages, Gallery, Contact, legal pages.
- CMS for all of the above (English first; Hindi fields ready).
- "Plan your event" enquiry flow, WhatsApp/call buttons, Google Maps.
- Leads module (list, detail, assign, follow-up, activity, statuses, sources, UTM).
- New-lead notifications (in-app + email; WhatsApp when configured).
- SEO basics, sitemap, robots, structured data, analytics with consent.
- Deploy to staging, then production once approved.
- Gate: website live, enquiries saving, staff notified, Google Business Profile linked.

## Phase 3 — Bookings and money
- Customers, halls and slots, bookings, sub-events, holds, calendar, conflict detection.
- Menus, packages, per-plate pricing, season rules, quotation versions.
- Payments ledger, schedules, deposits, cancellations, refunds.
- GST invoices, credit notes, numbering.
- Private document storage, bride and groom details.
- PDF service and templates: quotation, confirmation, receipt, statement, invoice, function sheet, kitchen sheet.
- Gate: a real (or realistic test) booking can be quoted, confirmed, paid, invoiced, and printed end to end.

## Phase 4 — Operations
- Staff and tasks with templates, vendors, expenses.
- Dashboards and reports with exports.
- Event-day staff PWA view.
- Activity history review.

## Phase 5 — Growth and engagement
- Blog, Hindi translations, e-brochure, 360 tours, real-wedding stories, offer pages.
- Public date check and site-visit booking.
- WhatsApp templates: quotation sent, payment due, event reminders, feedback and review request, opt-in greetings.
- Instagram strip if approved.

## Phase 6 — Hardening and launch review
- Full test suite, permissions review, security review, privacy/consent review.
- PDF rendering checks on long real-world bookings.
- Migration test on a clean database; verified backup restore.
- Performance budget check.
- Production environment variables and final deployment verification.
- Maintenance and recovery documentation.

After each phase, report (see the `phase-quality-gate` skill): what was implemented, files changed, what works, what remains incomplete, tests run and results, known issues, and external configuration still required.

Do not conceal errors or claim unimplemented functionality is complete.

---

# 28. CONTENT THE BUSINESS MUST SUPPLY

Track these in `docs/missing-business-info.md`; use placeholders until supplied:
- Logo (vector) and brand name styling.
- Professional photos: each hall empty and decorated, lawn, entrance, stage, dining, bridal room, night lighting.
- Drone shots (subject to local permissions) and a 30–60 s venue film.
- Hall fact sheet: area, ceiling height, capacity per layout, facilities, parking count.
- Floor plans (sketch with measurements is acceptable).
- Slot timings, buffers, and which halls can combine.
- Catering details: cuisines, menus, Jain/veg options, per-plate rates, minimum plates, outside-caterer policy.
- Décor themes and in-house vs partner decorators.
- Packages and which prices (if any) are public.
- Policies: booking advance %, payment schedule, cancellation slabs, security deposit, music cut-off time, other house rules.
- GSTIN, legal name, registered address, SAC codes and tax treatment confirmed by the accountant.
- Exact address, map pin, phone, WhatsApp number, email, office hours.
- Brand story (true facts only).
- 3–5 consented real-wedding stories with photographer permission.
- Google Business Profile link; Instagram and Facebook handles.
- Domain name and email provider.

---

# 29. IMPORTANT DEVELOPMENT RULES

1. Build real, functional features rather than static mockups.
2. Do not use fake data as a substitute for database functionality.
3. Do not create dead buttons or nonfunctional controls.
4. Do not duplicate business logic across pages.
5. Do not introduce a second design system; use the Rose Mahal tokens.
6. Do not hardcode secrets, tax rates, or business policies.
7. Do not expose private documents through public asset URLs.
8. Do not invent business facts, capacities, prices, awards, reviews, amenities, or testimonials.
9. Do not add room-booking functionality.
10. Do not change historical booking, quotation, or invoice prices when packages or menus are edited.
11. Do not silently modify or delete financial history; use adjustments, credit notes, and audit logs.
12. Do not expose sensitive information to unauthorized staff or the public (including via the date check).
13. Do not skip server-side validation.
14. Do not ignore responsive design, accessibility, or reduced motion.
15. Do not claim messages are sent, payments are online, or deployment is complete before verifying.
16. Prefer simple, documented solutions over unnecessary complexity.
17. Reuse the centralized global CSS and design tokens.
18. Maintain consistent naming and code conventions.
19. Keep all work version-controlled through Git with small, descriptive commits.
20. Ask for approval before destructive operations, production migrations, or changes that could risk existing data.

---

# 30. ACCEPTANCE CRITERIA

The application is ready for its initial production release only when the following are verified.

### Public website
- Responsive, fast (meets the performance budget), and visually consistent with Rose Mahal.
- Hero video, hall pages with verified facts, floor plans, catering, décor, gallery, and contact render correctly.
- All content editable through the CMS; Hindi + English working where content exists.
- Gallery and video load through Cloudinary.
- Enquiries, site visits, and brochure downloads create leads with source and UTM data.
- WhatsApp and call buttons work on mobile.
- Date check shows only availability, never booking details.
- SEO metadata, hreflang, sitemap, and structured data correctly configured.
- Room booking is not advertised or implemented.

### CRM
- Staff log in with appropriate permissions; 2FA enforced for privileged roles.
- Leads can be created, searched, assigned, followed up, and converted.
- Customers can be created and managed; consent recorded.
- Bookings with multiple sub-events, halls, and slots can be created and edited.
- Holds, buffers, and conflicts behave correctly, including concurrent confirmations.
- Menus, per-plate pricing, minimum plates, and extra-plate billing are correct.
- Quotation versions are immutable; accepted version drives pricing.
- Payments, deposits, refunds, and balances are accurate.
- GST invoices and credit notes are correct and sequentially numbered per financial year.
- Cancellation refunds follow the snapshotted policy.
- Private documents are securely stored and access is logged.
- PDF fields can be ticked or unticked; templates selectable and previewable; PDFs readable and print-ready.
- Notifications are logged and respect consent.
- Reports use actual database data and export correctly.

### Engineering
- Project builds; type checking and linting pass; critical tests pass.
- Migrations documented and tested on a clean database.
- Secrets not committed.
- Daily backups configured and a restore tested.
- Error tracking and uptime monitoring active.
- Deployment configuration verified on the production domain with SSL.
- Known limitations and remaining business inputs disclosed.

---

# FINAL INSTRUCTION

Start by inspecting the repository, reading `CLAUDE.md` and the skills in `.claude/skills/`, and preparing the Phase 0 documents and implementation plan.

Then build incrementally, phase by phase, following the architecture and requirements above. Ship the website and lead capture first.

Prioritize correctness, security, privacy, consistent luxury design, reliable financial and tax calculations, maintainability, and real database persistence.

The final result should be a luxury wedding and banquet venue website and a practical Mini CRM that The Sundaram Palace can use to manage its enquiries, customers, halls, bookings, menus, payments, invoices, documents, and event operations.

Do not stop after producing a plan or mockup. Continue with implementation phase by phase, run tests, document progress, and clearly identify anything that requires the user's configuration, content, or approval.

**Project name: The Sundaram Palace Website & CRM**

**Primary objective: Build a reliable, maintainable, SEO-friendly, luxurious, and cost-conscious business application using Claude Code.**
