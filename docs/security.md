# Security and privacy

Status: **Phase 0 draft.** Implemented from Phase 1 onward; reviewed in full in Phase 6. Legal points need confirmation by a qualified professional before production.
Last updated: 2026-10-23.

## 1. What we protect

| Class | Examples | Who may see it | Storage |
|---|---|---|---|
| Public | Website content, public menus, hall facts, gallery | Everyone | PostgreSQL, Cloudinary |
| Internal | Lead pipeline, tasks, vendor list, reports | Staff by permission | PostgreSQL |
| Personal | Names, phones, emails, addresses, DOB, anniversary, marital status, bride/groom contacts | Staff whose role needs it | PostgreSQL |
| Financial | Quotations, ledger, invoices, deposits, expenses | Accounts, Managers, Admins | PostgreSQL (append-only) |
| Restricted | Identity documents (PAN, masked Aadhaar), customer photos | `documents.sensitive.read` only, every access logged | Private document store (backend chosen in Phase 3, `architecture.md` ADR-07) |
| Secrets | API keys, DB URLs, HMAC secrets, TOTP secrets | Nobody in the app UI | Vercel / GitHub Actions secrets; TOTP secrets encrypted at rest |

Main threats: public form spam and abuse; staff account takeover; a staff member seeing more than their role needs; leaking private documents through a guessable or permanent URL; tampering with financial history; injection via CMS content or PDF templates; date-check endpoint leaking who booked what.

## 2. Authentication

- Better Auth with email + password for staff only. No public sign-up: Admins invite users.
- Passwords: minimum 12 characters, checked against a breached-password list, hashed by the library (scrypt/argon2).
- **TOTP 2FA mandatory** for Super Admin, Admin and Accounts; optional but encouraged for others. Backup codes shown once.
- Database sessions, cookies `HttpOnly; Secure; SameSite=Lax`; idle timeout 8 h, absolute 7 days (configurable); session rotated on sign-in, 2FA and role change. Admins can revoke all sessions for a user.
- Login and 2FA endpoints are rate-limited per IP and per account; repeated failures add delay and alert Super Admins.

## 3. Authorization

- Permission keys live in a code registry (`src/lib/permissions/registry.ts`) and are seeded into the DB. Roles are sets of permissions. **Code checks permissions, never role names.**
- Every Server Action and Route Handler: authenticate → `assertPermission(user, key, resource?)` → Zod validation → service. No "internal" exceptions.
- Data shaping in `src/server/policies/`: Operations never receives payment fields; Kitchen receives only kitchen-sheet data for upcoming events.
- A table-driven test walks the whole matrix and asserts 403 for every role × action that is not allowed (`tests/integration/permissions.test.ts`).
- CRM pages render the 403 screen with `forbidden()`. Because Next.js 16 streams pages, the HTTP status of such a page can be 200; the e2e test asserts that the 403 screen renders and no protected data is in the response. Route handlers and server actions return real 401/403 statuses.

### Draft permission matrix

✓ = granted · own = only records assigned to them · — = denied. Final matrix confirmed with the owner in Phase 1.

