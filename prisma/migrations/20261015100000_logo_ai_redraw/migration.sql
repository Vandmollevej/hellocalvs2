-- AI-rentegnede logoer (docs/DECISIONS.md 2026-10-15).
ALTER TABLE "brand_logo_candidates" ADD COLUMN "aiGenerated" BOOLEAN NOT NULL DEFAULT false;
