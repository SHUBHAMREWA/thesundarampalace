-- CreateTable
CREATE TABLE "blog_category" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "blog_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "summary" JSONB,
    "content" JSONB NOT NULL,
    "featuredImageUrl" TEXT,
    "author" TEXT NOT NULL DEFAULT 'The Sundaram Palace Team',
    "categoryKey" TEXT NOT NULL,
    "tags" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ(3),
    "metaTitle" JSONB,
    "metaDescription" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "blog_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "real_wedding_story" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "coupleName" JSONB NOT NULL,
    "eventDate" DATE,
    "eventTypeKey" TEXT NOT NULL,
    "hallUsed" JSONB,
    "photographerCredit" TEXT,
    "summary" JSONB,
    "story" JSONB,
    "coverImageUrl" TEXT,
    "galleryImageUrls" JSONB,
    "coupleConsent" BOOLEAN NOT NULL DEFAULT false,
    "photographerConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentDate" TIMESTAMPTZ(3),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "real_wedding_story_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_category_key_key" ON "blog_category"("key");

-- CreateIndex
CREATE UNIQUE INDEX "blog_post_slug_key" ON "blog_post"("slug");

-- CreateIndex
CREATE INDEX "blog_post_published_publishedAt_idx" ON "blog_post"("published", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "real_wedding_story_slug_key" ON "real_wedding_story"("slug");

-- CreateIndex
CREATE INDEX "real_wedding_story_published_sortOrder_idx" ON "real_wedding_story"("published", "sortOrder");

-- AddForeignKey
ALTER TABLE "blog_post" ADD CONSTRAINT "blog_post_categoryKey_fkey" FOREIGN KEY ("categoryKey") REFERENCES "blog_category"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
