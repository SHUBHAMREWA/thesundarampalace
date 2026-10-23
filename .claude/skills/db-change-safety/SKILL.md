---
name: db-change-safety
description: Use before changing prisma/schema.prisma, writing or running Prisma migrations, raw SQL migrations, seeds, or anything that could alter or lose data in The Sundaram Palace database.
---

# Database change safety

## Before changing the schema
- Read `docs/database-design.md`; update it in the same change.
- Money fields: `Decimal @db.Decimal(12, 2)`. Rates: `Decimal @db.Decimal(5, 2)`.
- Timestamps: `DateTime @db.Timestamptz(3)` with `createdAt @default(now())` and `updatedAt @updatedAt`.
- References (`SP-B-…`, invoice numbers) get `@unique`.
- Index columns used in search/filter (phone, status, dates, hallId + startsAt).
- Relations: `onDelete: Restrict` for anything touching bookings, payments, invoices, deposits, customers. Use soft delete (`deletedAt`) for customers, leads and bookings. Cascades only for pure child data (e.g. draft quotation lines).
- Snapshots (quotation versions, booking menu/price snapshots, invoices) are stored as immutable rows or JSON columns; never derived live from editable tables.

## Migrations
- Dev: `npx prisma migrate dev --name <descriptive_name>`; review the generated SQL before committing.
- Raw SQL (exclusion constraints, `btree_gist`, partial indexes) goes in a migration file, never applied by hand.
- Never use `prisma db push` or `migrate reset` against staging/production.
- Destructive changes (drop column/table, type narrowing, rename) → expand-and-contract: add new, backfill, switch code, remove old in a later migration. Ask the user before any destructive step.
- Production: `npx prisma migrate deploy` only after a fresh backup is confirmed.

## Seeds
- `prisma/seed.ts` creates clearly fake data (names like "Test Customer 01", phones `+91 90000 000xx`).
- Never import real customer data into seeds or fixtures.

## Verification
- Run migrations from scratch on an empty database in CI.
- Run integration tests that touch the changed tables.
- Record any manual follow-up (backfill, data fix) in the phase report.
