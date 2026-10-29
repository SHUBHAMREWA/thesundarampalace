-- Venues are now just a name, a description and photos (owner request,
-- 28 Oct 2026, confirmed: delete the other fields). A hall's main photo is
-- kept by moving it to the front of its photo list before the column goes.

UPDATE "media_placement" SET "sortOrder" = "sortOrder" + 1 WHERE "ownerType" = 'hall';
INSERT INTO "media_placement" ("id", "assetId", "ownerType", "ownerId", "sortOrder")
SELECT 'mp_' || md5(h."id" || h."heroAssetId"), h."heroAssetId", 'hall', h."id", 0
FROM "hall" h
WHERE h."heroAssetId" IS NOT NULL
ON CONFLICT ("ownerType", "ownerId", "assetId") DO UPDATE SET "sortOrder" = 0;

-- DropForeignKey
ALTER TABLE "hall" DROP CONSTRAINT "hall_floorPlanAssetId_fkey";

-- DropForeignKey
ALTER TABLE "hall" DROP CONSTRAINT "hall_heroAssetId_fkey";

-- DropForeignKey
ALTER TABLE "hall_layout_capacity" DROP CONSTRAINT "hall_layout_capacity_hallId_fkey";

-- AlterTable
ALTER TABLE "hall" DROP COLUMN "areaSqFt",
DROP COLUMN "ceilingHeightFt",
DROP COLUMN "eventTypeKeys",
DROP COLUMN "facilities",
DROP COLUMN "floorPlanAssetId",
DROP COLUMN "heroAssetId",
DROP COLUMN "seo",
DROP COLUMN "slotsInfo",
DROP COLUMN "summary",
DROP COLUMN "tourUrl";

-- DropTable
DROP TABLE "hall_layout_capacity";

-- DropEnum
DROP TYPE "HallLayout";

