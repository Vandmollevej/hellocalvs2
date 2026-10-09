-- Roadmap-punkter efter brugerens valg (2026-10-08): de dele af den native
-- app, der kræver brugerens egne konti. Datamigration, fordi roadmappen ligger
-- i databasen. Se native/README.md og docs/handoffs/OPEN-TASKS.md (G-NATIVE).
INSERT INTO "roadmap_items" ("id", "title", "description", "status", "createdBy", "sortOrder")
SELECT 'roadmap_native_push',
       'App: push-beskeder (login-godkendelse m.m.)',
       'Native push i Android- og iPhone-appen. Kræver et Firebase-projekt (google-services.json) og en Apple Developer-konto (Push-capability + APNs-nøgle) samt en backend-rute til FCM/APNs-tokens (/api/push/subscribe tager i dag kun Web Push). Hooken findes: Device/ProfileNativeBridge.enablePush svarer "unsupported".',
       'IDEA', 'Claude',
       COALESCE((SELECT MAX("sortOrder") + 1 FROM "roadmap_items" WHERE "status" = 'IDEA'), 0)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "roadmap_items" ("id", "title", "description", "status", "createdBy", "sortOrder")
SELECT 'roadmap_native_passkeys',
       'App: Face ID/fingeraftryk-login',
       'Passkey-login i den native app. Kræver Apple Developer Team ID (Associated Domains + apple-app-site-association på hellocal.packroff.dk) og Android assetlinks.json + androidx.credentials. Knappen er skjult i appen, indtil det er sat op.',
       'IDEA', 'Claude',
       COALESCE((SELECT MAX("sortOrder") + 1 FROM "roadmap_items" WHERE "status" = 'IDEA'), 0)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "roadmap_items" ("id", "title", "description", "status", "createdBy", "sortOrder")
SELECT 'roadmap_native_stores',
       'App: udgivelse i App Store og Google Play',
       'Kræver Apple Developer Program (99 $/år) og Google Play Console (25 $). Derefter: signeringsnøgler, app-ikoner i alle størrelser, butikstekster/skærmbilleder, Health Connect-erklæring i Play Console og en release-workflow i .github/workflows/native.yml. Indtil da bygges debug-APK og iPhone-simulatorbuild i CI.',
       'IDEA', 'Claude',
       COALESCE((SELECT MAX("sortOrder") + 1 FROM "roadmap_items" WHERE "status" = 'IDEA'), 0)
ON CONFLICT ("id") DO NOTHING;
