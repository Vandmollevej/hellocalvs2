# Åbne opgaver — fælles overlevering mellem konti

Opgaverne her blev startet på én Claude-konto og kan fortsættes på en anden.
Samme maskine, samme repo. Denne fil er den eneste fælles sandhed om, hvem der
laver hvad.

## Regler for alle sessioner

0. Hent altid først: commit dit eget arbejde, kør `git pull origin master`,
   og læs denne fil igen. Cloud-sessioner (claude.ai) arbejder ikke på din PC —
   deres ændringer og noter kommer kun ind via GitHub.
1. Læs denne fil før du begynder, og find din opgave/gruppe.
2. Hvis du fortsætter en opgave: sæt `Ejer` til din sessions titel + konto (fx
   "Kalender-gruppen, konto B") og opdatér `Status` + `Næste skridt` løbende —
   mindst hver gang du committer eller stopper.
3. Rør kun filer i din egen gruppe. Skal du ændre en fil, en anden gruppe ejer,
   så skriv det her og vent.
4. Ikke-committede ændringer i en gruppes filer (se "Ukendte ændringer") kan
   stamme fra en afbrudt session: læs `git diff` på filen før du ændrer den, og
   byg videre på den i stedet for at overskrive.
5. Den fulde originale samtale ligger i
   `C:\Users\Peter\.claude\projects\C--Users-Peter-Desktop-Hello-Cal\<id>*.jsonl`
   (id = første 8 tegn nedenfor). Læs den, hvis du mangler detaljer om kravet.
6. Når en opgave er færdig og committet: sæt `Status: Færdig (<commit>)` og flyt
   rækken til `ARCHIVE.md` (samme gruppe-overskrift). Her står kun åbent arbejde.
7. Løber din konto tør: sørg for at din linje her er opdateret og committet.

Status-værdier: `Ikke startet` · `Venter på bruger` · `I gang` · `Blokeret` · `Færdig`

Status opdateret: 2026-10-03 (færdige opgaver flyttet til `ARCHIVE.md`)

---

## G5 — Agent-app + logo-robot
Filer: ny agent-app, admin "scan-invites", logo-agent (Python/container).
Ejer: G5-overtagelse, konto B (2026-09-24)
ℹ️ Fra opret-vare-sessionen (2026-09-26): logo-isolering ved scanning + match mod DB er bygget i kamera-flowet (`ImageCutoutJob` BRAND_LOGO, `src/lib/brand-match.ts`, fritskrabning i `scripts/image-agent/cutout.py`, DECISIONS 2026-09-26). Logo-kandidater under 0,9 ligger klar til G5's admin-kø; natlig Google-søgning er ikke lavet.
⚠️ Fra G1 (2026-09-25): deploy-trinnet "Build and start catalog agents" i `.github/workflows` fejler ved hvert push til master siden 2026-09-24 ca. 18:00 (fx run for 50a5a47). App-deployet lykkes, men agent-containerne opdateres ikke. Brugeren har bedt G5 om at rette det — læs job-loggen på GitHub.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 548ca51e | Ny invite-only agent-app (hyldebillede, opret vare, 2FA, admin-oversigt, aflønnings-backend) | Deployet (2026-09-26) | Merget til master (29b7f28); `scan-app` (port 3101) startes i deploy-workflowet. Mangler: brugeren opretter Cloudflare *Published application route* `scanhellocal.packroff.dk` → `http://192.168.1.90:3101`. `SCAN_PII_KEY`/`SCAN_APP_BASE_URL` valgfri (fallback: ADMIN_SESSION_SECRET / scanhellocal-adressen). Face ID-login bygget 2026-09-29 (branch `claude/scan-passkey-keys`). Nøgler genereres af deployet. Mangler: merge af PR #104 og test med rigtig hylde |
| 850e575e / 0669f736 | Logo-robot: isolér logo ved scanning, match mod DB, natlig Google-søgning, admin-kø under 90 % | Deployet (2026-09-26) | `logo-agent` i deploy-workflowet; bruger eksisterende `GOOGLE_API_KEY` (Cloud Vision API skal være slået til på nøglens Google-projekt). Logo-match i selve scanningen hører til kamera-flowet (ikke G5) |

