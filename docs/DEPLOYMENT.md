# HELLO CAL — deployment

This document distinguishes the repository's current implementation from the
live Synology installation. Never store credentials, tokens, tunnel IDs, or
private hostnames in the repository.

## Production architecture

- GitHub Actions builds the application on a GitHub-hosted runner.
- Each push to `master` publishes both `latest` and an immutable Git commit SHA
  tag to `ghcr.io/vandmollevej/hellocalvs2`.
- After the image build succeeds, the self-hosted deploy job checks out the same
  commit, syncs `compose.production.yaml` plus the locally-built REMA 1000 and
  quality-control and amount-suggestion agent contexts into the server
  deployment directory, and sets
  `HELLOCAL_TAG` to that exact commit SHA before running Compose. This keeps the
  server definition, local build contexts, and application image on one release.
  Core database migrations and the web app are started before the locally-built
  catalog and quality-control agents, so an auxiliary-agent build failure cannot
  prevent the already-verified web release from starting.
- Synology Container Manager pulls the image and runs the application together
  with PostgreSQL 17 through `compose.production.yaml`.
- `prisma migrate deploy` runs as a one-shot service after PostgreSQL is healthy
  and before the application starts.
- PostgreSQL is only attached to the private Compose backend network. It has no
  published host port.
- The application is published on NAS port `3100` by default. No router
  port-forward is used; remote traffic enters through the existing Cloudflare
  Tunnel.

## Existing installation: preserve it

The server inventory from 2026-08-26 found an older, stopped HELLO CAL stack:

- Compose directory: `/volume1/docker/App/hellocal`
- PostgreSQL image: `postgres:17-alpine`
- PostgreSQL data: `/volume1/docker/App/hellocal/postgres`
- Other stopped services: `hellocal-web`, `hellocal-api`, `hellocal-minio`, and
  `hellocal-redis`

Do not start, delete, rename, or reuse those containers or directories during
the new deployment. The new stack uses:

- Compose project: `hellocal-v2`
- Server directory: `/volume1/docker/App/hellocal-v2`
- Database data: `/volume1/docker/App/hellocal-v2/data/postgres`
- Application port: `3100`

This separation is required until the old data has been assessed and either
formally migrated or archived.

## Local development environment (this Windows workstation)

- This workstation has **no Docker, no WSL, and no local PostgreSQL** — confirmed
  2026-08-27 (`Get-Command docker`, `wsl.exe -l`, and every relevant Windows
  service all come back empty/not-installed). The repository's root
  `docker-compose.yml` (a plain `postgres:16-alpine` service on `5432`) cannot
  be started here.
- Do not repeatedly ask the user to start a local database or install Docker —
  it requires local admin rights the workstation does not have (see
  "Administrative access" below), so the answer will not change between
  sessions. Do not propose installing Docker Desktop/WSL as a fix.
- Node.js **is** installed on this workstation, at `C:\Program Files\nodejs`,
  but it is not on the Bash tool's default `PATH` (a plain `node`/`npm`/`npx`
  call fails with "command not found"). Prepend it once per session instead of
  concluding Node is missing or asking the user to install it:
  `export PATH="$PATH:/c/Program Files/nodejs"` (Bash) — confirmed working for
  `node`, `npm`, and `node_modules/.bin/prisma` (2026-09-12).
- There is no local dev server or local database on this machine. The only
  running instance of HELLO CAL is the **production Synology deployment**,
  reachable at `https://hellocal.io` (old `https://hellocal.packroff.dk` still routed) (`/api/health` → `{"status":"ok"}`
  when it is up).
- Consequence for verification: `npm run lint` and `npm run build` are the
  verification bar reachable from this workstation (per `docs/DECISIONS.md`
  "Engineering process"). Live browser verification of a change requires it to
  actually be deployed to the Synology first, which needs the user to open the
  SSH maintenance switch and authenticate (see "Administrative access") — this
  is a user action, not something to poll or wait out. Ask the user once
  whether they want the change deployed for live verification; do not ask
  again in later sessions unless something about this changes.

