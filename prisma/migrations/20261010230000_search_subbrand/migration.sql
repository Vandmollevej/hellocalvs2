-- Søgning: subbrand er søgbart ligesom navn og brand, også når varesiden kun
-- viser det som logo (docs/DECISIONS.md 2026-10-10). Bruges af GET /api/products.
-- Alt er skema-kvalificeret af samme grund som i 20261010120000_search_unaccent_trgm.
CREATE INDEX IF NOT EXISTS "products_subbrand_search_trgm_idx" ON "products" USING gin (public.hc_search_norm("subbrand") gin_trgm_ops);

-- Ordlisten til "Mente du …?" får også subbrandenes ord.
DROP MATERIALIZED VIEW IF EXISTS "search_words";

CREATE MATERIALIZED VIEW "search_words" AS
SELECT word, public.hc_search_norm(word) AS norm, count(*)::int AS freq
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
  SELECT regexp_split_to_table(lower("subbrand"), '[[:space:][:punct:]]+')
  FROM "products"
  WHERE NOT "discontinued" AND "privateOwnerId" IS NULL AND "subbrand" IS NOT NULL
    AND ("externalSource" IS NULL OR "externalSource"::text NOT IN ('HELLOFRESH', 'OPEN_FOOD_FACTS'))
  UNION ALL
  SELECT regexp_split_to_table(lower("name"), '[[:space:][:punct:]]+') FROM "brands"
) w
WHERE length(word) >= 3 AND word !~ '[0-9]'
GROUP BY word;

CREATE UNIQUE INDEX "search_words_word_idx" ON "search_words" (word);
