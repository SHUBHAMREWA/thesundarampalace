-- Guest testimonials for the homepage (new table only; no existing data touched).
-- CreateTable
CREATE TABLE "testimonial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "event" JSONB,
    "quote" JSONB NOT NULL,
    "rating" INTEGER NOT NULL,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "testimonial_published_createdAt_idx" ON "testimonial"("published", "createdAt");


-- Stars are 1 to 5.
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