## G8 — Integrationer
Filer: `src/lib/integrations.ts`, integrationssiden, `/api/withings/**`, Google Health.
Ejer: G8-sessionen, konto C (overtaget 2026-09-24)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 69a1b2bd / 2c95590f | Dubletter af 6068f78a og 8d98b548 — læs dem for ekstra svar fra brugeren ("Så byg det, der mangler. Det skal jo bare virke!") | Dublet | Luk sammen med hovedopgaverne |
| 8d98b548 | Withings + Google Health koblet på, egen data-sync | Venter på bruger | Nøglerne ligger på serveren. 2026-09-26 (session d83284ca, med brugerens OK): 0.0.0.0-redirects i `handlers.ts` rettet. Redirect-URI løst via hellocal.io (2026-09-28); mangler kun testbruger packroff@gmail.com i Google Cloud (se STATUS "Integrationssiden"). HelloFresh-trin-rettelsen i samme transcript hører til G6 |
| d0442775 | Waldemarsro (DK-only) + scraper | Venter på bruger | Scraper + kalorie-matcher færdige og gemt i scripts/valdemarsro-import (157cff9); brugeren kører scraperen selv (output i Productdatabase/Valdemarsro). IKKE bygget: import til appen + Valdemarsro-kort/toggle på Integrationer (krav i STATUS, ea7843a) — byg når brugeren siger til |

## Widgets (iPhone/Android)
Filer: `src/lib/widgets.ts`, `src/lib/widget-data.ts`, `src/lib/widget-add-actions.ts`, `src/app/api/widgets/**`, `src/app/widgets/**`, `src/components/widgets/**`, `docs/WIDGETS.md`.
Ejer: Widget-sessionen (2026-09-26)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| c4b41bf9 | Forbered widgets: plus-knap, hurtig-tilføj, statistik-graf (Smart Stack/swipe), 2×2 boks, seneste registreringer | Venter på bruger | Brugeren godkender designet på `/widgets`; derefter native (Swift/Kotlin) når Mac er lejet |

## Venter på dig (ingen gruppe)
| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| d595e6bc | REMA-appelsin har "Zimbabwe" som produkttype → skal være land | Venter på bruger | Kør SQL via SSH/sudo med tabellen `products` (se transcript for kommandoen), så rettes rækken |

## Løse ender fra arkiverede opgaver
Fundet ved arkiveringen 2026-10-03; stadig ikke lavet i koden.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 56f30763-rest | Advarselstrekant ved mættet fedt mangler på forsidens tal-slider (`src/lib/frontpage-stats.ts`, `StatsWheel.tsx`) — G11 lavede den kun på statistik-bokse + produktside | Ikke startet | G2-filer: byg ikonet som på statistik-boksene |
| a83d7a5a-rest | "Knapper i hjulet" i `src/app/settings/display/front-page/page.tsx` har stadig egen streg-overskrift | Ikke startet | Skift til `.hf-type-section-title` som de øvrige overskrifter (G10) |

## G14 — Daglig kaloriegrænse pr. bruger + forslags-popup
Filer: `src/lib/kcal-goal-suggestion.ts`, `src/lib/use-daily-kcal-goal.ts`, `src/components/KcalGoalPrompt.tsx`, `src/app/api/profile/kcal-goal/**`. Rører også kalender, statistik, StatsWheel, widget-data (kun grænse-læsningen).
Ejer: cloud-session `claude/kcal-goal-prompt` (2026-09-29)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | Popup: "opdater din daglige kaloriegrænse fra X til Y" med Opdater / Senere / Spørg ikke igen | Færdig (kode, PR åben) | Migration 20260929190000 skal med deployet. Mangler: side til manuel ændring af grænsen + brugerens test med rigtige data |

## Opsætningsguide (ikke fordelt)
Filer: `src/components/OnboardingWizard.tsx`. Krav i `docs/DESIGN_V2.md` §8.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| onboarding-integration | Vægt + Aktivitetsniveau: tekstlink nederst "Tilføj gennem integration i stedet"; Aktivitetsniveau som HelloFresh-slidersider (ét spørgsmål pr. side) | Ikke startet | Spørgsmål afklaret (5 sider, se DESIGN_V2 §8) — klar til bygning |

## Ikke fordelt
Ændret og ikke committet uden kendt ejer: `docs/AI.md`, `src/components/AddButton.tsx`,
`src/components/hf/PointsPromoBanner.tsx`, `src/i18n/locales/*.json`, `src/lib/vault/webauthn-client.ts`.
Nogle hører muligvis til login-/Mailjet-sessionerne på konto B. Rør dem ikke uden at læse diff'en først.
Også (flyttet hertil fra arkiverede grupper): `src/lib/frontpage-layout.ts` (FAB-side højre) og
`src/lib/frontpage-stats.ts` (kalorie-mål fjernet) fra G2-tiden, samt `src/app/profile/photo-diary` og
`src/app/profile/weight-calibration` (passkey-lås / vægt-kalibrering) fra G7-tiden.

