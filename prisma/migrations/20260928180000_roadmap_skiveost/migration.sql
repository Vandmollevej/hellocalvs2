-- Roadmap-punkt efter brugerens ønske (2026-09-28): skiveost skal gennemgås
-- igen senere. Datamigration, fordi roadmappen ligger i databasen.
INSERT INTO "roadmap_items" ("id", "title", "description", "status", "createdBy", "sortOrder")
SELECT 'roadmap_skiveost_reindex',
       'Indekser skiveost på ny',
       'Gennemgå skiveost igen: skivevægt og enheden "skive/skiver" (servingSizeGrams), placering i kategoritræet og produkttypen (skiveost vs. skæreost/smøreost). Se docs/DECISIONS.md 2026-09-28 om startmængde og skivevægt.',
       'IDEA', 'Claude',
       COALESCE((SELECT MAX("sortOrder") + 1 FROM "roadmap_items" WHERE "status" = 'IDEA'), 0)
ON CONFLICT ("id") DO NOTHING;
