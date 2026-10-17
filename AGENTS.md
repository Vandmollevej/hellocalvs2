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

7. Ting, brugeren gør først ved lancering, står i `docs/GO-LIVE.md` — tilføj nye dér.

8. Read `docs/REGLER.md` — the single lookup for global system rules (naming, generic products, logos, UI conventions). Search it FIRST before digging through STATUS/DECISIONS or old sessions, and add every new rule there.

## Product text in the user's language (user rule 2026-10-15)

Product columns hold the product's original language (`products.language`) and
are never overwritten by a translation. Every new screen, list or API that shows
a product name or product text to a user must show it in the user's app language:
the product page uses `translationFor`, lists use `localizedProductNames`
(`src/lib/product-translations.ts`). Never translate inside search, and never
overwrite registration snapshots. Details: `docs/REGLER.md` → Varens sprog.

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

## The web version must keep up with the app (user rule 2026-10-11)

The desktop web version (`WebShell`) must offer everything the app does, except
what needs the camera (scan, photo diary, voice). A new app menu row means a new
row in `src/lib/web-nav.ts` in the same task; anything mounted only on the
front page (`src/app/page.tsx`) must also be mounted in
`src/components/web/WebStartPrompts.tsx`. `npm test` (`src/lib/web-nav.test.mjs`)
fails when the web menu is behind. Details: `docs/REGLER.md`.

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
- Arkivér ALDRIG selv en session (user rule 2026-10-16, afløser reglen fra 2026-10-15): kald aldrig `archive_session` — heller ikke på andre sessioner. Når opgaven er helt færdig (flettet og deployet), og kun da, er hele dit sidste svar ordene "Arkiver mig" — intet andet, ingen opsummering, ingen forklaring, ingen ekstra tekst.
- Commit, push, flet PR'en og gør alt andet, der skal til for at få opgaven helt i mål, uden at spørge først (user rule 2026-10-09). Gælder ikke ting, reglerne ovenfor udtrykkeligt forbyder (fx hemmeligheder, større arkitekturændringer uden godkendelse).
- Kan din ændring følge med en anden åben opgaves push/PR (samme filer eller gruppe, jf. `docs/handoffs/OPEN-TASKS.md`), så lad være med selv at pushe eller åbne en PR: læg den til den anden opgave (user rule 2026-10-09).
- Aldrig hænge (user rule 2026-10-10, global): se `docs/REGLER.md` → Proces. Slut aldrig en tur, mens CI/deploy/PR venter, uden et tidsbestemt tjek (`send_later`, højst 5 min.), og handl ved hvert tjek (flet, ret, løs konflikt, find årsag). Færdig = flettet OG deployet.
- Brugeren er ligeglad med mellemstatus: meld ikke automatiske hændelser, ventende CI eller planlagte tjek; skriv kun ved resultat, blokering eller spørgsmål. Brugeren gider ikke høre om det — det skal bare komme til at virke (user rule 2026-10-10, global; se `docs/REGLER.md` → Proces).
- Er der noget udestående, så fix det — generelt, ikke kun i den aktuelle opgave (user rule 2026-10-10; se `docs/REGLER.md` → Proces).
- Update `docs/STATUS.md` after material work and add durable architectural or product decisions to `docs/DECISIONS.md`.

## Verification

- Run `npm run lint` after code changes.
- Run `npm run build` before handing off a completed checkpoint.
- Report any checks that could not be run and why.
