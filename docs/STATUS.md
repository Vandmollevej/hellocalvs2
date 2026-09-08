# HELLO CAL — project status

Last updated: 2026-09-07

## In progress (2026-09-03): pointsystem, betaling, besked-automatisering, admin-brugere

Large multi-part feature, approved via plan mode and then expanded further
mid-implementation by the user across several follow-up messages. Full
requirement list: `docs/POINTS_MESSAGING_CHECKLIST.md`. Architectural
decisions: `docs/DECISIONS.md` (2026-09-02/03 entries).

Done so far:
- Prisma schema extended (points ledger, bug reports, message
  templates/outbound queue, notification preferences, push subscriptions,
  forwards, subscriptions/payment methods, admin audit log, `User.locale`,
  `User.referralCode`, `User.forgottenAt`, `Product.approvalToken`/
  `escalationSentAt`). Two migrations were **hand-written** (`prisma/migrations/
  20260902020000_points_messaging_forwards`, `.../20260902030000_payments_referrals_admin_users`)
  because there is no local database on this workstation to run
  `prisma migrate dev` against — validated with `prisma validate` +
  `prisma generate` + `tsc --noEmit` only, NOT yet applied to a real
  database. **Must be reviewed and applied via `prisma migrate deploy` on
  the next Synology release, and verified there before trusting the SQL.**
- Core lib layer: `src/lib/points.ts` (ledger, 50/month forward cap, 300→1
  free month redemption), `src/lib/messaging.ts` (template rendering +
  notification-preference gating + `OutboundMessage` queue), `src/lib/mailer.ts`
  (nodemailer, no-op until `SMTP_*` env vars exist), `src/lib/push.ts`
  (web-push, no-op until `VAPID_*` env vars exist), `src/lib/gdpr.ts`
  (anonymize, not hard-delete), `src/lib/scheduler.ts` + root `instrumentation.ts`
  (in-process 48h escalation + queue flush, DB-driven, not OS-cron —
  deliberately not Synology-specific per user instruction).
- `src/lib/referrals.ts` and `POST /api/auth/register` rewritten: referral
  attribution now works via `User.referralCode` in the signup body: both
  referrer and new user get 300 points (not a direct free month) once the
  existing 3-month wait passes.
- **Blocking gap found and fixed**: every regular-user route in the app used
  a single shared `getDemoUser()` (`src/lib/demo-user.ts`) — there was no
  real per-user login/session at all (matches the pre-existing "Next work"
  #4 item below). Points, bug reports, forwarding between two people,
  referral attribution, and per-user notification preferences are all
  meaningless without distinct logged-in users, so this had to be built
  first: `src/lib/user-auth.ts` + `src/lib/session.ts` (JWT session cookie,
  same pattern as `src/lib/admin-auth.ts`, deliberately separate
  cookie/secret from the admin session), `POST /api/auth/login`,
  `POST /api/auth/logout`, and `POST /api/auth/register` now sets the
  session cookie on success. `/login` (previously a non-functional mockup
  with a permanently disabled button) now has a real working email/password
  form; `/signup` now captures `?ref=<code>` and passes it through. Existing
  routes that still use `getDemoUser()` were deliberately left as-is — fully
  migrating the rest of the app to real sessions is a larger, separate piece
  of work, not bundled into this feature.

**Update 2026-09-03, later same day: feature is code-complete.** Everything
in `docs/POINTS_MESSAGING_CHECKLIST.md` is implemented — product-approval
points hooks + admin bruger-indsendte/auto-importerede tabs, bug reports end
to end, `/betingelser` + banner updates, login-free
`/admin/approve/[token]` mail-approval page (exempted from the admin-session
middleware gate via its unguessable token instead), "Besked automatisering"
admin tab (template editor + outbound log), `/profile/notifications` (two
entry points), "Invitér en ven" UI, "Videresend til en ven" end to end
(claim-time cross-send abuse check, flag surfaced in the existing Advarsler
page), "Betaling" page (provider-agnostic, no raw card fields — see
`docs/DECISIONS.md` for why), admin "Brugere" page (cross-host impersonation
via a 2-minute handoff token, GDPR anonymize, payment/newsletter overview),
admin DA/EN switch (nav + new-page titles; older admin pages stay Danish-only
for now). A third migration was added:
`prisma/migrations/20260902040000_product_created_by_user` (adds
`Product.createdByUserId`, needed so points can be attributed to whoever
actually submitted a product). `npm run lint` and `npm run build` are both
green against the full new surface (verified repeatedly as each piece was
added, most recently after the i18n switch).

**Not done, and out of scope for this pass:**
- No browser verification anywhere — this workstation has no local database
  (see "No local DB" note elsewhere in this file), so nothing has been
  clicked through in a real browser yet, only compiled/typechecked. Do that
  after deploy, per the checklist's verification section.
- `ACCOUNT_CREATED`/`EMAIL_VERIFICATION`/`PASSWORD_RESET` message templates
  exist but nothing calls `queueMessage()` for them yet (forgot-password
  doesn't exist as a feature at all). Only escalation/approval/points/forward
  events are actually wired.
- No real payment method can be added yet — deliberate, see `docs/DECISIONS.md`
  (no PSP chosen, and raw card fields are never appropriate without one).

**New environment variables this feature needs in `.env.production`** (not
added to `.env.production.example` in this pass — that file already has an
unrelated uncommitted addition in progress, `PASSIO_API_KEY`, so a separate
edit avoids colliding with it; fold these in next time that file is touched):
- `USER_SESSION_SECRET` — required, same rules as `ADMIN_SESSION_SECRET`
  (long random secret, falls back to `ADMIN_SESSION_SECRET` if unset, but a
  distinct value is safer). Changing it invalidates all regular-user sessions.
- `ADMIN_NOTIFICATION_EMAIL` — where 48h escalation mails go; defaults to
  `peter@packroff.dk` if unset.
- `ADMIN_BASE_URL` — defaults to `https://adminhellocal.packroff.dk`; only
  needed if that hostname ever changes.
- `APP_BASE_URL` — defaults to `https://hellocal.packroff.dk`; used to build
  the impersonation handoff link.
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` —
  optional; email sending stays a no-op (queued, never sent) until all four
  required ones are set.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_CONTACT_EMAIL` —
  optional; generate with `npx web-push generate-vapid-keys`. Push sending
  stays a no-op until the two keys are set.

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
- Product search (`/api/products`) now supplements local results with a live
  Open Food Facts text search (`src/lib/openFoodFacts.ts:searchOpenFoodFacts`),
  limited to Danish products (GS1 barcode prefix `57` + `countries_tags_en`
  filter) when local matches are fewer than 10. Matches are imported as
  `PENDING` products (same pattern as barcode lookup) so repeat searches for
  the same term don't re-fetch OFF. No bulk import of the OFF catalog exists
  or is planned — this is a live per-search fallback. `npm run lint` and
  `npm run build` passed on 2026-08-30.
- Meal-photo mode (`/camera?mode=meal`) is wired up end to end: capturing a
  photo now calls `/api/ai/analyze-meal-photo`, which sends it to Passio
  Nutrition-AI (`src/lib/passio.ts`) for plate segmentation, checks each
  ingredient against the local product database (same pattern as
  `interpret-meal`), and returns an editable list the user can trim before
  saving via `/api/registrations`. HelloFresh recipe matching is unchanged
  and still never calls Passio — only the general "scan a plate" flow does.
  Requires `PASSIO_API_KEY` (get one at accounts.passiolife.com); not yet set
  on Synology, so this is untested against the live Passio API. The detailed
  visual overlay/uncertain-ingredient UI from `docs/AI.md` is not built —
  this is a simple review list only. `npm run lint` and `npm run build`
  passed on 2026-09-03.

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
  `docs/DECISIONS.md`) at `adminhellocal.packroff.dk` — `/admin` (counts),
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
  memory). **The `adminhellocal.packroff.dk` Cloudflare Tunnel public
  hostname still needs to be added** (same target as the existing
  `hellocal.packroff.dk` route, `http://192.168.1.90:3100`) — this requires
  the Cloudflare dashboard login/SSO, which was not something available to
  do unattended; the user needs to add it (Zero Trust → Networks → Tunnels →
  the existing `Server` tunnel → Public Hostname → Add a public hostname).

