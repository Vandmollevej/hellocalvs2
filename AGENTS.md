<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# HELLO CAL project guidance

## Start every task here

1. Read `docs/STATUS.md` for the current checkpoint and next work.
2. Read `docs/DECISIONS.md` before changing architecture or product behavior.
3. Read `docs/DEPLOYMENT.md` before changing Docker, GitHub Actions, Synology, networking, or environment configuration.
4. Use `docs/SPECIFICATION.md` and the focused files in `docs/` as the product contract. Do not infer missing product behavior from placeholder UI.

## Working rules

- Preserve unrelated and uncommitted user changes.
- Keep business logic out of UI components and prefer small, focused modules.
- Never commit secrets or print values from `.env`.
- Treat the database as the source of truth and preserve snapshot semantics for registrations.
- Do not perform large rewrites or change deployment architecture without explicit user approval.
- Update `docs/STATUS.md` after material work and add durable architectural or product decisions to `docs/DECISIONS.md`.

## Verification

- Run `npm run lint` after code changes.
- Run `npm run build` before handing off a completed checkpoint.
- Report any checks that could not be run and why.
