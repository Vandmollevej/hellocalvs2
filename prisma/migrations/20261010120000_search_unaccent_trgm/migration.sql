-- Søgning: accent-ufølsom tekstmatch + ordliste til "Mente du …?"
-- (docs/DECISIONS.md 2026-10-10). Bruges af GET /api/products.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Små bogstaver og uden accenter ("Nescafé" → "nescafe", "æ" → "ae"). Skal være
-- IMMUTABLE for at kunne bruges i indeks.
CREATE OR REPLACE FUNCTION hc_search_norm(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT lower(unaccent('unaccent', $1)) $$;

CREATE INDEX "products_name_search_trgm_idx" ON "products" USING gin (hc_search_norm("name") gin_trgm_ops);
CREATE INDEX "products_namePlural_search_trgm_idx" ON "products" USING gin (hc_search_norm("namePlural") gin_trgm_ops);
CREATE INDEX "brands_name_search_trgm_idx" ON "brands" USING gin (hc_search_norm("name") gin_trgm_ops);

-- Ordliste fra søgbare varenavne og mærker. `word` er ordet som skrevet (små
-- bogstaver, vises til brugeren), `norm` er uden accenter (sammenlignes).
-- Ordlisten er lille (titusinder af rækker), så rettelser slår op med levenshtein()
-- uden indeks. Genopbygges af API'et (REFRESH ... CONCURRENTLY) når den er ældre end få timer.
CREATE MATERIALIZED VIEW "search_words" AS
SELECT word, hc_search_norm(word) AS norm, count(*)::int AS freq
FROM (
  SELECT regexp_split_to_table(lower("name"), '[[:space:][:punct:]]+') AS word
  FROM "products"
  WHERE NOT "discontinued" AND "privateOwnerId" IS NULL
    AND ("externalSource" IS NULL OR "externalSource"::text NOT IN ('HELLOFRESH', 'OPEN_FOOD_FACTS'))
  UNION ALL
  SELECT regexp_split_to_table(lower("namePlural"), '[[:space:][:punct:]]+')
  FROM "products"
  WHERE NOT "discontinued" AND "privateOwnerId" IS NULL AND "namePlural" IS NOT NULL
    AND ("externalSource" IS NULL OR "externalSource"::text NOT IN ('HELLOFRESH', 'OPEN_FOOD_FACTS'))
  UNION ALL
  SELECT regexp_split_to_table(lower("name"), '[[:space:][:punct:]]+') FROM "brands"
) w
WHERE length(word) >= 3 AND word !~ '[0-9]'
GROUP BY word;

CREATE UNIQUE INDEX "search_words_word_idx" ON "search_words" (word);
