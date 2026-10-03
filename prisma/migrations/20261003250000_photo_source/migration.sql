-- Kilde til brugerens foto ved "opdater varen": kun CAMERA giver points.
DO $$ BEGIN
  CREATE TYPE "PhotoSource" AS ENUM ('CAMERA', 'UPLOAD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "ai_product_analyses" ADD COLUMN IF NOT EXISTS "photo_source" "PhotoSource";
