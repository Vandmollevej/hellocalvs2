-- Udtrykkeligt samtykke til helbredsoplysninger (docs/DECISIONS.md 2026-09-25).
ALTER TABLE "users" ADD COLUMN "healthDataConsentAt" TIMESTAMP(3);
