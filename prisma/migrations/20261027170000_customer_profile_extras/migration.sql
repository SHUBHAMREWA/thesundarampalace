-- Customers: approximate age (as a birth year), several professions,
-- a Google Maps link and a photo stored on Cloudinary.
ALTER TABLE "customer" ADD COLUMN "approxBirthYear" INTEGER;
ALTER TABLE "customer" ADD COLUMN "professionKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "customer" ADD COLUMN "mapsUrl" TEXT;
ALTER TABLE "customer" ADD COLUMN "photoPublicId" TEXT;

UPDATE "customer" SET "professionKeys" = ARRAY["professionKey"] WHERE "professionKey" IS NOT NULL;

ALTER TABLE "customer" DROP COLUMN "professionKey";
