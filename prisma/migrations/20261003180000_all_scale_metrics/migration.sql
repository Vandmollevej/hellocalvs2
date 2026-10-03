-- Version af integrationens datasaet; hoejere version i adapteren = hent historikken igen.
-- (Maaletyperne fra smartvaegte tilfoejes af 20261003120000_all_health_metrics og
-- 20261003150000_full_body_composition, samlet fletning 2026-10-03.)
ALTER TABLE "integrations" ADD COLUMN IF NOT EXISTS "fetchVersion" INTEGER NOT NULL DEFAULT 0;
