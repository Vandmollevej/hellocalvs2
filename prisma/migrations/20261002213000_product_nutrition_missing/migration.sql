-- Butiksvarer uden kalorietal importeres skjult, til de har fået næring
-- (docs/DECISIONS.md 2026-10-02).
ALTER TABLE "products" ADD COLUMN "nutritionMissing" BOOLEAN NOT NULL DEFAULT false;