- 2026-08-28: Added passkey (WebAuthn/Face ID) login for the admin account
  as an alternative to password + TOTP (see `docs/DECISIONS.md`).
  `@simplewebauthn/server` and `@simplewebauthn/browser`; new `Passkey`
  table via Prisma migration `20260828170000_admin_passkeys` (not yet
  applied to production, same as the other pending admin-auth migration).
  `/admin/setup` now signs the new admin straight into a session after TOTP
  confirmation instead of sending them to `/admin/login`, so they land on
  the new `/admin/passkeys` page and can add a passkey (e.g. their iPhone's
  Face ID via iCloud Keychain) immediately. `/admin/login` gained a
  "Log ind med Face ID / passkey" button for a usernameless/discoverable
  login — a verified passkey grants a full session directly, skipping the
  separate TOTP step. `npm run lint` and `npm run build` passed. Could not
  be exercised end-to-end — no WebAuthn-capable browser/authenticator is
  available on this workstation and no local PostgreSQL is reachable (see
  `hellocal_no_local_db` memory); verify the whole flow (add a passkey,
  then log in with only Face ID) from an iPhone once deployed.

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

- 2026-08-28: Started the Integrationer/sport/vægt-AI/kalender-gestures/
  statistik/indstillinger batch (see `docs/DECISIONS.md` for the health-API
  strategy the user chose). Checkpoints 1-4 done so far:
  - **Checkpoint 1 (datamodel):** new Prisma models `Integration`
    (userId+provider unique, OAuth token/status fields) and `Activity`
    (sportType/startedAt/durationMinutes/caloriesBurned/source), plus
    `WeightEntry.shoes` (`ShoesState`: ON/OFF/UNKNOWN) and
    `WeightEntry.source` (`WeightSource`: MANUAL/FITBIT/WITHINGS). Migration
    `20260828140000_integrations_activity_weight_source` (hand-written, no
    local Postgres to run `prisma migrate dev` — see `hellocal_no_local_db`
    memory).
  - **Checkpoint 2 (Integrationer-side + Fitbit/Withings OAuth):** new
    `src/lib/integrations.ts` (provider catalog: only FITBIT/WITHINGS are
    `connectable: true`; GARMIN/APPLE_HEALTH/GOOGLE_HEALTH render as static
    "kommer snart" cards) and `src/lib/integrations/{fitbit,withings}.ts`
    (real OAuth2 authorize/token-exchange/refresh + activity/weight fetch
    functions against the documented Fitbit Web API and Withings Health
    API). Routes: `GET /api/integrations`, and per-provider
    `connect`/`callback`/`disconnect`/`sync` under
    `/api/integrations/{fitbit,withings}/`. New page
    `src/app/settings/integrationer/page.tsx`, linked from a new
    "Integrationer" row in `src/app/settings/page.tsx`. New env vars
    (`FITBIT_CLIENT_ID/SECRET`, `WITHINGS_CLIENT_ID/SECRET`,
    `INTEGRATIONS_REDIRECT_BASE_URL`) added to `.env.production.example` and
    `compose.production.yaml` — **not yet set on the server**; the user needs
    to create developer apps at `dev.fitbit.com` and
    `developer.withings.com` (self-serve) before either integration can be
    tested live. Garmin needs separate partner approval (instructions were
    given to the user directly in chat, not stored in a doc).
  - **Checkpoint 3 (kalender sportsikon):** `kalender/page.tsx` now fetches
    `/api/activities` and shows each hour's sport icon
    (`src/lib/sport-icons.ts`, reused from `@tabler/icons-react`) plus its
    bonus calories in green (`+X kcal`) beside the existing kcal total.
  - **Checkpoint 4 (statistik sport-blokke):** `computeStatCards()`
    (`src/lib/stat-cards.ts`) now accepts an optional `activities` list and
    appends one dynamic `sport:<type>` card per sport type present;
    `statistik/page.tsx` and `statistik/ubrugte-kort/page.tsx` only pass
    activities through (and only show the new "Sport og aktivitet" category)
    when at least one connectable integration is `CONNECTED`.
  - `npm run lint`, `npx tsc --noEmit`, and `npm run build` all passed after
    checkpoint 4 (the `.next/static` `EPERM` lock from a concurrent session
    cleared on retry, same known issue as prior entries in this file). Not
    yet verified live (no reachable local PostgreSQL, and no real Fitbit/
    Withings credentials exist yet to exercise the OAuth flow end-to-end).
  - **Checkpoint 5 (vægt-guide + Trendvægt):** `/profil/vaegt-kalibrering`
    gained a fourth "Med sko"/"Uden sko" segmented control
    (`WeightEntry.shoes`), same pattern as the existing clothed/toilet/meal
    controls. New `src/lib/weight-trend.ts` computes an AI-estimated
    "Trendvægt" on the fly (separate exponential smoothing for morning vs.
    evening weigh-ins, nudged down when food was logged within ±2h) —
    plain TypeScript, not a Python/ML service (see `docs/DECISIONS.md`),
    never stored as its own row, and only shown once ≥5 samples exist. It
    now renders as a dashed third series on the Statistik chart
    (`StatChart.tsx` gained an optional `dashed` field) and as a small line
    under the weight field on Profil.
  - **Checkpoint 6 (kalender-gestures):** new shared `src/hooks/useLongPress.ts`
    (the 7 pre-existing hand-rolled long-press copies elsewhere in this
    codebase were left alone — out of scope). The day-detail timeline
    (`kalender/page.tsx`) now supports a two-finger vertical drag to zoom the
    hour scale up to 4× (persisted per-browser in `localStorage`), revealing
    15-/5-minute gridlines and, once zoomed, a draggable marker per
    registration (`DraggableEntryMarker`): a plain tap opens the
    registration, a ½s hold arms "move" mode showing a live `HH:MM · title`
    label, and dragging then releasing retimes it via a new
    `PATCH /api/registrations/[id]`. At the default (unzoomed) level the
    timeline is visually unchanged from before. See `docs/DECISIONS.md` for
    how this refines the older, never-implemented-for-calendar-rows
    "long-press = add new registration" rule.
  - **Checkpoint 7 (statistik intradag-kurve + måltids-AI):** new
    `src/components/IntradayKcalChart.tsx` renders a smooth (not bar) curve
    of average kcal by half-hour bucket across 00-24, below the existing
    Kalorier/vægt chart on `/statistik`. New `src/lib/meal-time-classifier.ts`
    buckets registrations into morgenmad/frokost/aftensmad by fixed
    time-of-day windows (a deliberately simplified v1 of `docs/AI.md`'s
    fuller hverdag/weekend/fødevaretype profiling) and shows the average
    time+kcal per meal as analytical text only — no registration is
    auto-tagged.
  - **Checkpoint 8 (indstillinger):** `/settings` now has a "Betaling" row as
    its very first item (links to a new placeholder `/settings/betaling` —
    no payment/subscription backend exists yet) and a green "Invitér en ven"
    bar at the bottom ("– Så får I begge en måned gratis") that uses
    `navigator.share` (clipboard fallback) — purely a share action, since
    there is no account/payment system yet to credit a reward against (see
    `docs/DECISIONS.md`).
  - `npm run lint`, `npx tsc --noEmit`, and `npm run build` all passed clean
    after checkpoint 8 — full route list built successfully (50 routes,
    including all new `/api/integrations/*`, `/settings/integrationer`,
    `/settings/betaling`). Not yet verified live in a browser (no reachable
    local PostgreSQL, see `hellocal_no_local_db` memory) and no real
    Fitbit/Withings developer credentials exist yet — verify the full batch
    end-to-end against `hellocal.packroff.dk` once deployed: weight-guide
    shoes field, Trendvægt display, two-finger timeline zoom + entry
    drag-to-retime, the new intraday chart, and the Betaling/Invitér rows.
    Apply the new migration
    (`20260828140000_integrations_activity_weight_source`) and set the new
    env vars (see `.env.production.example`) before that.
  - **Checkpoint 9 (HealthKit/Health Connect prep, added after the user
    relayed a ChatGPT architecture discussion):** see the 2026-08-28
    "HealthKit/Health Connect as the future integration hub" entry in
    `docs/DECISIONS.md` for the full reasoning. New `DeviceToken` and
    `HealthMetric` Prisma models (migration
    `20260828160000_healthkit_ingest_prep`, also extends `WeightSource`/
    `ActivitySource` with `APPLE_HEALTH`/`GOOGLE_HEALTH`); new
    `POST/GET /api/integrations/healthkit/tokens`,
    `DELETE .../tokens/[id]`, and a bearer-token-authenticated
    `POST /api/integrations/healthkit/ingest` (`src/lib/device-tokens.ts`
    for the SHA-256 hashing); new `GET /api/health-metrics`. The
    Integrationer page (`src/app/settings/integrationer/page.tsx`) gained a
    device-token management section (generate/list/revoke), and the Apple
    Health/Google Health cards are no longer fully dimmed (marked
    `ingestOnly` in `src/lib/integrations.ts`) since they now have a real,
    working action even without a companion app existing yet. The three
    previously-hardcoded Statistik placeholder cards (steps/water/burned)
    now read real `HealthMetric` averages once any exist. New
    `docs/HEALTHKIT_COMPANION.md` documents the full ingest contract +
    HealthKit-type mapping + a Swift reference snippet for whenever the
    native app itself gets built (needs a Mac + Xcode, not done in this
    session). `npm run lint`, `npx tsc --noEmit`, and `npm run build` all
    passed clean (61 routes). Not yet verified live for the same reasons as
    checkpoint 8 above; additionally, the ingest endpoint has no consuming
    app yet to test against beyond manual `curl` calls once deployed.

