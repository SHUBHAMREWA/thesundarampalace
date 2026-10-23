# Deployment and operations

Status: **Phase 0 plan.** Steps are carried out in Phase 1 (accounts, CI, staging) and Phase 2 (production). Depends on the decisions in `docs/architecture.md` (ADR-02, 03, 07, 08).
Last updated: 2026-10-23.

## 1. Accounts to create

Recommended: every account is opened in the business's name with a shared business email, and the developer is invited as a member. This keeps ownership with the business and makes handover painless.

| Service | Used for | Phase |
|---|---|---|
| GitHub (private repo) | Code, CI, nightly backup job | 1 |
| Neon | PostgreSQL (`main` = production, `staging`, `dev-*`, `test`) | 1 |
| Vercel (Pro) | App hosting, previews, cron | End of Phase 1, when the first staging deploy is needed. Vercel counts paid client work as commercial use, so Hobby isn't appropriate even for previews. |
| Cloudinary | Public media | 1 |
| Cloudflare (R2) | Buckets: `sp-docs-staging`, `sp-docs-prod`, `sp-backups` | 1 |
| Resend | Email from the business domain | 2 |
| Sentry | Errors | 1 |
| UptimeRobot or Better Stack | Uptime | 2 |
| Render | PDF service | 3 |
| WhatsApp provider (Meta Cloud API or BSP) | Template messages | 5 |

## 2. Environment variables (draft `.env.example`)

Only placeholder values are ever committed.

