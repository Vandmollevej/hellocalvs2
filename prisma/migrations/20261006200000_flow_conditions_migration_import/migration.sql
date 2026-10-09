-- AlterTable
ALTER TABLE "flows" ADD COLUMN     "conditions" JSONB,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'popup',
ADD COLUMN     "maxShows" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "flow_pages" ADD COLUMN     "actionHref" TEXT,
ADD COLUMN     "actionLabel" TEXT;

-- CreateTable
CREATE TABLE "flow_views" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shownCount" INTEGER NOT NULL DEFAULT 0,
    "lastShownAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_section_visits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "visitCount" INTEGER NOT NULL DEFAULT 1,
    "firstVisitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_section_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_imports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ANALYZING',
    "frameCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_import_rows" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "meal" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountText" TEXT,
    "amountGrams" DOUBLE PRECISION,
    "kcal" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "registrationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flow_views_flowId_userId_key" ON "flow_views"("flowId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_section_visits_userId_section_key" ON "user_section_visits"("userId", "section");

-- CreateIndex
CREATE INDEX "migration_imports_userId_createdAt_idx" ON "migration_imports"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "migration_import_rows_importId_status_idx" ON "migration_import_rows"("importId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "migration_import_rows_importId_date_meal_name_kcal_key" ON "migration_import_rows"("importId", "date", "meal", "name", "kcal");

-- AddForeignKey
ALTER TABLE "flow_views" ADD CONSTRAINT "flow_views_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_views" ADD CONSTRAINT "flow_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_section_visits" ADD CONSTRAINT "user_section_visits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_imports" ADD CONSTRAINT "migration_imports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_import_rows" ADD CONSTRAINT "migration_import_rows_importId_fkey" FOREIGN KEY ("importId") REFERENCES "migration_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Opsætningsguide som flow i admin → Flows, slået fra (Kladde) indtil videre
-- (docs/DECISIONS.md 2026-10-06). Ekstra knap pr. side; tilbage-pilen bringer
-- brugeren tilbage til samme side i guiden.
INSERT INTO "flows" ("id", "name", "description", "enabled", "kind", "priority", "maxShows", "createdAt", "updatedAt")
VALUES ('flow_opsaetning_v1', 'Opsætningsguide', 'Opsætning ved oprettelse: ur, smart-vægt, vægt/højde/fødselsdato, søvn, mål, allergier og Hello Fresh.', false, 'popup', 100, 1, now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "flow_pages" ("id", "flowId", "sortOrder", "title", "bodyHtml", "buttonLabel", "actionLabel", "actionHref", "createdAt", "updatedAt")
SELECT v.id, 'flow_opsaetning_v1', v.sort, v.title, v.body, v.button, v.action_label, v.action_href, now(), now()
FROM (VALUES
  ('flow_opsaetning_v1_p1', 0, 'Integrér dit ur', '<p>For at gøre opsætningen lettere, kan du med fordel integrere dit ur allerede nu og indlæse dit aktivitetsniveau.</p>', 'Næste', 'Integrér dit ur', '/settings/integrations'),
  ('flow_opsaetning_v1_p2', 1, 'Har du en smart-vægt?', '<p>Hvis du integrerer den, slipper du for at angive startvægt.</p>', 'Næste', 'Integrér din vægt', '/settings/integrations'),
  ('flow_opsaetning_v1_p3', 2, 'Vægt, højde og alder', '<p>Indtast din vægt og højde, din alder og fødselsdato. Har du integreret en smart-vægt, skal du kun angive højde og fødselsdato.</p><p>Vi skal bruge din fødselsdato for at tilpasse din forbrænding og fysik.</p>', 'Næste', 'Udfyld vægt, højde og fødselsdato', '/profile/edit'),
  ('flow_opsaetning_v1_p4', 3, 'Søvn', '<p>Søvnen kan have stor indflydelse på vægt og trivsel. Se dit liv i et større perspektiv, når du har indsamlet nok data. Standard søvn sættes til 22.00 - 07.00.</p>', 'Næste', 'Indstil søvn', '/profile/sleep'),
  ('flow_opsaetning_v1_p5', 4, 'Sæt dig dit mål', '<p>Sæt dig dit første mål. Senere kan du også indsætte delmål.</p>', 'Næste', 'Sæt dit mål', '/profile/goals/new'),
  ('flow_opsaetning_v1_p6', 5, 'Allergier', '<p>Har du allergier eller fødevarer, du ønsker at undgå?</p>', 'Næste', 'Vælg allergier og fødevarer', '/profile/settings/results'),
  ('flow_opsaetning_v1_p7', 6, 'Hello Fresh', '<p>Abonnerer du på Hello Fresh? Så kan du allerede nu koble dit abonnement til, så det er nemt at registrere dine kalorier.</p>', 'Færdig', 'Kobl Hello Fresh til', '/settings/integrations')
) AS v(id, sort, title, body, button, action_label, action_href)
WHERE EXISTS (SELECT 1 FROM "flows" WHERE "id" = 'flow_opsaetning_v1')
ON CONFLICT ("id") DO NOTHING;
