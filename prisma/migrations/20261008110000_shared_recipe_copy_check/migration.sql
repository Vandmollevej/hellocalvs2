ALTER TABLE "shared_recipes" ADD COLUMN "copyFlagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "shared_recipes" ADD COLUMN "copyCheck" JSONB;
ALTER TABLE "shared_recipes" ADD COLUMN "rejectionReason" TEXT;
