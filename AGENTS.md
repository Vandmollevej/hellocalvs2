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
5. Read `design.md` before any visual/UI change (colors, typography, spacing, radius, component variants) — it is not needed for backend-only, data, or integration work. This file is intentionally not auto-loaded; fetch it explicitly when the task is visual.
6. Read `docs/handoffs/OPEN-TASKS.md`. Work is shared across several parallel sessions and Claude accounts: if your task is listed there, follow its rules — claim it, stay inside your group's files, and keep your row's status and next step current (commit it) so another account can resume exactly where you stopped.

7. Read `docs/REGLER.md` — the single lookup for global system rules (naming, generic products, logos, UI conventions). Search it FIRST before digging through STATUS/DECISIONS or old sessions, and add every new rule there.

## Web and native must change together (user rule 2026-10-07)

Hello Cal is also a fully native Android + iPhone app (`native/`, one Kotlin
Compose Multiplatform codebase for both phones). Every user-facing UI change
on the web must be carried over to the native screen in the same task:

- Changed `src/app/globals.css` tokens, `src/i18n/locales/*.json` texts or
  Tabler icons → run `node scripts/native/sync.mjs` and commit the generated files.
- Changed a page/component that a ported native screen is built from → update
  the native screen listed in `native/parity/screens.json`, then
  `node scripts/native/parity.mjs --accept <route>`.
- New page → `node scripts/native/parity.mjs --register`.
- `node scripts/native/parity.mjs` must exit 0 before you hand off. A Stop hook
  (`.claude/settings.json`) and the CI job "Web ↔ native in step" enforce it.
  Details: `native/README.md`.

## Working rules

- Preserve unrelated and uncommitted user changes.
- The Windows workstation does not have local administrator access. Do not install software or propose workflows that require local admin rights; prefer existing built-in tools and remote server capabilities.
- Keep business logic out of UI components and prefer small, focused modules.
- Never commit secrets or print values from `.env`.
- Treat the database as the source of truth and preserve snapshot semantics for registrations.
- Do not perform large rewrites or change deployment architecture without explicit user approval.
- If a password prompt needs the user, continue any independent work instead of
  waiting idly. Never store, repeat, or expose the password.
- Work continuously through the active checkpoint: after each successful step,
  immediately start the next safe in-scope step. Stop only for a material user
  decision, required authorization, or an exact external blocker.
- Ask the user questions only in the big question box (the AskUserQuestion
  tool), never as plain text at the end of a reply — the user does not see
  them otherwise (user rule 2026-09-26); repeated 2026-10-09: plain-text questions give no yellow dot, so
  the user never sees them. Never interrupt a task with one).
- Stop ikke midtvejs: færdiggør opgaven helt, med mindre det kan konflikte med andet arbejde (user rule 2026-10-05). Hvis der er noget at vente på (CI, review), så tjek PR'en med få minutters mellemrum og flet den ind, så snart det er muligt.
- Afslut hver færdig opgave med teksten "arkiver mig" og ingen anden tekst (user rule 2026-10-05).
- ALLE opgaver auto-arkiveres UMIDDELBART, så snart de melder klar (eller har meldt klar) til arkivering: kald `archive_session` i samme tur som "arkiver mig", uden at vente på svar, test eller bekræftelse. Er en tidligere session allerede meldt klar uden at være arkiveret, så arkivér den nu (user rule 2026-10-09, gentaget).
- Auto-arkivering (user rule 2026-10-09): når opgaven er helt færdig og dens PR er flettet (eller der ingen PR er), skriv "arkiver mig" som sidste tekst og kald derefter selv `archive_session` på din egen session (claude-code-remote; brug dit eget session-id). Arkivér aldrig en session med åbent arbejde, rød CI, uflettet PR eller ubesvaret spørgsmål. At noget mangler at blive testet (manuelt, på enhed, i produktion) er ALDRIG en gyldig grund til ikke at arkivere (global regel, user rule 2026-10-09): nævn det kort i overleveringen/OPEN-TASKS, og arkivér alligevel. Stop-hooken `scripts/archive-reminder.mjs` minder om reglen, hvis en færdig session glemmer den.
- Commit, push, flet PR'en og gør alt andet, der skal til for at få opgaven helt i mål, uden at spørge først (user rule 2026-10-09). Gælder ikke ting, reglerne ovenfor udtrykkeligt forbyder (fx hemmeligheder, større arkitekturændringer uden godkendelse).
- Kan din ændring følge med en anden åben opgaves push/PR (samme filer eller gruppe, jf. `docs/handoffs/OPEN-TASKS.md`), så lad være med selv at pushe eller åbne en PR: læg den til den anden opgave, og arkivér blot (user rule 2026-10-09).
- Update `docs/STATUS.md` after material work and add durable architectural or product decisions to `docs/DECISIONS.md`.

## Verification

- Run `npm run lint` after code changes.
- Run `npm run build` before handing off a completed checkpoint.
- Report any checks that could not be run and why.
