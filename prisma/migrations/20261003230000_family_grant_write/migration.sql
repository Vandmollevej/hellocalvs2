-- Adgang til et familiemedlem deles i "se profilen" (rækken findes) og
-- "oprette på deres vegne" (canWrite). Eksisterende tildelinger var "se og
-- taste ind", så de beholder begge dele (docs/DECISIONS.md 2026-10-03).
ALTER TABLE "family_access_grants" ADD COLUMN "canWrite" BOOLEAN NOT NULL DEFAULT true;
