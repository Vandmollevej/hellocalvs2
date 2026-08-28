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
- Production was updated to commit `1d272a0a7dafb843d857831b58077d5e92031283`
  on 2026-08-27: the full `hello-cal-nye-rettelser.md` fix batch (FAB, bottom
  nav, wheel, madliste, stat-cards + unused-cards page, stat chart, barcode
  fix, nutrition-label OCR, manual create-product page). Backup taken first;
  no new migration in this release; `db` and `app` are healthy and both the
  local and public `/api/health` return `{"status":"ok"}`.
- Production was updated to commit `1c121ae6f7ba0444039d08a5946a6efa4e2aaf32`
  on 2026-08-27: the Stemme (voice) screen now calls a real
  `/api/ai/interpret-meal` endpoint (OpenAI `gpt-4o-mini`) instead of showing
  three hardcoded example rows. Each spoken ingredient is matched against the
  local product database first; unmatched ones fall back to the AI's own
  macro estimate, shown with an "AI-estimat" badge, and approving now saves
  real registrations via `/api/registrations` (which creates a new `PENDING`
  candidate product for unmatched, AI-estimated items). Needs
  `OPENAI_API_KEY` in `.env.production` — verified live with a direct
  `curl` to `/api/ai/interpret-meal` returning real structured items.
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

