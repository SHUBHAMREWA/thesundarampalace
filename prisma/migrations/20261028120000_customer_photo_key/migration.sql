-- Profile photos now go through the private store (Cloudinary when configured, else the database).
ALTER TABLE "customer" RENAME COLUMN "photoPublicId" TO "photoKey";
-- Earlier values were bare Cloudinary public IDs; give them the store prefix.
UPDATE "customer" SET "photoKey" = 'cloudinary:' || "photoKey" WHERE "photoKey" IS NOT NULL AND "photoKey" NOT LIKE 'cloudinary:%';
