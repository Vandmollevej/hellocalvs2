# HELLO CAL — deployment

This document distinguishes the repository's current implementation from the
live Synology installation. Never store credentials, tokens, tunnel IDs, or
private hostnames in the repository.

## Production architecture

- GitHub Actions builds the application on a GitHub-hosted runner.
- Each push to `master` publishes both `latest` and an immutable Git commit SHA
  tag to `ghcr.io/vandmollevej/hellocalvs2`.
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
- There is no local dev server or local database on this machine. The only
  running instance of HELLO CAL is the **production Synology deployment**,
  reachable at `https://hellocal.packroff.dk` (`/api/health` → `{"status":"ok"}`
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

## Search indexing

The application adds `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet,
noimageindex` to every response. This lets search engines crawl the public app
only to see that it must not be indexed. Do not use `robots.txt` to block the
app while relying on `noindex`, because a blocked crawler cannot read that
instruction. If the application must be private rather than merely hidden from
search, protect it with an access-control layer such as Cloudflare Access.

## Backup

Create a database backup before every application update and before applying a
new migration. Run from the production directory:

```sh
sudo docker compose --env-file .env.production -f compose.production.yaml exec -T db pg_dump -U hellocal -d hellocal -Fc > backups/hellocal-$(date +%Y%m%d-%H%M%S).dump
```

Confirm that the dump exists and is non-empty. Backups must also be copied to a
second storage location; a file beside the live database is not sufficient as
the only backup.

Restoration is intentionally not automated. A restore replaces database state
and must be planned against a stopped application after the exact backup and
target database have been verified.

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
