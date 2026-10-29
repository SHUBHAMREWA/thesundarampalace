-- Fixed slots and setup/teardown buffers are no longer used (owner decision,
-- 26 Oct 2026): every function has its own start and end time and occupies
-- its hall exactly for that time.
-- Data only. Slot definitions stay in the database for history; functions keep
-- their times. Shrinking occupancies to the function's own times can never
-- create a new overlap, so the exclusion constraint stays satisfied.

UPDATE "hall" SET "setupBufferMinutes" = 0, "teardownBufferMinutes" = 0
WHERE "setupBufferMinutes" <> 0 OR "teardownBufferMinutes" <> 0;

UPDATE "slot_occupancy" AS o
SET "effectiveStartsAt" = r."startsAt", "effectiveEndsAt" = r."endsAt"
FROM "slot_reservation" AS r
WHERE o."reservationId" = r."id"
  AND (o."effectiveStartsAt" <> r."startsAt" OR o."effectiveEndsAt" <> r."endsAt");

UPDATE "slot_definition" SET "active" = false WHERE "active" = true;
