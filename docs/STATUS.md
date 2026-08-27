# HELLO CAL — project status

Last updated: 2026-08-26

## Current checkpoint

- Repository: `Vandmollevej/hellocalvs2`
- Branch: `master`
- Latest published checkpoint: `27df53c` — isolated Synology production deployment.
- Production was updated to commit `10d64698a51ea550922be75f5c653ba034b5a2cb`
  on 2026-08-27 (Statistik real-data change). Backup taken first; `db` and
  `app` are healthy and `/api/health` returns `{"status":"ok"}`.
- Production was updated to commit `ef6e3da1d625ad2bd9366114c5ff2e6e469de20f`
  on 2026-08-27: Madvarer rows now link to the add-flow, and Søg shows real
  recent registrations instead of hardcoded example rows. Backup taken first;
  `db` and `app` are healthy and `/api/health` returns `{"status":"ok"}`.
- GitHub Actions built and published the production image successfully.
- The application is a Next.js 16 prototype with Prisma 7 and PostgreSQL.
- The stable UI checkpoint is committed as `ed2d27d`.

## Validation

- `git diff --check`: passed on 2026-08-26.
- `npm run lint`: passed on 2026-08-26.
- `npx tsc --noEmit`: passed after the camera implementation on 2026-08-26.
- The freshly compiled `/kamera?mode=produkt` development route returned HTTP
  200 after the camera implementation on 2026-08-26.
- `npm run build`: passed after the camera implementation on 2026-08-26 with
  TypeScript validation enabled.
- Prisma schema validation: passed on 2026-08-26.
- The initial SQL migration was generated and compared against the Prisma schema;
  they match.
- `compose.production.yaml` and the GitHub Actions workflow parse as valid YAML.
- The isolated Synology Compose stack is running with healthy application and
  PostgreSQL services; the migration service completed with exit code `0`.
- Production health, Open Food Facts lookup, registration snapshots, product
  search, database backup, restart, and persistence passed on 2026-08-26.
- The temporary Cloudflare hostname `hellocal-test.packroff.dk` was verified and
  then removed after the permanent route passed its public check.
- The permanent hostname `hellocal.packroff.dk` was added and verified publicly
  against the same isolated application on 2026-08-26.
- The production rollout for commit `7c8f6cb` completed successfully. The
  application returns `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet,
  noimageindex`, and its health endpoint remains healthy.
- The home screen now reads the demo user's registrations directly from
  PostgreSQL. Creating a registration, viewing it, and deleting it use the same
  database records instead of example rows.
- The Madvarer screen now reads the product list from PostgreSQL and searches
  those real products instead of showing example food rows.
- The responsive app shell now removes the simulated phone frame on phones and
  other coarse-pointer devices while preserving it for desktop presentation.
- The Stemme screen now places the live transcript above detected food entries,
  shows a pulsing stand-microphone indicator during AI processing, and lets the
  user edit daily-meal-style rows before approval.
- The Stemme screen now requests real microphone access and uses the browser's
  Danish speech-recognition service for live interim and final transcription.
  Structured food interpretation remains placeholder data until the AI service
  is connected.
- Calendar goal completion now uses a subtle 1 px green outline and light-green
  corner checkmark; the current date keeps the solid green highlight.
- The calendar now supports horizontal swipe and arrow navigation, a full
  month picker, and month, week, and list views from the top-right view menu.
- Every date opens a full day view. Its registration list reads real
  PostgreSQL registrations filtered by date, using the same `/api/registrations`
  data as the home screen.
- The home-screen key-metric wheel is interactive by vertical swipe, mouse
  wheel, adjacent-item tap, and keyboard arrows. Calories and protein are
  calculated from today's PostgreSQL registration snapshots; activity metrics
  remain prototype values until health integration is connected.
- The Kamera screen now requests the device's rear-facing camera. Product mode
  continuously scans real one-dimensional barcodes with ZXing, looks them up
  through the existing local/Open Food Facts endpoint, and opens the real
  add-product flow when a match is found. Manual barcode entry remains as a
  fallback.
- Meal mode now shows the live camera with the specified plate guide and can
  capture and retake a local photo preview. AI meal interpretation and upload
  remain separate future work.
- The production demo user was populated on 2026-08-26 with four non-duplicate
  food registrations for the current day (1,044 kcal and 10 g protein total),
  using the existing product lookup and registration APIs.
- The Statistik screen now reads the demo user's real registrations from
  PostgreSQL: the weekly-average kcal chart, average kcal/protein per day,
  days logged, and days the calorie goal was met are computed from actual
  data instead of hardcoded example numbers. The key-metric wheel now shares
  the same daily calorie/protein goal constants (`src/lib/goals.ts`) instead
  of duplicating them. Water, calories burned, and steps remain prototype
  values pending health-data integration.

## Deployment implementation

- `compose.production.yaml` defines the isolated `hellocal-v2` application,
  migration, and PostgreSQL 17 services.
- The new stack uses host port `3100` and persistent data below
  `/volume1/docker/App/hellocal-v2`.
- PostgreSQL has no published host port. Migrations must finish successfully
  before the application starts.
- `/api/health` verifies both the Next.js process and its database connection.
- GitHub Actions publishes both `latest` and immutable Git SHA image tags.
- GHCR authentication, first deployment, update, backup, rollback, and
  Cloudflare test cutover are documented in `docs/DEPLOYMENT.md`.

## Confirmed Synology inventory

- The stopped legacy HELLO CAL stack remains in
  `/volume1/docker/App/hellocal` and must not be changed.
- Its PostgreSQL 17 data is bind-mounted from
  `/volume1/docker/App/hellocal/postgres`.
- The legacy app, API, PostgreSQL, MinIO, and Redis containers were stopped when
  inspected on 2026-08-26.
- The existing `Cloudflare_Tunnel` container was running.

## Next work

1. Perform user acceptance testing through `hellocal.packroff.dk`, including on
   a phone.
2. Replace remaining prototype values (water, calories burned, steps) with
   real health-data integration once a source is chosen. Stemme's structured
   food interpretation remains placeholder pending the AI service.
3. Implement account authentication before inviting other users.
4. Copy verified database backups to a second storage location.
5. Keep the external SSH maintenance switch off outside maintenance windows.
