-- Fejlrapport fra en generisk vares "Har du fundet en fejl?" (docs/DECISIONS.md 2026-10-15).
ALTER TABLE "bug_reports" ADD COLUMN "genericIngredientId" TEXT;

CREATE INDEX "bug_reports_userId_genericIngredientId_idx" ON "bug_reports"("userId", "genericIngredientId");

ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_genericIngredientId_fkey" FOREIGN KEY ("genericIngredientId") REFERENCES "generic_ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