## Administrative access

- The Windows workstation has no local administrator access. Deployment must
  use existing Windows tools and the Synology server.
- Synology SSH listens internally on port `22`. External maintenance access is
  temporarily enabled through the existing Home Assistant switch and the
  documented external port `2222`.
- The workstation is on the same LAN as the NAS (`192.168.1.90`, same host the
  Cloudflare Tunnel points at — see "Cloudflare Tunnel cutover" below), so a
  plain `ssh Peter@192.168.1.90` from this workstation reaches it directly over
  internal port `22` — the Home Assistant switch/external port `2222` is only
  needed for a connection from *outside* the LAN. SSH username: `Peter`.
- Password authentication is currently required because the workstation's
  Ed25519 key is not yet authorized.
- Turn the Home Assistant SSH switch off immediately after maintenance.
- Never include passwords, PATs, private keys, or the Cloudflare tunnel token in
  command output copied into chat or committed files.

## Files used in production

- `Dockerfile`: builds the Next.js standalone application and includes the
  Prisma CLI used by the migration service.
- `compose.production.yaml`: isolated app, migration, and database services.
- `.env.production.example`: non-secret template. The real `.env.production`
  exists only on the server and is ignored by Git.
- `prisma/migrations/`: reviewed SQL migrations applied by the one-shot service.
- `/api/health`: verifies that both Next.js and PostgreSQL respond.

## Oprettelses-app og logo-robot (2026-09-25)

- `scan-app`: samme image som `app`, men `HELLOCAL_APP_MODE=scan` (kun
  medarbejder-ruterne). Port `SCAN_APP_HTTP_PORT` (3101). Kræver et eget
  hostname i Cloudflare Tunnel og `SCAN_APP_BASE_URL`. Deploy-workflowet
  starter den endnu ikke automatisk — tilføj `scan-app` til
  `up -d db migrate app`, når brugeren godkender det. Manuelt:
  `docker compose ... up -d scan-app`.
- `logo-agent`: lokalt bygget Python-container (`scripts/logo-agent`),
  kører hver nat kl. `LOGO_AGENT_RUN_HOUR`. Bruger `GOOGLE_VISION_API_KEY`
  (fallback `GOOGLE_API_KEY`). Ingen `:?`-krav, så en manglende nøgle ikke
  stopper stakken. Heller ikke med i deploy-workflowet endnu.
- Se `.env.production.example` for alle nye variabler.
- Hjælpe-chatbot (2026-10-02): valgfri `OPENAI_CHATBOT_MODEL` (standard
  `gpt-4o-mini`). Bruger den eksisterende `OPENAI_API_KEY`. Migration
  `20261002120000_chatbot` køres af deployet.

## Umami (analyse, 2026-09-27)

- Services `umami-db-init` (opretter databasen `umami` i `db`, hvis den
  mangler) og `umami` (`ghcr.io/umami-software/umami:${UMAMI_TAG:-3.4.0}`).
  Deploy-workflowet starter dem som sidste trin; manuelt:
  `docker compose ... up -d umami-db-init umami`.
- Kun på det interne `backend`-netværk: ingen port og intet tunnel-hostnavn.
  Appen sender `/umami/script.js` og `/umami/api/send` videre til
  `http://umami:3000` (`UMAMI_URL`).
- Login: Umami opretter `admin`/`umami` ved første start, og appen bruger det.
  Skiftes koden i Umami, sættes den nye i `UMAMI_PASSWORD` i `.env.production`.
- `UMAMI_APP_SECRET` er valgfri; tom = Umami udleder nøglen af sin
  `DATABASE_URL`. Kræver URL-sikker `POSTGRES_PASSWORD` (som i forvejen).
- Backup: databasen `umami` ligger i samme PostgreSQL; `pg_dump -d hellocal`
  tager den ikke med. Tag `pg_dump -d umami` med, hvis statistikken skal bevares.

## First deployment

Do not perform these steps until the image build for the deployment commit has
completed successfully in GitHub Actions.

