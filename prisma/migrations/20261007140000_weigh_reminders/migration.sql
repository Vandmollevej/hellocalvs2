-- Vejepaaminelser + kladde-flow "Kalibrer vaegten i weekenden" (fredag, banner, deaktiveret).
CREATE TABLE "weigh_reminder_prefs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "hours" INTEGER[],
    "lastSlot" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "weigh_reminder_prefs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "weigh_reminder_prefs_userId_key" ON "weigh_reminder_prefs"("userId");

INSERT INTO "flows" ("id","name","description","enabled","kind","conditions","priority","maxShows","createdAt","updatedAt")
VALUES ('flow_weekend_calibration', 'Kalibrér vægten i weekenden', 'Vises om fredagen. Foreslår at kalibrere vægten over weekenden og at slå vejepåmindelser til.', false, 'banner', '{"weekdays":[5],"minDaysBetweenShows":7}'::jsonb, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "flow_pages" ("id","flowId","sortOrder","title","bodyHtml","buttonLabel","actionLabel","actionHref","createdAt","updatedAt")
VALUES ('flowpage_weekend_calibration', 'flow_weekend_calibration', 0, 'Kalibrér din vægt i weekenden', '<p>Har du adgang til en vægt i weekenden? Så er det et godt tidspunkt at kalibrere. Slå påmindelser til, så får du besked 5 minutter før hver 2. time.</p>', 'Senere', 'Vælg påmindelser', '/weigh-reminders', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
