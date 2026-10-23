# Implementation plan

Status: **Phase 1 (Foundation) built locally on 2026-10-23.** Phase 0 approved with the free-tier hosting decision; Phase 1 tasks below are done except deploying (no hosting accounts yet) and Sentry (no DSN yet).
Last updated: 2026-10-23.

Companion docs: `architecture.md` (decisions), `database-design.md` (model), `design-system.md` (tokens), `security.md`, `deployment.md`, `costs.md`, `missing-business-info.md` (what the business must supply).

## 0. Phase 0 findings

- The repository contained only the starter kit (`CLAUDE.md`, `MASTER_PROMPT.md`, `README.md`, 8 skills). It was not a Git repository; Phase 0 initialised Git here and committed the kit plus these docs.
- Local machine: Node 24.11, npm 11.6, Git 2.47. **No Docker and no PostgreSQL** — local development will use a Neon dev branch (or a native PostgreSQL install if preferred).
- Current stable packages were checked on npm. Two version traps to avoid: npm's `latest` tag for the `prisma` CLI points at an 8.0 release candidate (we pin 7.10.x), and TypeScript 7.0 is not yet supported by Next.js' default type-checker (we pin 6.0.x).
- No business facts were supplied. **Nothing is known yet about the city, halls, capacities, menus, prices or policies** — all are tracked in `missing-business-info.md`. Phase 1 doesn't need them; Phase 2 does.
- Design tokens: four contrast problems found (muted on lavender, gold on light, input borders, warning text); fixes proposed in `design-system.md` §2.
- **Owner decision (2026-10-23): free tiers only** — Vercel Hobby, Neon Free, Cloudinary Free, plus free Resend, GitHub, Sentry and UptimeRobot. Nothing is bought now; the domain is already at Hostinger. The design was adjusted to fit: static public pages, scheduler and backups on GitHub Actions, hero film served from Vercel, Phase 3 PDF/document options that cost $0 (`architecture.md`, `costs.md`).
- Known risk of that decision: Vercel's terms reserve Hobby for non-commercial use. The app avoids Vercel-only features so it can move if Vercel objects.

## 1. Decisions needed before Phase 1