1. Open the SSH maintenance port through Home Assistant and connect to the NAS.
2. Create `/volume1/docker/App/hellocal-v2` and its `data/postgres` and `backups`
   directories. Keep all persistent data below this shared folder.
3. Transfer `compose.production.yaml` and `.env.production.example` from the
   checked-out repository. Copy the example to `.env.production` on the server.
4. Set a long URL-safe database password in both `POSTGRES_PASSWORD` and
   `DATABASE_URL`. Set neither value in the repository. Keep `HELLOCAL_TAG` on a
   specific Git SHA for a controlled release; use `latest` only for the first
   isolated smoke test.
5. Log in to GHCR without putting the token on the command line:

   ```sh
   sudo docker login ghcr.io -u Vandmollevej
   ```

   Enter a GitHub personal access token with `read:packages` when prompted.
6. From `/volume1/docker/App/hellocal-v2`, validate the Compose file without
   printing its resolved secrets:

   ```sh
   sudo docker compose --env-file .env.production -f compose.production.yaml config --quiet
   ```

7. Pull and start the isolated stack:

   ```sh
   sudo docker compose --env-file .env.production -f compose.production.yaml pull
   sudo docker compose --env-file .env.production -f compose.production.yaml up -d
   ```

8. Check service state and the local health endpoint:

   ```sh
   sudo docker compose --env-file .env.production -f compose.production.yaml ps
   curl --fail http://127.0.0.1:3100/api/health
   ```

The `migrate` service should show exit code `0`; `db` and `app` should be
healthy. A failed migration prevents the application service from starting.

## Cloudflare Tunnel cutover

The existing `Cloudflare_Tunnel` container was running during the 2026-08-26
inventory. Do not inspect its environment or full command because those may
contain its token.

After the isolated health check passes, configure a temporary test hostname in
the remotely managed tunnel to route to `http://<NAS-LAN-IP>:3100`. Verify the
test hostname before changing the current HELLO CAL route. There must be no
router port-forward for port `3100`.

Verified on 2026-08-26: the temporary public hostname
`hellocal-test.packroff.dk` routes through the existing `Server` tunnel to
`http://192.168.1.90:3100`. The application loaded successfully from the public
hostname. The existing `server.packroff.dk` and `webmail.packroff.dk` routes
were not changed.

The permanent public hostname `hellocal.packroff.dk` was then added to the same
tunnel and verified successfully against `http://192.168.1.90:3100`. The
temporary test route was removed after this verification. The mistaken
`hallocal.packroff.dk` route was also removed; neither obsolete DNS record
remains.

Record only the non-secret route shape after it has been confirmed. Never record
the tunnel ID or token.

### Admin hostname (`adminhellocal.packroff.dk`)

The admin approval UI (`docs/ADMIN.md`) is the same application and the same
target as `hellocal.packroff.dk` (`http://192.168.1.90:3100`) — only the
public hostname differs; `middleware.ts` routes by hostname. Add it as a
second public hostname on the same existing tunnel, the same way
`hellocal.packroff.dk` was added above. This step needs the Cloudflare
dashboard login and was not done as part of adding the admin UI's code —
see `docs/STATUS.md`.

### Domæne hellocal.io (2026-09-27)

Produktdomænet er nu `hellocal.io` (Cloudflare-zone, samme konto). Mål i
tunnellen `Server`:

| Hostname | Mål |
| --- | --- |
| `hellocal.io` (+ `www.hellocal.io`) | `http://192.168.1.90:3100` |
| `admin.hellocal.io` | `http://192.168.1.90:3100` |
| `scan.hellocal.io` | `http://192.168.1.90:3101` |

