# Deployment and operations

Status: **Phase 0 plan, free-tier setup** (owner decision 2026-10-23: buy nothing now; domain already at Hostinger). Steps are carried out in Phase 1 (accounts, CI, staging) and Phase 2 (production). See `docs/architecture.md` ADR-02, 03, 06, 11.
Last updated: 2026-10-23.

## 1. Accounts to create (all free)

Open accounts with a shared business email if possible, so the business keeps ownership. Vercel Hobby is a personal account with no team seats, so whoever signs up owns the project; agree in writing who that is.

| Service | Plan | Used for | Phase |
|---|---|---|---|
| GitHub (private repo) | Free | Code, CI, scheduler, nightly backups | 1 |
| Neon | Free — projects `sundaram-prod` and `sundaram-dev` | PostgreSQL | 1 |
| Vercel | Hobby | App hosting, previews | 1 |
| Cloudinary | Free | Public images | 1 |
| Sentry | Free | Errors | 1 |
| Resend | Free | Email from the business domain | 2 |
| UptimeRobot | Free | Uptime alerts | 2 |
| Hostinger | Already purchased | Domain + DNS | 2 |
| Render | Free (if ADR-08 option A) | PDF renderer | 3 |

No card or payment is needed for any of these, except Cloudflare R2 if it is chosen in Phase 3.

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

# Email
RESEND_API_KEY=
EMAIL_FROM="The Sundaram Palace <no-reply@example.test>"

# Scheduler (GitHub Actions → /api/cron/*)
CRON_SECRET=change-me

# Monitoring
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# Phase 3 — private documents and PDF renderer (set when ADR-07/08 are decided)
PRIVATE_STORAGE_DRIVER=none     # cloudinary-authenticated | r2
PDF_SERVICE_URL=
PDF_SERVICE_HMAC_SECRET=