| # | Decision | Recommendation | Impact if changed later |
|---|---|---|---|
| D1 | Hosting | **Decided:** Vercel Hobby (free) | Medium — deployment config only |
| D2 | Database | **Decided:** Neon Free, separate `sundaram-prod` and `sundaram-dev` projects | High after launch (data migration) |
| D3 | Auth library | Better Auth with TOTP 2FA (free) | High after Phase 1 |
| D4 | Private storage + PDF renderer | **Deferred to Phase 3.** Free options in `architecture.md` ADR-07/08 | Low (abstraction) |
| D5 | Account ownership | Free accounts opened with a business email; agree in writing who owns the Vercel Hobby account (it's personal, no team seats) | High (transfer is painful) |
| D6 | Token fixes | Approve `--color-border-strong: #9E8994` and `--color-warning: #946118` | Low |
| D7 | Repo location | Keep this folder as the repository root (it already holds `.claude/` and `CLAUDE.md`) | Low |
| D8 | Local database | Neon `sundaram-dev` project (no install) vs native PostgreSQL 17 | Low |

Business info needed early (not blocking Phase 1, blocking Phase 2): city/address, hall names, the exact domain name and Hostinger DNS access, logo, photos — see `missing-business-info.md` §0.

## 2. Phase 1 — Foundation

**Phase 1 result (2026-10-23):** 1.1–1.12 and 1.14's workflows are done and verified locally (type check, lint, 66 unit/integration tests, production build, 15 Playwright tests). Not done: the Vercel/Neon deployment in 1.13 and the first live backup/restore drill in 1.14 — both need the free accounts to be created; Sentry moves to Phase 2 launch. Decisions taken while building: TypeScript 5.9 (not 6.0), local PostgreSQL via `embedded-postgres` instead of a Neon dev project, public pages use a non-nonce CSP because they are static.

Goal: an empty but production-shaped app: design system, database, auth with 2FA, permissions, layouts, CI. No business features yet.

| # | Task (≈ one commit each) | Skills |
|---|---|---|
| 1.1 | Scaffold Next.js 16 (App Router, TS strict, Tailwind 4, ESLint, Prettier), `.gitignore`, `.env.example`, `src/lib/env.ts` with Zod validation | — |
| 1.2 | Vitest + Playwright setup; `npm run typecheck / lint / test / test:e2e / build` scripts; CLAUDE.md commands updated | phase-quality-gate |
| 1.3 | Rose Mahal tokens in `globals.css`, Tailwind `@theme`, shadcn/ui init mapped to tokens, fonts via `next/font` (incl. Devanagari), hex-colour lint guard | sundaram-design-system |
| 1.4 | Base components: Button, Input, Select, Checkbox, FormField, PhoneInput, MoneyInput, Badge, Card, Toast, ConfirmDialog, Skeleton, EmptyState, ErrorState, DataTable shell | sundaram-design-system |
| 1.5 | Prisma 7 + adapter-pg, Neon connection, first migration: User/auth tables, Role, Permission, RolePermission, UserRole, SiteSetting, LookupValue, NumberSequence, AuditLog, ActivityLog, RateLimitBucket | db-change-safety |
| 1.6 | Money library (`src/lib/money`): Decimal helpers, ROUND_HALF_UP, INR formatter, amount in words (lakh/crore) — with unit tests | india-billing-gst |
| 1.7 | Time library: Asia/Kolkata helpers, slot range builder (midnight crossing), financial-year label — with unit tests | banquet-business-rules |
| 1.8 | Better Auth: email/password, invitation-only users, TOTP 2FA enforced for Super Admin/Admin/Accounts, session policy, login rate limit | secure-customer-data |
| 1.9 | Permission registry, `assertPermission`, seeded roles, table-driven 403 test over the matrix | secure-customer-data |
| 1.10 | Layouts: public website shell (`[locale]` with next-intl, header/footer placeholders, language toggle) and CRM shell (sidebar, mobile nav, breadcrumbs, empty dashboard) | sundaram-design-system |
| 1.11 | Settings framework (typed sections, admin page skeleton), reference-number generator (`SP-L-…`, `SP-B-…`) with concurrency test | db-change-safety |
| 1.12 | Security headers + CSP, Sentry, `/api/health/enquiry`, fake seed (`prisma/seed.ts`) | secure-customer-data |
| 1.13 | GitHub Actions CI (typecheck, lint, migrate from empty DB, tests, build, e2e smoke, audit); Vercel Hobby preview/staging deploy | phase-quality-gate |
| 1.14 | GitHub Actions scheduler (hourly/daily → `/api/cron/*`) and nightly encrypted backup workflow; first restore drill on `sundaram-dev` | db-change-safety |

**Gate:** CI green; a Super Admin can sign in with 2FA on staging; a Sales user gets 403 on an admin-only action; tokens render correctly at 360/768/1280/1536 px; Phase 1 report delivered.

## 3. Phase 2 — Website and leads MVP (ship first)

**Phase 2 result (2026-10-23):** built and verified locally (type check, lint, 107 unit/integration tests, production build with 96 static pages, 35 Playwright tests). All public pages, the CMS for every content type, the 3-step and compact enquiry forms, the leads CRM, staff accounts, notifications and SEO basics work with tasteful placeholders where business facts are missing. Not done: 2.11 deployment (no accounts/domain records yet), Sentry, Google Business Profile link (needs the business), Hindi UI translations and Hindi content (need a fluent speaker), a Lighthouse run on real photos (no photos yet). Decisions: CMS text uses a safe Markdown subset (ADR-13), no cookie banner because no tracking cookies are set (ADR-18).

Goal: the public site is live and enquiries reach staff.

| # | Task | Skills |
|---|---|---|
| 2.1 | CMS models + admin screens: pages/sections, media library (Cloudinary signed upload, alt text required), navigation, contact settings, SEO fields | luxury-venue-content, db-change-safety |
| 2.2 | Halls (public facts only): Hall, HallLayoutCapacity, facilities, floor plan, slots-as-info; listing + detail pages with "coming soon" placeholders | luxury-venue-content |
| 2.3 | Homepage sections (hero video with poster/reduced-motion fallback, spaces, services, catering, décor, packages, gallery, reviews link, auspicious dates, map/contact) — each toggleable and ordered in CMS | luxury-venue-content, sundaram-design-system |
| 2.4 | About, Catering (public menus), Décor, Services, Packages (prices hidden unless enabled), Gallery, Contact (map, directions, click-to-call, wa.me), legal pages, 404/error pages | luxury-venue-content |
| 2.5 | "Plan your event" 3-step form + compact form: Zod schemas shared, honeypot, rate limit, consent with notice version, UTM capture, success screen with reference | luxury-venue-content, secure-customer-data |
| 2.6 | Lead service: create, duplicate-window merge, reference numbering, initial status, activity log, notifications (in-app + email via outbox) | secure-customer-data |
| 2.7 | Leads CRM: list (search, filters, sort, pagination), detail, assign, status changes, follow-ups, activity timeline, lost reasons, "Chat on WhatsApp" | — |
| 2.8 | SEO: `generateMetadata` from CMS, canonical + hreflang, sitemap, robots, EventVenue/LocalBusiness JSON-LD with supplied fields only | luxury-venue-content |
| 2.9 | Consent banner, conversion events in our own table (no PII); page-view analytics within free limits | secure-customer-data |
| 2.10 | Performance pass (LCP < 2.5 s on mid-range mobile, static generation of public pages so visits don't wake the free database, image sizing, lazy loading), accessibility pass | sundaram-design-system |
| 2.11 | Staging → production deploy, domain records in Hostinger DNS, Resend SPF/DKIM/DMARC, uptime alerts, free-tier usage check | — |

**Gate:** website live on the business domain; a phone enquiry on 4G creates a lead with UTM data and notifies staff; Google Business Profile links to the site; Phase 2 report.

**Depends on business:** city/address, hall names and facts (or acceptance of placeholders), logo, photos, contact numbers, domain, privacy text review.

## 4. Phase 3 — Bookings and money

Decide the free private-document store and PDF renderer (ADR-07/08) → customers (profile, duplicates, merge review, consent) → halls/slots/buffers/composite halls → bookings with sub-events → `SlotReservation`/`SlotOccupancy` with exclusion constraint → holds, waitlist, expiry job → calendar → menus, packages, per-plate pricing, minimum plates, guest-count lock, pricing rules → quotation versions (immutable, diff, accept) → ledger, instalments, deposits, cancellation slabs, refunds → GST invoices, credit notes, FY numbering → private documents + bride/groom details → PDF service + templates (quotation, confirmation, receipt, statement, invoice, credit note, deposit settlement, function sheet, kitchen sheet) with field picker and presets.

**Gate:** a realistic test booking (5-day wedding, 6 sub-events, ~40 lines) can be quoted, revised, accepted, confirmed, paid in instalments, invoiced, partly credited, cancelled with the correct refund, and printed — end to end on staging. Existing confirmed future bookings are entered before real use.

## 5. Phase 4 — Operations

Tasks + templates (event checklist on confirmation), vendors and assignments, expenses, role dashboards, reports with CSV/Excel export, event-day PWA view for operations staff, data-subject-request workflow.

**Gate:** each role's dashboard shows only its data; reports reconcile with ledger totals; exports respect permissions.

## 6. Phase 5 — Growth and engagement

Blog workflow (draft/preview/publish/schedule), Hindi translations (reviewed by a fluent speaker), e-brochure with optional lead gate, 360° tours, real-wedding stories with consent, offer/landing pages with campaign tagging, public date check, site-visit booking, WhatsApp via free `wa.me` links (API templates for quotation sent, payment due, reminders, feedback/review request and greetings only if the business decides to pay Meta's per-message charges), Instagram strip if approved.

**Gate:** date check proven to reveal nothing personal; WhatsApp messages respect consent and are logged; Hindi pages have correct hreflang.

## 7. Phase 6 — Hardening and launch review

Full test suite, permission and security review, privacy/consent review, PDF checks on long bookings and Hindi text, clean-database migration test, backup restore drill, performance budget, production env review, maintenance and recovery docs, TypeScript 7 upgrade check.

## 8. Critical tests by phase

Numbers refer to MASTER_PROMPT §25.

| Phase | Tests |
|---|---|
| 1 | 18 (permission matrix, partial), 27 (migrations on clean DB), money/time library units used later by 11, 15, 17 |
| 2 | 1, 2, 3, 4 (search/assign), 23, 24 (SEO/hreflang for pages), 25, 26, 28 |
| 3 | 4 (convert without duplicates), 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 21, 22 |
| 4 | 18 (full matrix incl. reports/exports) |
| 5 | 20, 23 (Hindi), 24 (blog) |
| 6 | All 28 re-run |

## 9. How we'll work

- One phase at a time. Each starts by re-reading `MASTER_PROMPT.md` and loading the skills listed above, and ends with the `phase-quality-gate` report.
- Small commits per task; no commits with failing checks unless you approve and the report says so.
- Any destructive operation or production migration waits for your explicit OK.
- New gaps in business information are added to `missing-business-info.md` as they're found.

## 10. Top risks

| Risk | Mitigation |
|---|---|
| Business content arrives late and blocks Phase 2 | Placeholders that look intentional; launch with fewer pages if needed, never with invented facts |
| Double bookings during the switch from paper/Excel | Enter all confirmed future bookings before Phase 3 goes live |
| GST treatment wrong (e.g. composition scheme) | Accountant signs off Settings before the first real invoice |
| Hero video eats the Cloudinary free tier | Hero film served from Vercel static files; Cloudinary for images only |
| Vercel restricts the Hobby project for commercial use | No Vercel-only features; the app can move to Vercel Pro or another host without code changes |
| Neon Free compute runs out mid-month (database suspended) | Static public pages, separate dev project, monthly usage check, enquiry fallback to phone/WhatsApp |
| Only 6-hour restore window on Neon Free | Nightly encrypted backups + monthly off-GitHub copy + quarterly restore drill |
| Scope creep from a long requirements list | Phase gates; anything new goes into the next phase's list |