De gamle `*.packroff.dk`-hostnavne bliver liggende i tunnellen, men
packroff.dk-zonen har redirect-regler (308, sti + query bevares):
`hellocal.packroff.dk` → `hellocal.io`, `adminhellocal.packroff.dk` →
`admin.hellocal.io`, `scanhellocal.packroff.dk` → `scan.hellocal.io`.
`www.hellocal.io` → `hellocal.io` (301). Derfor virker OAuth-callbacks, der
stadig er registreret på det gamle domæne (`INTEGRATIONS_REDIRECT_BASE_URL`
står bevidst på `hellocal.packroff.dk`, indtil Strava har fået den nye URI;
`WITHINGS_REDIRECT_URI` og `GOOGLE_HEALTH_REDIRECT_URI` peger på `hellocal.io`).
`middleware.ts` accepterer begge admin-hostnavne. Email Routing: MX, SPF
(`include:_spf.mx.cloudflare.net include:spf.mailjet.com`) og DMARC `p=none`
er sat; `support@` + catch-all → `peter@packroff.dk` (kræver at modtager-
adressen er bekræftet via Cloudflares mail). Server-
`.env.production` skal have `APP_BASE_URL`/`INTEGRATIONS_REDIRECT_BASE_URL=https://hellocal.io`,
`ADMIN_BASE_URL=https://admin.hellocal.io`, `SCAN_APP_BASE_URL=https://scan.hellocal.io`
og `SMTP_FROM=Hello Cal <no-reply@hellocal.io>` (kræver at `hellocal.io` er
verificeret afsenderdomæne i Mailjet: SPF + DKIM-TXT i Cloudflare-zonen).
Kontaktadresse `support@hellocal.io` videresendes med Cloudflare Email
Routing. OAuth-redirect-URI'er hos Google, Facebook, Apple, Strava, Withings,
Polar, Garmin, WHOOP, Huawei m.fl. og MobilePay-webhooken skal pege på `hellocal.io`. Garmins ping-adresse er `https://hellocal.io/api/integrations/garmin/webhook?key=<GARMIN_WEBHOOK_KEY>`. Passkeys er
bundet til hostnavnet og skal oprettes igen på det nye domæne.

## Search indexing and crawler protection

Every response carries `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet,
noimageindex`, and `public/robots.txt` is `Disallow: /`. This is only a request
to well-behaved bots. The real protection is the access wall in
`middleware.ts` / `src/lib/access-wall.ts` (docs/DECISIONS.md 2026-10-08):
known crawlers and script clients get 403, anonymous visitors only reach the
front page, login and legal pages, and everything else (pages, APIs, product
images) needs a valid user session.

Recommended Cloudflare settings for hellocal.io (dashboard, not code):
Security → Bots → Bot Fight Mode on; "Block AI bots" / AI Scrapers and Crawlers
on; a rate-limiting rule on `/api/auth/*` (e.g. 10 requests/min per IP).
New public routes (webhooks, OAuth callbacks) must be added to
`PUBLIC_API_PREFIXES` in `src/lib/access-wall.ts`, otherwise anonymous calls
get 401.

## Backup

Create a database backup before every application update and before applying a
new migration. Run from the production directory:

```sh
sudo docker compose --env-file .env.production -f compose.production.yaml exec -T db pg_dump -U hellocal -d hellocal -Fc > backups/hellocal-$(date +%Y%m%d-%H%M%S).dump
```

Confirm that the dump exists and is non-empty. Backups must also be copied to a
second storage location; a file beside the live database is not sufficient as
the only backup.

### Fuld container-backup

`scripts/backup/backup-all-containers.sh` kopieres af deployet til
`/volume1/docker/App/hellocal-v2/scripts/backup-all-containers.sh` og køres manuelt:

```sh
ssh -t Peter@192.168.1.90 "sudo bash /volume1/docker/App/hellocal-v2/scripts/backup-all-containers.sh"
```

Den dumper Postgres/MySQL i stedet for at kopiere deres rå datamapper, kopierer
hver mount-mappe én gang (også når flere containere deler den, og ikke
runnerens /deploy, der indeholder alle de andre), og hardlinker uændrede filer
mod forrige backup med `rsync --link-dest`. Docker-images tages kun med
`--with-images`. Resultatet lægges i `/volume1/docker/App/backups/containers-<tid>`.

