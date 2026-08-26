# HELLO CAL — deployment

This document distinguishes the repository's current implementation from the intended Synology deployment. Do not store credentials, tokens, tunnel IDs, or private hostnames here.

## Implemented in the repository

- `Dockerfile` builds a Next.js standalone production image.
- `.github/workflows/build.yml` uses a GitHub-hosted `ubuntu-latest` runner.
- A push to `master` builds and publishes `ghcr.io/<repository-owner>/hellocalvs2:latest`.
- `docker-compose.yml` starts `postgres:16-alpine` with a persistent named volume.
- Prisma reads the database connection from `DATABASE_URL`.

## Intended production architecture

- Synology Container Manager runs the HELLO CAL application and PostgreSQL.
- The application is reachable through the existing Cloudflare Tunnel without public application portforwarding.
- Production database migrations run with `prisma migrate deploy` during a controlled deployment step.
- GitHub/GHCR provides versioned application delivery to the NAS.

## Administrative access

- The Windows development workstation has no local administrator access. Deployment and maintenance procedures must not depend on installing additional local software.
- Synology's SSH service listens on internal port `22`. External access uses `ssh.packroff.dk:2222`, which forwards to the server's port `22`, with the user `Peter`.
- The external forwarding is closed by default and is temporarily opened or closed by an existing Home Assistant switch. Turn the switch on before an SSH maintenance session and off again when the session is finished.
- The workstation's existing Ed25519 key was rejected on 2026-08-26, so access currently requires the server password until key authorization is repaired.
- Never record the password or private key contents in this repository.

## Still missing

- Add the application service to a production Compose configuration.
- Replace development database credentials in Compose with server-managed secrets or environment variables.
- Define the internal application/database network and avoid exposing PostgreSQL publicly.
- Add health checks, restart behavior, migration sequencing, and persistent backup procedures.
- Record the non-secret Cloudflare routing shape once the live tunnel has been inspected.
- Decide whether deployment uses the current GitHub-hosted build plus NAS image pull, or a self-hosted runner on Synology. The documentation previously described a self-hosted runner, but the current workflow does not use one.
- Document GHCR authentication and the controlled update/rollback procedure on Synology.

## Required verification before production

1. `npm run lint`
2. `npm run build`
3. Build the Docker image.
4. Start an isolated app/database stack.
5. Run migrations against a disposable database.
6. Verify health, persistence, restart, tunnel routing, backup, and rollback.
