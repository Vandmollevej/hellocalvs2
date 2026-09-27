-- "Opret straks" fra kameraflowet: felter der stadig aflæses i baggrunden (docs/DECISIONS.md 2026-09-27).
ALTER TABLE "products" ADD COLUMN "pendingFields" TEXT[] DEFAULT ARRAY[]::TEXT[];
