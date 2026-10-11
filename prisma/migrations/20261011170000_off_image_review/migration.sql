-- Open Food Facts-billedgennemgang (2026-10-11): admins dom over OFF-billedet paa varen.
-- null = til gennemgang. Se docs/DECISIONS.md 2026-10-11.
CREATE TYPE "OffImageReview" AS ENUM ('APPROVED', 'REJECTED');

ALTER TABLE "products"
  ADD COLUMN "offImageReview" "OffImageReview",
  ADD COLUMN "offImageReviewedAt" TIMESTAMP(3),
  ADD COLUMN "offImageReviewedById" TEXT;

CREATE INDEX "products_externalSource_offImageReview_offImageReviewedAt_idx"
  ON "products"("externalSource", "offImageReview", "offImageReviewedAt");