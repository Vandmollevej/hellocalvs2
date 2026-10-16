-- Sprogrobotten (docs/DECISIONS.md 2026-10-15): hvornår varens sprog er
-- tjekket mod teksten (scripts/quality-control-agent/language_local.py).
ALTER TABLE "products" ADD COLUMN "languageCheckedAt" TIMESTAMP(3);
