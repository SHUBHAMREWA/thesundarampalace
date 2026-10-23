---
name: secure-customer-data
description: Use when working on authentication, roles and permissions, file uploads, private documents, customer or bride/groom personal data, consent, notifications/WhatsApp/email, audit logs or data deletion in The Sundaram Palace project.
---

# Secure customer data and privacy (DPDP-aware)

## Authorization
- Permission keys like `leads.read`, `leads.assign`, `bookings.override_conflict`, `payments.create`, `invoices.issue`, `documents.sensitive.read`, `settings.manage`.
- Roles map to permission sets in the database; code checks permissions, not role names.
- Every Server Action / Route Handler: authenticate → `assertPermission(user, key, resource?)` → validate input with Zod → act. No exceptions for "internal" endpoints.
- Data shaping: return only fields the caller may see (e.g. Operations never receives payment data; Kitchen sees only kitchen sheets).
- 2FA (TOTP) required for Super Admin, Admin, Accounts. Session cookies `HttpOnly`, `Secure`, `SameSite=Lax`, rotation on privilege change.

## Uploads
- Validate by content sniffing (magic bytes), not extension; allowlist types (JPEG, PNG, WebP, PDF); size limits from Settings.
- Public media → Cloudinary signed upload. Private documents → private storage behind `src/lib/storage/private.ts` abstraction.
- Private downloads only through a server route that checks permission, writes an audit log, and redirects to a short-lived signed URL (minutes). Never store or render permanent private URLs.
- Strip EXIF location data from public images.

## Identity documents
- Optional, collected only for a configured legitimate purpose.
- Prefer masked Aadhaar copies; never store full Aadhaar numbers in plain columns.
- Excluded from PDFs by default; access always audit-logged.

## Consent and DPDP Act, 2023
- Record `ConsentRecord { subject, purpose (contact, marketing_whatsapp, greetings, brochure), granted, noticeVersion, timestamp, source }`.
- Messages check consent for the purpose before sending; transactional booking messages follow the booking relationship, marketing/greetings require opt-in.
- Data-subject requests (access, correction, deletion) handled via an admin workflow; deletion anonymizes personal fields but keeps financial/tax records for legally required periods.
- Retention periods per data type from Settings; a scheduled job flags records past retention for review.
- Privacy notice and consent text must be reviewed by a qualified professional before production.

## Notifications
- `NotificationService.send({ channel, template, to, data, purpose })` → checks consent → provider adapter → `MessageLog` with status.
- WhatsApp: approved templates only; never attach identity documents; links to PDFs are signed and expiring.
- If no provider is configured, log the notification as `NOT_SENT_NO_PROVIDER` and show it in-app. Never claim it was sent.

## Logging
- Audit log: who, what, which record, when, before/after summary for sensitive changes, IP/user agent.
- Never log passwords, tokens, OTPs, full phone lists, document contents or payment secrets. Mask phones in app logs (`98******21`).

## Web security
- Security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors), CSRF protection for state-changing routes outside Server Actions.
- Rate limit public endpoints: enquiry, date check, site visit, brochure, login.
- Admin/CRM routes `noindex` and excluded from sitemap.

## Tests to keep green
- Role without permission gets 403 on every protected action (table-driven test over the permission matrix).
- Private document URL inaccessible without session; signed URL expires.
- Consent false → marketing message not sent and logged.
- Date-check response contains no personal data.
