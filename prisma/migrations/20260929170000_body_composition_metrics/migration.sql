-- Kropssammensaetning fra smartvaegte: muskelmasse (kg) og kropsvand (%).
ALTER TYPE "HealthMetricType" ADD VALUE IF NOT EXISTS 'MUSCLE_MASS_KG';
ALTER TYPE "HealthMetricType" ADD VALUE IF NOT EXISTS 'BODY_WATER_PERCENT';
