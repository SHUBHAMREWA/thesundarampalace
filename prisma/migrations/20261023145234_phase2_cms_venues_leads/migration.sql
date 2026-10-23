-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "PageKind" AS ENUM ('STANDARD', 'SERVICE', 'LEGAL');

-- CreateEnum
CREATE TYPE "HallLayout" AS ENUM ('THEATRE', 'BANQUET', 'FLOATING', 'CLUSTER');

-- CreateTable
CREATE TABLE "media_asset" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "format" TEXT,
    "kind" "MediaKind" NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "alt" JSONB NOT NULL,
    "caption" JSONB,
    "photographerCredit" TEXT,
    "usagePermission" TEXT,
    "group" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_placement" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "media_placement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_page" (
    "id" TEXT NOT NULL,
    "kind" "PageKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "summary" JSONB,
    "body" JSONB,
    "heroAssetId" TEXT,
    "seo" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "website_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_section" (
    "type" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "content" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "home_section_pkey" PRIMARY KEY ("type")
);

-- CreateTable
CREATE TABLE "hall" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "summary" JSONB,
    "description" JSONB,
    "areaSqFt" INTEGER,
    "ceilingHeightFt" DECIMAL(5,2),
    "facilities" JSONB NOT NULL,
    "eventTypeKeys" JSONB NOT NULL,
    "slotsInfo" JSONB,
    "heroAssetId" TEXT,
    "floorPlanAssetId" TEXT,
    "tourUrl" TEXT,
    "seo" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "setupBufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "teardownBufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "isComposite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hall_layout_capacity" (
    "id" TEXT NOT NULL,
    "hallId" TEXT NOT NULL,
    "layout" "HallLayout" NOT NULL,
    "minGuests" INTEGER,
    "maxGuests" INTEGER,

    CONSTRAINT "hall_layout_capacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "description" JSONB,
    "publicVisible" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decor_theme" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "decor_theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "inclusions" JSONB,
    "addOns" JSONB,
    "terms" JSONB,
    "eventTypeKeys" JSONB NOT NULL,
    "publicPrice" DECIMAL(12,2),
    "publicPriceNote" JSONB,
    "showPublicPrice" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_category" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "gallery_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_item" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gallery_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auspicious_date" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "label" JSONB NOT NULL,
    "note" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auspicious_date_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "statusKey" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "campaign" TEXT,
    "utm" JSONB,
    "referrer" TEXT,
    "landingPage" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "eventTypeKey" TEXT,
    "preferredDate" DATE,
    "guestsApprox" INTEGER,
    "message" TEXT,
    "preferredHallId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "contactPreference" TEXT NOT NULL,
    "assignedToId" TEXT,
    "followUpAt" TIMESTAMPTZ(3),
    "budgetEstimate" DECIMAL(12,2),
    "menuPreference" TEXT,
    "siteVisitAt" TIMESTAMPTZ(3),
    "siteVisitOutcome" TEXT,
    "lostReasonKey" TEXT,
    "lastActivityAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "data" JSONB,
    "actorId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_record" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "providerMessageId" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "page" TEXT,
    "locale" TEXT,
    "utm" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversion_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_publicId_key" ON "media_asset"("publicId");

-- CreateIndex
CREATE INDEX "media_asset_group_createdAt_idx" ON "media_asset"("group", "createdAt");

-- CreateIndex
CREATE INDEX "media_placement_ownerType_ownerId_sortOrder_idx" ON "media_placement"("ownerType", "ownerId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "media_placement_ownerType_ownerId_assetId_key" ON "media_placement"("ownerType", "ownerId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "website_page_kind_slug_key" ON "website_page"("kind", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "hall_slug_key" ON "hall"("slug");

-- CreateIndex
CREATE INDEX "hall_published_sortOrder_idx" ON "hall"("published", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "hall_layout_capacity_hallId_layout_key" ON "hall_layout_capacity"("hallId", "layout");

-- CreateIndex
CREATE INDEX "menu_item_menuId_course_sortOrder_idx" ON "menu_item"("menuId", "course", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "decor_theme_slug_key" ON "decor_theme"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "package_slug_key" ON "package"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "gallery_category_key_key" ON "gallery_category"("key");

-- CreateIndex
CREATE UNIQUE INDEX "gallery_item_categoryId_assetId_key" ON "gallery_item"("categoryId", "assetId");

-- CreateIndex
CREATE INDEX "auspicious_date_published_date_idx" ON "auspicious_date"("published", "date");

-- CreateIndex
CREATE UNIQUE INDEX "lead_reference_key" ON "lead"("reference");

-- CreateIndex
CREATE INDEX "lead_phone_idx" ON "lead"("phone");

-- CreateIndex
CREATE INDEX "lead_statusKey_createdAt_idx" ON "lead"("statusKey", "createdAt");

-- CreateIndex
CREATE INDEX "lead_assignedToId_followUpAt_idx" ON "lead"("assignedToId", "followUpAt");

-- CreateIndex
CREATE INDEX "lead_createdAt_idx" ON "lead"("createdAt");

-- CreateIndex
CREATE INDEX "lead_activity_leadId_createdAt_idx" ON "lead_activity"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "consent_record_subjectType_subjectId_purpose_createdAt_idx" ON "consent_record"("subjectType", "subjectId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_createdAt_idx" ON "notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_status_nextAttemptAt_idx" ON "outbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "outbox_relatedType_relatedId_idx" ON "outbox"("relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "conversion_event_type_createdAt_idx" ON "conversion_event"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "media_placement" ADD CONSTRAINT "media_placement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_page" ADD CONSTRAINT "website_page_heroAssetId_fkey" FOREIGN KEY ("heroAssetId") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hall" ADD CONSTRAINT "hall_heroAssetId_fkey" FOREIGN KEY ("heroAssetId") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hall" ADD CONSTRAINT "hall_floorPlanAssetId_fkey" FOREIGN KEY ("floorPlanAssetId") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hall_layout_capacity" ADD CONSTRAINT "hall_layout_capacity_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "hall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_item" ADD CONSTRAINT "gallery_item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "gallery_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_item" ADD CONSTRAINT "gallery_item_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_preferredHallId_fkey" FOREIGN KEY ("preferredHallId") REFERENCES "hall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
