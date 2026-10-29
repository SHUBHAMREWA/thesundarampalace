-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "foodGst" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "menu_package" ALTER COLUMN "taxCategoryId" DROP NOT NULL;
