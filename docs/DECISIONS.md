# HELLO CAL — decision log

This file records durable decisions. Add a dated entry when a later decision changes one of them.

## Product and data

- The product name is **HELLO CAL**.
- PostgreSQL is the primary database; Prisma is the application ORM.
- Registrations store nutrition snapshots so later product edits cannot alter historical records.
- HELLO CAL is the primary data source. Apple Health and Google Health Connect are write-only integrations as described in the specification.
- Product behavior and UI decisions in `docs/SPECIFICATION.md`, `docs/UI.md`, `docs/AI.md`, `docs/DATABASE.md`, `docs/BACKEND.md`, and `docs/ADMIN.md` take precedence over prototype placeholders.
- 2026-08-26: The simulated phone frame is a desktop presentation aid only.
  On phones and other coarse-pointer devices, the application fills the browser
  viewport without an outer frame, rounded corners, shadow, or mockup background.
- 2026-08-26: Voice registration shows the live transcript at the top below a
  stand-microphone status circle. The circle pulses while AI processes the
  speech; detected entries appear below in the daily-meal row style and can be
  edited before the user approves them.
- 2026-08-26: Voice capture uses the browser-provided Speech Recognition API in
  Danish as the first implementation step. It provides real microphone access
  and live transcription independently of HELLO CAL's later structured-food AI,
  with an unsupported-browser fallback instead of silently failing.
- 2026-08-26: Calendar success is deliberately understated: a completed day has
  a 1 px green border and a light-green checkmark in its upper-right corner.
  Today alone receives the solid green date treatment.
- 2026-08-26: Calendar navigation supports month, week, and list views. The
  period can be changed by horizontal swipe, arrow controls, or a year-aware
  month picker. Selecting any date opens its database-backed day view.
- 2026-08-26: The home-screen key-metric panel behaves as a vertical wheel.
  Swipe, scroll, adjacent-item taps, and keyboard arrows rotate calories,
  protein, water, calories burned, and steps through the emphasized center.
  Food-derived totals use today's registration snapshots.
- 2026-08-27: Supersedes the 2026-08-26 "visualizes success, not failure"
  principle for the calendar. The calendar now shows a calm red marker on
  days the goal was not met, alongside the existing green marker for days it
  was met. A star streak indicator (with a day count) appears once the goal
  has been met at least 5 days in a row and disappears immediately the streak
  breaks. No other badges or motivational messaging were added.
- 2026-08-27: A fullscreen first-run setup wizard (`OnboardingWizard`) was
  implemented for the three questions the user specified: sleep-pattern /
  shift-work / daily work-hours-vs-sleep-times logging preference, smartwatch
  health-data import, and work-hours-in-calendar. Only these are specified,
  so the wizard's step list (`ALL_STEPS` in `src/components/OnboardingWizard.tsx`)
  currently has 3–5 visible steps (shift-work and daily-log-preference are
  conditionally skipped), not the "10 trin" example in `docs/UI.md`. The
  remaining onboarding content (goals, activity level, etc. from
  `docs/SPECIFICATION.md` §5) is unspecified and must be added to the step
  list once decided — do not infer it. "Vis ikke igen" only appears after the
  user has chosen "Påmind mig senere" once, mirroring the existing forced
  onboarding modal's pattern.
- 2026-08-27: Unknown product barcodes are resolved through a deterministic
  fallback chain: HELLO CAL's own database, Open Food Facts, then USDA
  FoodData Central when `USDA_FDC_API_KEY` is configured. Imported products
  retain their external source, external id, and lookup timestamp. USDA data
  never overwrites an existing local product, and all external imports remain
  `PENDING` for the existing validation/admin flow.