```dotenv
# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
APP_ENV=development            # development | staging | production

# Database (Neon) — pooled URL for the app, direct URL for migrations
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
DIRECT_DATABASE_URL=postgresql://user:password@host/db?sslmode=require

# Auth
BETTER_AUTH_SECRET=change-me-32-bytes-min
BETTER_AUTH_URL=http://localhost:3000
TOTP_ENCRYPTION_KEY=change-me

# Cloudinary (public media)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER_PREFIX=dev

# Cloudflare R2 (private documents)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_DOCS_BUCKET=sp-docs-dev

# Email
RESEND_API_KEY=
EMAIL_FROM="The Sundaram Palace <no-reply@example.test>"

# PDF service (Phase 3)
PDF_SERVICE_URL=http://localhost:4000
PDF_SERVICE_HMAC_SECRET=change-me

# Cron
CRON_SECRET=change-me

# Monitoring
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# WhatsApp (Phase 5) — leave empty until a provider is approved
WHATSAPP_PROVIDER=none
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

All variables are validated at startup with Zod (`src/lib/env.ts`); the app refuses to boot with a missing or malformed value in staging/production.

## 3. Branches and environments

| Git branch | Deploys to | Database |
|---|---|---|
| feature branches | Vercel preview URL | Neon `dev` branch (shared) or a per-preview branch |
| `main` | Staging (`staging.<domain>`) | Neon `staging` |
| Release tag `vYYYY.MM.DD` | Production (`<domain>`) | Neon `main` |

Production deploys are promoted from a staging build that has passed the phase-quality-gate checks.

## 4. CI (GitHub Actions, set up in Phase 1)

On every push and pull request:
1. `npm ci`
2. `npm run typecheck`
3. `npm run lint` (includes the hex-colour guard)
4. Start a PostgreSQL 17 service container → `npx prisma migrate deploy` from an empty database → `npm run test` (unit + integration)
5. `npm run build`
6. `npm run test:e2e` (Playwright against the built app; smoke set on PRs, full set on `main`)
7. `npm audit --audit-level=high`

## 5. Database migrations

- Development: `npx prisma migrate dev --name <descriptive_name>`; review the SQL before committing.
- Staging: `npx prisma migrate deploy` runs in the deploy pipeline after CI passes.
- Production: **manual approval step.** Confirm a fresh backup exists (Neon restore point + last night's dump), then `npx prisma migrate deploy` with `DIRECT_DATABASE_URL`.
- Destructive changes use expand-and-contract across two releases and need the owner's approval.
- Never `prisma db push` or `migrate reset` against staging or production.

## 6. PDF service (Phase 3)

- Lives in `pdf-service/` in this repo: a small Node HTTP server with Playwright Chromium, built from the official Playwright Docker image, with Cormorant Garamond, Inter and Tiro Devanagari Hindi installed in the image.
- Render web service (Starter), deployed from the same repo with root `pdf-service/`, health check `/healthz`.
- Accepts `POST /render` with HTML + options, signed `X-Signature: HMAC-SHA256(secret, timestamp + body)`; rejects stale (> 60 s), unsigned or > 5 MB requests. No outbound network access from the page (`page.route('**', abort)` except `data:` URLs).

## 7. Scheduled jobs

`vercel.json` cron entries (all call routes protected by `CRON_SECRET`):

| Schedule (UTC) | Route | Does |
|---|---|---|
| `*/15 * * * *` | `/api/cron/outbox` | Deliver pending notifications, retry failures |
| `0 * * * *` | `/api/cron/hourly` | Release expired holds, promote waitlist, hold-expiry and payment-due reminders |
| `30 0 * * *` (06:00 IST) | `/api/cron/daily` | Follow-up digest, retention flags, sequence sanity check, prune rate-limit buckets |

Cron frequency depends on the Vercel plan; Pro supports these intervals (verify at setup).

## 8. Backups and restore

- **Neon point-in-time restore** on the production plan (window per plan — see `docs/costs.md`).
- **Nightly logical backup**: GitHub Actions at 02:00 IST runs `pg_dump --format=custom`, encrypts with `age` using a public key (the private key is held offline by the owner and developer), uploads to `sp-backups/daily/`. A lifecycle rule keeps 30 dailies; the first dump of each month is copied to `monthly/` and kept 12 months.
- **Restore drill** (before launch, then quarterly): restore the latest dump into a fresh Neon branch, run `npx prisma migrate status` and a row-count + ledger-balance check script, record the date and result below.

| Date | Backup used | Restored to | Checks | Result |
|---|---|---|---|---|
| — | — | — | — | Not yet done |

## 9. Domain, email and SSL

- DNS for `<domain>` (and `www` → apex redirect) pointed at Vercel; SSL is automatic.
- `staging.<domain>` → Vercel staging, protected by Vercel password protection or allowlisted IPs, and `noindex`.
- Resend: add the SPF, DKIM and DMARC records it provides; DMARC starts at `p=none` with reports, then moves to `quarantine` once clean.

## 10. Monitoring

- Sentry projects for the app and the PDF service, with alerts to the owner and developer.
- Uptime checks every 5 min on `/` and `/api/health/enquiry`; alerts by email and phone.
- Enquiry failure path: Sentry alert within minutes; the form shows phone and WhatsApp as a fallback.

## 11. Launch checklist (Phase 2 gate, extended in Phase 6)

- [ ] All Phase 2 quality-gate checks pass on the staging build.
- [ ] Production env vars set and validated; secrets differ from staging.
- [ ] `prisma migrate deploy` applied on production after a confirmed backup.
- [ ] Domain live with SSL; `www` redirect works; old site URLs (if any) 301-redirect.
- [ ] Test enquiry from a phone on 4G creates a lead and notifies staff; then delete it via the admin workflow.
- [ ] `robots.txt` allows the website, blocks `/admin`; sitemap submitted to Google Search Console.
- [ ] Google Business Profile links to the site; NAP (name, address, phone) matches exactly.
- [ ] Uptime and Sentry alerts received in a test.
- [ ] Privacy policy and consent text reviewed by a professional.

## 12. Rollback

- App: Vercel instant rollback to the previous production deployment.
- Database: migrations are additive (expand-and-contract), so the previous app version keeps working. If data is damaged, restore to a Neon branch from a point in time, verify, then switch.