# Phase 5 — WhatsApp API stays off in free mode (wa.me links need no config)
WHATSAPP_PROVIDER=none
```

All variables are validated at startup with Zod (`src/lib/env.ts`); the app refuses to boot with a missing or malformed value in staging/production.

## 3. Branches and environments

| Git branch | Deploys to | Database |
|---|---|---|
| feature branches | Vercel preview URL (Vercel Authentication on) | `sundaram-dev` / `dev` |
| `main` | Staging — `staging.<domain>` as a Vercel branch domain, protected and `noindex` | `sundaram-prod` / `staging` |
| `production` | Production — `<domain>` | `sundaram-prod` / `main` |

Production is updated by merging `main` into `production` after the phase-quality-gate checks pass on staging.

## 4. CI (GitHub Actions, set up in Phase 1)

On every push and pull request:
1. `npm ci`
2. `npm run typecheck`
3. `npm run lint` (includes the hex-colour guard)
4. Start a PostgreSQL 17 service container → `npx prisma migrate deploy` from an empty database → `npm run test` (unit + integration)
5. `npm run build`
6. `npm run test:e2e` (smoke set on PRs, full set on `main`)
7. `npm audit --audit-level=high`

Kept lean (dependency caching, e2e smoke on PRs) to stay inside GitHub Free's Actions minutes.

## 5. Database migrations

- Development: `npx prisma migrate dev --name <descriptive_name>`; review the SQL before committing.
- Staging: `npx prisma migrate deploy` runs after CI passes on `main`.
- Production: **manual approval step.** Confirm a fresh backup exists (last night's encrypted dump, plus a Neon restore point within the 6-hour window), then `npx prisma migrate deploy` with `DIRECT_DATABASE_URL`.
- Destructive changes use expand-and-contract across two releases and need the owner's approval.
- Never `prisma db push` or `migrate reset` against staging or production.

## 6. Scheduled jobs (GitHub Actions, `.github/workflows/scheduler.yml`)

Vercel Hobby cron runs only once a day, so GitHub Actions calls the app's cron routes with `Authorization: Bearer $CRON_SECRET`.

| Schedule (UTC) | Route | Does |
|---|---|---|
| `0 * * * *` (hourly) | `/api/cron/hourly` | Release expired holds, promote waitlist, retry failed outbox messages, hold-expiry reminders |
| `30 0 * * *` (06:00 IST) | `/api/cron/daily` | Follow-up digest, payment-due reminders, retention flags, sequence check, prune rate-limit buckets |

GitHub may start scheduled runs late; nothing depends on exact timing (notifications go out immediately with `after()`, and holds also expire lazily on read).

## 7. Backups and restore (`.github/workflows/backup.yml`)

- **Nightly at 02:00 IST**: `pg_dump --format=custom` with the PostgreSQL 17 client → encrypt with `age` (public key committed; private key kept offline by the owner and the developer) → upload as a workflow artifact, 30-day retention.
- **Monthly**: on the 1st, the owner downloads that day's encrypted dump to the business's own storage (e.g. Google Drive). This keeps a long-term copy outside GitHub at no cost.
- **Neon Free** also offers a 6-hour restore window — useful for "undo the last hour", not a backup.
- **Restore drill** (before launch, then quarterly): restore the latest dump into a fresh branch of `sundaram-dev`, run `npx prisma migrate status` and a row-count + ledger-balance check script, record the result below.

| Date | Backup used | Restored to | Checks | Result |
|---|---|---|---|---|
| — | — | — | — | Not yet done |

## 8. Domain and email (Hostinger)

The domain stays registered at Hostinger. DNS can stay there too; nothing needs to move.

1. In Vercel → Project → Domains, add `<domain>` and `www.<domain>`. Vercel shows the exact DNS records to create.
2. In Hostinger → Domains → DNS / Nameservers, add those records (typically an `A` record for the root domain and a `CNAME` for `www`). Keep Hostinger's nameservers.
3. Add `staging.<domain>` the same way and assign it to the `main` branch in Vercel.
4. SSL certificates are issued by Vercel automatically once DNS resolves.
5. Resend: add the domain in Resend; create the SPF, DKIM and DMARC records it shows in Hostinger DNS. DMARC starts at `p=none`, then moves to `quarantine` once reports are clean.
6. If the business also wants to *receive* email at the domain (e.g. `info@<domain>`), check whether the Hostinger purchase includes email or forwarding; otherwise a free mailbox provider can be added later. Keep its MX records separate from the Resend sending records.

## 9. Monitoring

- Sentry Free for the app (and the PDF service in Phase 3), alerts to the owner and developer.
- UptimeRobot Free every 5 min on `/` and `/api/health/enquiry`; alerts by email.
- Enquiry failure path: Sentry alert within minutes; the form shows phone and WhatsApp as a fallback.
- Monthly free-tier usage check: see `docs/costs.md` §3.

## 10. Launch checklist (Phase 2 gate, extended in Phase 6)

- [ ] All Phase 2 quality-gate checks pass on the staging build.
- [ ] Production env vars set and validated; secrets differ from staging.
- [ ] `prisma migrate deploy` applied on production after a confirmed backup.
- [ ] Domain live with SSL; `www` redirect works; old site URLs (if any) 301-redirect.
- [ ] Test enquiry from a phone on 4G creates a lead and notifies staff; then remove it via the admin workflow.
- [ ] `robots.txt` allows the website, blocks `/admin`; sitemap submitted to Google Search Console.
- [ ] Google Business Profile links to the site; name, address and phone match exactly.
- [ ] Uptime and Sentry alerts received in a test.
- [ ] First nightly backup present; one restore drill done.
- [ ] Free-tier usage dashboards bookmarked for the monthly check.
- [ ] Privacy policy and consent text reviewed by a professional.

## 11. Rollback

- App: Vercel instant rollback to the previous production deployment (available on Hobby; verify at setup), or redeploy the previous commit.
- Database: migrations are additive (expand-and-contract), so the previous app version keeps working. If data is damaged within 6 hours, restore a Neon branch to a point in time; otherwise restore last night's dump.
