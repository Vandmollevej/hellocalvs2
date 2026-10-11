-- Google Health sendte iltmætning, åndedræt, HRV og temperatur som én måling
-- hvert minut, så kalenderen viste 4-5 målinger på få minutter (bruger
-- 2026-10-11). Synkroniseringen gemmer nu ét gennemsnit pr. time
-- (averagePerHour i src/lib/integrations/google-health.ts). Denne engangs-
-- oprydning samler de minutmålinger, der allerede ligger i databasen, på
-- samme måde: første måling i timen beholdes med timens gennemsnit, resten
-- slettes. Dagssummer (kl. 00:00:00.000 UTC) og alle andre typer røres ikke.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER w AS rn,
    COUNT(*) OVER p AS n,
    AVG("value") OVER p AS avg_value
  FROM "health_metrics"
  WHERE "source" = 'GOOGLE_HEALTH'
    AND "type"::text IN ('OXYGEN_SATURATION_PERCENT', 'RESPIRATORY_RATE_BPM', 'HEART_RATE_VARIABILITY_MS', 'TEMPERATURE_C')
    AND "recordedAt" <> date_trunc('day', "recordedAt")
  WINDOW p AS (PARTITION BY "userId", "type", date_trunc('hour', "recordedAt")),
         w AS (p ORDER BY "recordedAt")
),
averaged AS (
  UPDATE "health_metrics" AS m
  SET "value" = ROUND(r.avg_value::numeric, 2)::double precision
  FROM ranked r
  WHERE m."id" = r."id" AND r.rn = 1 AND r.n > 1
  RETURNING m."id"
)
DELETE FROM "health_metrics" AS m
USING ranked r
WHERE m."id" = r."id" AND r.rn > 1;