- 2026-08-29: Applied the newly uploaded Hello Cal logo/favicon assets: the
  lime-only mark is now `src/app/icon.png`/`apple-icon.png`/`favicon.ico`
  (Next.js's file-convention favicon, replacing the default placeholder), and
  the full wordmark now renders in the admin header
  (`src/components/admin/AdminNav.tsx`) instead of plain text. Source PNGs
  were cropped/square-padded from the uploaded files; originals left in the
  project root.
- 2026-08-29: Added `scripts/hellofresh-import` (new `hellofresh-agent`
  service) — see `docs/DECISIONS.md` for the full design (why `Product`/new
  `Ingredient`/`ProductIngredient` models instead of a separate `Recipe`
  model, why the sitemap instead of the "Se flere" API, the explicit
  copyright-risk decision, and known limitations: no cross-run dedup beyond
  matching `recipeId`, no per-ingredient vitamin/mineral estimate yet).
  New migration `20260829010000_hellofresh_catalog` (on top of the
  already-present `20260829000000_hellofresh_product_source` enum migration)
  adds `Product.nutritionExtra`, the `Ingredient`/`ProductIngredient` tables,
  and seeds the four `Category` rows (Retter/Menuer/Ingredienser/Færdigmad).
  Neither migration is applied to production yet. `compose.production.yaml`
  gained the `hellofresh-agent` service (reconciled with a concurrent
  session's already-present block — see `docs/DECISIONS.md`) plus a new
  `./data/hellofresh-images` volume mounted into both the agent and `app`.
  `npx prisma validate` and `npx tsc --noEmit` passed clean. `npm run lint`
  passed for every file touched by this work; it also surfaced two
  pre-existing errors in `src/app/kamera/page.tsx` and
  `src/app/tilfoej/[id]/page.tsx` (`react-hooks/set-state-in-effect`) from a
  concurrent session's in-progress `recognize-hellofresh` work, not caused by
  this change. `npm run build` still hit the known concurrent-session
  `.next/static` `EPERM` lock (see prior entries in this file) — re-run once
  no other session's dev server is active. Not yet run against a live
  database (see `hellocal_no_local_db`) — deploy both new migrations, then
  bring up `hellofresh-agent` to start the first import pass.
- 2026-08-29: Built the recognize-hellofresh/UI side referenced above (see
  `docs/DECISIONS.md` for the "Ret nr. isn't public, use AI photo recognition
  instead" decision): `POST /api/ai/recognize-hellofresh`,
  `src/components/HelloFreshMatchReview.tsx`, a `kamera` `?mode=hellofresh`
  capture flow, a "HelloFresh — Genkend din ret" entry row on `/madvarer`,
  and a generic portion-based amount stepper on `/tilfoej/[id]` for any
  product with `servingSizeGrams` set. The two `react-hooks/set-state-in-effect`
  lint errors the entry above attributes to this work are now fixed (moved
  the `setAmount`/`setRecognizeStatus` calls out of a bare effect body into
  the existing async `.then()` callbacks); `npm run lint` is clean again.
  `npx prisma generate` was re-run after the concurrent session's schema
  additions landed. `npm run build` (retried after the shared `.next/static`
  `EPERM` lock — confirmed held by the concurrent session's live `next dev`
  process, not stale — cleared) then passed clean: TypeScript, all 62 routes
  including `/api/ai/recognize-hellofresh` and `/tilfoej/[id]`. Not yet
  verified live in a browser (no reachable local PostgreSQL, see
  `hellocal_no_local_db`) — verify the HelloFresh camera-recognition flow and
  the portion stepper against `hellocal.packroff.dk` once both migrations are
  deployed and `hellofresh-agent` has imported at least one recipe.
- 2026-08-29: Deployed the accumulated pending migrations to production in
  one pass — Frida (`20260827180000`/`20260827190000`), admin passkeys
  (`20260828170000`), integrations/healthkit
  (`20260828140000`/`20260828160000`), and both HelloFresh migrations
  (`20260829000000`/`20260829010000`) — all 18 applied cleanly (`prisma
  migrate deploy` log: "All migrations have been successfully applied").
  Brought up `frida-agent` and the new `hellofresh-agent` service for the
  first time (`docker compose up -d --build`); `hellofresh-agent` found 6054
  recipe URLs in HelloFresh's sitemap and started importing (30/cycle, every
  2 minutes — full catalog takes a while but needs no manual step).
  `/api/health` verified `{"status":"ok"}` on the live server. Added
  `/volume1/docker/App/hellocal-v2/deploy.sh` (server-only, see
  `docs/DEPLOYMENT.md`) to collapse the controlled-update steps into one
  command — use it for future deploys instead of the manual sequence.
  See `docs/DEPLOYMENT.md`'s "Operational gotchas" note for the SFTP-chroot
  and terminal-paste quirks hit along the way.

- 2026-08-30: Completed a dedicated HelloFresh visual consistency audit without
  changing application code. Added root `design.md` as the binding visual
  contract and referenced it from `CLAUDE.md`. The contract corrects the source
  screenshot scale to 3x (1206x2622 -> 402x874), records the exact measured
  palette, typography, spacing/radius families, reusable component variants,
  and 33 concrete current-code/live-view deviations. The contract now also
  defines reusable padding roles for standard 16 px screen gutters, the
  measured 32 px editorial variant, cards, 48 px rows, fields, buttons,
  modals, images, app bars, action bars, bottom navigation, grids, and safe
  areas. It also includes a concrete, explicitly not-yet-implemented CSS
  blueprint for tokens, Tailwind theme mapping, the scoped app font root,
  typography, shell/appbar, a locked button taxonomy (appearance, size, form,
  loading/disabled states, icon/FAB and social login), fields/search, cards/rows,
  chevrons, imagery, action bars, bottom navigation, legacy aliases, and a
  controlled component-by-component migration. A fresh 402x874 local
  review covered `/velkommen`, `/logind`, `/tilmeld`, `/`, `/madvarer`,
  `/settings`, `/profil`, `/soeg`, `/statistik`, `/kalender`, `/stemme`, and
  `/kamera?mode=produkt`; database-backed states could not all load, but this
  exposed inconsistent short/error-state bottom-nav placement on Profil/Søg,
  clipped nav on Kalender, and nav below the viewport on Kamera. No lint/build
  was required because no runtime source was changed.
  On 2026-08-31, the contract was cross-checked against live computed styles
  from the official HelloFresh Denmark homepage at desktop and 402x874 mobile
  sizes plus its login page. The review confirms the core text, action, brand,
  page, secondary-text and field-border colors; 48 px primary controls; 4/8 px
  radii; 44 px icon hit area; and the 4/8-based spacing family. `design.md` now
  also records exact official web hover/active/focus colors and explicitly
  separates website-only Agrandir/Roboto, marketing green and social-provider
  variants from the primary iOS-app evidence.

- 2026-09-02: Implemented a batch of 13 requested UI/product changes (no local
  DB — verified with `npm run lint` + `npm run build` only, live verification
  pending per `hellocal_no_local_db`). Added `src/components/ui/Toggle.tsx`
  (standing rule: no checkboxes anywhere, see `docs/DECISIONS.md`) and
  `src/components/hf/HfChevron.tsx`; replaced all `type="checkbox"` and the
  literal "›" chevron. Added `src/components/hf/FullscreenAccordionRow.tsx`
  (fullscreen-takeover accordion, collapses back in place) and moved the
  profile's core fields into a new first "Profil" accordion item on
  `/profil`; renamed "Sundhedsdata" to "Integrationer" (now links to
  `/settings/integrationer`, no more "— opsat" suffix); added a "Kommunikation"
  accordion with 4 push/email preference toggles; added
  `/profil/billede-dagbog` (photo diary — photos stored client-side in
  localStorage only, no blob storage infra exists yet; the "requires phone
  passcode" toggle persists `User.photoDiaryRequiresPasscode` but has no real
  OS-level enforcement, future native-app work). Added `src/components/ui/WheelPicker.tsx`
  (iOS-style scroll picker, "Vælg" default, birth year scrolls to 1990) for
  fødselsår/højde. Added a weight "Opdateret d. X fra (enhed)" caption sourced
  from the latest `WeightEntry`. `/profil/soevn` now auto-fills Tirsdag-Fredag
  from Mandag's entry (still editable). `/profil/vaegt-kalibrering`'s
  time-of-day picker is now a side-by-side Morgen/Aften row with `HfChevron`.
  `/profil/indstillinger` now shows a setup progress bar (same pattern as
  `OnboardingWizard`) tracking region/allergener/vægtkalibrering. Added the
  `Referral` model + `User.freeMonthsCredited` + `src/lib/referrals.ts` for
  "Invitér en ven" reward bookkeeping (3 months → 1 free month, capped at 12) —
  this is data-model/logic only, since no real invite-link/attribution system
  exists yet (flagged explicitly, not faked). Hand-wrote migration
  `20260902000000_communication_photodiary_referrals` (not applied to any
  live DB from here).

- 2026-09-02: Started the design.md-driven visual migration (§11 order),
  step 1-2. Added the `.hf-type-*` typography classes (including
  `.hf-type-progress-active/inactive`, centered `page-title`/`category-title`)
  and the `.hf-appbar`/`.hf-appbar__slot`/`.hf-appbar__title` shell classes to
  `globals.css`, plus the missing `--hf-color-white`/`--hf-color-nav-legacy`
  tokens. Rewrote `ScreenHeader.tsx` to the fixed 44/1fr/44px slot grid with
  real `env(safe-area-inset-top)` instead of hardcoded `pt-9`: the profile
  circle is now always the left slot and a back arrow (never a cross/✕, see
  `docs/DECISIONS.md`) is the right slot on closable pages — this also fixes
  the DES-007/DES-032 profile-left/close-right violation on every screen that
  passed `onBack` (Profil, Indstillinger, Søvnmønster, Vægt kalibrering,
  Billede-dagbog, Betaling, Integrationer, Ubrugte statistik-kort). Also fixed
  the two kalender-internal custom headers (day-detail overlay, hour
  drill-down overlay) to use the same real safe-area padding instead of
  `pt-9`, and swapped the day-detail's chevron-left close button for the same
  arrow-left used everywhere else. `npm run lint` and `npm run build` both
  passed. Verified live against this session's own dev server (no reachable
  local PostgreSQL, see `hellocal_no_local_db`): `/settings` (top-level, no
  back arrow) and `/settings/integrationer` (with back arrow) both render the
  new appbar correctly at 402px width; kalender's day-detail overlay opens
  with the arrow-left close button and correct header height. Also fixed
  `BottomNav.tsx` (DES-012): the bar used the wrong `--hf-tan` (card)
  background instead of `--hf-tan-dark` (`--hf-color-nav`, `#DFD9CC`), the
  inactive icon/label color was `#4b4b4b` (an unrelated hover token) instead
  of `--hf-color-text-secondary` (`#656565`), and tab labels now use
  `.hf-type-tab` (12px) instead of a hardcoded 11px. Verified live:
  `/madvarer` shows the corrected nav background/colors.

  Continued into step 3 (shared primitives, DES-004/005/009/010): `.hf-card`
  radius is now 8px everywhere it was still 16-17px pill/rounded-2xl
  (`AccordionCard`, the settings promo/invite cards); `ChevronRow` is now a
  fixed 48px row with `.hf-type-body` (17/25) labels instead of a 56px
  `py-4` row with `text-[15px] font-medium`; `.hf-btn-primary`/
  `.hf-btn-secondary` radius corrected from a full pill to 8px (only the
  radius — the many call sites that size these buttons via local
  `py-*`/`text-*` for compact/small inline actions were deliberately left
  alone, since the class intentionally doesn't own height/padding yet; a
  real `--primary`/`--compact`/`--small`/`--full` modifier system per
  design.md §6.2 is still a separate follow-up). `.hf-search` is now a fixed
  48px field with 8px radius and the correct `--hf-color-line` border
  (was a full pill with the wrong `--hf-tan-dark` border) — used on
  `/madvarer` and `/soeg`. Settings page: card-group gap corrected from 16px
  to the contracted 32px. `npm run lint` and `npm run build` passed; verified
  live (`/settings`, `/madvarer`) against this session's dev server. Not yet
  done: the button size-variant system, and then the rest of the per-screen
  migration pass (statistik, kalender, stemme, kamera) per design.md §11 —
  continue from there.

- 2026-09-02: Migrated the auth/onboarding screens (design.md §11 step 4,
  clearest 1:1 references): /velkommen, /logind, /logind/land, /tilmeld.
  Added SocialLoginButton.tsx (correct provider colors: Google #4285F4 fill
  with a white icon zone, Apple #232323, Facebook #00178C — the prior
  Google button was white-with-border, Apple was the wrong near-black) and
  TextField.tsx (48px, auth variant 4px radius, .hf-type-input/label,
  placeholder now uses --hf-color-placeholder via a new
  .hf-type-input::placeholder rule). Fixed the 20px->16px gutter (DES-033),
  replaced every literal pt-9 with real safe-area padding, replaced the
  literal chevron character and IconChevronDown with HfChevron, replaced
  IconChevronLeft close buttons with IconArrowLeft (back-arrow-not-cross
  rule), and fixed /logind/land from individually-rounded/ringed cards to
  the reference's flat full-width 56px-row list with a plain checkmark for
  the selected country (DES-021). /velkommen's hero circle is now 180px
  (was 176px) with the correct 32px gaps; body copy moved from an invented
  15px to .hf-type-body-lg.

  Also fixed a lint-blocking issue unrelated to this change: another
  concurrent agent session's git worktree under .claude/worktrees/ had its
  own .next build output, which ESLint was traversing into (its .next/**
  ignore doesn't reach that deeply nested a path) — added .claude/** to
  eslint.config.mjs's ignores, since worktrees are never app source.

  npm run lint and npm run build both passed. Live browser verification was
  not possible this pass — a concurrent session holds Next.js's
  single-instance dev-server lock on this exact directory (next dev refuses
  a second instance even on a different port); re-verify /velkommen,
  /logind, /logind/land, and /tilmeld at 402px once no other session's dev
  server is active.

- 2026-09-02: Fixed the remaining 8px-radius (DES-004) violations on screens
  not touched by the concurrent statistik/profil-focused session: /madvarer
  (HelloFresh promo card, product-list container), /soeg (recently-added and
  results containers), /kamera (camera preview frame -> 12px radius-md since
  it's an image frame not a card; the barcode-lookup status card -> 8px),
  /settings/integrationer (notice banner, provider cards, device-token rows,
  device-code display block), /settings/betaling (placeholder card). Left
  the `rounded-full` status-badge pills alone (pills are a legitimate
  radius-round use, not a violation). `npm run lint` and `npm run build`
  passed. Live verification still blocked by the same concurrent session's
  Next.js dev-server directory lock (PID unchanged) — re-verify /madvarer,
  /soeg, /kamera, /settings/integrationer, /settings/betaling once free,
  alongside the auth screens noted above.

- 2026-09-02: Built the guided camera auto-recognition + product-creation
  flow (full design/reasoning in `docs/DECISIONS.md`). New routes
  `src/app/kamera/opret/page.tsx` (own camera bootstrap, does not touch the
  existing `/kamera` `produkt`/`maaltid`/`hellofresh` tabs) and
  `src/app/produkt/opret/page.tsx` (new create-product screen: masterdata
  form + the new 2x2 `CreateProductMediaGrid` — stregkode/næringsindhold/
  indholdsfortegnelse/produktbilleder, each behind a `NumberedBadge`).
  Recognition cascade is local-first (OCR via `tesseract.js`, fuzzy text
  match, average-hash image match, regex nutrition parsing) with two new AI
  routes (`/api/ai/recognize-product-photo`, `/api/ai/extract-nutrition`,
  same `gpt-4o-mini` pattern as `recognize-hellofresh`) only as the
  documented last resort; new supporting routes
  `/api/products/{recognize-text,generic-candidates,match-nutrition}`.
  `POST /api/products` now also accepts optional `barcode`/`imageUrl`/
  `ingredientsText`/`extraImages`. `design.md` §6.11 documents the new
  primitives (`NumberedBadge`, `HfBarcodeIcon`, `ScanningOverlay`, the
  banner/points cards — the points box is UI-only, no data model).

  While preparing to verify: found and fixed two pre-existing git
  merge-conflict-marker blocks in `src/components/StatCardsGrid.tsx`/
  `StatChart.tsx` (unrelated to this change, from a stash/pull conflict —
  see `docs/DECISIONS.md`), and a BigInt-literal/`tsconfig` `target: ES2017`
  incompatibility in the new `src/lib/image-similarity.ts` (fixed by using
  `BigInt(0)`/`BigInt(1)` instead of `0n`/`1n` literals). `npm run lint` and
  `npx tsc --noEmit` are both clean for every file this change touches.
  Full `npm run build` is currently still blocked, but only by an unrelated,
  actively in-progress concurrent session that appears to be duplicating the
  whole app's routing into English-named routes (`src/app/statistics/`,
  `src/app/product/create/`, etc. alongside the existing Danish routes) —
  same class of "concurrent session WIP blocks the build" issue noted
  repeatedly elsewhere in this file. Not yet verified live in a browser (no
  reachable local PostgreSQL, see `hellocal_no_local_db` memory) — once a
  database is reachable, exercise the full flow (product with visible text,
  a generic fruit/vegetable with no text, an unknown product all the way to
  the create page) against `hellocal.packroff.dk`, and re-run
  `npm run build` once the concurrent routing work settles.

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
6. Keep the external SSH maintenance switch off outside maintenance windows
   (not used for the 2026-08-29 deploy — done from the home LAN directly).
7. ~~Deploy the Frida migrations and `frida-agent`~~ — done 2026-08-29;
   running in production. Known residual issue: the server-side
   `scripts/frida-import/` files are owned by a different user than `Peter`
   (a leftover from an earlier manual copy), so a plain `rm`/overwrite from
   the deploy flow fails with "Permission denied" — the currently-running
   `frida-agent` image is built from whatever version was already on disk,
   not necessarily the latest `agent.py` in this repo. Fix with
   `sudo rm -rf scripts/frida-import` once, then re-copy, next time
   `frida-import`'s code actually needs to change.
8. Admin-auth migrations are deployed and `ADMIN_SESSION_SECRET` is set
   (regenerated 2026-08-29 during the HelloFresh deploy — this invalidates
   any previously-issued admin session/JWT, not the Passkey records
   themselves). Still open: add the `adminhellocal.packroff.dk` Cloudflare
   Tunnel public hostname (same target as `hellocal.packroff.dk`,
   `http://192.168.1.90:3100`) — needs the Cloudflare dashboard login. Then
   open `https://adminhellocal.packroff.dk/admin/setup` once to create the
   admin account and add a passkey from `/admin/passkeys`; verify the
   "Log ind med Face ID / passkey" button from an iPhone once deployed.
9. Integrations/healthkit migrations are deployed. Still open: create Fitbit
   (`dev.fitbit.com/apps/new`) and Withings
   (`developer.withings.com/dashboard`) developer apps, each with redirect
   URI `https://hellocal.packroff.dk/api/integrations/<provider>/callback`,
   then set `FITBIT_CLIENT_ID/SECRET`, `WITHINGS_CLIENT_ID/SECRET`, and
   `INTEGRATIONS_REDIRECT_BASE_URL` in `.env.production` — only then can the
   Integrationer page's Fitbit/Withings connect flow be tested live. Garmin
   needs a separate partner-access application (instructions were given to
   the user directly in chat on 2026-08-28) before it can move beyond its
   current "kommer snart" card.
10. ~~Deploy the HelloFresh migrations and `hellofresh-agent`~~ — done
    2026-08-29; running in production, importing HelloFresh's ~6000-recipe
    catalog on its own (30 recipes/cycle, every 2 minutes — no manual step
    needed). Verify the camera-recognition flow and the portion stepper
    against `hellocal.packroff.dk` once it has imported enough of the
    current week's menu to test against.
11. Set `PASSIO_API_KEY` (get one at accounts.passiolife.com) in `.env` and
    `.env.production`/Synology so the meal-photo scan flow
    (`/camera?mode=meal` → `/api/ai/analyze-meal-photo` →
    `src/lib/passio.ts`, built 2026-09-03) actually works — untested against
    the live Passio API without it. Once a key exists, verify end to end on
    `hellocal.packroff.dk` (take a plate photo, confirm ingredients/grams
    come back and save correctly). The full visual overlay/uncertain-
    ingredient UI from `docs/AI.md`'s "Måltidsanalyse" section is still not
    built — only a simple editable review list exists so far.

## 2026-09-05: Fejlretninger-log started; several already-fixed, some real central bugs fixed

The user began listing UI bugs one by one from fresh screenshots, logged
verbatim with full context in the new `Fejlretninger/FEJLLISTE.md` (37
numbered entries so far, screenshots `IMG_1577`-`IMG_1614`). Mid-session the
user also asked to actually verify/fix against the live app rather than only
log, so a working local `npm run dev` + Browser-pane preview was used going
forward (`.claude/launch.json` gained a `scratchpad-preview` entry too, for
an earlier failed attempt at a hand-built artifact mockup — see below).

**Important finding: several logged entries describe an older build, not the
current code.** Live-checked against the running dev server at 402×874:
`/settings`, `/profile/notifications`, `/calendar` all already show the
correct header (profile circle left, centered title, no stray "Trin X af 3"
progress bar in the wrong place) and the calendar's month-view arrows already
sit right beside the month name, not flung to the screen edges, and the
list-view dropdown (the tiny chevron under the small header calendar icon)
already exists. Fejllisten's entries #4 (profile-circle side), #12C/#23/#24C
(bottom nav placement, month-arrow position, list-view dropdown) look like
they were logged from a stale screenshot batch, not the current code — **do
not blindly "fix" those without re-screenshotting the live app first**, or
correct code risks being reverted to match a stale bug report.

**Confirmed-real bugs actually fixed this session** (each verified by
screenshotting the live dev server before/after, `npm run lint` and
`npm run build` both passed at the end):

- `src/components/ui/Toggle.tsx` (fejl #3): the switch was vertically
  centered against the whole label+description card instead of the label's
  own line, and was too large. Now `items-start` + the switch has its own
  `pt-0.5` wrapper so it aligns with the label regardless of description
  length; switch shrunk `h-7 w-12`→`h-6 w-10`; a light `border-hf-gray-light`
  separator was added between label and description.
- `src/components/StatsWheel.tsx` (fejl #29A, the home-screen key-metric
  wheel): the active item's label ("KALORIER" etc.) only rendered at all when
  centered, so it visually popped in/turned green as the wheel scrolled.
  Every item's label now always renders, fading in continuously with
  distance from center (same `labelOpacity` already computed) instead of a
  binary show/hide — no more sudden pop.
- **Root cause found for the "bottom nav floats away from the bottom in
  loading/empty/error states" bug (fejl #4/#12C/#23/#26/#28B), and fixed at
  the three pages still doing it**: `src/app/profile/page.tsx` and
  `src/app/settings/page.tsx` built their own ad-hoc header+content+BottomNav
  markup instead of the shared `HfScreen` component, and neither wrapped
  their content in `HfScreen`'s `min-h-0 flex-1 overflow-y-auto` scroll
  region — when content was short (an error message, an empty state), the
  flex column just hugged the content instead of stretching, so `BottomNav`
  rendered directly under the short text with empty space below it instead of
  pinned to the viewport bottom. Both pages migrated to `HfScreen`
  (`headerRight` used for `/profile`'s back arrow, since `HfScreen` doesn't
  take an `onBack` prop directly). `src/app/registration/[id]/page.tsx`'s
  loading/not-found/error branch (still a hand-rolled shell, not migrated —
  its dual back+close header buttons don't fit `HfScreen`'s single
  `headerRight` slot without inventing a new header variant, which was
  deliberately not done without a confirmed HelloFresh reference for that
  exact pattern) got the same `min-h-0 flex-1 overflow-y-auto` wrapper added
  around its message so `BottomNav` stays pinned there too.
  **Any other page that imports `BottomNav`/`ScreenHeader` directly instead
  of `HfScreen` should be treated as suspect for this same bug** —
  `src/app/page.tsx` is the one remaining direct `BottomNav` import besides
  the two fixed above, but it's the home screen's deliberately-special
  rotating-wheel shell (see `design.md` §1's protected exception) and wasn't
  touched.
- `src/app/voice/page.tsx` (fejl #37, #38, and #8's recycle-icon complaint):
  the mic now auto-starts listening on mount (`useEffect` calling
  `startListening()` once) instead of requiring a first tap — tapping now
  pauses/resumes, per the user's explicit "omvendt rækkefølge" request.
  Pressing Enter in the transcript textarea now blurs it (closes the
  keyboard) instead of doing nothing. Added a small black circular reset
  button (top-right of the transcript box) that clears only the transcript
  text, not the recognized food items. The per-item "reset my edits" button
  was using `IconRecycle` on a filled green circle (exactly fejl #8's
  complaint, just found in a second location) — changed to `IconRefresh` as
  a plain ghost icon (green, no fill), matching fejl #8's stated preference;
  fejl #8/#38's own black-circle reset variant is intentionally styled
  differently (filled, since it's a more consequential "clear everything
  typed" action) — this two-variant split is a judgment call made without
  asking, not yet confirmed with the user.
- `next.config.ts` gained `devIndicators: false` — the floating black "N"
  circle the user pointed at was Next.js's own dev-mode indicator badge, not
  part of the app; it never appears in a production build, but is now also
  suppressed in local dev.

**Not done / needs a decision, not a screenshot, before touching code:**
- Fejl #4's specific claim (profile circle should be *right*, back arrow
  *left*) contradicts both `design.md` §1's documented rule and what the
  live app currently renders (profile circle left, confirmed correct against
  multiple pages this session) — flagged to the user mid-session, not yet
  resolved either way in `Fejlretninger/FEJLLISTE.md`.
- A hand-built Artifact mockup of the app shell was attempted early in this
  session per an explicit user request to "se designet" before code changes;
  it went through several rounds of guesses that didn't match the
  HelloFresh reference screenshots the user was comparing against (centered
  vs. left-aligned header title, invented back-arrow/avatar slots that don't
  exist on tab-root screens, wrong phone-frame aspect ratio) because the
  scratchpad file the Write/Edit tools write to is **not visible to Bash/
  PowerShell/a local http-server** — there is no way to screenshot own
  Artifact output before publishing it in this environment. The rest of the
  session's fixes were made directly against the real Next.js app instead
  (verified via the actual Browser-pane screenshot), which is the only
  verification path that actually works here; don't attempt the
  hand-built-mockup route again for future design questions — go straight to
  the running dev server.
- The remaining ~30 entries in `Fejlretninger/FEJLLISTE.md` (weight
  calibration page, sleep-pattern page, points page, invite-a-friend page,
  Kommunikation/Notifikationer merge, search page's favorites/recently-used
  sections, E-number accordion, swipe-action colors, region list, landscape
  mode, the FAB drag-bulge interaction, allergen-under-profile duplication,
  and others) still need the same live-screenshot-first treatment before any
  further fixes — several may turn out to already be fixed like the ones
  found stale above.

### 2026-09-06 follow-up: root cause found for the repeated "white text invisible on green" bug, plus a dozen more pages migrated to `HfScreen`

**Root cause of fejl #12A/#14A/#15A (logged as three separate "kontrastfejl" reports) found and fixed — it was a real, live CSS bug, not a stale screenshot:** `globals.css`'s `.hf-type-body`, `.hf-type-body-sm`, `.hf-type-caption`, and `.hf-type-hero` all hardcode `color: var(--hf-color-text)` (or `--hf-color-text-secondary` for caption). Any element using one of those classes *and* a `text-hf-white`/`text-white` Tailwind utility to show white text on a green/dark card was losing that fight — the plain CSS class's `color` declaration was winning over the Tailwind utility class in the compiled stylesheet, so the text rendered in dark/gray instead of white, exactly as reported (invisible/near-invisible text on green). Found by grepping every `hf-type-*` + `text-*white` combination in `src/app` and `src/components` (11 hits) and confirmed live in the browser (screenshotted `/profile/invite` and `/profile/points` before and after). Fixed at all 10 real occurrences (the 11th, `SocialLoginButton.tsx`'s `hf-type-button`, doesn't set a color and was never actually broken) by replacing the Tailwind color utility with an inline `style={{ color: "var(--hf-color-white)" }}` (inline styles always win over a class, regardless of source order) in: `src/app/login/page.tsx`, `src/app/profile/invite/page.tsx` (both lines), `src/app/profile/points/page.tsx` (all three — this was the "Din saldo … points" balance box that rendered as an unreadable "…"), `src/app/profile/report-bug/page.tsx`, `src/app/settings/page.tsx` (both lines, one of which had no `text-*` override at all and was silently relying on inheriting a color from its parent `<Link>` that the class was blocking), and `src/app/settings/payment/page.tsx` (both lines). **This class of bug can recur anywhere a designer reaches for an `hf-type-*` class on a colored background and expects a co-applied Tailwind color utility to win — it won't, use an inline `style` override instead, or add a card-background modifier to the type classes themselves centrally if this keeps coming up.**

**A dozen more pages had the same missing-`HfScreen`-shell bug as `/profile` and `/settings` (fixed 2026-09-05):** grepped every `page.tsx` for `ScreenHeader` without `HfScreen`/`BottomNav` and found 12 more: `src/app/profile/invite`, `profile/notifications`, `profile/photo-diary`, `profile/points`, `profile/report-bug`, `profile/settings`, `profile/sleep`, `profile/weight-calibration`, `settings/integrations`, `settings/payment`, `statistics/unused-cards`, and `product/create`. All 12 migrated to `HfScreen` the same way (title + `headerRight` back-arrow button replacing the old `ScreenHeader onBack`/`ScreenHeader icon` props) — confirmed by `npm run lint` and `npm run build` passing clean after each batch, plus live screenshots of `/profile/weight-calibration`, `/profile/sleep`, `/profile/invite`, and `/profile/points` at 402×874 showing the bottom nav now correctly pinned to the viewport bottom in every case, including the empty/error states that previously left it floating under a couple of lines of text. `src/app/betingelser/page.tsx` (legal terms — reads as a standalone document, matches design.md's implicit precedent) was deliberately left alone as a plausible intentional exception, not because it wasn't checked.

**`/profile/settings` and `/settings` were found to be two different pages sharing one "Indstillinger" title** (`profile/settings` is the region/allergens/language setup screen fejl #17-#19 actually describe; `/settings` is the separate Betaling/Hjælpecenter/Integrationer/Notifikationer/Betingelser list). Renamed `profile/settings`'s title to a new `settings.setupTitle` key ("Opsætning", da/en) per fejl #18C's decision, so the two no longer look like the same screen. Also renamed `settings.showAllergens` from "Vis allergener" to "Få vist allergener" (fejl #19B) — it's used in exactly one place, safe to rename directly.

**Fejl #17 (region list only has 6 countries) fixed**: `src/lib/regions.ts`'s `REGIONS` extended from 6 to 16 entries (added AT, CH, NL, BE, FR, IT, ES, IE, CA, AU, NZ) covering HelloFresh's actual delivery markets, each with its real GS1 barcode-prefix range (standard GS1 country-prefix data, not guessed) since that list also drives barcode-region-matching in `src/app/api/products/route.ts`, not just display.

**Fejl #11 (sleep page) B and C fixed**: `src/app/profile/sleep/page.tsx`'s "Normal sengetid"/"Normal stå-op-tid" fields reordered (wake time first) and the wake-time label shortened to "Normal stå op"; a new `addMinutes()` helper now auto-fills the other field to a 7.5h offset the first time either one is set (only when the other is still empty, never overwriting a value the user already chose). Per-day slider redesign (fejl #11D) and the native-time-picker replacement (fejl #11E) are still open — both need a real design decision/build, not a quick fix, and were deliberately left alone rather than improvised.

**Fejl #10 (weight calibration) C, D, F fixed**: the weight input is now a minimal underlined field with a static "kg" suffix instead of a boxed input; the green intro card wraps the intro text (F); the "Registrér vejning" button is gone and every control (weight-field blur, each segmented choice) saves immediately via the existing debounced-PATCH pattern already used elsewhere on the same page (D). Fejl #10A ("Ved ikke" as an oversized primary button) turned out to already be a correctly-built 2-3-way segmented control when checked live — not a real bug, just every option showing the same "selected" green styling, which is expected behavior, not a hierarchy problem.

All of the above verified with `npm run lint` (clean) and `npm run build` (clean, after retrying past one instance of the known `.next/static` `EPERM` lock from this same session's own concurrent dev server — stopping the dev server before building and restarting it after cleared it, consistent with every prior note of this issue in this file).

**Still open in `Fejlretninger/FEJLLISTE.md`, not yet touched this pass:** #7/#37A (continuous swipe vs. page-snap — re-check live, may already be fine like several others were), #13 (Kommunikation page — still needs to be built, `profile/notifications` was only shell-fixed, not merged/redesigned), #16 (delete Notifikationer), #20/#21/#28A (E-number accordion, inline macro editing), #24 (calendar — re-check live, several of its four points already looked fixed in the 2026-09-05 pass), #27 (calendar timeline mystery gray line, "Dagens mål blev nået" box restyle), #30-#32 (FAB bulge interaction, drejehjul spacing, landscape mode), #39 (bottom-nav inactive-gray verification).

### 2026-09-06, later same day: a real `Favorite`/bookmark feature built end to end, plus the last recycle-icon holdout fixed

**Fejl #6's `BottomNav.tsx` reviewed against its screenshot and found to already be a complete, deliberately-built feature** (550ms long-press → jiggle mode, drag-to-reorder with FLIP animation, tap-to-remove `×` badge, drag-to-add from a bottom sheet, edge-hold page flipping, swipe-to-page — all present in code, matching the detailed 2026-08-28 `STATUS.md` entry documenting this same feature). This could not be exercised end-to-end here (long-press timing and multi-step pointer drags aren't reliably simulable through this session's browser automation), so it's marked reviewed-by-code-reading, not verified-by-interaction — if it's still misbehaving on a real phone, that needs an on-device report, not another screenshot of the same static state. It did have one confirmed, fixed bug: its "reset layout" button used the same `IconRecycle`-on-filled-green-circle fejl #8 already flagged elsewhere — changed to `IconRefresh` ghost-style, consistent with the `voice/page.tsx` fix from 2026-09-05. Grepped the whole codebase afterwards for any remaining `IconRecycle` usage — none left.

**Fejl #31/#33/#36 (favorites) built for real, not just UI:** the `Favorite` Prisma model already existed in schema (userId + productId + dishId, unique per combination) but had zero API routes and zero UI wired to it anywhere in the app. Added `src/app/api/favorites/route.ts` (GET list, POST add, DELETE remove — same `getEffectiveUser()`/`prisma` pattern as every other route; POST deliberately uses `findFirst` + conditional `create` instead of `upsert`, since Postgres treats a NULL `dishId` as distinct from any other NULL for uniqueness purposes, so an upsert keyed on a null field can't reliably detect an existing row). Wired it in three places: `src/components/SwipeableRow.tsx`'s existing-but-previously-unused `onFavorite` swipe action now has a bookmark icon and posts to the real API (also recolored its delete action from `bg-red-600` to `bg-hf-black` per fejl #34's explicit ask); `src/components/DailyList.tsx` now passes a real `favoriteEntry` handler (needed `productId` added to its registration mapping, which the API already returned but the component didn't carry through); and `src/app/search/page.tsx` gained a full "Favoritter" section (shown above the pre-existing "Senest anvendte" section when the search field is empty) with a working bookmark/bookmark-filled toggle button on every result row, backed by the same API. The old default "Alle varer" listing (fejl #31's core complaint — an arbitrary slice of the entire product catalog shown with no search term) was removed entirely; an empty query now shows only Favoritter/Senest anvendte, or a plain "search for something" hint if neither has any data yet, and the `/api/products?q=` call is no longer made at all until the user actually types something.

Verified: `npm run lint` clean, `npm run build` clean (full route list including the new `/api/favorites`), and `/search` screenshotted live at 402×874 showing the new empty-state copy correctly replacing the old "Alle varer" list (no local database, so the Favoritter/Senest anvendte sections themselves render empty here — expected, not a bug, see `hellocal_no_local_db` memory).

### 2026-09-06, third pass: a real broken-route bug found (not a Fejlretninger item), fejl #13/#16 merged for real, #1/#22/#20/#21 fixed

**Found and fixed a genuine, previously-unknown production bug while editing `src/app/profile/page.tsx`:** its "Integrationer" row linked to `/settings/integrationer` (Danish) — the real route is `/settings/integrations` (English). Same mistake, worse impact, in `src/app/camera/create/page.tsx` (5 places) and `src/app/product/create/page.tsx` (1 place): every successful barcode-scan/AI-recognize/manual-create path did `router.push(\`/tilfoej/${id}\`)` — the real route is `/add/[id]`, not `/tilfoej/[id]` (that was the route's old Danish name before a rename this project went through; `STATUS.md`'s own older entries still call it `/tilfoej/[id]` in prose, which is presumably how the stale name survived in these six call sites after the folder was renamed). Every one of these sent the user to a 404 immediately after successfully scanning or creating a product — a real, severe, silent break, not a cosmetic issue, and not something in `Fejlretninger/FEJLLISTE.md` since it's invisible in a static screenshot. Fixed all 6 with a straight `/tilfoej/` → `/add/` substitution (`sed`) plus the one `/settings/integrationer` → `/settings/integrations` fix. **Given how this happened, it's worth grepping for any other route the app renames in the future** — there is no automated check that a `router.push`/`href` string matches an actual folder under `src/app`.

**Fejl #13 + #16 (Kommunikation/Notifikationer merge) done for real, not just shell-fixed:** turned out `User.wantsPushNotifications`/`wantsUpdateNewsEmails`/`wantsAdviceEmails`/`wantsPartnerOffersEmails` (fejl #13's exact four toggles) already existed in the schema and were already fully wired end-to-end (`/api/profile`, GDPR anonymize, admin user list) — just surfaced as an inline `FullscreenAccordionRow` accordion on `/profile` instead of fejl #13's requested dedicated page. Rewrote `src/app/profile/notifications/page.tsx` (same route, so no other link needed to change) into the real merged Kommunikation page: intro copy, three sectioned toggle groups with a title + divider each (Push-beskeder / E-mails / Information fra vores samarbejdspartnere) using the four existing fields, a "Specifikke beskeder" section below it preserving the *old* Notifikationer page's per-event `NotificationPreference` email/push toggles verbatim (nothing deleted, per fejl #16's "sikr at ... bevares" instruction — these are genuinely different, transactional-event toggles, not redundant with the four marketing ones), and a terms link at the bottom. Removed the now-redundant inline accordion and separate "Notifikationer" row from `/profile` (was two entries; now one, labelled "Kommunikation", reusing the icon/position of the old Notifikationer row) — also dropped the now-unused `IconMessageCircle` import, `Toggle` import, and `communicationOpen` state from that file. Renamed `settings.notifications`/`profile.row.notifications` from "Notifikationer" to "Kommunikation" in both locales (same route, `/profile/notifications`, still linked from `/settings` and `/profile`). Verified live at 402×874: new page renders with correct header/bottom-nav, section titles, dividers, and terms link (toggle values themselves show "Henter…" — no local database, expected).

**Fejl #1/#22 (kcal-per-100g default) fixed at its actual root cause:** `src/app/add/[id]/page.tsx`'s `amountUnit` state defaulted to `"personer"` (portions) instead of `"gram"` — this is the literal reason the Tilføj screen kept showing "148 kcal / portion" as the primary figure with the "Personer" tab pre-selected, across every variant of that screen shown in the log. Changed the initial state to `"gram"`.

**Fejl #22B/#22C ("Detaljer" centering, E-numre badge placement/rename) fixed** in the same file: the standalone E-badge/link next to "Detaljer" (always visible, duplicating the real list further down) removed; "Detaljer" is now the only thing on that row and is centered. `addProduct.additives` renamed "E-tilsætningsstoffer" → "E-numre" (da only, per the log; left the English string as "E-additives").

**Fejl #20A (E-numre accordion) fixed:** the E-numre list inside the Detaljer section now starts collapsed behind a chevron-toggle header instead of always being fully expanded.

**Fejl #20 addendum (allergen warning badge) fixed:** added a small green circle with "!" before the "Allergener" heading in the same details section.

**Fejl #21 (macro editing modal → real inline editing) fixed:** `src/components/hf/MacroSliderBar.tsx`'s tap-to-edit used a `createPortal` bottom-sheet modal with its own "Gem" button — replaced with true inline editing: tapping the "NN g" value swaps it for a real `<input>` (auto-focused, white background, selects existing text) right there on the same line; Enter or blur commits and reverts to the plain button, no modal, no separate save action anywhere.

All of the above: `npm run lint` and `npm run build` both clean.

**Fejl items in this list still not independently re-verified against the live app in this session:** #30-#32 (FAB bulge interaction, drejehjul spacing, landscape mode — all need a real device/pointer-drag to test, not just a code read). Given how many of the earlier-assumed-broken items turned out to already be fixed (and, conversely, how the `/tilfoej/`→`/add/` bug was invisible to log-based screenshots entirely), treat every remaining item as unverified until it's actually been reloaded in a browser this session — don't assume either "still broken" or "already fine" from the log text alone.

### 2026-09-06, fourth pass: calendar day-status box restyled, #39 confirmed, #7/#37A/#24 re-checked live

**Fejl #24 (calendar month view) re-checked live at 402×874 — all four of its sub-points already fixed/were stale, confirmed by screenshot this time, not just code reading:** month-nav arrows sit directly beside "September 2026" (not flung to the screen edges), the overflow date (31 from August) already renders in a lighter/outlined style distinct from in-month dates, and the list-view dropdown chevron under the small header calendar icon is present and functional (already noted in the first pass, re-confirmed).

**Fejl #26/#27B (day-detail sub-header layout, "Dagens mål blev nået" box) — one real bug found and fixed, one already fine:** the `‹ 📅 Fredag 18. september › ←` sub-header row already renders correctly on one line (fejl #26 was stale). The status box, though, was still exactly as reported: a full-width green card with a large circular checkmark icon (`src/app/calendar/page.tsx`, day-detail view, ~line 1345) — completely different from the month view's minimal small-badge-plus-plain-text style used by `MonthlyStatus` a few hundred lines below it in the same file. Restyled it to match `MonthlyStatus` exactly (5px circular badge, `IconCheck` at 13px, plain `text-hf-black` label, no card background) so the two "goal met" indicators in the same feature are now visually consistent instead of looking like two different components.

**Fejl #39 (bottom-nav inactive color) confirmed via computed style, not just reading the token table:** `getComputedStyle` on an inactive tab label returned `rgb(101, 101, 101)` (`#656565`, exactly `--hf-color-text-secondary`) and the active one returned `rgb(35, 35, 35)` (`#232323`, exactly `--hf-color-action`) — the token is correctly wired in `BottomNav.tsx`'s `NAV_INACTIVE_COLOR`/`NAV_ACTIVE_COLOR` constants. (A handful of unrelated `rgb(31,31,29)` values also came back from the same query — traced to this session's Browser-pane occasionally rendering the page tiled/duplicated in screenshots, a tooling artifact unrelated to the app's own code, not a real second color in use.)

**Fejl #7/#37A (continuous swipe vs. discrete page-snap) reviewed in `BottomNav.tsx`'s existing page-swipe handler:** `pageSwipe.offsetX` is set directly from the live pointer position on every `pointermove` and fed straight into the row's `translateX`, so the page genuinely follows the finger continuously (only snapping — with a real `ease` transition — once the pointer is released past the swipe-ratio threshold). This matches the requested behavior in the code; not independently confirmed via a real drag gesture in this session (synthetic pointer sequences aren't reliably drivable through this browser automation), so treat as reviewed-by-code, not interaction-tested.

`npm run lint` and `npm run build` both clean after this pass.

## 2026-09-07: deployed for the first time, header slot swap, and another full sweep of Fejlretninger/FEJLLISTE.md

**Critical realization mid-session: nothing above had ever been deployed.** Every fix through commit `10a7297` existed only as uncommitted local changes on this workstation — the user had been testing `hellocal.packroff.dk` (the real Synology deployment) the whole time, which had received none of it. Committed and pushed to `master` (which triggers GitHub Actions' existing auto-deploy, confirmed via `.github/workflows/*.yml`'s `on: push: branches: [master]`) for the first time this session. **Lesson: verifying against a local dev server proves the code is correct, not that the user can see it — push to master is the only thing that actually reaches the live app the user is judging by.**

**Header slot swap (explicit user correction, applies globally):** the back button must always be in the header's **left** slot and the profile circle always in the **right** slot — the reverse of what every page above was migrated to. Also: the back icon must be the shared `HfChevron` (`direction="left"`, a plain "<"), never `IconArrowLeft` (a full arrow). Rewrote `src/components/hf/ScreenHeader.tsx` and `src/components/HfScreen.tsx` (the `headerRight` prop is gone; replaced with `onBack?: () => void`, which ScreenHeader now renders in the left slot) and updated all 14 pages that previously passed a manual `headerRight={<button>...<IconArrowLeft/></button>}` workaround down to a plain `onBack={() => router.back()}`. One page (`/add/[id]`) used the header's right slot for a non-back action (`ForwardButton`, "videresend til en ven") — moved into page content (top-right of the product card) instead of inventing a third header slot. Verified live via screenshot: PT circle right, "<" chevron left.

**Found and fixed a real, previously-undiscovered bug per direct user report ("guide/test-skærmen er stadig ikke deaktiveret"):** `src/components/Hero.tsx` had `const IS_NEW_USER = true` — a literal "Assumption for the prototype" comment — driving whether the FAB onboarding spotlight overlay showed. It was never wired to real state, so it reappeared on **every single page load for every user, forever**. Fixed with the same one-time-hydration-from-localStorage pattern `BottomNav.tsx` already uses (a plain `useState(false)` + effect with the established `eslint-disable-next-line react-hooks/set-state-in-effect` justification — a naive `useState(() => !loadDismissed())` lazy initializer was tried first and caused a real, confirmed hydration-mismatch console error, since `window`/localStorage don't exist during SSR; reverted to the effect-based pattern which doesn't have that problem). Verified live: overlay present on first load, gone after dismissing, no hydration error in console on a fresh tab.

**User pushback, verbatim, on how this session had been reporting progress: "hvorfor tager du en til to opgaver og skriver, du er færdig, når du mangler en masse?"** — fair: this file (and the chat) had been summarizing after every 1-2 fixes in a way that read as "done" well before the actual `Fejlretninger/FEJLLISTE.md` list was anywhere close to finished. Went back through the list end to end instead of stopping after each fix:

- **#28 (Madvarer/foods page) — untouched all session until now, fixed:** removed the unauthorized "Råvaredata: Fødevaredata... DTU Fødevareinstituttet" line (`foods.dataSource`) the user explicitly rejected; added a working favorite/bookmark toggle to each product row using the `/api/favorites` route built earlier.
- **#19 (allergen accordion) confirmed as a real, current bug, not stale:** in `profile/settings/page.tsx`, the expanded allergen list rendered *after* the unrelated Sprog toggle instead of directly under "Vis allergener" — the JSX order literally put another whole toggle between the trigger and its own content. Reordered, added a light divider, compacted row height.
- **#9 (scroll-lock) confirmed as a real bug and fixed properly:** the icon-editor bottom sheet's backdrop didn't stop the background from scrolling, because `document.body` isn't actually the app's scroll container (`HfScreen`'s inner div is) — a naive `body.style.overflow = "hidden"` would have been a no-op. Fixed by blocking `touchmove` outside the sheet while it's open instead.
- **#25 (calendar sleep fallback) confirmed and fixed:** `getSleepWindow()` treated bedtime/wake-time as two *independent* fixed fallbacks (23:00 / 07:00), so a user with only one of the two set could get an implied sleep duration of a few hours or 16+. Now derives the missing one as a 7.5h offset from whichever is actually set.
- **#21 (photo diary) built:** tapping a thumbnail now opens a full-height portrait (`object-contain`) viewer with swipe/chevron navigation between photos and the date shown underneath, replacing the flat always-cropped 2-column grid. Not exercised live — `/profile/photo-diary`'s `/api/profile` fetch fails without a reachable database in this environment, so this one is lint+build-verified only, not screenshotted.
- **#27 (calendar "mystery gray line") investigated and resolved as a real component, not a bug:** it's `SleepBlock`'s drag handle for adjusting the whole sleep period by touch — legitimate, already-documented functionality (2026-08-28 entry above), just visually indistinguishable from noise. Made it a higher-contrast white pill with a shadow instead of a thin unstyled line.
- **#6 (bottom-nav long-press jiggle) and #12D/#11D/#11E/#20/#30/#32 still open** — #6 remains code-reviewed-only (a synthetic pointer-event test was attempted via `javascript_tool` to actually verify the 550ms long-press → jiggle transition; it produced an inconclusive/likely-invalid result — text appeared only *after* simulated pointer-up rather than during the hold — most plausibly a synthetic-event limitation rather than a real app bug, but not conclusively ruled either way, and the tool timed out on a follow-up attempt; needs a real device to actually confirm). #12D (invitation list with name/email/expiry/resend) needs a data model this app doesn't have at all — the `Referral` model only exists *after* a friend registers, there's no "pending invitation sent to a specific email" concept anywhere, so building this properly means a new schema migration + wiring the existing mailer, not a quick UI fix — deliberately not attempted blind. #11D (per-weekday sleep sliders), #11E (custom time-picker to replace the native OS one), #20 (E-number fold — **correction: this one turned out to already be done**, `add/[id]/page.tsx` already got an `additivesOpen` accordion toggle in an earlier pass this session), #30 (FAB drag/bulge interaction), #32 (landscape mode) are all substantial, unbuilt features, not small fixes — flagged, not silently skipped.

All of the above: `npm run lint` clean, `npm run build` clean (had to `rm -rf .next` once more mid-session — the recurring OneDrive-sync file-lock issue this repo lives under, not a code problem), each committed and pushed separately (`e7d1ae4` header swap, `d4bf60f` Hero.tsx onboarding fix, `53e4448` foods/allergen/scroll-lock/calendar-sleep, `b98e89e` photo-diary viewer, `6539e5a` sleep-handle visibility).
