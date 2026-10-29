-- Packages removed from the website, CMS, catalog and bookings (owner request,
-- 28 Oct 2026). Menu packages (menu_package) are a different feature and stay.
-- Quotation lines already written with kind PACKAGE keep their copied
-- description and amounts (financial history), so the LineKind value stays.

-- Homepage block and the public page record.
DELETE FROM "home_section" WHERE "type" = 'packages';
DELETE FROM "website_page" WHERE "kind" = 'STANDARD' AND "slug" = 'packages';

-- DropForeignKey
ALTER TABLE "booking" DROP CONSTRAINT "booking_packageId_fkey";

-- DropForeignKey
ALTER TABLE "package" DROP CONSTRAINT "package_taxCategoryId_fkey";

-- AlterTable
ALTER TABLE "booking" DROP COLUMN "packageId";

-- DropTable
DROP TABLE "package";