## G-PAL — Aktivitetsniveau, energibehov og kaloriemål
Filer: `docs/ACTIVITY-PAL.md`, `src/lib/activity-level.ts`, nye `src/lib/pal-model*`/`energy-budget*`, aktivitetstrinnene i `src/components/OnboardingWizard.tsx`, `src/lib/goals.ts`. Ændringer i kalender/statistik (erstat `DAILY_KCAL_GOAL`) kræver aftale med G1/G2.
Ejer: cloud-session (2026-09-29)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| pal-plan | Plan for aktivitetsniveau, PAL, MET, kalibrering og kaloriemål (`docs/ACTIVITY-PAL.md`); erstatter de 5 sider i `onboarding-integration` | I gang | F0–F6 færdige på branch `claude/activity-pal-plan` (PR #114). **Bemærk G1:** `src/app/calendar/page.tsx` har fået to små ændringer (energyProfile får `palBase`/`trainingAllowanceKcal`; ny fetch af `/api/health-metrics` sendt til vægtestimatet) — ingen UI-ændring. Kaloriemålet bruges nu pr. dato i kalender, statistik, forside og widgets (kun fremadrettet, efter brugerens ønske; `src/lib/daily-budget.ts`). **Bemærk G1/G2:** `src/app/calendar/page.tsx` (context `DailyGoalContext`, alle `DAILY_KCAL_GOAL`-brug), `src/app/statistics/page.tsx`, `src/components/StatChart.tsx` (`goals` pr. punkt), `src/components/StatsWheel.tsx`, `src/lib/frontpage-stats.ts` og `src/lib/widget-data.ts` er ændret. Næste: brugerens test af guiden på telefon |

## G-FAM — Familieabonnement og børneprofiler
Filer: `docs/FAMILY.md`, Prisma-skema (Family*, ProfileAccessLog), `src/lib/family*.ts`, `src/lib/session.ts`, `src/app/api/family/**`, `src/app/profile/family/**`, profilvælger/panel-komponenter, dagbogs-API'erne der skal følge den valgte profil.
Ejer: cloud-session `claude/lucid-bell-s5vyhv` (2026-09-25)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | Familieabonnement: forældre ser/taster for børn, adgangslog til barnet | I gang | Første version bygget og pushet (branch `claude/lucid-bell-s5vyhv`, ikke flettet). Næste: brugerens test og "Mangler" i `docs/FAMILY.md` (oprettelsesflow med alder er næste skridt) |

## G-STORE — Butiksimport (Bilka + REMA 1000)
Filer: `scripts/store-products-import/**`, `docs/PRODUCT_IMPORT_MAPPING.md`, `Product.nutritionMissing`.
Ejer: "Indholdsfortegnelse og feltsammenflettning" (89f1295c, 2026-10-03)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 89f1295c | Alt fra arkene flettet ind: ingredienser, `_is_`-felter, energi (kJ-fejl + forkerte kcal rettet), Labels, alle 13.039 varer (2.364 skjulte uden næring) | Færdig i kode (se git log "Store import") — data venter på bruger | Kopiér `C:\Users\Peter\Desktop\Butiksimport 2026-10-03\` (store_products.json + images) til NAS'ens `data/store-products-import/` og kør jobbet `store-products-import` (admin → Cron-jobs). Forventet: "Imported/updated 13039 of 13039 … (2364 hidden …)" |
| 89f1295c | Vitaminer fra Bilka (`bilka_vitamins.py`) | Venter på bruger | Brugeren kører `py bilka_vitamins.py` i Bilka-mappen på NAS'en (nogle timer). Derefter: `py build_data.py --all --out <mappe> --images-from <NAS-json>`, kopiér `store_products.json` til NAS'ens `data/store-products-import/` og kør jobbet |
| — | Næring fra Frida til de 2.364 skjulte varer (`WHERE "nutritionMissing"`) | Ikke startet | Brugerens plan ("så tager vi det fra Frida senere"): match på produkttype/navn, udfyld som ESTIMATED (~), sæt `nutritionMissing = false` og opret stregkode-rækken (EAN = `externalId`) |
