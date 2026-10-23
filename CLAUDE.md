# CLAUDE.md — The Sundaram Palace Website & CRM

Full requirements: `MASTER_PROMPT.md`. Read it at the start of every new phase.

## What this project is
- Luxury wedding and banquet venue website + internal CRM for The Sundaram Palace (India).
- Scope is venue and banquet halls only. **No room booking anywhere.**
- Stack: Next.js (App Router) · TypeScript strict · Tailwind · shadcn/ui · React Hook Form + Zod · PostgreSQL + Prisma · Cloudinary · Playwright/Chromium PDFs · Vitest + Playwright tests.

## Non-negotiable rules
1. Never invent business facts (capacity, area, prices, awards, reviews, address, phone). Use CMS placeholders and log the gap in `docs/missing-business-info.md`.
2. Money uses Prisma `Decimal` / decimal.js only. No floats. All totals computed server-side.
3. Never edit or delete financial history. Use adjustments, credit notes, and audit logs.
4. Never hardcode tax rates, slot times, or policies. They live in Settings.
5. Every protected action checks permissions on the server.
6. Private documents never get public URLs. Signed short-lived URLs + audit log.
7. Only Rose Mahal design tokens from `globals.css`. No new hex colors in components.
8. Time zone `Asia/Kolkata`; store UTC; slots can cross midnight.
9. No secrets or real customer data in Git. Seeds are clearly fake.
10. Ask before destructive operations or production migrations.

## Skills to load (in `.claude/skills/`)
| Working on | Load skill |
|---|---|
| Any UI, page, component, PDF styling | `sundaram-design-system` |
| Public website pages, CMS content, SEO | `luxury-venue-content` |
| Halls, slots, holds, bookings, conflicts, menus, plates | `banquet-business-rules` |
| Money, GST, invoices, deposits, refunds, cancellation | `india-billing-gst` |
| PDF templates and rendering | `pdf-documents` |
| Auth, permissions, uploads, personal data, notifications | `secure-customer-data` |
| Prisma schema or migrations | `db-change-safety` |
| End of any phase or before saying "done" | `phase-quality-gate` |

## Commands
- Local database (keep running in its own terminal): `npm run db:local` — embedded PostgreSQL 17 on port 54329, data in `.local/pgdata`
- Dev: `npm run dev` (needs `.env`; copy from `.env.example`)
- Type check: `npm run typecheck`
- Lint (+ colour-token guard): `npm run lint`
- Unit/integration tests: `npm run test` (rebuilds `sundaram_test` from migrations)
- E2E tests: `npm run build && npm run test:e2e` (rebuilds `sundaram_e2e`)
- Build: `npm run build`
- Migrations (dev): `npm run db:migrate -- --name <name>` then `npx prisma generate`
- Seed: `npm run db:seed` (roles, lists, settings; local Super Admin from `.env` in development)

## Framework notes
- Next.js 16 with Cache Components: read `AGENTS.md` and `node_modules/next/dist/docs/` before using unfamiliar APIs. `middleware` is now `src/proxy.ts`.
- Public pages must stay static (free-tier plan): no cookies/headers reads in `(website)`; locale comes from `next/root-params`.
- The CRM root layout (`src/app/admin/layout.tsx`) is dynamic for the CSP nonce; check permissions with `requirePermission()` in every page and `assertPermission()` in every action.
- Prisma 7: client is generated into `src/generated/prisma` (git-ignored); import from `@/generated/prisma/client`.

## Phase order
0 Discovery → 1 Foundation → 2 Website + Leads MVP → 3 Bookings and money → 4 Operations → 5 Growth → 6 Hardening and launch.
Ship Phase 2 first so enquiries start coming in.

## Conventions
- Business logic in `src/server/services/`; UI components stay thin.
- Zod schemas shared between client and server in `src/lib/validation/`.
- Human-readable references: `SP-L-YYYY-#####` (lead), `SP-B-YYYY-#####` (booking), invoices per financial year from Settings.
- Small, descriptive Git commits per feature.