Restoration is intentionally not automated. A restore replaces database state
and must be planned against a stopped application after the exact backup and
target database have been verified.

## Login (brugere)

Almindelige brugere logger ind med e-mail + adgangskode, Face ID (passkey),
Google, Apple eller Facebook (docs/DECISIONS.md 2026-09-24 "Normalt login").
Alle variabler sættes i `.env.production` (se `.env.production.example`) og
sendes videre af `compose.production.yaml`.

- `USER_SESSION_SECRET` og `APP_BASE_URL` (`https://hellocal.io`).
- SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`):
  glemt adgangskode og advarsel ved login fra ny enhed/nyt land. Uden SMTP
  bliver mails liggende i køen. Udbyder: Mailjet (`in-v3.mailjet.com`, port
  587, API-nøgle som bruger, secret key som adgangskode). Aktiv fra 2026-09-25.
- SMS via TeamMessage (`TEAMMESSAGE_API_TOKEN`, valgfrit `TEAMMESSAGE_TEAM_ID`,
  `TEAMMESSAGE_TEAMLIST_EMAIL`, `TEAMMESSAGE_SENDER`, `TEAMMESSAGE_API_URL`):
  kode på SMS ved glemt adgangskode. Kan også sættes i admin → API-nøgler → SMS.
  Uden token sendes ingen SMS. Migration `20261002110000_password_reset_sms`.
- Face ID/passkeys kræver HTTPS på det rigtige domæne (Cloudflare Tunnel).
  Ingen nøgler nødvendige.
- Google: Google Cloud Console → APIs & Services → OAuth consent screen
  (External) → Credentials → OAuth client ID (Web application). Authorized
  redirect URI: `<APP_BASE_URL>/api/auth/oauth/google/callback`.
  → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Facebook: developers.facebook.com → Create App (Consumer) → Facebook Login
  → Valid OAuth Redirect URI: `<APP_BASE_URL>/api/auth/oauth/facebook/callback`.
  Appen skal i "Live"-tilstand (kræver privatlivspolitik-URL).
  → `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`.
- Apple (kræver betalt Apple Developer-konto): Identifiers → App ID med
  "Sign in with Apple" → Services ID (= `APPLE_CLIENT_ID`), konfigurér domæne
  `hellocal.io` og Return URL
  `<APP_BASE_URL>/api/auth/oauth/apple/callback` → Keys → ny nøgle med
  "Sign in with Apple" (`APPLE_KEY_ID`, .p8-indholdet som
  `APPLE_PRIVATE_KEY` med linjeskift skrevet som `
