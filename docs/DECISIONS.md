# HELLO CAL — decision log

This file records durable decisions. Add a dated entry when a later decision changes one of them.

## Product and data

- The product name is **HELLO CAL**.
- PostgreSQL is the primary database; Prisma is the application ORM.
- Registrations store nutrition snapshots so later product edits cannot alter historical records.
- HELLO CAL is the primary data source. Apple Health and Google Health Connect are write-only integrations as described in the specification.
- Product behavior and UI decisions in `docs/SPECIFICATION.md`, `docs/UI.md`, `docs/AI.md`, `docs/DATABASE.md`, `docs/BACKEND.md`, and `docs/ADMIN.md` take precedence over prototype placeholders.

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

## Engineering process

- Keep changes small and reviewable; large rewrites require explicit approval.
- Preserve unrelated local changes.
- A checkpoint is complete only after lint and production build pass, unless an unresolved check is documented in `docs/STATUS.md`.
- Local `npm run dev` uses Next.js' Webpack mode. Turbopack 16.2.12 produced a reproducible HMR panic in the OneDrive-synchronized repository, while Webpack and the production build are stable.
