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

## G-HAND — Håndfrugter og æg (Lille / Normal / Stor)
Filer: `src/lib/hand-sizes.ts`, `src/components/hf/HandSizePicker.tsx`, `docs/HAND-SIZES.md`. Små indgreb i `src/components/add/AddProductView.tsx` (vælgeren over mængdeboksen) og `src/lib/default-amount.ts` (Normal som startmængde).
Ejer: cloud-session på branch `claude/handfrugt-sizes-grams-2z4p3i` (2026-10-02)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| hand-sizes | Håndfrugter + æg i S/M/L med mål, gram og skalerede billeder | Venter på bruger | Bygget i draft-PR #128. Brugeren skal godkende listen og tallene i `docs/HAND-SIZES.md` og teste fliserne på telefon |

---

## G1 — Kalender
Filer: `src/app/calendar/**`, kalender-komponenter.
Ukendte ændringer: `src/app/calendar/page.tsx` indeholder G3's ikke-committede "Månedens synder"-knap (G3 ejer den del).
Ejer: G1-overtagelse, konto C (2026-09-24)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 018jYb36 | Kamera: lygte-knap, fokus ~20 cm ved stregkode, hvid tekst ved for mørkt/ude af fokus (PR #145, branch `claude/barcode-autofocus-issues-ouca0n`) | Venter på bruger | Kode færdig, lint/typecheck/build grønne, master merget ind. Mangler: test på telefon (Android: lygte+fokus; iPhone: kun tekst), derefter PR klar + merge. Ved konflikt: merge master ind, behold begge sider i docs. |
| 5ac89589 | Flyt "Du er inden for din målsætning" op mellem måned og kalendergitter | Færdig (06599b0) | — |
| 85b824f8 | Statusfelt nederst: bottom-align, "Tilbage for i dag" ikke fed | Færdig (3ab3d8d) | — |
| 70e219fb | Dagvisning: fjern dropdown, ugedag-stil, "Kl." over tider, luft | Færdig (d0fd708) | — |
| 9848667e | Ugetal på egen linje under datoen | Færdig (2573548, justeret 7ef4534/9e7e9bb) | — |
| 63e9ff5d | Ugesummering (kaloriebalance + estimeret vægt) — kun roadmap-beslutning | Færdig (37ee7f4; senere slået til i 7747ea1, DECISIONS 2026-09-23) | — |
| b4d954bd | Listevisning: fjern +/−, "Mål (ikke) nået" regulær + flyttet, lige afstand | Færdig (se G1-commit) | Minus vises nu som ÷ (brugerens valg: fortegn som symbol, som i månedsgitteret). Afventer brugerens visuelle godkendelse |
| 116d3656 | Dagvisning: søvn-slider med to grå nuancer kan ikke trækkes + fjern dialogen "Kun denne dato / Standardmønster" | Færdig (se G1-commit) | Ét gråt felt ved dagsøvn, feltet følger håndtaget, tryk uden træk gemmer intet, dialog fjernet (gælder kun datoen). Ikke live-testet: lokal DB mangler |
| — | Dagvisning: træk søvn-håndtag forbi kanten (scroller med) + "Nattens søvn: X,XX timer" i nattens grå felt | Færdig (flettet i master fra cloud-branch `claude/cloud-session-credits-expired-7504pf`) | Afventer brugerens test på telefon |
| — | Dagvisning: sengetids-håndtag altid nederst (også ved sengetid 00:00) + manglende tekst "calendar.remainingToday" | Færdig (flettet i master fra `claude/calendar-slider-bedtime-text-1cp8lf`) | Afventer brugerens test på telefon |
| — | Kalender: dage vi er forbi vises grå og ikke-fede (måned, uge, liste) | Færdig (PR #119, branch `claude/calendar-past-days-muted`) | Afventer brugerens visuelle godkendelse på telefon |
| — | Statusblok (dag + måned): flamme + grøn "+ N kcal" og "Mål" øverst, kort statusbjælke, "Tilbage"/"Overskredet" under; motion tæller med i målet i hele kalenderen; fælles komponent `GoalStatusSummary` | Færdig (PR #122, branch `claude/kalender-maalstatus-blok`) | Afventer brugerens test på telefon. Forside-kort/widgets regner stadig uden motion (G2/andre) |

## G2 — Statistik-siden (redigering, drag/drop)
Filer: statistik-siden, `src/components/StatsWheel.tsx`, `src/lib/frontpage-layout.ts`, `src/lib/frontpage-stats.ts`.
Ukendte ændringer: `frontpage-layout.ts` (FAB-side højre) og `frontpage-stats.ts` (kalorie-mål fjernet) er stadig ikke committet — hører ikke til G2's opgaver, ejer ukendt. Rør dem ikke uden at spørge brugeren.
Ejer: G2-overtagelse, konto C (2026-09-24) — alle G2-opgaver bygget og flettet ind i master (fabba4b).
Ikke visuelt testet: lokalt sender appen til /welcome uden login. Test på mobil i drift.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 7fd0a9a3 | Rettelser til kort-redigering: fjern 6 prikker, skillelinje, vibration stop, scroll, slette-cirkel, ét slider-design | Færdig (32995ab) | Slider-delen var allerede lavet (23163ec) |
| fb445e0d / 1ac06755 | Drag/drop til frie felter, stiplede rammer, dropzone til overskrift (1ac06755 er samme opgave) | Færdig (32995ab) | — |
| 2fb90f13 | Dublet af 7fd0a9a3 (samme 6 punkter) | Færdig (32995ab) | — |
| 961d7953 | Tal-slider på forsiden: midterste tal 25px indrykket, aftager til 0 som transparensen | Færdig (eba3638) | — |
| 00cf8440 | Gradient i højre side af tallene (synlighed) skal være helt flydende | Færdig (32995ab) | Opacity går nu lineært til 0 ved kanten |
| a9819635 | Trinløs størrelse/farve på slider (ingen spring pr. position) | Færdig (32995ab) | Ikonfarve + "/ mål"-linje glider nu trinløst |
| 65efa293 | Tal-hjulet: én linje uden "/ mål", ikon til HØJRE, jævn luft, 7 rækker (2 opfundne), 2° vifte pr. række, ingen beskæring | Færdig (8009704, pushet til master) | Konflikter med 0d21a46 (lokal master): behold denne version, den har 0d21a46's dæmpning med. Brugeren tester på iPhone |
| ios-drag-1002 | Kort kan ikke trækkes på iPhone i redigering — siden scroller i stedet | Færdig (gren claude/stat-kort-traek-ios) | Brugeren tester på iPhone efter deploy |

## G3 — Produktkategorier + statistikbokse + "Månedens synder"
Filer: Prisma-skema (kategori), kategori-lib, nye statistikbokse, ny liste-side, knap i kalender (koordinér med G1).
Ejer: G3-sessionen, konto B (overtaget 2026-09-24)
Koordinering med G1: G3 skal senere tilføje knappen "Månedens synder" nederst i månedsvisningen i `src/app/calendar/page.tsx` (et `<Link>` til ny side, ingen andre ændringer). G1: skriv her når filen er committet/fri, så G3 kan tilføje knappen oven på jeres version.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| c0d3a8fa / f5505465 | Ernæringsmæssige produktkategorier (alkohol, fedt, ost, yoghurt, …; ultraforarbejdet som tag) | Færdig (se git log "G3:") | Grove kategorier + klassifikation bygget. 30-listen er separat opgave |
| d7f6eb5c / 1578bf02 | Kød/fisk-bokse (g + kcal), sukkerholdige drikke, alkohol, "største syndere", liste-side, "Månedens synder" | Færdig (se git log "G3:") | Bygget. Knap i kalender tilføjet (kun én `ActionLink` i månedsvisning) |

## G4 — Usikkerhed (bølgeikon + Uncertainties-admin)
Filer: usikkerheds-ikon/komponent, mikronæringsvisning, indstillinger → Visning, admin Uncertainties.
Ejer: G4-sessionen, konto B (overtaget 2026-09-24)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| d2f522ca / 52205f52 | Globalt bølgeikon for usikre varer + mikrodata, margin i grå, on/off i indstillinger | Færdig (pushet til master 2026-09-25) | Specifikation: samtale ef2ba16f + DECISIONS 2026-09-25. Live-tjek kræver login |
| ff7fc6a5 | Admin "Uncertainties" (5 faner inkl. Billeder, 70/50 %-tærskler), natlig AI-genkørsel, admin "Cron-jobs" | Færdig (pushet til master 2026-09-25) | Live-tjek kræver admin-login |

## G5 — Agent-app + logo-robot
Filer: ny agent-app, admin "scan-invites", logo-agent (Python/container).
Ejer: G5-overtagelse, konto B (2026-09-24)
ℹ️ Fra opret-vare-sessionen (2026-09-26): logo-isolering ved scanning + match mod DB er bygget i kamera-flowet (`ImageCutoutJob` BRAND_LOGO, `src/lib/brand-match.ts`, fritskrabning i `scripts/image-agent/cutout.py`, DECISIONS 2026-09-26). Logo-kandidater under 0,9 ligger klar til G5's admin-kø; natlig Google-søgning er ikke lavet.
⚠️ Fra G1 (2026-09-25): deploy-trinnet "Build and start catalog agents" i `.github/workflows` fejler ved hvert push til master siden 2026-09-24 ca. 18:00 (fx run for 50a5a47). App-deployet lykkes, men agent-containerne opdateres ikke. Brugeren har bedt G5 om at rette det — læs job-loggen på GitHub.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 548ca51e | Ny invite-only agent-app (hyldebillede, opret vare, 2FA, admin-oversigt, aflønnings-backend) | Deployet (2026-09-26) | Merget til master (29b7f28); `scan-app` (port 3101) startes i deploy-workflowet. Mangler: brugeren opretter Cloudflare *Published application route* `scanhellocal.packroff.dk` → `http://192.168.1.90:3101`. `SCAN_PII_KEY`/`SCAN_APP_BASE_URL` valgfri (fallback: ADMIN_SESSION_SECRET / scanhellocal-adressen). Face ID-login bygget 2026-09-29 (branch `claude/scan-passkey-keys`). Nøgler genereres af deployet. Mangler: merge af PR #104 og test med rigtig hylde |
| 850e575e / 0669f736 | Logo-robot: isolér logo ved scanning, match mod DB, natlig Google-søgning, admin-kø under 90 % | Deployet (2026-09-26) | `logo-agent` i deploy-workflowet; bruger eksisterende `GOOGLE_API_KEY` (Cloud Vision API skal være slået til på nøglens Google-projekt). Logo-match i selve scanningen hører til kamera-flowet (ikke G5) |
| 548ca51e | Ny invite-only agent-app (hyldebillede, opret vare, 2FA, admin-oversigt, aflønnings-backend) | I gang | Bruger sagde 2026-09-24 "byg det hele, ny container". Bygger: Prisma-modeller → admin scan-invites/medarbejdersider → agent-app-container |
| 850e575e / 0669f736 | Logo-robot: isolér logo ved scanning, match mod DB, natlig Google-søgning, admin-kø under 90 % | I gang | Besluttet: Google Vision API Web Detection (ikke Custom Search/CSE, lukker 2027-01-01). Bygges efter agent-appens datamodel |

## G6 — Madvare-flow (Tilføj madvare, Madvarer-siden)
Filer: `src/app/add/**`, `src/components/ForwardButton.tsx`, Madvarer-siden, fælles knap-komponent.
Ukendte ændringer: ingen (ForwardButton gjort færdig).
Ejer: G6-overtagelse, konto B (2026-09-24)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 155dc7cf | Forward-ikon i stedet for dele-ikon, "Log ind…"-tekst på linje med ikonet | Færdig (aaed6fb) | — |
| 56fda7bc | Mængde altid med enhed (g / ml / cl efter produkttype) | Færdig (3264ed1) | Var allerede lavet af anden session |
| ad648ee7 | HelloFresh kun i Opret ret + global regel: knapper fuld bredde (også bedt om i 6a503586) | Færdig (aaed6fb) | Åbent: kameraets "Produkt"-fane bruger stadig HelloFresh uden for Opret ret (ikke G6's fil) |
| b309686e | Opret ret: HelloFresh-trin med 3 cirkler, "Tag billede"/"Opret manuelt", tekstlink "Opret egen ingrediens" → ny side for private ingredienser | Færdig (1540198) — undtagen trin-cirklerne | Knap-tekster, tekstlink og private ingredienser (boks + anonym admin-anmodning + auto-erstatning) er committet. Trin-cirklerne (`SetupProgressBar`) ligger færdige men ikke-committede i `src/app/profile/settings/page.tsx` (G7's fil) — G7: tag den hunk med i jeres commit |

## G7 — Profil
Filer: `src/app/profile/**`.
Ukendte ændringer: `profile/body-measurements`, `profile/invite`, `profile/photo-diary`, `profile/settings`, `profile/weight-calibration`, `src/lib/body-measurements.ts` er ændret og ikke committet.
Ejer: Profil-gruppen (G7), konto B — overtaget 2026-09-24

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 9a0770ce | Ny oversigtsside over målsætninger (historik, grønt flueben, fast knap nederst) | Ikke startet | Tjek om allerede lavet, ellers byg |
| 8b0a278f | Kropsmål med mand/kvinde-tegninger (fra hovedmappen), kort som på statistik | Blokeret | Tjekket 2026-09-25 (cloud-session): tegningerne findes ikke i repoet på nogen branch, og live-siden viser ingen ikoner. De ligger kun lokalt i hovedmappen på Windows-pc'en — commit + push dem (fx til `public/icons/body/`) sammen med G7's ikke-committede `profile/body-measurements`-ændringer, eller upload dem i en session, før opgaven kan bygges |
| d22c7e61 | Invitér en ven: kun visuelt (betingelser som tekstlink, luft, fjern skillelinje, demo-data) | Venter på bruger | E-mail-invitation/venneliste strider mod privacy — kun visuelle rettelser |
| ef8a5612 | "Skift adgangskode"-side | Blokeret | Strider sandsynligvis mod passkey-only login — spørg brugeren |
| 60da6b15 | Indstillinger: "Få vist allergener" ind i samme boks + "Vælg alle" ved topknappen | Lavet, ikke verificeret | **Sandsynligvis kilden til diff'en i profile/settings.** Verificér og commit |
| bc01cd73 | Højde-vælger fryser, "Færdig" virker ikke, aktuel højde vises ikke i scrolleren | Lavet?, ikke verificeret | **Sandsynligvis kilden til diff'en i `src/components/ui/WheelPicker.tsx`.** Tjek, verificér og commit |
| 26393cba | Demo-bruger med abonnement "Seriøs", næste betalingsdato, "Betalingsmetoder"-knap + profilpunkt | Blokeret | Demo-brugeren blev bevidst fjernet (commit e2c0a83). Spørg: byg kun abonnement/betalingsmetoder-UI? |

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

## G-FLOWS — Admin "Flows" + telefon-editor
Filer: `src/components/admin/PhonePreviewEditor.tsx`, `src/components/admin/FlowEditor.tsx`, `src/app/admin/flows/**`, `src/app/api/admin/flows/**`, `src/lib/flows.ts`.
Ejer: Flows-sessionen (2026-09-27)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 745f1ab5 | Telefon-editor (iPhone 17) til mails/notifikationer/svarskabeloner + hovedmenu "Flows" med flow-sider | Færdig (se git log "Admin: phone editor") | Guide-builderen (tooltips) er flyttet ind i `flows`-gruppen i `AdminShell.tsx` efter brugerens ønske |
| 41 | Design-screening af admin-flowsider mod HelloFresh-retningen | Færdig (branch `claude/admin-flowsider-design-4tzgb4`) | Afventer brugerens visuelle test på desktop + telefon |

## G-CHAT — Hjælpe-chatbot (app + web) og admin "Chatbot"
Filer: `src/lib/chatbot*.ts`, `src/lib/help-chat-events.ts`, `src/components/help/**`, `src/app/api/chatbot/**`, `src/app/admin/chatbot/**`, `src/components/admin/chatbot/**`. Små indgreb i `ScreenHeader`, `TopBar`, `WebShell`, `layout.tsx`, `AdminShell` og `globals.css` (`.hf-appbar--help`).
Ejer: Chatbot-sessionen (cloud), branch `claude/ai-chatbot-support`

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| chatbot | AI-chatbot øverst i app og web med medarbejder og kontaktformular (ingen telefon); admin → Brugere → Chatbot med oftest spurgt, Q&A-tabel, hele tråde og brugerinfo | Færdig (kode, se DECISIONS 2026-10-02) | Merge + deploy (migration `20261002120000_chatbot`). Test på mobil og desktop |

## G-WAVES — Bølge-baggrund på forsiden
Filer: `src/lib/home-waves.ts`, `src/components/HomeWaves.tsx`, `.home-wave*` i `globals.css`, `src/app/page.tsx` (lag-opbygning), `StatsWheel.tsx` (kun `clipPath`).
Ejer: bølge-sessionen (2026-10-01)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | Rolig, tilfældig bølge-animation bag forsiden med frostet-glas-bund og tåge | Færdig (kode) | Afventer brugerens visuelle godkendelse på telefon; justér tempo/farve efter feedback |

## G-INT2 — Flere integrationer (Garmin, WHOOP, Huawei, via-mærker, Health Connect-modul)
Filer: `src/lib/integrations/**`, `src/lib/integrations.ts`, `src/app/settings/integrations/**`, `src/app/api/integrations/**`, `src/lib/api-keys/*`, `native/android/healthconnect/**`.
Ejer: cloud-session `claude/integrations-more-brands` (2026-10-02)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | Garmin, WHOOP, Huawei (OAuth, kun læsning) + eufy/Renpho/Xiaomi/Tuya/Samsung via Health Connect/Apple Health + Android Health Connect-modul | Færdig (flettet i master via PR #157) | Kode i master; migration `20261002120000_more_integrations` kører ved deploy. Brugeren: Garmin-partnerprogram, Huawei Health Kit-godkendelse, WHOOP-app, nøgler i admin, logoer. Android-modulet skal bygges i Android Studio |

## G-STORE — Butiksimport (Bilka + REMA 1000)
Filer: `scripts/store-products-import/**`, `docs/PRODUCT_IMPORT_MAPPING.md`, `Product.nutritionMissing`.
Ejer: "Indholdsfortegnelse og feltsammenflettning" (89f1295c, 2026-10-03)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 89f1295c | Alt fra arkene flettet ind: ingredienser, `_is_`-felter, energi (kJ-fejl + forkerte kcal rettet), Labels, alle 13.039 varer (2.364 skjulte uden næring) | Færdig i kode (se git log "Store import") — data venter på bruger | Kopiér `C:\Users\Peter\Desktop\Butiksimport 2026-10-03\` (store_products.json + images) til NAS'ens `data/store-products-import/` og kør jobbet `store-products-import` (admin → Cron-jobs). Forventet: "Imported/updated 13039 of 13039 … (2364 hidden …)" |
| 89f1295c | Vitaminer fra Bilka (`bilka_vitamins.py`) | Venter på bruger | Brugeren kører `py bilka_vitamins.py` i Bilka-mappen på NAS'en (nogle timer). Derefter: `py build_data.py --all --out <mappe> --images-from <NAS-json>`, kopiér `store_products.json` til NAS'ens `data/store-products-import/` og kør jobbet |
| — | Næring fra Frida til de 2.364 skjulte varer (`WHERE "nutritionMissing"`) | Ikke startet | Brugerens plan ("så tager vi det fra Frida senere"): match på produkttype/navn, udfyld som ESTIMATED (~), sæt `nutritionMissing = false` og opret stregkode-rækken (EAN = `externalId`) |

## G-AUTH — SMS-kode + login-godkendelse
Filer: `src/lib/teammessage.ts`, `src/lib/sms-verification.ts`, `src/lib/login-approval.ts`, `src/app/api/auth/{sms,login-approval,reset-password}/**`, `src/app/signup`, `src/app/reset-password`, `src/app/approve-login`, `src/app/profile/login-approval`, `public/sw.js`.
Ejer: SMS-sessionen (2026-10-02)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | 6-cifret SMS-kode ved tilmelding + glemt adgangskode (TeamMessage) og login-godkendelse med push | Venter på bruger | Branch `claude/teammessage-sms` er klar, men ikke flettet. Se STATUS 2026-10-03 "Roadmap": TeamMessage-env + VAPID-nøgler på serveren, derefter flet + test |
| — | 6-cifret SMS-kode ved tilmelding + glemt adgangskode (TeamMessage) og login-godkendelse med push | Venter på bruger | Branch `claude/teammessage-sms` er klar, men ikke flettet. Se STATUS 2026-10-03 "Roadmap": TeamMessage-env + VAPID-nøgler på serveren, derefter flet + test |
