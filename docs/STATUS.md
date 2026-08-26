# HELLO CAL — project status

Last updated: 2026-08-26

## Current checkpoint

- Repository: `Vandmollevej/hellocalvs2`
- Branch: `master`
- Latest published checkpoint: `3c66ae5` — isolated Synology production deployment.
- GitHub authentication is working; only this status reconciliation remains to
  be pushed.
- The application is a Next.js 16 prototype with Prisma 7 and PostgreSQL.
- The stable UI checkpoint is committed as `ed2d27d`.

## Validation

- `git diff --check`: passed on 2026-08-26.
- `npm run lint`: passed on 2026-08-26.
- `npm run build`: passed on 2026-08-26 with TypeScript validation enabled.
- Prisma schema validation: passed on 2026-08-26.
- The initial SQL migration was generated and compared against the Prisma schema;
  they match.
- `compose.production.yaml` and the GitHub Actions workflow parse as valid YAML.
- Docker image and Compose runtime checks cannot run on the Windows workstation
  because Docker is not installed. They must run through GitHub Actions and the
  isolated Synology stack.
- Local product lookup and registration still require a running, migrated
  PostgreSQL database for end-to-end verification.

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

1. Verify both GHCR image tags were built successfully.
2. Transfer the production Compose and environment template to the new
   `/volume1/docker/App/hellocal-v2` server directory.
3. Start the isolated stack, then verify migrations, health, product lookup,
   registration, persistence, backup, and rollback.
4. Test a temporary Cloudflare hostname against NAS port `3100` before changing
   any existing route.