| Permission | Super Admin | Admin | Manager | Sales | Accounts | Operations | Kitchen |
|---|---|---|---|---|---|---|---|
| `settings.manage`, `users.manage`, `roles.manage` | ✓ | users only | — | — | — | — | — |
| `cms.edit`, `cms.publish` | ✓ | ✓ | — | — | — | — | — |
| `leads.read` / `leads.edit` | ✓ | ✓ | ✓ | own + unassigned | — | — | — |
| `leads.assign` | ✓ | ✓ | ✓ | — | — | — | — |
| `customers.read` (contact fields) | ✓ | ✓ | ✓ | ✓ | ✓ | name + phone of assigned events | — |
| `customers.personal.read` (DOB, marital, address) | ✓ | ✓ | ✓ | — | — | — | — |
| `customers.merge` | ✓ | ✓ | ✓ | — | — | — | — |
| `bookings.read` / `bookings.edit` | ✓ | ✓ | ✓ | ✓ / quotation stage | read | assigned | — |
| `bookings.confirm`, `holds.place` | ✓ | ✓ | ✓ | holds only | — | — | — |
| `bookings.override_conflict` | ✓ | ✓ | ✓ (with reason) | — | — | — | — |
| `quotations.create` / `quotations.accept` | ✓ | ✓ | ✓ | ✓ / — | — | — | — |
| `payments.create`, `refunds.create`, `deposits.manage` | ✓ | ✓ | — | — | ✓ | — | — |
| `invoices.issue`, `credit_notes.issue` | ✓ | ✓ | — | — | ✓ | — | — |
| `documents.sensitive.read` / `.upload` | ✓ | ✓ | ✓ | — | — | — | — |
| `pdf.generate` | ✓ | ✓ | ✓ | quotations | financial docs | function sheets | kitchen sheets |
| `reports.financial` | ✓ | ✓ | ✓ | — | ✓ | — | — |
| `reports.sales` | ✓ | ✓ | ✓ | own | — | — | — |
| `tasks.manage` | ✓ | ✓ | ✓ | own | own | own | — |
| `audit.read` | ✓ | ✓ | — | — | — | — | — |
| `privacy.requests` | ✓ | ✓ | — | — | — | — | — |

## 4. Files and private documents

- Upload validation by magic bytes (not extension); allowlist JPEG, PNG, WebP, PDF (+ MP4/WebM for public video). Size limits from Settings (proposed: images 10 MB, PDFs 15 MB, video 50 MB before compression).
- EXIF (including GPS) stripped from public images.
- Public media → Cloudinary signed upload. Private documents → `src/lib/storage/private.ts` (Cloudinary `authenticated` assets or R2, decided in Phase 3); object keys are random UUIDs, never names.
- Download: `/api/documents/[id]/download` → session → permission → audit log → the server streams the file (or, with R2, redirects to a presigned URL valid ≤ 5 minutes). Storage URLs are never stored or rendered in HTML.
- A test asserts that a private document cannot be fetched by its storage URL without our server.
- Identity documents: optional, only for a configured purpose; masked Aadhaar preferred; no Aadhaar number columns anywhere; excluded from PDFs by default; WhatsApp/email never attach them.

## 5. Web security

- Headers (`src/lib/security/headers.ts`, `src/proxy.ts`): **public pages** are statically generated, so they can't carry per-request nonces; they get a CSP without nonces that still blocks plugins, framing, foreign forms and foreign scripts (`script-src 'self' 'unsafe-inline'`). **The CRM** is always rendered per request and gets a strict nonce-based CSP (`'nonce-…' 'strict-dynamic'`). Plus `Strict-Transport-Security` (preload after launch), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, mic, geolocation off), `frame-ancestors 'none'` for `/admin`.
- Server Actions get Next.js' built-in origin check; other state-changing route handlers verify `Origin` and a CSRF token.
- Output escaping by React; CMS rich text rendered from JSON with an allowlist (no raw HTML); PDF templates render escaped data only.
- Public endpoints rate-limited (ADR-12): enquiry, date check, site visit, brochure, login, 2FA. Enquiry also has a honeypot and a minimum fill time. A privacy-friendly CAPTCHA is added only if spam appears.
- The date-check endpoint returns only `AVAILABLE | LIMITED | FULLY_BOOKED`; a test asserts the response contains no names, references or event types.
- Cron and PDF-service calls are authenticated with secrets/HMAC and reject replays.
- Dependencies: Dependabot + `npm audit` in CI; lockfile committed.

## 6. Logging and audit

