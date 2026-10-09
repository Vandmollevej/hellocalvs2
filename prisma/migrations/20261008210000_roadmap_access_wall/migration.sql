-- Roadmap-punkter efter adgangsmuren (docs/DECISIONS.md 2026-10-08): de dele,
-- der kræver brugerens egen indsats. Datamigration, fordi roadmappen ligger i
-- databasen.
INSERT INTO "roadmap_items" ("id", "title", "description", "status", "createdBy", "sortOrder")
SELECT 'roadmap_wall_cloudflare',
       'Cloudflare: bot-beskyttelse for hellocal.io',
       'Slå Bot Fight Mode og "AI Scrapers and Crawlers"-blokering til i Cloudflare, og sæt en rate-limit-regel på /api/auth/* (fx 10 forespørgsler/min pr. IP). Det er et supplement til adgangsmuren i middleware.ts og kan kun gøres i Cloudflare-dashboardet. Se docs/DEPLOYMENT.md "Search indexing and crawler protection".',
       'PLANNED', 'Claude',
       COALESCE((SELECT MAX("sortOrder") + 1 FROM "roadmap_items" WHERE "status" = 'PLANNED'), 0)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "roadmap_items" ("id", "title", "description", "status", "createdBy", "sortOrder")
SELECT 'roadmap_wall_livetest',
       'Live-test af adgangsmuren efter deploy',
       'Adgangsmuren er ikke testet live (ingen lokal DB/login). Tjek efter deploy: forside, login, Face ID, Google/Apple/Facebook-login, betalings-webhook, widgets, partnerportal, /business-kontaktformular og produktbilleder i appen. Mangler en offentlig rute, tilføjes den i src/lib/access-wall.ts.',
       'PLANNED', 'Claude',
       COALESCE((SELECT MAX("sortOrder") + 1 FROM "roadmap_items" WHERE "status" = 'PLANNED'), 0)
ON CONFLICT ("id") DO NOTHING;