- 2026-08-27: Danish generic-food data comes from DTU Fødevareinstituttet's
  Frida database, imported as `Product` rows with `externalSource='FRIDA'`
  and `status='APPROVED'` (no barcode). Frida's own site
  (`fcdb.fooddata.dk`) has no public reuse API — only an undocumented
  internal API behind its frontend, deliberately not used for anything more
  than confirming this. Instead, its dataset releases are published to
  DTU's official Figshare-based repository (`data.dtu.dk`), which has a
  real public, documented, unauthenticated, CC-BY-4.0 API
  (`api.figshare.com`, DTU Food's group id `18053`). `scripts/frida-import`
  (`frida-agent` service) polls that API on a schedule
  (`FRIDA_AGENT_POLL_INTERVAL_SECONDS`, default 24h), and — unlike the
  USDA/Open Food Facts barcode fallback — imports automatically as
  `APPROVED` without an admin review step, since it is DTU's own curated
  reference data rather than a single external contributor's submission.
  `frida_import_state` tracks which Figshare release has already been
  imported so the same version is never reprocessed.

- 2026-08-27: The calendar's landscape week timeline and day-detail timeline
  now render sleep as a light-grey background band (00:00–wake and
  bedtime–24:00) derived from `SleepSchedule`/`WorkShift`/`User` defaults.
  Holding the sleep/wake boundary line for ~0.5s and dragging adjusts the
  time (15-minute snap); releasing asks whether the change applies only to
  that date (`WorkShift` override) or the standing weekly pattern
  (`SleepSchedule`). See `docs/DESIGN_V2.md` §6 for the source spec.

- 2026-08-27: The admin product/image approval UI (docs/ADMIN.md) is served
  from the same codebase and deployment as the rest of the app, reached at a
  dedicated hostname (`adminhellocal.packroff.dk`) rather than a path on
  the public domain — `middleware.ts` rewrites that hostname's root to
  `/admin` and refuses `/admin/*` and `/api/admin/*` entirely on any other
  hostname (except `localhost` for local development), even though every
  route is also login-gated. There is still no general user account/login
  system (see "Next work" in `docs/STATUS.md`); this only adds the two
  `User` fields (`passwordHash`, `totpSecret`) needed for the single
  administrator account, created once via `/admin/setup` (blocked after the
  first admin exists). Login is password + TOTP (Google
  Authenticator/Authy-compatible, `otplib`), sessions are a signed JWT cookie
  (`ADMIN_SESSION_SECRET`, `jose`), and login/TOTP attempts are rate-limited
  in-memory per email/user. `/admin/produkter` approves or rejects new
  `ProductStatus.PENDING` products; `/admin/billeder` shows each
  `imageStatus = PENDING` product's current image beside the image-agent's
  `pendingImageUrl` suggestion (see the 2026-08-27 image-agent entry above)
  and promotes or rejects it.

- 2026-08-28: Added passkey (WebAuthn) login for the admin account as an
  alternative to password + TOTP — e.g. Face ID on iPhone via iCloud
  Keychain. `@simplewebauthn/server`/`@simplewebauthn/browser`; a new
  `Passkey` model (migration `20260828170000_admin_passkeys`) stores each
  credential. Registration (`/admin/passkeys`, `POST
  /api/admin/passkey/register/*`) requires an existing session — only the
  already-authenticated admin can add a new device — and uses a discoverable
  credential (`residentKey: "required"`) so login doesn't need an email
  first. Login (`POST /api/admin/passkey/authenticate/*`, public, listed in
  `middleware.ts`'s public admin API paths) is usernameless: the browser/OS
  shows whichever passkeys it has for the site. A verified passkey assertion
  already proves possession plus biometric/PIN user verification, so it
  grants a full session directly, skipping the separate TOTP step — treated
  as equivalent strength to password + TOTP combined, not as a weaker
  shortcut. Relying-party ID/origin are derived from the request's
  `Origin`/`Host` headers rather than a fixed env var, so the same code
  works on `adminhellocal.packroff.dk` and `localhost`. `/admin/setup`
  now signs the new admin straight into a session after TOTP confirmation
  (previously redirected to `/admin/login`) so they can add a passkey
  immediately without a second login round-trip.

- 2026-08-28: Admin UI v2 design (not yet implemented — currently a static
  HTML mockup only, no code): the default/only landing view is "Nye
  produkter" in reverse-chronological order — no separate dashboard/start
  screen. Each product row expands (on image click) into two image rows —
  top 5 highest-scoring "primær" candidates (front-of-package, meets the
  background/quality bar, used as the profile photo) and up to 5 "sekundær"
  images (no background requirement) — drag-reorderable, each with a
  checkbox ("brug billede") and a ⋮ menu (Slet / Send til revision). An
  image sent to revision moves to a new "Billeder til gennemgang" page
  (placeholder for now) and is expected to come back and update the product
  automatically once manually processed (e.g. background removed in
  Photoshop) — this is a *conditional* approval, not a rejection. A new
  "Billeder" page lists every submitted image across all products, sortable
  by an AI-assessed quality score (0–100%, threshold-based status) alongside
  product/type/status — the AI scoring model/pipeline itself is not yet
  designed. Each product also has a ⋮ menu: Afvis (rejects — does **not**
  retroactively affect any user who already logged the item, and does not
  create the product in the shared database), Godkend, and Betinget
  godkendt (opens a note field + SEND; the product stays in the database but
  moves to a new "Betingede godkendelser" page — placeholder for now —
  pending revision).
- 2026-08-28: **Product edits must not retroactively change historical data**
  other users already logged — this is already true today (registrations
  snapshot nutrition values, see the top of this section) and stays true by
  default. A new admin setting is planned — "Overskriv tilføjede produkter
  ved ændringer og opdateringer i databasen" (on/off) — that, when enabled,
  would deliberately let a product edit retroactively update existing users'
  logged registrations instead of only affecting future ones. Not yet
  implemented; default must be **off** (preserve current snapshot behavior)
  until this setting exists.

- 2026-08-28: **Correction, overrides any contradicting guidance given earlier
  (in this file or verbally to other agent sessions):** screens/windows and
  their headers fill the entire viewport edge-to-edge, matching the HelloFresh
  app — never inset with a visible margin or frame around them (the desktop
  `PhoneFrame` presentation aid is unaffected, see 2026-08-26). The
  profile/user-menu circle moves from the top-right to the **top-left** corner
  of the standard top bar, because the top-right corner is needed for a
  close-cross (×) on pages that can be closed — there is no room for both in
  the same corner. This supersedes the earlier `docs/UI.md` claim that there
  is no separate close-cross on the persistent frame. See `docs/SPECIFICATION.md`
  §6 and `docs/UI.md`'s Navigation/Layout-konsistens sections.

- 2026-08-28: Health-API integration strategy, chosen with the user before
  implementation started: **Fitbit and Withings get real, working OAuth2
  integrations now** (both have genuine cloud APIs). **Apple Health, Apple
  Watch, Garmin, and Google Health Connect are shown as disabled "kommer
  snart" cards with no live connection** — Apple Health/Health Connect
  cannot be read by a plain web app at all (HealthKit/Health Connect are
  native-only; there is no cloud REST API Apple or Google expose for
  third-party reads), and Garmin's Health API requires a separate business
  partner application. A future connection to those either needs a native
  companion app or a paid third-party aggregator (Terra/Vital/Spike) — not
  decided, and out of scope for this batch. See `src/lib/integrations.ts`
  (`INTEGRATION_CATALOG`, `connectable` flag) and the `Integration` Prisma
  model.
- 2026-08-28: Sport/activity data (`Activity` model) and its calendar/
  statistik surfacing (icon + green bonus calories on the calendar; dynamic
  `sport:<type>` stat cards) are only shown when the user has at least one
  *connectable* integration (Fitbit/Withings) actually `CONNECTED` — not
  merely because `Activity` rows exist. This matches the user's own framing
  ("HVIS integrationerne er slået til").
- 2026-08-28: "Trendvægt" (AI-estimated weight, `docs/SPECIFICATION.md` §5)
  is computed on-the-fly from `WeightEntry` + `Registration` timestamps
  (`src/lib/weight-trend.ts`) — separate exponential smoothing for morning
  vs. evening weigh-ins, nudged down slightly when food was logged within
  ±2h of the weigh-in. It is deliberately plain TypeScript, not a Python/ML
  service, since the underlying method is simple statistical smoothing, not
  a trained model — revisit only if a real model is later warranted. It is
  never stored as its own `WeightEntry` row, to keep measured data
  unpolluted; needs ≥5 samples before it is shown at all.
- 2026-08-28: The calendar day-detail timeline's long-press vocabulary is
  gesture-specific, refining (for calendar rows only) the older general rule
  in `docs/SPECIFICATION.md:26`/`docs/UI.md:27` ("langt tryk = tilføj som ny
  registrering") — that rule was never actually implemented for calendar
  entries. Holding an entry now arms "move" mode (drag to retime, shown via
  a live `HH:MM · title` label, committed on release through the new
  `PATCH /api/registrations/[id]`); a plain tap still opens the
  registration's detail page. A two-finger vertical drag on the day
  timeline zooms it (up to 4×, persisted per-browser in `localStorage`) to
  reveal 15-/5-minute gridlines and per-registration markers, which only
  render once zoomed — at the default zoom level the timeline still shows
  only the existing per-hour aggregate, unchanged.

- 2026-08-28: **HealthKit/Health Connect as the future integration hub**
  (user-directed, based on a ChatGPT architecture discussion the user
  relayed): rather than building a direct API integration per device brand,
  a single future native iOS companion app (HealthKit) and Android companion
  app (Health Connect) would each read whatever the user's devices already
  sync there (Apple Watch, Fitbit, Garmin, smart scales, etc.) and relay it
  to HELLO CAL's own backend — see the new `docs/SPECIFICATION.md` §4
  wording and `docs/HEALTHKIT_COMPANION.md`. This does **not** replace the
  direct Fitbit/Withings OAuth integrations already built (2026-08-28,
  above) — those remain independently useful for a user who doesn't want to
  install anything beyond the web app. Building the actual native app is a
  separate project requiring a Mac + Xcode (+ an Apple Developer Program
  membership) that could not be done from this session; what *was* prepared
  ahead of time, so the backend is ready the moment such an app exists:
  - `DeviceToken` model + `POST /api/integrations/healthkit/tokens`
    (create/list) and `DELETE .../tokens/[id]` (revoke) — a personal,
    SHA-256-hashed bearer token, generated from the Integrationer page
    ("Generér enhedskode"), shown once.
  - `HealthMetric` model (generic `type`/`value`/`recordedAt`, one row per
    day for cumulative types) for data that doesn't fit `WeightEntry`/
    `Activity` — steps, active/resting energy, heart rate, sleep minutes,
    body fat %, height, BMI, water.
  - `POST /api/integrations/healthkit/ingest`, bearer-token authenticated
    (no user login exists yet to build a real OAuth flow against), accepts
    a batch of `metrics`/`weights`/`activities` tagged
    `source: APPLE_HEALTH | GOOGLE_HEALTH`.
  - The three previously-hardcoded Statistik placeholder cards (`steps`,
    `water`, `burned` in `src/lib/stat-cards.ts`) now read real averages
    from `HealthMetric` once any exist, falling back to the old placeholder
    text otherwise — no UI change until real data is actually ingested.
  - `docs/HEALTHKIT_COMPANION.md` documents the full contract (HealthKit
    type → `HealthMetricType` mapping, request/response shape, a minimal
    Swift reference snippet) for whenever the native app work starts.

- 2026-08-29: HelloFresh Danmarks recipe catalog is imported as ordinary
  `Product` rows (`externalSource='HELLOFRESH'`, `status='APPROVED'`, category
  "Retter") rather than a separate `Recipe` model — this makes every imported
  dish immediately searchable/loggable through the existing Madvarer/tilføj
  flow with no new UI. A new shared `Ingredient` model (category
  "Ingredienser") caches each unique HelloFresh ingredient's image once and
  reuses it across every recipe that contains it; `ProductIngredient` records
  each ingredient's raw amount, gram amount (when the unit is grams), and its
  proportion of the dish's total tracked weight — the concrete building block
  for later "how much did the bell pepper contribute" estimates. **Explicit
  user decision (asked before building, given this reverses the copyright-risk
  avoidance established for the image-agent/Frida sources): download and
  rehost HelloFresh's dish/ingredient photos as requested, accepting the
  copyright/ToS exposure** — "Det er en app til [mig] jeg er igang med at
  udvikle. Så bare fortsæt som jeg skrev."
  Four `Category` rows (Retter/Menuer/Ingredienser/Færdigmad) were seeded for
  internal scanning/filtering only, not shown in the UI; "Menuer" and
  "Færdigmad" are reserved for future use — nothing populates them yet.
  `scripts/hellofresh-import` (new `hellofresh-agent` service) crawls
  `sitemap_recipe_pages.xml` — the sitemap HelloFresh's own `robots.txt`
  explicitly links for crawling — rather than the "Se flere" pagination UI:
  that button calls an internal `recipe.search` API on a Kubernetes-internal
  hostname (`products-service.live-k8s.hellofresh.io`, private DNS only, not
  reachable outside their cluster) and the `?page=` URL parameter is itself
  disallowed by `robots.txt`. Each recipe's own public page embeds its full
  data (name, macros, ingredients with gram amounts, image path) in a
  `__NEXT_DATA__` script tag — the same public HTML any visitor's browser
  receives, no auth or private API involved. Re-import matches on `recipeId`
  and updates existing rows rather than duplicating; HelloFresh frequently
  re-publishes the same dish under a new `recipeId` week to week
  (`clonedFrom` in their data) — a full same-dish-across-reruns dedup chain
  was **not** attempted in this first version, so near-duplicate `Product`
  rows across reruns of a dish are a known limitation. Per-ingredient
  vitamin/mineral estimation (matching each ingredient against Frida data)
  was also not implemented yet — Frida import currently only stores the four
  core macros (see the 2026-08-27 Frida entry above), not vitamins/minerals,
  so there is nothing yet to match against; the gram/proportion data this
  import produces is what a future pass would need. Recipe-level minerals
  HelloFresh already publishes directly (potassium/calcium/iron/fiber/sugar/
  salt) are stored as-is in a new `Product.nutritionExtra` JSON field.
  Images are downloaded at `w=2000` from `media.hellofresh.com` (Cloudinary-
  style `c_limit` never upscales, so this reliably returns the source file's
  native resolution) into a new shared `./data/hellofresh-images` volume,
  mounted into both the agent and the app (served as `/hellofresh-images/...`
  the same way `/product-images` already is for the image-agent).
  **Note:** a concurrent session was found mid-way through this same feature
  (an empty `scripts/hellofresh-import/`, an enum-only migration, and a
  `hellofresh-agent` compose block using different env var names, plus a
  separate `/api/ai/recognize-hellofresh` endpoint and a `kamera` "hellofresh"
  mode answering the "compare a plate photo against HelloFresh's catalog"
  part of the request) — the compose service block was reconciled to this
  session's actual env vars/volume; the recognize-hellofresh endpoint/camera
  mode were left untouched as out of this session's scope.
- 2026-08-29: The other side of the same feature, from the session referenced
  in the note directly above (recognize-hellofresh/kamera "hellofresh" mode):
  the user's original request asked for a "Ret nr." (dish number) field above
  the normal search box on `/madvarer`. **Confirmed directly with the user:
  HelloFresh only prints that number on the physical recipe card at
  delivery** — it does not appear anywhere on their public website (verified
  by inspecting the same `__NEXT_DATA__` payload the catalog-import agent
  reads), so it cannot be looked up from a typed number at all. Per the
  user's own follow-up ("den del må vi skippe... billedegenkendelsen må
  forhåbentligt kunne genkende retten"), the number field was dropped
  entirely in favor of AI photo recognition: `/api/ai/recognize-hellofresh`
  sends a photo of the plated meal plus the names of every currently
  non-discontinued `externalSource='HELLOFRESH'` product to `gpt-4o-mini`
  (vision), which returns its best-guess product id; a new `kamera`
  `?mode=hellofresh` capture flow (single-purpose — it hides the usual
  Stregkode/Måltid/Næring tab row) shows the match via `HelloFreshMatchReview`
  for the user to confirm before landing on the existing `/tilfoej/[id]`
  screen, reusing the ordinary registration flow rather than a new one. The
  entry point is a "HelloFresh — Genkend din ret" row above the search box on
  `/madvarer`. Separately, `/tilfoej/[id]` now treats any product with
  `servingSizeGrams` set as counted in portions rather than grams (the
  amount stepper steps by half a serving and labels itself "portion(er)");
  this is a small generic UI change, not HelloFresh-specific, but it is what
  makes the recognized HelloFresh dish's real per-portion `servingSizeGrams`
  (from the 2026-08-29 catalog-import entry above) display and log
  correctly. This session's own first-draft `scripts/hellofresh-import` (a
  simpler menu-listing crawler using a nominal 500 g serving size) was
  superseded on disk by the more thorough sitemap/ingredient-catalog version
  from the other session — only that version remains.

## Hosting and delivery

- Production is intended to run on the user's Synology NAS through Docker/Container Manager.
- PostgreSQL runs as a separate container with persistent storage.
- Remote web access uses the existing Cloudflare Tunnel; no application portforwarding is intended.
- Source code is stored in the private GitHub repository, and application images are published to GHCR.
- Secrets belong in server-side environment configuration and must never be committed.
- 2026-08-26: Production delivery uses GitHub-hosted image builds followed by an authenticated GHCR pull on Synology. Images receive both `latest` and immutable Git SHA tags; controlled deployments pin a SHA.
- 2026-08-26: The new stack is isolated as Compose project `hellocal-v2` under `/volume1/docker/App/hellocal-v2`, with PostgreSQL 17 and host port `3100`. The stopped legacy stack and `/volume1/docker/App/hellocal/postgres` remain untouched until a separate data-migration decision is made.
- 2026-08-26: The public HELLO CAL application remains accessible to anyone who
  knows its address, but every response carries an `X-Robots-Tag` noindex policy
  so search engines are instructed not to index or surface its contents.
- 2026-08-27: Nutrition-label photo capture (`/kamera?mode=naering`, per
  `docs/AI.md`'s "næringsdeklaration" flow) was previously unbuilt, not
  broken — only `produkt` and `maaltid` camera modes existed. Added a third
  camera mode with client-side OCR via `tesseract.js` (new dependency; no
  server/API key required) and pragmatic Danish-keyword regex heuristics
  (`src/lib/nutrition-ocr.ts`) to extract kcal/protein/kulhydrat/fedt per
  100 g. Extracted values, if any, are handed off to a new shared manual
  create-product screen, `src/app/madvarer/nyt/page.tsx` — the app had no
  such screen before this change, so both the OCR flow and the barcode
  "product not found" fallback needed one. `NutritionLabelReview.tsx` shows
  the OCR status and forwards the read values via `sessionStorage` to that
  screen for a final editable review before `POST /api/products` creates
  the `PENDING` product and opens the existing `/tilfoej/[id]` registration
  flow; OCR failure shows a clear manual-entry fallback there instead of
  failing silently. This is intentionally minimal — it does not implement
  the full four-step unknown-barcode flow (front + barcode + næringsdeklaration)
  described in `docs/AI.md`; that remains separate future work on the
  `produkt` mode.

## Engineering process

- Keep changes small and reviewable; large rewrites require explicit approval.
- Preserve unrelated local changes.
- A checkpoint is complete only after lint and production build pass, unless an unresolved check is documented in `docs/STATUS.md`.
- Local `npm run dev` uses Next.js' Webpack mode. Turbopack 16.2.12 produced a reproducible HMR panic in the OneDrive-synchronized repository, while Webpack and the production build are stable.
- 2026-08-30: Root `design.md` is the binding visual implementation contract
  for colors, typography, geometry, spacing, radius, icons, and reusable UI
  primitives. It does not override product behavior in `SPECIFICATION.md`,
  `DECISIONS.md`, or `UI.md`. Existing code is not a design authority when it
  differs from this contract. The source HelloFresh screenshots are measured
  at their original 1206x2622 resolution (exactly 3x a 402x874 logical
  viewport), not the 941x2048 preview size recorded in the older typography
  note. The references contain two contextual greens: `#067A46` for
  brand/auth/onboarding and `#35784A` for newer app bars; implementations must
  use named variants instead of blending them into an arbitrary third green.
  General horizontal screen padding is 16 px. The measured 32 px padding is a
  named editorial/feature variant, not a second default. Cards, rows, fields,
  buttons, modals and safe-area containers own their internal padding so pages
  may not compensate with route-specific margins or nested padding wrappers.
  `design.md` also contains the proposed CSS blueprint. That code is guidance,
  not an implemented state: runtime CSS must be migrated component by
  component, with temporary semantic legacy aliases, fresh in-place visual
  verification, lint, and build before any part is marked complete.
- 2026-08-31: The live official HelloFresh Denmark website is secondary visual
  evidence, while the supplied original app screenshots remain primary for
  Hello Cal. Official web computed styles confirm the shared core colors
  `#242424`, `#232323`, `#067A46`, `#FAF8F3`, `#656565`, and `#7D7561`, plus
  the 4/8-based spacing/radius family and 48 px controls. Web-only typography
  (Agrandir Tight/Roboto), marketing green `#056835`, and provider/state color
  differences must not overwrite direct app measurements. Exact documented
  web hover/active/focus values may be used only in their named interaction
  states.
- 2026-09-02: Standing rule — checkboxes must never be used anywhere in the
  app; every on/off preference uses the shared right-aligned iOS-style
  `Toggle` component (`src/components/ui/Toggle.tsx`). Replaced all remaining
  `type="checkbox"` usages (profil/indstillinger, profil/soevn, StatChart).
  Added `HfChevron` (`src/components/hf/HfChevron.tsx`) as the single allowed
  chevron primitive per `design.md` §6.7; `AccordionCard`'s literal "›" was
  replaced with it.
- 2026-09-02: Billede-dagbog stores photos client-side only (localStorage) —
  there is no blob/object storage infrastructure in this project yet. Only
  the "requires phone passcode" preference (`User.photoDiaryRequiresPasscode`)
  is persisted server-side; there is no real OS-level passcode/biometric
  enforcement, which is a future native-app concern.
- 2026-09-02: "Invitér en ven" reward bookkeeping (`Referral` model,
  `User.freeMonthsCredited`, `src/lib/referrals.ts`) is pure data-model and
  computation logic. There is still no real invite-link/referral-code or
  signup-attribution mechanism anywhere in the app (no account/login system
  generally, see `docs/STATUS.md`), so no `Referral` rows can be created yet.
  Do not invent a fake referral-code system to fill this gap — wire this up
  once real attribution exists.
- 2026-09-02: `design.md` typography resolved against a second independent
  measurement pass (ChatGPT) plus fresh visual re-checks of the source
  screenshots, closing prior ambiguities: inline text-links use only
  `#242424` (no separate muted/back-link color); `.hf-type-tab` differs
  active/inactive by color only, never weight (confirmed against
  `Startside.png`); social-login labels are weight 700 (confirmed against
  `Log-in.png`, same weight as adjacent CTA buttons); a new
  `.hf-type-progress-active` (600, `#035624`) and `.hf-type-progress-inactive`
  (400, `#828282`) pair was added for onboarding step indicators (confirmed
  against `Oprettelsesflow.png`); `.hf-type-page-title` and
  `.hf-type-category-title` are centered by default app-wide (not a
  auth-only variant) — this changes existing left-aligned page headings and
  must be applied when those screens are next touched.
- 2026-09-02: Standing rule — the appbar's closable-page action is always a
  back arrow (←), never an ✕/cross, anywhere in the app. This overrides
  `docs/UI.md`'s prior wording (now corrected) which had specified a cross
  icon; no shipped code used a cross in the appbar yet, so this was a
  forward decision, not a fix. Matches the user's separately stated global
  preference (back arrow over cross for close/back actions in any project).
- 2026-09-02: Built the guided product-creation auto-recognition flow the
  user specified (a fuller realization of `docs/AI.md`'s "Ny vare via
  stregkode" four-step flow, explicitly noted as never fully implemented —
  see the 2026-08-27 entry above). New, self-contained route
  `src/app/kamera/opret/page.tsx` (own camera bootstrap, does **not** touch
  the existing `/kamera` `produkt`/`maaltid`/`hellofresh` tabs, per explicit
  instruction) drives three stages: forsidefoto → stregkode → næring, ending
  on a new `src/app/produkt/opret/page.tsx` create-product page prefilled
  from whatever was recognized/captured (`src/lib/product-draft.ts`
  sessionStorage cache, same pattern as the existing OCR-draft key).
  Recognition order is local-first, AI only as the documented last resort
  per the user's explicit instruction: OCR text (`tesseract.js`, activating
  the previously-unused dependency noted in the 2026-08-27 entry) → fuzzy
  ≥90% text match (`src/lib/text-similarity.ts`, hand-rolled Levenshtein, no
  new dependency) against local products; if no text, a local average-hash
  image similarity check (`src/lib/image-similarity.ts`, canvas-based, no ML
  model) against generic Frugt/Grønt-category products; only then
  `/api/ai/recognize-product-photo` (OpenAI `gpt-4o-mini`, same pattern as
  `/api/ai/recognize-hellofresh`, requires ≥95% confidence to count as a
  match). Barcode step reuses the existing ZXing setup and
  `/api/products/lookup/[barcode]`. Nutrition step: regex parsing
  (`src/lib/product-ocr.ts:parseNutritionText`) first, `/api/ai/extract-nutrition`
  only if regex can't derive all four per-100g values, then a tolerance-based
  dedupe check (`/api/products/match-nutrition`) before falling through to
  the create page, matching the user's "if not ~identical to an existing
  product" wording.

  **Known limitation, flagged as an explicit assumption (not silently
  chosen):** there is no image-embedding/ML infrastructure in this project
  (no pgvector, no vision-embedding pipeline), so the "vektor"-matching step
  is a lightweight perceptual average-hash, not real ML similarity — it can
  reliably match a near-identical photo but cannot reliably distinguish
  visually similar produce (e.g. a peach vs. a nectarine). The AI-vision
  fallback is the real safety net for that case, per the user's own
  instructions. It also depends on `imageUrl` being readable by canvas
  (`crossOrigin: "anonymous"`) — an externally hosted candidate image without
  permissive CORS headers is silently skipped rather than breaking the flow.

  The 2×2 create-product media grid (`src/components/hf/CreateProductMediaGrid.tsx`:
  stregkode/næringsindhold/indholdsfortegnelse/produktbilleder, each behind a
  numbered corner badge) and its supporting primitives (`NumberedBadge`,
  `HfBarcodeIcon`, `ScanningOverlay`) are new Hello Cal-specific components,
  documented in `design.md` §6.11 per its own governance rule requiring new
  primitives to be named before a page uses them. The points banner
  ("Opret produktet og optjen 10 points") is **UI only** — there is no points/
  gamification data model anywhere in this project; the user explicitly
  deferred that to a separate task and asked only to show the box for now.
  `POST /api/products` was extended to optionally accept `barcode`,
  `imageUrl`, `ingredientsText`, and `extraImages` (creates the `Barcode`/
  `ProductImage` rows) — additive, existing manual-create behavior from
  `src/app/madvarer/nyt/page.tsx` is unchanged.

  While preparing to verify this with `npm run build`, found and resolved
  two unrelated pre-existing git merge-conflict-marker blocks left in
  `src/components/StatCardsGrid.tsx` and `src/components/StatChart.tsx`
  (from a `git stash`/pull conflict, not part of this change) — resolved by
  keeping the more complete/integrated side in each case (an orphaned
  `deviationLabel` helper and a `setSwipe` call with no matching `useState`
  declaration were dropped as clearly incomplete work-in-progress, not a
  deliberate feature removal). A concurrent session appeared to be resolving
  the same files at the same time; only the conflict(s) still present when
  checked were touched.

## 2026-09-02/03: Pointsystem, betaling, besked-automatisering, admin-brugere

- Points tildeles ved admin-godkendelse (produkter, fejlrapporter), ikke ved
  indsendelse — forhindrer at spam-indsendelser giver points.
- Ledger frem for et cachet saldofelt: `PointsTransaction` er kilden til
  sandhed, saldo er altid en SUM-forespørgsel.
- "Invitér en ven" giver 300 points til begge parter (ikke en direkte gratis
  måned); 300 points kan indløses til 1 gratis måned, som kræver en gemt
  betalingsmetode, så abonnementet fortsætter automatisk til fuld pris
  bagefter. Lifetime-loft på 12 gratis måneder er uændret fra den
  oprindelige `freeMonthsCredited`-regel.
- "Videresend ret/produkt til en ven" giver kun points når modtageren rent
  faktisk tilføjer varen til sin egen dag (ikke blot åbner linket), har et
  loft på 50 points/måned/bruger, og krydsspærrer to brugere der sender frem
  og tilbage mere end én tur-retur på 24 timer (flag håndteres i den
  eksisterende admin "Advarsler"-side, ingen ny admin-side).
- 48-timers admin-eskalering (produkter og fejlrapporter) kører som et
  in-process baggrundsjob i selve Next.js-serveren (`src/lib/scheduler.ts` +
  `instrumentation.ts`), DB-drevet og bevidst IKKE bundet til Synology Task
  Scheduler eller andet OS-cron — appen skal kunne flyttes til en anden
  host uden at miste funktionen.
- Mail (`src/lib/mailer.ts`, nodemailer) og Web Push (`src/lib/push.ts`,
  web-push) er forberedt fuldt ud men er bevidst no-op indtil
  `SMTP_*`/`VAPID_*`-miljøvariabler findes — se `docs/DEPLOYMENT.md`. Ingen
  konkret mailudbyder er valgt endnu.
- **Sydtrafik-infrastruktur eller -konti må ALDRIG bruges til noget i dette
  projekt** — Hello Cal er brugerens eget personlige projekt, fuldstændig
  adskilt fra dennes arbejdsplads. Gælder mail, hosting, betaling — alt.
- Betalingsside/-model er bevidst udbyder-uafhængig: der er endnu ingen
  indløsningsaftale, så `Subscription`/`PaymentMethod` er forberedt med et
  `PaymentProvider`-enum (Reepay/Quickpay/Stripe/MobilePay Online), men
  ingen konkret PSP-API kaldes i kode endnu. MobilePay-understøttelse kræver
  en dansk PSP (ikke Stripe alene) — vælges når en aftale findes.
- GDPR "ret til at blive glemt" er en **anonymisering**, ikke et hårdt slet:
  mange tabeller kræver `userId` (RESTRICT) for at bevare
  registrerings-snapshot-princippet. `src/lib/gdpr.ts` rydder PII og
  login-midler, men bevarer selve User-rækken og dens historik.
- Admin "log ind som bruger" (impersonation) og GDPR-sletning logges begge i
  en ny `AdminAuditLog`-tabel — følsomme admin-handlinger skal kunne
  efterspores.
- To Prisma-migrationer i denne batch (`20260902020000_points_messaging_forwards`,
  `20260902030000_payments_referrals_admin_users`) blev skrevet i hånden,
  fordi arbejdsstationen ikke har lokal database-adgang til at generere dem
  med `prisma migrate dev`. De er kun valideret med `prisma validate` +
  `prisma generate` + `tsc --noEmit` — skal gennemgås og køres med
  `prisma migrate deploy` ved næste Synology-udrulning før de kan stoles på.