- `AuditLog` (append-only): who, action, entity, before/after summary, IP, user agent, time. Logged for: sign-in, 2FA changes, role/permission changes, settings changes, conflict overrides, payments/refunds/adjustments, invoices/credit notes, document views and downloads, data exports, data-subject requests, customer merges.
- Never logged: passwords, tokens, OTPs, TOTP secrets, document contents, full phone lists, payment secrets. Phones are masked in app logs (`98******21`). Sentry has PII scrubbing on and does not capture request bodies.

## 7. DPDP Act, 2023 (and the DPDP Rules)

The design follows the Digital Personal Data Protection Act, 2023. The DPDP Rules, 2025 phase in obligations over time; the exact dates that apply to this business must be confirmed by counsel.

- **Notice and consent at collection.** Each form shows a short notice and a purpose-specific, unticked consent checkbox. We store `ConsentRecord { subject, purpose, granted, noticeVersion, source, timestamp }`. Purposes: `contact`, `brochure`, `site_visit`, `marketing_whatsapp`, `marketing_email`, `greetings`.
- **Minimisation.** Enquiry asks only name and phone as mandatory. DOB and anniversary are not collected unless greetings are enabled and the customer opts in.
- **Use limited to purpose.** NotificationService refuses marketing/greeting messages without the matching consent and logs `SKIPPED_NO_CONSENT`.
- **Data principal rights.** Admin workflow (`DataSubjectRequest`) for access (export), correction and deletion. Deletion anonymizes personal fields but keeps financial and tax records for the legally required period.
- **Withdrawal.** Withdrawing consent is as easy as giving it (link in messages and a CRM action); real-wedding stories unpublish automatically.
- **Retention.** Periods per data type in Settings; a daily job flags records past retention for review.
- **Professional review.** Privacy policy, notices and consent text must be reviewed by a qualified professional before production.

### Proposed retention defaults (to be confirmed by accountant / counsel)

| Data | Proposed default | Reason |
|---|---|---|
| Lost / inactive leads | 24 months after last activity | Sales follow-up value expires |
| Customer profile without bookings | 24 months after last activity | |
| Bookings, ledgers, invoices, credit notes | As required by GST and income-tax law (accountant to confirm) | Legal obligation |
| Identity documents | Delete 90 days after the event's completion | Purpose fulfilled |
| Audit log | 3 years | Investigations |
| Message logs | 12 months | Delivery disputes |

## 8. Backups and recovery

- Free-tier setup: Neon Free gives only a 6-hour restore window, so a nightly `pg_dump` is encrypted with `age` and kept as a private GitHub Actions artifact for 30 days; the owner downloads one encrypted copy per month to the business's own storage. Details in `docs/deployment.md` §7.
- Backups contain personal data: they are always encrypted before leaving the runner, and the private key is never stored in GitHub.
- Private documents: the app never hard-deletes an object directly; it marks it deleted and a scheduled job purges it after 30 days, so accidental deletes are recoverable.
- Restore is tested before launch and quarterly; the result is written to `docs/deployment.md`.

## 9. Incident and breach response

1. **Contain** — revoke sessions and rotate affected secrets (DB, Cloudinary, private storage, Resend, cron and PDF HMAC), disable the affected feature.
2. **Assess** — what data, how many people, since when; preserve logs.
3. **Notify** — under the DPDP framework, personal-data breaches must be reported to the Data Protection Board and the affected people; CERT-In directions may also require reporting certain cyber incidents within 6 hours. Counsel confirms which apply and the current timelines. Prepare the notice text in advance.
4. **Recover** — restore from backup if data was altered; verify ledger integrity (append-only triggers make tampering visible).
5. **Review** — root cause, fix, update this document.

Contact list (owner, developer, counsel, accountant) to be filled in before launch.

## 10. Secrets

- `.env` files are never committed; `.env.example` holds placeholders only.
- Production secrets live only in Vercel / GitHub Actions (and Render, if used) secret stores, scoped per environment.
- Each credential has the narrowest scope the provider allows (e.g. the backup job's database role is read-only).
- Rotate on staff departure of anyone with access, and at least yearly.