- 2026-08-27: Implemented the full batch of fixes from `hello-cal-nye-rettelser.md`
  (11 areas), run as parallel background agents and then reconciled by hand:
  - FAB (`AddButton.tsx`): removed the visible box/border/shadow — only the
    plus glyph renders (now `--hf-fab`-colored since the dark background box
    is gone; it was left white by mistake mid-batch and would have been
    invisible, caught and fixed during review). Drag/snap-to-edge behavior and
    its transparent same-size hit area are unchanged. `document.body` gets
    `select-none` toggled during drag so page text can't be selected.
  - Bottom nav (`AppScreen.tsx`): now `sticky bottom-0` in a `h-full
    overflow-hidden` shell so only the content area scrolls; the nav never
    moves with page content. Desktop phone-frame behavior preserved.
  - Wheel (`StatsWheel.tsx`): green circle untouched; values now offset
    progressively by distance from the active index (continuous curve/depth
    instead of binary prev/next), font-size/opacity scale continuously
    (fisheye), and drag position/snap animate continuously instead of
    jumping. Added an "Anretning" plate+cutlery stat icon.
  - Madliste (`DailyList.tsx`): thumbnail image is now centered in its box;
    "Oprettet" label removed (only "Kl. {time}" remains); calories always
    show as `{kcal} / 100 g` computed from `kcalSnapshot`/`amountGrams`; a
    `IconChevronRight` was added and the whole row stays one `Link`. No
    per-unit/serving-size field exists on `Product`/`Registration`, so the
    optional "Pr. stk." secondary line was not added — would need a schema
    change.
  - Statistik cards (`StatCardsGrid.tsx`, `src/lib/stat-cards.ts`): removed
    the "Færdig" button — edit mode now exits via a full-screen tap-outside
    backdrop (same pattern as `StatChart`'s dropdown) or by navigating away.
    The old inline "ubrugte kort" floating panel was replaced by a dedicated
    route, `src/app/statistik/ubrugte-kort/page.tsx`, grouped into the 5
    specified categories; only "Energi og makrofordeling" and "Aktivitet og
    øvrige data" currently have matching cards — "Kulhydrattyper og fibre",
    "Vitaminer", and "Mineraler" render with an empty-state note since no
    such stat types exist yet in this codebase (none were invented). Added
    `DEFAULT_ACTIVE_STAT_KEYS` export to `stat-cards.ts` (missing after the
    refactor, causing a build failure — fixed during review).
  - Statistik chart (`StatChart.tsx`, `statistik/page.tsx`): the "Kalorier"
    dropdown chevron now sits directly beside the label as one clickable
    row. The kcal series now plots deviation from `DAILY_KCAL_GOAL` around a
    "Mål · 0" center line (green under goal, dark over goal, matching the
    calendar's color convention). Weight has no goal field anywhere in the
    schema, so its series still plots raw values — implementing weight
    deviation would need a new `User`/`WeightEntry` target-weight field.
    Fixed a `p.deviation` type error (`normalize()` now returns the same
    shape as `normalizeDeviation()`) found during the build/type-check pass.
  - Barcode scanning (`kamera/page.tsx`): root cause was that the ZXing
    decode callback ignored its `error` argument, so any fatal decoder error
    (anything other than the expected per-frame `NotFoundException`/
    `ChecksumException`/`FormatException`) silently froze the camera with no
    feedback. Now surfaces `cameraStatus = "error"` (existing error overlay +
    retry button) on any real failure. Barcode format support was already
    correct (`MultiFormatOneDReader` covers EAN-13/UPC/Code39/128/ITF/RSS).
  - Nutrition-label photo scanning: this was entirely unbuilt (only
    `produkt`/`maaltid` camera modes existed). Added a third `naering` mode
    to `/kamera` with client-side OCR (`tesseract.js`, new dependency) via
    `src/lib/nutrition-ocr.ts`, parsing Danish nutrition-label keywords.
  - Manual product creation: neither the OCR flow nor the barcode
    "not found" fallback had anywhere to send the user — no manual
    create-product screen existed at all. Added
    `src/app/madvarer/nyt/page.tsx` as the one shared manual-create-product
    form (name + kcal/protein/carbs/fat per 100g → `POST /api/products` →
    `/tilfoej/[id]`). The `naering` OCR flow now writes its read values to
    `sessionStorage` and routes here instead of posting directly itself;
    the barcode "not found" state links here too; `/madvarer` also links
    here directly for a fully manual entry.
  - After reconciling all seven agents' concurrent edits: `npm run lint`,
    `npx tsc --noEmit`, and `npm run build` all pass clean (the `.next/static`
    `EPERM` lock from a concurrent dev server cleared after a retry).

- 2026-08-27: Added a `FRIDA` value on `ExternalProductSource` (Prisma
  migration `20260827180000_frida_product_source`) and a new
  `frida_import_state` table (migration `20260827190000_frida_import_state`)
  — neither yet applied to production. DTU Fødevareinstituttet's Frida
  database (Danish food composition data) has no reuse API on its own site
  (`fcdb.fooddata.dk` only exposes an undocumented internal API behind its
  own frontend), but its dataset downloads are published to DTU's official
  Figshare-based research-data repository (`data.dtu.dk`, DOI
  `10.11583/DTU.32312844` for v6.1), which *does* have a real, public,
  documented, unauthenticated API (`api.figshare.com`) — CC-BY 4.0 licensed.
  DTU Food's Figshare group id is `18053`.

  Added `scripts/frida-import` as a new always-on service (`frida-agent` in
  `compose.production.yaml`, same pattern as `scripts/image-agent`): it polls
  `api.figshare.com/v2/articles/search` (default every 24h,
  `FRIDA_AGENT_POLL_INTERVAL_SECONDS`) for the newest article titled "Danish
  Food Composition Database" under group 18053, checks `frida_import_state`
  for whether that Figshare article id was already imported, and if not,
  downloads its `.xlsx` file directly (no browser/manual step), parses the
  `Food` and `Data_Normalised` sheets (openpyxl) for the four core macros
  (Energi kcal/Protein/Kulhydrat difference/Fedt, ParameterIDs
  356/218/170/141), and upserts them into `products` as
  `externalSource='FRIDA'`, `status='APPROVED'`, no barcode — matched on
  (`externalSource`, `externalId`=Frida FoodID) so a new release updates
  existing rows instead of duplicating them. 1389 of 1390 Frida foods have
  all four values. Verified end-to-end locally against the live Figshare API
  (finds v6.1, downloads, parses 1389 foods) except the final Postgres
  write — this workstation has no reachable PostgreSQL (see
  `hellocal_no_local_db` memory). A static Frida attribution line was added
  to `/madvarer` per Frida's reuse terms. `npm run lint`, `npx prisma
  validate`, `npm run build`, and `compose.production.yaml`'s YAML all
  passed. The manually-downloaded xlsx originally placed at
  `scripts/frida-import/data/` is no longer needed by the running service
  (kept locally, gitignored) — the agent downloads directly from Figshare.

- 2026-08-27: Added an admin product/image approval UI (see
  `docs/DECISIONS.md`) at `products.hellocal.packroff.dk` — `/admin` (counts),
  `/admin/produkter` (approve/reject `PENDING` products), `/admin/billeder`
  (accept/reject the image-agent's suggested photos). First visit to that
  hostname goes to `/admin/setup` to create the one admin account
  (email + password + TOTP QR code); afterwards `/admin/login` →
  `/admin/verify` (TOTP). New `User.passwordHash`/`User.totpSecret` columns
  via Prisma migration `20260827200000_admin_auth` (not yet applied to
  production) and a new `ADMIN_SESSION_SECRET` env var (added to
  `.env.production.example` and `compose.production.yaml`, not yet set on the
  server). `npm run lint` and `npm run build` passed (the `.next` cache had
  to be cleared first — an `EPERM` on `.next/static` from a stale/concurrent
  lock, same class of issue noted elsewhere in this file; a clean rebuild
  succeeded). Not yet verified against a live database or browser — no local
  PostgreSQL is reachable from this workstation (see `hellocal_no_local_db`
  memory). **The `products.hellocal.packroff.dk` Cloudflare Tunnel public
  hostname still needs to be added** (same target as the existing
  `hellocal.packroff.dk` route, `http://192.168.1.90:3100`) — this requires
  the Cloudflare dashboard login/SSO, which was not something available to
  do unattended; the user needs to add it (Zero Trust → Networks → Tunnels →
  the existing `Server` tunnel → Public Hostname → Add a public hostname).

- 2026-08-28: Reworked the calendar day-detail view
  (`src/app/kalender/page.tsx`) per direct user feedback: the app's own
  header/bottom nav now stay visible behind it (`HfScreen`'s content wrapper
  is `relative` so the modal's `absolute inset-0` no longer escapes to the
  viewport); the header gained prev/next chevrons and a calendar icon
  (swipe still works too), and the Danish month name no longer gets
  wrongly capitalized (`capitalize` replaced with `first-letter:uppercase`).
  Removed invented copy ("Flot balance i dagens registreringer" etc.); an
  empty day now shows a plain gray "Ingen registreringer" beside the
  "Registreringer" heading instead of a bold box, and the bottom of the
  view now always shows "Mål: X kcal" plus remaining/overskredet kcal.
  The sleep visualization no longer disappears when the user has no
  sleep schedule set (falls back to a dummy 23:00–07:00 window) and is
  now a single continuous light-gray band with one draggable dark center
  handle instead of two edge handles; the whole hour grid is rotated so
  the day's wake-up hour is always the first row (`rotatedTop` in
  `kalender/page.tsx`). Each hour is now its own row showing a bold kcal
  total (when logged) and a chevron that opens a per-hour drill-down list
  (`HourEntriesOverlay`) with a time-separator between distinct timestamps.
  Long-pressing an empty hour row (1s) shows a "Tilføj" bar that opens
  `/madvarer` pre-filled with that hour, which now carries `date`/`time`
  through to `/tilfoej/[id]`; that page gained an editable time field.
  `POST /api/registrations` now accepts an optional `createdAt` override
  (`src/app/api/registrations/route.ts`). `npm run lint` passed clean.
  `npm run build`'s TypeScript check currently fails, but only on
  unrelated concurrent-session WIP (`api/products/lookup/[barcode]`,
  `api/profile/route.ts` — Prisma schema/allergen work in progress, not
  part of this change); re-run the build once that session's changes
  settle. Not yet verified live in the browser (no reachable local
  PostgreSQL, see `hellocal_no_local_db` memory) — verify the rotated
  sleep band, hour drill-down, and time-prefilled add flow against
  `hellocal.packroff.dk` next.

- 2026-08-28: Extended `/tilfoej/[id]` (add-product screen) per direct user
  feedback: the product image is now bigger (190px) and sits higher on the
  screen instead of vertically centered. Added a "Detaljer" underlined link
  with a chevron-down beside the kcal line that smooth-scrolls to a new
  details section below the amount stepper/Tilføj button, containing an
  editable "Energifordeling" (slider + tap-to-type-a-number, extracted from
  `stemme/page.tsx`'s `MacroBar` into a shared `MacroSliderBar` component),
  an "Allergener" line, and "Ingredienser". Product now has
  `ingredientsText`/`allergens`/`additives` fields (Prisma migration
  `20260828120000_product_nutrition_details`), populated from Open Food
  Facts' `ingredients_text`/`allergens_tags`/`additives_tags` when a barcode
  is looked up (`src/lib/openFoodFacts.ts`, `src/lib/allergens.ts` maps OFF
  tags to the 14 EU-mandated allergens). Allergens only render when the user
  has turned on "Vis allergener" in a new `/profil/indstillinger` page, which
  also lists all 14 allergens as individual on/off checkboxes
  (`User.showAllergens`/`allergenVisibility` on the same migration) and shows
  the required "Vi henter data fra 3. part..." disclaimer. When a product has
  E-numbers, a green "E" badge + "E-tilsætningsstoffer" link appears beside
  Detaljer and a full list renders in the details section; tapping one opens
  an `AdditiveInfoModal` (white card, 1px border, X to close, click-outside
  to close) with a short factual description from a new curated
  `src/lib/additives.ts` (~50 common E-numbers) plus a
  general-information/third-party-data disclaimer — not sourced from live
  external research, since no such feed exists yet. `POST /api/registrations`
  now accepts optional `proteinSnapshot`/`carbsSnapshot`/`fatSnapshot`
  overrides even when `productId` is given, so slider edits on this screen
  are actually saved. `npm run lint` and `npx prisma validate` passed;
  `npm run build`'s TypeScript check passed clean, but the build itself
  currently fails prerendering `/madvarer` — that page is mid-edit by a
  concurrent session (unrelated `useSearchParams`/Suspense issue, not part of
  this change) and should resolve once that session's changes land. Not yet
  verified live (no reachable local PostgreSQL, see `hellocal_no_local_db`
  memory) — verify the new Detaljer scroll, allergen toggle, and E-number
  modal against `hellocal.packroff.dk` once deployed, and apply the new
  migration.

- 2026-08-28: Corrected a prior mistaken instruction (see `docs/DECISIONS.md`):
  screens/headers fill the full viewport edge-to-edge (HelloFresh-style), and
  the profile/user-menu circle moved from the top-right to the top-left corner
  of the standard header (`TopBar.tsx`, `hf/ScreenHeader.tsx`) to leave room
  for a close-cross on closable pages. `npm run lint` passed (TypeScript build
  check passed clean); the production build still fails prerendering
  `/madvarer` for the same unrelated concurrent-session `useSearchParams`
  issue already noted above, not caused by this change.

- 2026-08-28: Three FAB/add-flow features per direct user request
  (`hello-cal-nye-rettelser.md`'s successor feedback). (1) Restored the green
  half-circle behind the tilføj-menu (`src/components/AddButton.tsx`),
  smaller than the pre-removal version and flush against the FAB's edge,
  shown while the menu is open. Replaced the old two-tap "open, then tap an
  option" flow with a press-and-drag gesture: pressing the FAB and dragging
  toward one of the five fanned-out actions (without lifting) highlights and
  enlarges the nearest one live, and releasing over it navigates straight
  there; a plain tap still opens/closes the menu as before, and tapping an
  option directly still works too. In the same pass, a concurrent session
  had already dropped the FAB's drag-to-reposition/edge-snap feature
  (`useFabPosition`, `FabPosition`) in favor of a fixed left-edge FAB — this
  session's work builds on that fixed-position version rather than
  reintroducing dragging. (2) Added a shared hand-authored
  `IconPlateCutlery` (`src/components/icons/PlateCutlery.tsx`: plate with a
  fork on the left and knife on the right, tabler-outline style) and pointed
  both the FAB's "Måltid" action and the wheel's "Anretning" stat
  (`StatsWheel.tsx`) at it, replacing the old single-sided
  plate+bundled-cutlery icon and the plain crossed fork/knife glyph.
  (3) Built the "Egne retter" (own dishes) feature end to end against the
  `Dish`/`DishIngredient` Prisma models that already existed in schema but
  had no UI/API: a pot icon (`IconSoup`) FAB action opens a new
  `/opret-ret` page where ingredients are added by reusing the existing
  single-food add flow (search/barcode-scan/OCR-photo/manual-create) — each
  now accepts a `?for=ret` query param that swaps `/tilfoej/[id]`'s primary
  button to "Tilføj til ret", which appends the product to an in-progress
  ingredient list kept in `sessionStorage` (`src/lib/dish-draft.ts`) instead
  of registering it, then returns to `/opret-ret`. Saving there posts to the
  new `POST /api/dishes` (creates the dish + ingredients) and clears the
  draft. `GET/POST /api/dishes` and `GET /api/dishes/[id]` were added, and
  `POST /api/registrations` now also accepts `{ dishId, amountGrams }`,
  computing the snapshot from the sum of the dish's ingredients scaled to
  the logged amount — no new migration needed, `dishes`/`dish_ingredients`
  were already part of the initial migration. While fixing the build, also
  wrapped `/madvarer`'s `useSearchParams()` in a `Suspense` boundary (the
  concurrent-session issue flagged in the two entries above) since it was
  blocking verification of this work. `npm run lint` and `npm run build`
  both passed clean. Not yet verified live in the browser (no reachable
  local PostgreSQL, see `hellocal_no_local_db` memory) — verify the new
  drag-select gesture, the plate/cutlery icon, and the full opret-ret ->
  save -> dish flow against `hellocal.packroff.dk` once deployed.

- 2026-08-28: Added an E-number reference database at
  `scripts/e-numre/data/e_numre.csv` (343 rows, the full official EU-approved
  E-number range E100-E1521, one row per number/sub-number) with columns
  E-nummer, Internationalt navn, Dansk kaldenavn, Funktion, Risici,
  Forskningsafsnit, Link, Kilde. Compiled by 8 parallel research agents
  cross-checking EFSA opinions, the EU additives Annex II/III, and UK FSA's
  mirrored approved-additives list; conservative "ingen dokumenteret
  EU-specifik advarsel" wording used wherever no specific documented risk was
  found (no invented risks/studies). A Python screening tool,
  `scripts/e-numre/scan.py`, takes free text (e.g. an ingredient
  declaration) and reports which E-numbers it contains plus any not present
  in the local database. Not yet wired into the app (no UI, no product-page
  integration, no database table) — currently a standalone CSV +
  command-line tool only.

- 2026-08-28: Fixed the bottom nav so only 4 icons are ever visible at once,
  per direct user report that adding more icons kept cramming them into one
  row (`src/components/BottomNav.tsx`). Active icons are now paginated into
  fixed 4-slot pages (a `grid-cols-4` per page, so empty slots stay static
  gaps rather than the row re-centering); small dots above the bar show the
  current page when there's more than one. A horizontal drag on any icon (or
  an empty slot) that isn't a long-press swipes between pages, following the
  finger with a rubber-band edge and snapping on release — like a carousel,
  intentionally lighter-weight than an iOS-style hold-to-page delay since the
  user offered that as an acceptable simpler alternative. Long-press-to-reorder
  is unchanged (still reorders by nearest-icon-center, now scoped to only the
  current page's icons); dragging a reordered icon to within 36px of the bar's
  left/right edge for 650ms now flips to the adjacent page (iOS springboard
  style), so icons can be dragged across pages. `npm run lint` and
  `npx tsc --noEmit` passed clean. `npm run build` still fails prerendering
  `/madvarer` on the same unrelated concurrent-session issue noted above
  (not caused by this change). Verified live against the dev server by
  injecting 5-8 active icons via `localStorage` and driving synthetic
  pointer events: paging renders exactly 4 buttons per page with the extra
  icon alone on page 2 (3 static empty slots beside it), the page dots and
  `aria-hidden`/`translateX` state update correctly, a horizontal drag flips
  the visible page, and long-press still enters jiggle/edit mode. Not
  re-verified against real touch input on a phone.

- 2026-08-28: Wired the E-number reference database into the real database
  instead of a standalone CSV. Added an `Additive` Prisma model (table
  `additives`, migration `20260828130000_additives`, not yet applied to
  production) holding the 343 rows from `scripts/e-numre/data/e_numre.csv`
  (E100-E1521, sourced from EFSA/EU-forordning 1333/2008). Added
  `scripts/e-numre/import_to_db.py` (psycopg2, same DATABASE_URL convention as
  `scripts/frida-import`) to upsert the CSV into the table — run it after the
  migration is deployed. Added `GET /api/additives` returning the full table.
  `src/lib/additives.ts` now fetches from that endpoint (client-side cached)
  instead of a hardcoded ~50-entry map; `AdditiveInfoModal` and the
  E-tilsætningsstoffer list on `/tilfoej/[id]` were updated to the new async
  API and the modal now also shows Risici/Forskning/Link, not just a one-line
  description. `npx prisma validate`, `npm run lint`, and `npm run build` all
  passed. Not yet verified live (no reachable local PostgreSQL, see
  `hellocal_no_local_db` memory) — after deploying, run
  `npm run db:deploy` then `python scripts/e-numre/import_to_db.py` with
  `DATABASE_URL` set, and verify `/api/additives` and the product-page
  additive list/modal against real data.

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
7. Deploy the two Frida migrations (`20260827180000_frida_product_source`,
   `20260827190000_frida_import_state`) and the new `frida-agent` compose
   service to production (new service in `compose.production.yaml`, needs
   `docker compose up -d --build frida-agent` alongside the normal migration
   step — see the 2026-08-27 Frida entry above). It will then import the
   1389 Frida products fully on its own on first poll; no manual file
   handling needed on an ongoing basis.
8. Deploy the admin-auth migration (`20260827200000_admin_auth`), set a real
   `ADMIN_SESSION_SECRET` in `.env.production`, and add the
   `products.hellocal.packroff.dk` Cloudflare Tunnel public hostname (points
   to the same `http://192.168.1.90:3100` target as `hellocal.packroff.dk`).
   Then open `https://products.hellocal.packroff.dk/admin/setup` once to
   create the admin account.
