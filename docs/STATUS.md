# HELLO CAL — project status

Last updated: 2026-08-27

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
- USDA FoodData Central is now implemented as the second external barcode
  fallback after Open Food Facts. Imported products retain `externalSource`,
  `externalId`, and `sourceCheckedAt`, remain `PENDING`, and are stored in the
  local product database so registration snapshots stay authoritative. The
  fallback is enabled only when the server has `USDA_FDC_API_KEY`; the example
  environment and production Compose service include that variable. A live
  lookup through the new module returned the exact GTIN, FDC id, brand, and
  kcal/protein/carbohydrate/fat values for the USDA test product
  `737628064502`. Prisma format/validation, `npm run lint`, and `npm run build`
  passed on 2026-08-27. Migration
  `20260827170000_external_product_sources` still needs to be deployed with
  the application and the real USDA key added to Synology before production
  fallback becomes active.

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

- Added and deployed `scripts/image-agent`: a Python service (Docker) that
  polls for brandless, approved products missing an image, searches Google
  Custom Search for a high-resolution candidate, removes the background with
  `rembg`, and writes the result as `Product.pendingImageUrl`
  (`imageStatus = PENDING`). It never sets the live `imageUrl` directly —
  admin approval to promote it is still future work (no UI yet). Added via
  `compose.production.yaml` (new `image-agent` service, shared
  `data/product-images` volume) and Prisma migration
  `20260827120000_product_image_status`. The Google Programmable Search
  Engine (`hellocal-images`, cx `f25aa8ec646534e07`) is scoped to
  `commons.wikimedia.org` only — Google no longer allows new engines to
  search the whole web, and Wikimedia Commons images are freely licensed,
  avoiding copyright risk from scraping arbitrary Google Images results.
  `DATABASE_URL`'s Prisma-only `?schema=public` query param is stripped
  before use since psycopg2/libpq rejects it. Verified running in production
  on 2026-08-27 (`no products waiting for an image` — connects fine, just no
  current candidates). The server's `compose.production.yaml` and
  `scripts/image-agent/` had to be updated by hand outside the normal
  `HELLOCAL_TAG` bump flow, since this was the stack's first new service —
  ordinary code changes still only need the 3-step controlled update.

- The Statistik screen chart now supports multiple dataserier (kalorier +
  vægt from `WeightEntry`), each independently normalized, with a legend and
  a small non-fullscreen dropdown (persisted to `localStorage`) to choose
  which series show. The stat-card grid below it is now modular: long-press
  enters an edit mode (cards wobble), cards can be drag-reordered or dragged
  into/out of a scrollable "ubrugte kort" panel (positioned above/below by
  available space), and a draggable "Overskrift" template creates a
  renameable full-width divider row. Layout is persisted to `localStorage`
  (`src/components/StatChart.tsx`, `src/components/StatCardsGrid.tsx`,
  `src/lib/stat-cards.ts`). `npm run lint` passed; `npm run build` could not
  be run — a concurrent session's dev server holds a lock on `.next/static`
  (`EPERM: operation not permitted, unlink`). Re-run the build once no other
  session has the dev server active.
- The home-screen FAB (`src/components/AddButton.tsx`) is now a dark
  (`--hf-fab`) rounded-square button matching the HelloFresh reference —
  thin white plus, no circle/outline/shadow, ~64px, 14px corner radius.
  Long-pressing it enters drag mode with a ghost preview and a snap outline;
  releasing snaps it to the left or right edge at the chosen vertical
  position, and the choice persists via `localStorage`
  (`src/components/AddButton.tsx`'s `useFabPosition`, a
  `useSyncExternalStore` hook). `StatsWheel` and `OnboardingSpotlight`
  (`src/components/StatsWheel.tsx`, `src/components/OnboardingSpotlight.tsx`)
  now read the FAB's side and always render on the opposite side, sliding
  when it changes. `npm run lint` passed; `npm run build` could not be run
  for the same concurrent-session `.next/static` lock as above. Verified
  interactively against the other session's already-running dev server:
  computed FAB styles (64x64, 14px radius, `rgb(35,35,35)`, no shadow), a
  simulated long-press drag correctly showed the ghost/snap outline and
  committed the side + vertical offset, and `StatsWheel` swapped sides in
  response. The concurrent session's own edits caused frequent Fast Refresh
  reloads and some 503s on that shared dev server during testing, which made
  one reload-persistence check unreliable; re-verify that specific case
  (reload the page after moving the FAB, confirm it stays put) once no other
  session is editing concurrently.

- The bottom nav icons are now larger (30px, matching HelloFresh's bottom-tab
  proportions from the reference screenshots) and no longer sit inside a
  background shape, matching HelloFresh's own plain-icon tab bar. Long-pressing
  any bottom-nav icon enters an iOS-style jiggle edit mode: active icons can be
  dragged to reorder or removed with a small ×, and a panel slides up above the
  bar listing unused functions (Kamera, Søg, Stemme, Profil) that can be
  dragged (or tapped) into the bar. The arrangement persists in `localStorage`
  per browser, not in the database.

