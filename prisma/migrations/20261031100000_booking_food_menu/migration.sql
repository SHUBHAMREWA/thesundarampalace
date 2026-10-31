-- A booking's own food menu: a copy of the venue menu with the items picked for it.
ALTER TABLE "booking" ADD COLUMN "foodMenu" JSONB;
