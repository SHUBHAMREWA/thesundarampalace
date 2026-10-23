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

## Local setup (Windows, macOS or Linux — no Docker needed)

```bash
npm install
cp .env.example .env        # then fill in secrets (see comments in the file)
npm run db:local            # terminal 1: embedded PostgreSQL 17 on port 54329
npm run db:deploy           # terminal 2: apply migrations to sundaram_dev
npm run db:seed             # roles, permissions, lists, settings, local Super Admin
npm run dev                 # http://localhost:3000  ·  CRM: /admin
```

`.env` also needs `TEST_DATABASE_URL` and `E2E_DATABASE_URL` for the test suites
(`…/sundaram_test` and `…/sundaram_e2e` on the same local server).

The first Super Admin sign-in forces two-factor setup (any authenticator app).

## Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build && npm run test:e2e
```

CI runs all of these on every push (`.github/workflows/ci.yml`).