- The calendar month/week views now show a calm red marker on days the goal
  was missed (alongside the existing green marker for days it was met), and
  the month footer below the grid replaces the old legend with a monthly
  status summary: whether the user is within their calorie goal (and by how
  much), a 7-day over/under summary, and a "X of Y days" goal count. A green
  star streak badge with a day count appears once the goal has been met at
  least 5 days running and disappears immediately the streak breaks
  (`src/app/kalender/page.tsx`, `MonthlyStatus`). `daily-totals.ts` now
  exports `groupByDay` for reuse. This reverses the prior "no red markers, no
  streaks" principle per the updated `docs/SPECIFICATION.md`/`docs/UI.md`;
  see `docs/DECISIONS.md` (2026-08-27). `npm run lint` passed (only
  pre-existing unused-var warnings in `kalender/page.tsx`); `npm run build`
  still could not be run — the `.next/static` `EPERM` lock from a concurrent
  session persists.

- SET-01 (Opsætningsguide, `docs/UI-KRAVSPEC-2026-08-27.md` §8): implemented.
  A fullscreen `OnboardingWizard` (`src/components/OnboardingWizard.tsx`)
  shows on the home screen for a user who hasn't completed or dismissed it,
  with a progress bar ("Trin X af Y") and Næste / Påmind mig senere / Vis
  ikke igen (the last only appears after "Påmind mig senere" was used once).
  Implements the three specified questions: sleep pattern → shift-work/night
  work → daily work-hours-vs-sleep-times logging preference; smartwatch/health
  import ("Opsæt nu" as the single primary action, otherwise "Næste"); and
  work-hours-in-calendar. New `User` fields (`dailyLogPreference`,
  `workHoursInCalendarEnabled`, `healthImportRequested`, `onboardingStep`,
  `onboardingCompletedAt`, `onboardingRemindLaterAt`, `onboardingDismissed`)
  were added via Prisma migration `20260827160000_onboarding_wizard`.
  `/api/profile` PATCH now accepts these fields. Progress and the health
  import toggle are also reachable from Profil (`Sundhedsdata (smartwatch)`,
  and a per-weekday work-hours-in-calendar checkbox on `/profil/soevn`); the
  guide can be restarted from Indstillinger. Only the three specified
  questions exist — the "10 trin" example step count in the spec is
  illustrative, and remaining onboarding content (goals/activity level etc.)
  is unspecified pending further product decisions; see `docs/DECISIONS.md`
  (2026-08-27). `npm run lint` and `npm run build` passed. The migration
  could **not** be applied — no local PostgreSQL is reachable at
  `localhost:5432` in this environment (no docker CLI, no local compose file)
  — and the wizard could not be exercised against live data as a result
  (`/api/profile` returned 503 on the shared dev server too). Apply
  `npx prisma migrate deploy` and verify the wizard end-to-end once a
  reachable database (local or the Synology deployment pipeline) is
  available.

## Design checklist (docs/DESIGN_V2.md)

Pr. 2026-08-27, mod den udvidede UI-tjekliste i `docs/DESIGN_V2.md`:

- CAL-01/02/03/04 (månedsvisning, månedsstatus, listevisning, landskab/dagsvisning): implementeret i tidligere checkpoints.
- CAL-05 (søvnvisualisering: grå baggrund for sovetid + langt-tryk-og-træk-justering med "kun denne dato"/"standardmønster") is now implemented in `src/app/kalender/page.tsx` (`SleepBands`, `SleepBoundaryHandle`), using the existing `SleepSchedule`/`WorkShift` models and `/api/sleep-schedule`, `/api/work-shifts` endpoints. `npm run lint` and `npm run build` passed. Live/browser verification against the running dev server was not possible — `/api/health` returned 503 while a concurrent session had the database down; re-verify visually (drag the sleep/wake boundary in landscape and in day view, confirm the "kun denne dato"/"standardmønster" prompt and persistence) once the database is back up.
- USR-01/USR-02 (søvnmønster, skiftende arbejdstider): implementeret (`/profil/soevn`, `/api/profile`).
- SET-01 (opsætningsguide): delvist implementeret (`OnboardingWizard`, kun de 3 specificerede spørgsmål).
- STA-01/STA-02 (statistik-graf med flere dataserier, modulære statistik-kort): implementeret.
- FOOD-03 (accordion/chevron) has an existing `AccordionCard` component; not yet re-verified against `DESIGN_V2.md` §14's exact chevron spec.
- NAV-01 (bundmenu-ikonstørrelse/omarrangering) and FAB-01 (FAB-visuelt redesign/side-bytte med statushjul) are implemented (see the entries above dated 2026-08-27 in this file).
- DES-01 (statistik-kort HelloFresh-visuel), FOOD-01/FOOD-02 (madvareside hero/tags/metadata/CTA på `/madvarer`): not yet implemented — no matching UI found in the codebase.
- DES-02 (fælles palette-/komponent-konsistens-audit across the whole app against `DESIGN_V2.md` §15): not yet done as a dedicated pass.

## Next work

1. Implement the pending UI/design requirements in
   [docs/UI-KRAVSPEC-2026-08-27.md](UI-KRAVSPEC-2026-08-27.md) (calendar status
   markers, list/week view, sleep visualization, onboarding wizard, bottom nav
   editing, FAB, statistics cards, food page, accordion/chevron). None of it is
   implemented yet; mark items done here as they land.
2. Perform user acceptance testing through `hellocal.packroff.dk`, including on
   a phone.
3. Replace remaining prototype values (water, calories burned, steps) with
   real health-data integration once a source is chosen. Stemme's structured
   food interpretation remains placeholder pending the AI service.
4. Implement account authentication before inviting other users.
5. Copy verified database backups to a second storage location.
6. Keep the external SSH maintenance switch off outside maintenance windows.
