-- Nettos ØGO-pose blev læst som "DAGO" (docs/STATUS.md 2026-10-15). Årsagen er
-- rettet i #417, men varen lå stadig forkert i databasen.
-- 1) ØGO findes som brand (normalt oprettet af PINNED_BRANDS ved første scan).
INSERT INTO "brands" ("id", "name", "createdAt")
SELECT 'brand_oego_' || substr(md5(random()::text), 1, 12), 'ØGO', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "brands" WHERE "name" = 'ØGO');

-- 2) Varen (EAN 5712872629689) og alle andre varer på "DAGO" flyttes til ØGO.
UPDATE "products"
SET "brandId" = (SELECT "id" FROM "brands" WHERE "name" = 'ØGO')
WHERE "brandId" IN (SELECT "id" FROM "brands" WHERE upper("name") = 'DAGO')
   OR "id" IN (SELECT "productId" FROM "barcodes" WHERE "code" = '5712872629689');

-- 3) Forsidebilledet blev beskåret til AI'ens boks og kan ikke genskabes: varen
--    markeres og sendes til scan-appens "Skal scannes" nu i stedet for i nat
--    (samme markering som robotten front-image-check, src/lib/front-image-check.ts).
UPDATE "products"
SET "frontImageSuspect" = 'beskåret til AI''ens boks (DAGO-posen)',
    "frontImageSuspectUrl" = "imageUrl",
    "frontImageSuspectAt" = NOW(),
    "frontImageFixedAt" = NULL
WHERE "id" IN (SELECT "productId" FROM "barcodes" WHERE "code" = '5712872629689');

INSERT INTO "product_quality_reviews" ("productId", "score", "rating", "categories", "findings", "assessedAt", "scanRequestedAt")
SELECT b."productId", 0, 'POOR', ARRAY['FRONT_CROPPED'],
       '[{"category":"IMAGE","code":"front_cropped","severity":"high","comment":"Forsidebilledet er beskåret — tag forsiden om"}]'::jsonb,
       NOW(), NOW()
FROM "barcodes" b
WHERE b."code" = '5712872629689'
ON CONFLICT ("productId") DO UPDATE
SET "categories" = CASE WHEN 'FRONT_CROPPED' = ANY("product_quality_reviews"."categories")
                        THEN "product_quality_reviews"."categories"
                        ELSE array_append("product_quality_reviews"."categories", 'FRONT_CROPPED') END,
    "scanRequestedAt" = NOW(),
    "scanDoneAt" = NULL,
    "scanDoneByWorkerId" = NULL;
