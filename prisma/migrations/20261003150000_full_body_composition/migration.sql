-- Hele kropssammensætningen fra smartvægte (docs/DECISIONS.md 2026-10-03):
-- fedtmasse, fedtfri masse, knoglemasse og visceralt fedt. Håndskrevet
-- (ingen lokal PostgreSQL).

ALTER TYPE "HealthMetricType" ADD VALUE IF NOT EXISTS 'FAT_MASS_KG';
ALTER TYPE "HealthMetricType" ADD VALUE IF NOT EXISTS 'FAT_FREE_MASS_KG';
ALTER TYPE "HealthMetricType" ADD VALUE IF NOT EXISTS 'BONE_MASS_KG';
ALTER TYPE "HealthMetricType" ADD VALUE IF NOT EXISTS 'VISCERAL_FAT_INDEX';
