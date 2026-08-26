# HELLO CAL — project status

Last updated: 2026-08-26

## Current checkpoint

- Repository: `Vandmollevej/hellocalvs2`
- Branch: `master`
- Latest committed checkpoint: `3d26fa7` — GitHub Actions workflow for building and pushing the Docker image to GHCR.
- The application is a Next.js 16 prototype with Prisma 7 and PostgreSQL.
- Product and UI requirements are recorded in the focused documents under `docs/`.
- The working tree contains an unfinished set of UI refinements across the app. Preserve and review these changes before committing them.

## Validation

- `git diff --check`: passed on 2026-08-26.
- `npm run lint`: passed on 2026-08-26.
- `npm run build`: passed on 2026-08-26 with TypeScript validation enabled.
- Visual review: the home, saved foods, calendar, statistics, search, onboarding, and add/offline-state screens were reviewed locally on 2026-08-26. The reviewed layouts render coherently and onboarding dismissal works.
- Local product lookup and registration cannot be verified end-to-end until PostgreSQL is running and seeded; the UI currently shows its designed database-unavailable fallback.
- Local development uses Webpack because Turbopack 16.2.12 repeatedly panics while the repository is inside the OneDrive-synchronized path. Production `next build` succeeds with Turbopack.

## Deployment status

- The application has a production `Dockerfile` using Next.js standalone output.
- GitHub Actions builds and pushes `ghcr.io/<repository-owner>/hellocalvs2:latest` on pushes to `master`.
- `docker-compose.yml` currently defines PostgreSQL only; it is not yet a complete production stack.
- Synology and Cloudflare Tunnel are the documented target, but their live configuration is not represented fully in this repository.
- The Home Assistant SSH-port switch was confirmed working on 2026-08-26. Server login is awaiting interactive password authentication because the stored workstation key is not currently authorized.

## Next work

1. Start and seed PostgreSQL, then verify product lookup and registration end-to-end.
2. Commit a stable UI checkpoint.
3. Create the complete Synology production stack and deployment procedure described in `docs/DEPLOYMENT.md`.
