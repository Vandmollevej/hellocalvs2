-- Beløbsgrænser for varsler på admin → API-forbrug (docs/DECISIONS.md 2026-10-16).
ALTER TABLE "api_budgets" ADD COLUMN "alertAt" DOUBLE PRECISION;
ALTER TABLE "api_budgets" ADD COLUMN "balanceAlertAt" DOUBLE PRECISION;