`), `APPLE_TEAM_ID`
  øverst til højre på developer.apple.com.
- En knap, hvis nøgler mangler, viser "Login med X er ikke sat op endnu".

## API-nøgler fra admin

Alle API-nøgler (login, integrationer, OpenAI, SMTP, push m.fl.) kan også
indtastes og testes på `admin.hellocal.io/admin/api-keys`. En værdi
gemt dér vinder over `.env.production` og virker uden genstart. Database,
sessionsnøgler og adresser ændres stadig kun i `.env.production`
(docs/DECISIONS.md 2026-09-25 "API-nøgler i admin").

## Controlled update

1. Confirm GitHub Actions published the intended commit SHA tag.
2. Create and verify a database backup.
3. Change only `HELLOCAL_TAG` in the server's `.env.production` to that full SHA.
4. Run `pull`, then `up -d` with the commands from the first deployment.
5. Verify Compose state, `/api/health`, product lookup, and registration.
6. Turn off the SSH maintenance switch (only relevant if the external
   maintenance port was used — not needed when connected from the home LAN).

### `deploy.sh` (2026-08-29)

Steps 2–5 above are wrapped in `/volume1/docker/App/hellocal-v2/deploy.sh` on
the server (not committed to this repo — server-only, since it has no
secrets but is purely an operational convenience script). Usage:

```sh
cd /volume1/docker/App/hellocal-v2
./deploy.sh <full-commit-sha>
```

It backs up the database, sets `HELLOCAL_TAG`, pulls, rebuilds the
locally-built agents (`--build`), prints Compose status, and checks
`/api/health` — all in one call. Re-create it (base64-encode the script and
`| base64 -d > deploy.sh` in one line — see below) if the server is ever
rebuilt.

The GitHub Actions deploy job now performs the same release-tag update and
local-agent rebuild automatically after a successful image build. Keep
`deploy.sh` for manual controlled updates and recovery; do not remove it.

**Operational gotchas found deploying HelloFresh (2026-08-29), for next time:**
- The Synology's SFTP subsystem appears chrooted — plain `scp`/SFTP to
  absolute paths outside it silently fails (`stat remote`/`dest open`: "No
  such file or directory") even though the path exists and is writable over
  a normal SSH shell. Workaround used: write files server-side instead of
  transferring them — base64-encode the file locally, then on the server
  `echo "<base64>" | base64 -d > path/to/file` as **one single line** (no
  embedded newlines to go wrong).
- The Windows Terminal/cmd.exe SSH session reliably swallows the newline
  between a pasted command and whatever is pasted/typed next, silently
  concatenating them into one broken line. Never send two commands
  expecting them to land as separate lines — chain everything needed into
  one line with `&&`, or use a script like `deploy.sh` instead.
- `sudo` requires a real TTY: a non-interactive `ssh host "sudo ..."` fails
  with "a terminal is required to read the password" unless you add `-t` to
  force a pseudo-terminal.

## Rollback

For a release with no database migration, set `HELLOCAL_TAG` back to the previous
known-good SHA and run `pull` followed by `up -d`.

If the failed release applied a database migration, do not start an older image
blindly. Stop the app, assess migration compatibility, and restore the verified
pre-update database dump only when that destructive recovery step has been
explicitly approved.

## Required verification before production

1. `git diff --check`
2. `npm run lint`
3. `npm run build`
4. Build the Docker image.
5. Validate `compose.production.yaml` with real server-side environment values.
6. Start the isolated app/database stack.
7. Verify migrations, health, persistence, restart, product lookup, and
   registration.
8. Verify the temporary Cloudflare route, backup, and rollback procedure.

## MobilePay (betaling)

- Kræver en MobilePay-salgsstedsaftale med **Recurring API** slået til (portal.vippsmobilepay.com).
- Læg nøglerne i admin → API-nøgler → Betaling → MobilePay (eller i `.env.production`): `MOBILEPAY_CLIENT_ID`, `MOBILEPAY_CLIENT_SECRET`, `MOBILEPAY_SUBSCRIPTION_KEY`, `MOBILEPAY_MERCHANT_SERIAL_NUMBER`. `MOBILEPAY_ENV=test` bruger testmiljøet; tomt = produktion. Tryk "Test".
- Webhooken (`APP_BASE_URL/api/payments/mobilepay/webhook`) registreres automatisk ved første scheduler-kørsel efter nøglerne er sat. Adressen skal kunne nås udefra.
- Migration: `20260926120000_mobilepay_recurring`.

## Lettere deploy (2026-09-28)

- Push til master, der kun ændrer `docs/**` eller `*.md`, starter intet build/deploy (`paths-ignore` i `build.yml`).
- `.dockerignore` udelukker `docs`, rod-`*.md`, `.github` og `.claude`, så de ikke sendes med til Docker-buildet.

## Stripe (2026-09-29)

1. Opret Stripe-konto, aktivér **MobilePay** og **kort** under Indstillinger → Betalingsmetoder (kortet dækker EC/girocard for Tyskland).
2. Læg `STRIPE_SECRET_KEY` (sk_live_… / sk_test_…) i admin → API-nøgler → Betaling → Stripe og tryk "Test".
3. Deploy med migrationen `20260929150000_stripe_payments`. Serveren registrerer selv webhooken `https://<APP_BASE_URL>/api/payments/stripe/webhook` inden for 15 min. (eller sæt `STRIPE_WEBHOOK_SECRET` fra dashboardet).
4. `APP_BASE_URL` skal være den offentlige https-adresse (bruges til retur- og webhook-adresser).

## Udrulning uden nedetid (2026-10-04)

Før: hver udrulning genskabte `app`-containeren, og sitet gav "Bad Gateway" i ca. 40 sekunder (målt 2026-10-04: 9 udrulninger på ca. 50 minutter fra flere sessioner).

Nu:

- `edge-proxy` (nginx, `scripts/edge-proxy/nginx.conf`) ejer serverens port `3100` (`HELLOCAL_HTTP_PORT`); Cloudflare Tunnel peger stadig på `http://192.168.1.90:3100`. `app` udgiver ikke længere en port og kan derfor køre i flere kopier. Proxyen sætter ingen `X-Forwarded-*`-headere: appen læser klient-IP (admin-IP-begrænsningen) fra `cf-connecting-ip`, og tunnelens headere skal videregives uændret.
- Deploy-trinnet kalder `scripts/deploy/rollout-app.sh`: (1) `nginx -t` på konfigurationen, (1b) migreringerne køres eksplicit (`run --rm --no-deps migrate`) og stopper udrulningen, hvis de fejler — `depends_on` alene var ikke nok, se "Prøvekørsel af migreringer", (2) ny app-container startes ved siden af den gamle (`up -d --scale app=2 --no-recreate app`), (3) venter til den er sund (healthcheck hvert 5. sekund, op til 3 minutter), (4) stopper og fjerner den gamle. Bliver den nye ikke sund, fjernes den, den gamle bliver stående, og udrulningen fejler — sitet er uberørt.
- Første udrulning efter denne ændring har én kort afbrydelse (den gamle app ejer endnu port 3100 og genskabes uden port, derefter starter proxyen). Scriptet vælger selv den vej.
- `scan-app` (scan.hellocal.io) og agenterne er uændrede og genstartes som før.
- Ændringer, der kun rører `docs/**`, `**/*.md` eller `tools/**`, starter intet build/deploy.
- Ved problemer: `docker compose ... logs edge-proxy`; hurtig tilbagerulning er at gendanne `ports` på `app` i compose-filen og køre `docker compose ... up -d app` (proxyen fjernes med `rm -sf edge-proxy`).

## Prøvekørsel af migreringer og overvågning (2026-10-07)

Hændelse 2026-10-06/07: migreringen `20261004190000_user_email_hash` brugte tabelnavnet `"User"` (tabellen hedder `"users"`) og fejlede i produktion. `up --no-recreate` genbrugte den gamle, afsluttede migrate-container som "gennemført", så den nye kode gik i drift uden kolonnen (P2022 ved hvert brugeropslag). `migrate deploy` afviste derefter alle senere deploys (P3009), og `/api/health` svarede "ok" (kun `SELECT 1`) — fejlen stod ubemærket i 17 timer.

Sikringer:

- **Prøvekørsel:** `scripts/deploy/test-migrations.sh` (deploy-trin før udrulningen) kopierer produktionens skema + `_prisma_migrations` (ingen brugerdata) til en midlertidig PostgreSQL (`hellocal-migrate-test` på `backend`-netværket) og kører den nye releases `migrate`-service mod kopien. Fejler den, stopper deployet før produktionen røres. Kan kopien ikke indlæses, advares der, og testen springes over.
- **Rækkefølge:** `rollout-app.sh` kører migreringerne eksplicit, før en ny app-container startes.
- **Healthcheck:** `/api/health` henter også en (ikke-eksisterende) bruger med alle kolonner, så ny kode mod en database uden sine migreringer aldrig bliver sund. `/api/health?deep=1` melder desuden fejlede migreringer (HTTP 503 `degraded`).
- **Overvågning:** `.github/workflows/uptime.yml` kalder `https://hellocal.io/api/health?deep=1` hvert 5. minut fra GitHubs servere (virker også, når NAS'en er nede; tre forsøg før alarm). En fejlet kørsel giver mail/push fra GitHub til den, der sidst ændrede workflowet (GitHub-indstilling: Notifications → Actions → "Only notify for failed workflows").
- **Admin:** forsiden viser en rød boks "Deploy blokeret", når en migrering står som fejlet.
- Gendannelsen 2026-10-07 skete via en midlertidig `prisma migrate resolve --rolled-back …` i `migrate`-servicen (c245f4cb), fjernet igen efter migreringen var anvendt. Samme fremgangsmåde bruges, hvis en migrering igen står som fejlet.

### Overvågning (2026-10-08)

Tre lag, så en fejl altid giver besked:

1. **GitHub** (`.github/workflows/uptime.yml`): hvert 5. minut udefra; virker også, når NAS'en er slukket. Mail/push fra GitHub.
2. **Vagt-robot på NAS'en** (`scripts/uptime-agent`, service `uptime-agent`): hver time (`UPTIME_CHECK_INTERVAL_SECONDS`, standard 3600) tjekkes `hellocal.io` udefra (gennem tunnelen), appen indefra (`http://app:3000`, uden om Cloudflare — skelner tunnel- fra app-fejl), alle `hellocal-v2`-containere (Docker-socket, kun læsning; afsluttede containere med `restart: "no"` springes over) og ledig plads på `/volume1` (alarm under 10 %). Mail til `UPTIME_ALERT_EMAIL` (standard `peter@packroff.dk`) ved ny fejl, påmindelse hver 6. time og "løst"-mail, når det virker igen; en "vagt-robot startet"-mail ved hver opstart bekræfter, at mail virker (og afslører en NAS-genstart). SMTP som appen: `.env.production` overskrevet af admin-gemte nøgler i `app_secrets` (dekrypteres med `ADMIN_SESSION_SECRET`). Startes i deploy-jobbet før migreringer og app, uden `depends_on`, så den kører, selv om de fejler.
3. **Cloudflare** (sættes op i Cloudflare-dashboardet af brugeren, ikke i koden): Notifications → "Tunnel Health Alert" for tunnelen og evt. "Passive Origin Monitoring" for hellocal.io — mail, når tunnelen eller NAS'en ikke svarer Cloudflare.

## Feltkryptering af brugerdata (2026-10-04)

`User.email` og `User.displayName` er krypteret i databasen (AES-256-GCM). Nøgler (aldrig i git, aldrig i logs):

- `USER_DATA_KEY` — 32 bytes base64: `openssl rand -base64 32`
- `USER_EMAIL_HASH_KEY` — separat nøgle til opslags-hash: `openssl rand -base64 32`

Begge er sat på `app` og `scan-app` i `compose.production.yaml` og vises i `.env.production.example`. **Gem dem i en adgangskodemanager og tag backup af dem adskilt fra databasebackuppen** — uden `USER_DATA_KEY` kan navn/e-mail ikke læses, og nøglerne må ikke ændres efter backfill.

Rækkefølge på Synology (sudo kræver brugerens adgangskode):

1. Tag en database-backup (se "Backup").
2. Tilføj begge nøgler til `.env.production`.
3. Deploy som normalt (migrationen `20261004190000_user_email_hash` er additiv: kolonnen `emailHash` + unikt indeks).
4. Tør-kørsel (ændrer intet): `sudo docker compose --env-file .env.production -f compose.production.yaml exec -T app node - < scripts/encrypt-user-data/backfill.cjs`
5. Kør for alvor (idempotent, kan gentages): samme kommando med `node - --apply`. Scriptet skriver kun antal og id'er, aldrig værdier. Slutter med "Tilbage ukrypteret: 0".
6. Tjek login, `/admin/admin-users` (navn + e-mail) og en mail-udsendelse.

Uden nøgler kører appen som før (klartekst); nye rækker, der oprettes før nøglerne er sat, krypteres af backfill. Er `emailHash`-kollision (to e-mails der kun adskiller sig på store/små bogstaver) rapporterer backfill id'et, og rækken rettes manuelt.
