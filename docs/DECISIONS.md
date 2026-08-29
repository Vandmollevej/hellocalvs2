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
  dedicated hostname (`products.hellocal.packroff.dk`) rather than a path on
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
  works on `products.hellocal.packroff.dk` and `localhost`. `/admin/setup`
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
