# The Sundaram Palace — Website & CRM

Luxury wedding and banquet venue website, CMS and internal CRM for The Sundaram Palace.
Venue and banquet halls only — no room booking.

- Requirements: [`MASTER_PROMPT.md`](MASTER_PROMPT.md) · Project rules: [`CLAUDE.md`](CLAUDE.md)
- Plan and decisions: [`docs/implementation-plan.md`](docs/implementation-plan.md), [`docs/architecture.md`](docs/architecture.md)
- What the business still needs to supply: [`docs/missing-business-info.md`](docs/missing-business-info.md)

## Stack
Next.js 16 (App Router, Cache Components) · TypeScript strict · Tailwind 4 + shadcn/ui ·
PostgreSQL + Prisma 7 · Better Auth (TOTP 2FA) · next-intl (English + Hindi) · Vitest + Playwright.
Hosting plan: Vercel Hobby, Neon Free, Cloudinary Free (see [`docs/costs.md`](docs/costs.md)).

## Run it locally (Windows, macOS or Linux — no Docker needed)

```bash
npm install
npm run dev
```

`npm run dev` does everything in one go:

1. creates `.env` from `.env.example` with random local secrets (first run only)
2. starts the embedded PostgreSQL 17 server on port 54329 (unless it's already running)
3. applies the committed migrations
4. generates the Prisma client
5. seeds roles, permissions, lists, settings, CMS pages and a local Super Admin
6. starts the website on http://localhost:3000 (CRM at `/admin`)

Press **Ctrl+C** to stop the website and the database together. The local Super Admin's
email and password are `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`; the first
sign-in asks you to set up an authenticator app.

Other development commands:

| Command | What it does |
|---|---|
| `npm run dev -- --port 3001` | Same, on another port |
| `npm run dev:next` | Only the Next.js server (database must already be running) |
| `npm run db:local` | Only the local database |
| `npm run db:migrate -- --name <name>` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run db:studio` | Browse the local database |

## Staging / production database

```bash
npm run db:prod -- --env-file .env.production
```

Runs **only** `prisma migrate deploy` and the reference-data seed (roles, lists, settings, CMS
page structure), then shows the migration status. It never resets or deletes data, never creates
the local test admin, ignores your local `.env`, refuses a localhost database, and asks you to
type the database name to confirm (`--yes` skips the prompt in CI). Take a backup first —
see `docs/deployment.md` §5.

## Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build && npm run test:e2e
```

CI runs all of these on every push (`.github/workflows/ci.yml`).
