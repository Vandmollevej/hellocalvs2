| image-upload | Drag and drop af produktbilleder (EAN / produkttype, _raw / _pl) med advarsel ved eksisterende billeder: Ignorer / Erstat / Vis forskel | Færdig (kode) | Migration 20261004180000 skal med deployet. Ikke prøvet i browser/mod rigtig database — test med få billeder først |# Åbne opgaver — fælles overlevering mellem konti

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

Status opdateret: 2026-10-06 — alle udestående opgaver slettet (klaret af en anden konto)

---

## G-NATIVE — Native Android + iPhone-app (helt native, Compose Multiplatform)
Filer: `native/**`, `scripts/native/**`, `.github/workflows/native.yml`. Branch `claude/native-apps` (merges til master, når CI er grøn).
Ejer: session "Native app" (e4e4d388), 2026-10-08. Fortsæt fra `native/README.md` + `native/PORTING.md`; status pr. skærm står i `native/parity/screens.json` (`node scripts/native/parity.mjs`).

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| fundament | Gradle/KMP-build, Android- og iPhone-app, tema/tekster/ikoner fra web, login, navigation, paritets-vagt, CI | Færdig | — |
| skaerme | Portér alle forbruger-sider + finpudsning | Færdig (121/121, CI grøn, 80110278) | Ikke porteret: "Guide mig"-markering i hjælpechatten, FLIP-animation i bundmenu-panelet, reduceret bevægelse |
| oauth | Apple/Google/Facebook-login og integrationer tilbage til appen | Færdig (PKCE + engangskoder) | — |
| paritetsgaeld | Godkendt uden port 2026-10-09 (PR #282, brugerens valg): `FooterArc.tsx` (fast cirkel, ny vifte/labels) og `StaleSyncPrompt` i `layout.tsx`. `BottomNav.tsx` z-index er kun web | Åben | Port FooterArc og StaleSyncPrompt til native, derefter `parity.mjs --accept` |
| konti | Push (Firebase/APNs), Face ID/passkey-login og butiks-udgivelse | Roadmap (brugerens valg 2026-10-08) | Admin → Roadmap (migration 20261008200000_roadmap_native_accounts); kræver brugerens konti |

---

## G-NAVNE — Stavning, Nøgleord-punkt, Integrationer-navn (2026-10-07)
Filer: se commit. Ejer: session "Varer/Integrationer-navne", 2026-10-07.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| stavning | Scan efter "vareer" (ental vare / flertal varer) | Færdig — intet fundet at rette | — |
| nøgleord | Fjern "Nøgleord på produktsiden" (UI + dødt backend) | Færdig | Tabellen product_page_tag_settings kan droppes via migration, hvis brugeren ønsker det |
| hf-valdemarsro | Kun Deaktivér-knap pr. linje | Færdig (24b50742, c7bd58e3) | — |
| integrationer | "Adgangsark (integrationer)" → "Integrationer" | Færdig | — |

---

## G-HAND — Håndfrugter og æg (Lille / Normal / Stor)
Filer: `src/lib/hand-sizes.ts`, `src/components/hf/HandSizePicker.tsx`, `docs/HAND-SIZES.md`. Små indgreb i `src/components/add/AddProductView.tsx` (vælgeren over mængdeboksen) og `src/lib/default-amount.ts` (Normal som startmængde).
Ejer: cloud-session på branch `claude/handfrugt-sizes-grams-2z4p3i` (2026-10-02)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |

---

## G-PRODUPD — Opdater varen (points kun for kamerabilleder)
Filer: `src/lib/product-update.ts`, `src/app/add/[id]/update/page.tsx`, `src/app/api/products/[id]/update/route.ts`.
Ejer: cloud-session på branch `claude/product-update-points-camera-only` (2026-10-03)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |

---

## G1 — Kalender
Filer: `src/app/calendar/**`, kalender-komponenter.
Ukendte ændringer: `src/app/calendar/page.tsx` indeholder G3's ikke-committede "Månedens synder"-knap (G3 ejer den del).
Ejer: G1-overtagelse, konto C (2026-09-24)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
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
| — | Kalender: dages dropdown virker igen, natten synlig om morgenen, "Søvn" med halvmåne | Færdig (branch `claude/kalender-soevn-dropdown`) | Afventer brugerens test på telefon |
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
| — | Fold-ud-boks (accordion) som layout-element: kort kan trækkes ind, hele boksen flyttes også lukket; opbygningsknapper samlet øverst med egen baggrund på tilføj-siden | Færdig (branch `claude/statistik-accordion-blok`) | Afventer brugerens test af træk-og-slip på telefon |
| 961d7953 | Tal-slider på forsiden: midterste tal 25px indrykket, aftager til 0 som transparensen | Færdig (eba3638) | — |
| 00cf8440 | Gradient i højre side af tallene (synlighed) skal være helt flydende | Færdig (32995ab) | Opacity går nu lineært til 0 ved kanten |
| a9819635 | Trinløs størrelse/farve på slider (ingen spring pr. position) | Færdig (32995ab) | Ikonfarve + "/ mål"-linje glider nu trinløst |
| 65efa293 | Tal-hjulet: én linje uden "/ mål", ikon til HØJRE, jævn luft, 7 rækker (2 opfundne), 2° vifte pr. række, ingen beskæring | Færdig (8009704, pushet til master) | Konflikter med 0d21a46 (lokal master): behold denne version, den har 0d21a46's dæmpning med. Brugeren tester på iPhone |
| ios-drag-1002 | Kort kan ikke trækkes på iPhone i redigering — siden scroller i stedet | Færdig (gren claude/stat-kort-traek-ios) | Brugeren tester på iPhone efter deploy |
| stat-skeleton | Statistiksiden: blokkene må ikke flytte plads ved indlæsning; skelet med gradient som HelloFresh | Færdig (branch `claude/statistik-skelet`) | Brugeren tester på telefon efter deploy |

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
| ad648ee7 | HelloFresh kun i Opret ret + global regel: knapper fuld bredde (også bedt om i 6a503586) | Færdig (aaed6fb + trin-commit) | Kameraets "Produkt"-fane vises nu kun fra Opret ret |
| b309686e | Opret ret: HelloFresh-trin med 3 cirkler, "Tag billede"/"Opret manuelt", tekstlink "Opret egen ingrediens" → ny side for private ingredienser | Færdig (1540198 + trin-commit); "Opret manuelt" fjernet igen 2026-10-02 (PR #118: kun scanning) | Trin-baren på Opsætning bruger nu den fælles HfProgressStepper (HelloFresh-stil). Venter på deploy sammen med alt andet (brugerens beslutning) |

## G7 — Profil
Filer: `src/app/profile/**`.
Ukendte ændringer: `profile/body-measurements`, `profile/invite`, `profile/photo-diary`, `profile/settings`, `profile/weight-calibration`, `src/lib/body-measurements.ts` er ændret og ikke committet.
Ejer: Profil-gruppen (G7), konto B — overtaget 2026-09-24

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| bc01cd73 | Højde-vælger fryser, "Færdig" virker ikke, aktuel højde vises ikke i scrolleren | Lavet?, ikke verificeret | **Sandsynligvis kilden til diff'en i `src/components/ui/WheelPicker.tsx`.** Tjek, verificér og commit |

## G8 — Integrationer
Filer: `src/lib/integrations.ts`, integrationssiden, `/api/withings/**`, Google Health.
Ejer: G8-sessionen, konto C (overtaget 2026-09-24)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 69a1b2bd / 2c95590f | Dubletter af 6068f78a og 8d98b548 — læs dem for ekstra svar fra brugeren ("Så byg det, der mangler. Det skal jo bare virke!") | Dublet | Luk sammen med hovedopgaverne |
| 5c45b0d7 | Opskrift-scrapere som Valdemarsro: Arla, Coop, REMA 1000, MENY, Hjerteforeningen, TV2 (+ Børnevenlig og måltidstype) | Færdig (kode) | Scrapere + kalorie-matcher i scripts/recipe-sites-import (README). Testet på de rigtige sider. Brugeren kører dem selv i VS Code; import i appen hører under Valdemarsro-integrationen |
| 300489b5 | Push til Health/integrationer + egen side pr. app med til/fra (hent/send) ved tilkobling og bagefter | Færdig (ce1bc7f, deployet) | Brugeren: skriveadgang i Google Cloud-klienten (nutrition/health_metrics writeonly) og Strava-appen (activity:write); native app til Apple Health/Health Connect mangler |
| admin-integrationer | Admin → Integrationer: oversigt (installationer, brug, frakoblinger) + side pr. integration med grafer | Færdig (kode), branch `claude/admin-integrationer` | Ny tabel `integration_events` (migration `20261002120000_integration_events`) skrives fra `handlers.ts`, `integrations-oauth.ts`, `companion.ts` og healthkit-/settings-ruterne. Næste: deploy + brugerens test på admin |
| tester-popup | Popup "første testperson, 300 points" på hver integrations side + Admin → Brugere → Test-programmes | Færdig (kode, branch `claude/integration-tester-popup`) | Migration `20261002120000_integration_testers` ved deploy; brugerens test på telefon |

## G9 — Ikoner (forside + vand)
Filer: forsidens grydeikon, Vand-siden, `public/` assets.
Ejer: G9-overtagelse, konto B

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| b4666faa | Grydeikon: trim `Gryde.png` og erstat på forsiden | Færdig (f5895a3) | Var allerede lavet: `public/icons/gryde.png` (770×759, trimmet), brugt i `src/lib/add-actions.ts` |
| 8f42a331 | Nyt grydeikon (jævne streger) + champagneikon til Målsætning | Færdig | SVG-ikoner i `src/components/icons/`. Brugeren sletter kildebillederne i sin lokale hovedmappe |
| 60e492ca | Vand-siden: 4 PNG'er (75/50/33/25 cl) | Færdig (6cf89c5) | Billeder i `public/icons/water/`, registrerer 750/500/330/250 ml. Afventer brugerens godkendelse af udseendet |
| ea9d1f7c | Dublet af 60e492ca (glas/flaske i række på fire) | Færdig (6cf89c5) | Lukket af G9: spørgsmålet om billede↔størrelse er besvaret af filnavnene i 60e492ca |

## G10 — Bundnavigation + global overskrift-stil
Filer: `src/components/BottomNav.tsx`, `src/app/globals.css`.
Ukendte ændringer: ingen (alt G10-arbejde committet).
Ejer: G10-overtagelse, konto D (2026-09-24)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 5f2ee781 | Fjern stregen mellem footer og indhold + sektionsoverskrifter mindre, ikke fed, centreret med streg på hver side | Færdig (be3a05d) | Verificeret i preview. Afventer brugerens godkendelse af udseendet |
| a83d7a5a | Alle overskrifter med streger skal være samme klasse (Tidspunkt, datogrupper, statistik, "+ Skillelinje", Historik) | Færdig (136f502) | Deployet (Actions grøn). Obs: forside-indstillingernes "Knapper i hjulet" har en egen streg-overskrift, der kun findes på den lokale master — den skal over på `.hf-type-section-title`, når den lander på origin |
| navx-slet | Bundmenu-redigering: slet-kryds lukkede hele redigeringen | Færdig (kode) | Nav løftes over lukke-laget (z-50) i redigering. Afventer test på telefon |
| 6a503586 | Footer-redigering: slette-krydserne er skåret af + ikoner skal kunne trækkes til siden for at bytte rækkefølge | Færdig (8d5ba9b) | `overflow-x-clip` så krydserne ikke klippes; ombytning efter pladsen under fingeren (ingen hop) + roligere glide-animation; ikon fra panelet indsættes på den plads, det slippes. Afventer test på telefon (HelloFresh/knap-delen hører til G6) |
| footer-edit-motion | Footer-redigering som statistik-gitteret: swipe side til side mens ikonerne vibrerer, stille tryk løfter et ikon, rækken ruller kontinuerligt når et ikon trækkes mod kanten, alle flytninger glider (FLIP via script-animation, som vibrationen ellers overstyrede), sluppet ikon glider fra fingeren | Færdig (web + native `app/BottomNav.kt`; native ikke kompileret lokalt, CI tjekker) | Afventer test på telefon |

## G11 — Næringsdata på produktsiden (E-numre, toksiner, fedt-advarsel)
Filer: produktsidens næringsvisning, statistik-boks-katalog (koordinér med G2), Opsætning/Visning (koordinér med G7).
Ejer: G11-overtagelse, konto C (2026-09-24). Arbejder i worktree `gifted-hofstadter-894e70`, fletter ind i master

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 03b329f3 / 5a3cdd2b | E-numre + toksiner som valgfri statistik-bokse og til/fra i Opsætning, vist på produktsiden; "udvidet næringsindhold" åben som standard | Færdig (5cea433) | Kontakter i Opsætning, toksinliste (FVST + EFSA, graviditet/amning/fertilitet først), produktside. Flettes ind i master, når G7 har committet profile/settings |
| 56f30763 | Advarselstrekant med udråbstegn ved mættet/usundt fedt | Færdig (5cea433) | Trekant på statistik-bokse + produktside. **G2:** forsidens tal-slider (`frontpage-stats.ts`) mangler samme ikon — G11 rører ikke filen |
| 31 | E-numre klikbare på varen og i ingredienslisten | Færdig (branch `claude/clickable-e-numbers-0g8aih`) | E-numre i ingredienstekst åbner `AdditiveInfoModal` via `splitENumbers` i `src/lib/additives.ts`; E-nummer-listen var allerede klikbar |

## Widgets (iPhone/Android)
Filer: `src/lib/widgets.ts`, `src/lib/widget-data.ts`, `src/lib/widget-add-actions.ts`, `src/app/api/widgets/**`, `src/app/widgets/**`, `src/components/widgets/**`, `docs/WIDGETS.md`.
Ejer: Widget-sessionen (2026-09-26)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |

## G-KONTO — Kontoopsætning øverst på Profil
Filer: `src/lib/account-setup.ts`, `src/app/profile/page.tsx` (kasse + proceslinje øverst), omdøbning `settings.learnTheApp` i `da.json`/`en.json`.
Ejer: cloud-session `claude/kontoopsaetning` (2026-10-03)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| konto-procent | Kontoopsætning: mørkegrøn "XX%" (andel udfyldte felter) midt mellem tekst og pil | Færdig (kode) | Brugerens test på telefon |

## Venter på dig (ingen gruppe)
| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |

## Løse ender fra arkiverede opgaver
Fundet ved arkiveringen 2026-10-03; stadig ikke lavet i koden.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |

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

## G-FAM — Familieabonnement og børneprofiler
Filer: `docs/FAMILY.md`, Prisma-skema (Family*, ProfileAccessLog), `src/lib/family*.ts`, `src/lib/session.ts`, `src/app/api/family/**`, `src/app/profile/family/**`, profilvælger/panel-komponenter, dagbogs-API'erne der skal følge den valgte profil.
Ejer: cloud-session `claude/lucid-bell-s5vyhv` (2026-09-25)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |

## G-FLOWS — Admin "Flows" + telefon-editor
Filer: `src/components/admin/PhonePreviewEditor.tsx`, `src/components/admin/FlowEditor.tsx`, `src/app/admin/flows/**`, `src/app/api/admin/flows/**`, `src/lib/flows.ts`.
Ejer: Flows-sessionen (2026-09-27)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 745f1ab5 | Telefon-editor (iPhone 17) til mails/notifikationer/svarskabeloner + hovedmenu "Flows" med flow-sider | Færdig (se git log "Admin: phone editor") | Guide-builderen (tooltips) er flyttet ind i `flows`-gruppen i `AdminShell.tsx` efter brugerens ønske |
| 41 | Design-screening af admin-flowsider mod HelloFresh-retningen | Færdig (branch `claude/admin-flowsider-design-4tzgb4`) | Afventer brugerens visuelle test på desktop + telefon |
| fredags-vejning | Fredags-banner under Flows: foreslår kalibrering i weekenden; `/weigh-reminders` med tidslinje (én kontakt pr. 2. time, push 5 min før); regler (ugedag, tid, dato m.m.) i Flows → Visning og betingelser | Venter på bruger | Kode i master (DECISIONS 2026-10-07), lint 0 fejl. Migration `20261007140000_weigh_reminders` skal køre ved deploy; flowet "Kalibrér vægten i weekenden" er en kladde — aktivér i admin → Flows. Kræver VAPID-nøgler + push-abonnement. Brugerens test på telefon |

## G-POPUP — Søg/vare/beskeder-efterrettelser + bundark-gennemgang
Filer: `src/components/ui/WheelPicker.tsx`, `src/components/ui/BirthDatePicker.tsx`, `src/components/StartupTipOverlay.tsx`, `src/components/family/AccessLogPanel.tsx`, `src/components/hf/BottomSheet.tsx` (kun no-drag-markering), `src/lib/use-confirm-sheet.tsx`, `window.confirm`-kald i admin-/indstillingskomponenter, `src/components/add/AddProductView.tsx` (kun brand-logoets luft til cirklen).
Ejer: session ddf69bff, konto A (2026-10-07)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 3/4/6/7/9 | Tilføj-knap væk, "Sådan regner vi" væk, menutekst tættere, "/stk.", luft over Tilføj | Færdig (0a7d3593 på master) | Kun verificeret mod koden her |
| 8 | Brand-logo: luft mellem logoet/Ø'et og cirklen | Færdig (44b2a341) | Logoets venstre kant beregnes af dets højde (`src/lib/brand-logo-layout.ts`), 8 px luft til cirklen. Afventer brugerens test på telefon |
| 10 | Alle popups/modaler som bundark (swipe ned = annullér), ingen `window.confirm`/centrerede overlays | Færdig (44b2a341) | Hjulvælgere, fødselsdato, startup-tip, adgangslog, familie-sletning, 15 admin-bekræftelser og admin-detaljevinduer. Undtagelser: DECISIONS 2026-10-07. Afventer brugerens test |
| fredag-vejning | Fredags-flow + vejepåmindelser, måltips til/fra, Udregn (Seriøs) | Færdig (kode, se git log 2026-10-07) | Migration 20261007140000 + aktivér flowet i admin |

## G-CHAT — Hjælpe-chatbot (app + web) og admin "Chatbot"
Filer: `src/lib/chatbot*.ts`, `src/lib/help-chat-events.ts`, `src/components/help/**`, `src/app/api/chatbot/**`, `src/app/admin/chatbot/**`, `src/components/admin/chatbot/**`. Små indgreb i `ScreenHeader`, `TopBar`, `WebShell`, `layout.tsx`, `AdminShell` og `globals.css` (`.hf-appbar--help`).
Ejer: Chatbot-sessionen (cloud), branch `claude/ai-chatbot-support`

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| chatbot | AI-chatbot øverst i app og web med medarbejder og kontaktformular (ingen telefon); admin → Brugere → Chatbot med oftest spurgt, Q&A-tabel, hele tråde og brugerinfo | Færdig (kode, se DECISIONS 2026-10-02) | Merge + deploy (migration `20261002120000_chatbot`). Test på mobil og desktop |
| chat-support | Chatten kun under Support, kontakt kun nederst (ikke i toppen) | Færdig (kode, branch `claude/help-chat-only-support`, DECISIONS 2026-10-03) | Brugerens visuelle test på telefon efter deploy |
## G-RESCAN — "Scan varen igen" (10 points) + natlig AI på Open Food Facts-billeder
Filer: `src/components/add/RescanBanner.tsx`, `src/lib/product-rescan*.ts`, `src/lib/external-image-ai.ts`, `src/app/api/products/[id]/rescan/**`. Rører også `ProductCaptureFlow.tsx` (ny `rescan`-prop), `AddProductView.tsx` (banneret), `quick-product-enrichment.ts` (eksporterede funktioner, snapshot-værn), `image-cutout-jobs.ts` (`discardPendingFrontImage`), jobregistret og scheduleren.
Ejer: cloud-session `claude/open-food-facts-scan-banner-rihp53` (2026-10-02)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | Banner "Optjen 10 points" for Open Food Facts-/USDA-varer og egne varer uden PNG (efter scanning og fra søgning), kamera med felterne, genscannede eksterne varer overtages som egne, natlig OpenAI-aflæsning hvis ingen reagerer | Færdig (kode, PR #138 åben) | Migration 20261003050000 med i deployet. Brugerens test på telefon |

## G-WAVES — Bølge-baggrund på forsiden
Filer: `src/lib/home-waves.ts`, `src/components/HomeWaves.tsx`, `.home-wave*` i `globals.css`, `src/app/page.tsx` (lag-opbygning), `StatsWheel.tsx` (kun `clipPath`).
Ejer: bølge-sessionen (2026-10-01)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | Rolig, tilfældig bølge-animation bag forsiden med frostet-glas-bund og tåge | Færdig (kode) | Afventer brugerens visuelle godkendelse på telefon; justér tempo/farve efter feedback | 2026-10-09: pause (PULSE_REST) mellem bølgerne, slagfrekvens uændret.

## G-SCAN — Kameraflow og vareside efter test (mælk/flødeboller)
Filer: `src/components/camera/**`, `src/lib/focus-detection.ts`, `src/lib/product-naming*`, `src/lib/quick-product-enrichment.ts`, `src/lib/product-photo-analysis.ts`, `src/lib/brand-match.ts`, `src/lib/nutrient-resolution.ts`, `src/components/add/AddProductView.tsx` (cirkel/titel/næringspanel), `scripts/image-agent/cutout.py`.
Ejer: cloud-session `claude/scan-flow-rettelser` (2026-10-02) — arkiveres; næste session overtager via PR #162

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | Ingen Tag billede-knap, større ramme, scan-rytme, h1/h2 uden gentagelser, brand fra DB, logo 70 %, 10 %-udklip, næringsdetaljer altid, tomme udklip afvises | Færdig (kode, draft-PR #162, master flettet ind 2026-10-03) | Næste session: flet master ind igen ved konflikt, sæt PR #162 til ready og merge efter brugerens OK. Brugerens test på telefon. Log-analyse af de to scanninger (mælk + flødeboller) kræver eksport fra admin → Log (cloud-sessionen når ikke produktions-DB'en). Fjern hjerte-logoet manuelt i admin → Logoer |

## G-INT2 — Flere integrationer (Garmin, WHOOP, Huawei, via-mærker, Health Connect-modul)
Filer: `src/lib/integrations/**`, `src/lib/integrations.ts`, `src/app/settings/integrations/**`, `src/app/api/integrations/**`, `src/lib/api-keys/*`, `native/android/healthconnect/**`.
Ejer: cloud-session `claude/integrations-more-brands` (2026-10-02)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | Garmin, WHOOP, Huawei (OAuth, kun læsning) + eufy/Renpho/Xiaomi/Tuya/Samsung via Health Connect/Apple Health + Android Health Connect-modul | Færdig (flettet i master via PR #157) | Kode i master; migration `20261002120000_more_integrations` kører ved deploy. Brugeren: Garmin-partnerprogram, Huawei Health Kit-godkendelse, WHOOP-app, nøgler i admin, logoer. Android-modulet skal bygges i Android Studio |
| calendar-weighins | **Bemærk G1:** vejninger og kropsmålinger vises i kalenderens dagsvisning/timeoversigt (`src/app/calendar/page.tsx`: ny `measurements`-prop på `DayDetails`, `HourRow` og `HourEntriesOverlay`, ny `MeasurementRow`) | Færdig på branch `claude/integrations-all-metrics` (PR #186) | Brugerens test på telefon |
| all-metrics | ALT med fra integrationerne: hele kropssammensætningen (fedt %, fedtmasse, fedtfri masse, muskel-, knogle- og vandmasse, visceralt fedt, BMR, metabolisk alder …), blodtryk, EKG, temperatur, blodsukker, aktivitet og søvn fra Withings, Garmin, Huawei, WHOOP, Polar, Fitbit, Google Health og Health Connect + Statistik-kort | Færdig på branch `claude/integrations-all-metrics` (venter på merge) | Migration `20261003120000_all_health_metrics` ved deploy. Withings/Fitbit/WHOOP/Huawei-brugere skal trykke "Forbind igen" for de nye tilladelser. Feltnavne for Polar-dagsaktivitet/cardio load, Huawei-sammensætning og Google Health-enkeltmålinger er ikke prøvet mod live-API |

## G-STORE — Butiksimport (Bilka + REMA 1000)
Filer: `scripts/store-products-import/**`, `docs/PRODUCT_IMPORT_MAPPING.md`, `Product.nutritionMissing`.
Ejer: "Indholdsfortegnelse og feltsammenflettning" (89f1295c, 2026-10-03)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 89f1295c | Alt fra arkene flettet ind: ingredienser, `_is_`-felter, energi (kJ-fejl + forkerte kcal rettet), Labels, alle 13.039 varer (2.364 skjulte uden næring) | Færdig (9dffca2a; importeret i drift 2026-10-03, set på hellocal.io) | — |

## G-PARTNER — Partnersider
Filer: `src/app/admin/partners/**`, `src/components/admin/partner/**`, `src/lib/partner-performance.ts`, `src/lib/ad-inventory.ts`, `src/lib/ad-serving.ts`, `src/lib/simple-pdf.ts`, `src/components/AdBanner.tsx`, `src/app/api/ads/**`, `src/app/api/admin/partners/**`.
Ejer: partner-sessionen (2026-10-03)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | Partnerside: virksomhed/kontakter i venstre bjælke, Sponsoraftale, Performance (Overview + Data mining), Fakturering, Betaling, PDF/CSV + send | Færdig i kode (branch `claude/partner-pages`) | Banner-upload bygget. Afventer brugerens visuelle godkendelse og besked om hvilke reklamepladser der findes (kataloget i `ad-inventory.ts` er et forslag) |


## G-AUTH — SMS-kode + login-godkendelse
Filer: `src/lib/teammessage.ts`, `src/lib/sms-verification.ts`, `src/lib/login-approval.ts`, `src/app/api/auth/{sms,login-approval,reset-password}/**`, `src/app/signup`, `src/app/reset-password`, `src/app/approve-login`, `src/app/profile/login-approval`, `public/sw.js`.
Ejer: SMS-sessionen (2026-10-02)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |

## G-BODYCHART — Kropsmål som statistikgrafer
Filer: `src/components/BodyMeasurementChart.tsx`, `src/lib/body-measurement-series.ts` (+ test), `src/lib/stat-charts.ts` (`body:*`), `src/app/statistics/{page,unused-charts/page,unused-cards/page}.tsx`, `src/app/profile/body-measurements/page.tsx`, i18n `bodyMeasurementChart.*`.
Ejer: ledig (Kropsmål-graf-sessionen er arkiveret 2026-10-03)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | Kropsmål-grafer: tegning til venstre, forløb af seneste 10 målinger til højre; følger cm/tommer | Færdig i kode på branch `claude/kropsmaal-statistikgraf` (PR #156, kladde) — ikke flettet | Gennemgå PR #156, flet master ind ved konflikt (typisk kun `docs/STATUS.md`: behold begge sider), kør lint/typecheck/build og flet til master. Tjek på telefon: Statistik → Tilføj → Kropsmål |

## G-LANG — Syv sprog (da, en, de, fr, nl, sv, no) + Hjælpecenter på alle
Filer: `src/i18n/**` (`index.ts`, `locales/*.json`), `public/hjaelp.html`, `public/help-*.html`, `src/app/profile/settings/language-region/page.tsx`.
Ejer: cloud-session `claude/seven-languages` (2026-10-03)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |

## G-CERT — Certifikat-udklip fra produktbilleder
Filer: `Certifikater/Udklip fra produktbilleder/` (kun data, ingen kode).
Ejer: ledig (session "Produktbilleder og certifikater screening")

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |

## G-PULS — Puls-robot, ugevisning og sportsforslag
Filer: `src/lib/pulse-*.ts`, `src/lib/heart-rate-spikes.ts`, `src/components/activity/*Pulse*`, `HeartRateSpikePrompt.tsx`, `src/app/api/activities/spike/**`, `src/components/admin/PulseRobotPanel.tsx`.
Ejer: session "Puls-robot" (2026-10-04)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| puls-robot | Natlig robot: pulsudsving uden sport + mønstergenkendelse + forslag; uge med datoer i spørgsmålet (web + mobil) | Færdig (kode, se git log "Puls-robot") | Migration 20261004120000 skal med deployet. Brugeren tester bundarket på telefon/desktop med tilsluttet ur |

## G-LOGOUPLOAD — Logo-upload i admin (drag and drop)
Filer: `src/app/admin/product-database/{logo-upload,image-upload}/**`, `src/app/api/admin/{brand-logos,product-images}/**`, `src/components/admin/{BrandLogo*,ProductImage*,ImageCompare}.tsx`, `src/lib/{brand-logo-*,product-image-*,dropped-files}.ts`, tabellerne `brand_logo_upload*` og `product_image_upload*`.
Ejer: logo-upload-sessionen (2026-10-04)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| logo-upload | Drag and drop af logoer under Varedatabase med partier/tidsstempel, masse-sletning, størrelse/original/filstørrelse og procesvisning | Færdig (kode) | Migration 20261004140000 skal med deployet. Ikke prøvet i browser/mod rigtig database — test med en lille mappe først |

## G-FOOTERARC — Halvcirkel over footeren + Tilføj-menu-redigering + Edeka-logo
Filer: `src/components/FooterArc*.tsx`, `src/lib/footer-arc.ts`, `src/lib/add-menu-layout.ts`, `src/components/add/AddMenuList.tsx`, `scripts/image-agent/cutout.py` (logo), `src/app/profile/messages/page.tsx`.
Ejer: halvcirkel-sessionen (2026-10-07)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| edeka-logo | Logo viser kun hjertet (blå felt væk) | Færdig (kode) | Årsag + fix i cutout.py; allerede gemt Edeka-logo skal genkøres/uploades igen. Ikke prøvet mod det rigtige foto |
| beskeder-prik | Sorte cirkler på Beskeder → grå tekst "Ny" | Færdig | — |
| footer-arc | Lille halvcirkel midt over footeren (skub op, træk til siden, tryk, hold = redigér) | Færdig (kode, første prøve) | Afventer brugerens svar på bekræftelsesspørgsmål + test på telefon |
| add-menu-edit | Tilføj-menuen: hold inde → omrokér/slet, "Tilføj" øverst til højre | Færdig (kode) | Afventer test på telefon |
| retter-tekst-scan | Retter: auto-fokus søg, "Opret ny ret", integrationsknapper + filter-bundark; opret ret med Manuelt/Indsæt tekst/Scan + kopi-tjek (claude/retter-tekst-scan) | Delvis færdig (kode) | Alt bygget undtagen Valdemarsro-import/-detaljevisning/natligt link-script (afventer beslutning). Migrationer 20261008100000/110000/120000 skal med deployet |
## G-OFFLINE — Offline-besked, PII-anbefaling, tallerken-scan på OpenAI, stregkode-robusthed
Filer: `src/lib/use-online-status.ts`, `src/components/OfflineQueueBanner.tsx`, `src/lib/barcode-frame-scanner.ts`, `src/lib/meal-photo-recognition.ts`, `docs/OFFLINE-AUDIT.md`, `docs/SECURITY-PII-OPTIONS.md`.
Ejer: offline/PII/scan-sessionen (2026-10-07), branch `claude/offline-pii-scan`

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 1 | Offline-audit + fælles offline-besked | Færdig (se git log "Offline") | Registreringer køes ikke offline (se OFFLINE-AUDIT) |
| 2 | PII-adskillelse: anbefaling | Færdig (docs/SECURITY-PII-OPTIONS.md) | Afventer brugerens valg før noget bygges |
| 3 | Tallerken-scan midlertidigt på OpenAI | Færdig (flag MEAL_PHOTO_PROVIDER) | Skal rulles tilbage, se DECISIONS 2026-10-07 |
| 4 | Stregkodescanner robusthed (skygge) | Færdig (kode) + lokal tærskel pr. scanlinje i JS-stien (PR #297, `barcode-row-threshold.ts`/`barcode-local-binarizer.ts`, 2026-10-09) | Afventer brugerens test på telefon med mælk i skygge. Virker det stadig ikke på iPhone: eksportér scan-loggen fra admin → Log; vinduet (10 %) og kontrastgrænsen (8) kan justeres |
## G-VAEGT — Vægt: synk-status, tøj ved vejning, kalibrer
Filer: `src/components/weight/**`, `src/app/weight/**`, `src/app/api/weight-*`, `src/lib/weigh-*`, `src/app/admin/weight-attire/**`.
Ejer: vægt-sessionen (2026-10-07)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| vaegt-synk | Synk-status, synk-popup, tøj-popup, tøj-blok + admin-algoritme, kalibrer-link, klik ind på vejning, Tilføj-tekst tættere | Færdig (se git log "Vægt:") | Afventer brugerens test på telefon; de/fr/nl/sv/no mangler oversættelse af `weighIn.*` |
| vaegt-kalender-ret | Timeoversigt: vejning alene på tidspunktet åbner info-vinduet direkte (ingen accordion), dublet-række og gammelt badevægt-ikon væk, vægt-linjen nederst ved kalorierne fjernet | Færdig (kode, `src/app/calendar/page.tsx`) | Brugerens test på telefon |
| vaegt-tojslidere | Tøj ved vejning som flere til/fra-slidere (undertøj, bukser, top/T-shirt, sweater, sko, mobil m.m. i lommen, efter toiletbesøg); intet valgt = nøgen | Færdig (kode) | Migration 20261009100000 (`attireItems`, gamle valg omregnes) skal med deployet. Ikke prøvet i browser/mod rigtig database; de/fr/nl/sv/no har engelske tekster |
## G-VIDEN — Guide mig + Viden om mad
Filer: `src/lib/help-guides.ts`, `src/components/help/**`, `src/lib/knowledge*.ts`, `src/app/viden-om/**`.
Ejer: viden-hjaelp-guide-sessionen (2026-10-07)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | Genvejslink + Guide mig-overlay i hjælpe-chatten; søgning i Viden om mad; kalorieforbrænding; WHO-kilder | Færdig (se git log "Guide mig") | Brugeren tester på telefon: spørg chatten "hvordan logger jeg vægt?" |
| retter-tekst-scan | Retter: auto-fokus søg, "Opret ny ret", integrationsknapper + filter-bundark; opret ret med Manuelt/Indsæt tekst/Scan + kopi-tjek (claude/retter-tekst-scan) | Færdig (kode) | Alt bygget inkl. valdemarsro-agent. Migrationer 20261008100000/110000/120000/130000 skal med deployet; agenten er ikke kørt mod rigtig database/Docker. Ikke prøvet i browser |

## G-EGENMAALING — Tilføj egen måling i tal-hjulet
Filer: `src/lib/custom-measure*.ts`, `src/components/CustomMeasureSection.tsx`, `StatsWheel.tsx`, native `CustomMeasure*.kt`/`HomeStatsWheel.kt`.
Ejer: cloud-session `claude/stat-kort-kalorier-skridt` (2026-10-09)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| egen-maaling | Tilføj egen måling (navn, parameter, periode, tekst max 2×15 tegn) i Visning → Forside + tal-hjul, web og native | Færdig (kode, PR åben) | Brugerens test på telefon; de/fr/nl/sv/no mangler oversættelse af `customMeasure.*`. Åbent: nye statistik-kort (screening-status, skridt vs. mål, minutter i zone) afventer brugerens svar |
## G-GUIDE — Genvej + "Guide mig" i Hjælpecenteret
Filer: `public/hjaelp.html` + `public/help-*.html` (script nederst), `src/app/api/help/guides/**`, `topics` i `src/lib/help-guides.ts`, `?guide=` i `HelpGuideSpotlight.tsx`.
Ejer: cloud-session `claude/help-center-shortcut-overlay-2cql8y` (2026-10-09)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| guide-hjaelpecenter | Understreget genvej øverst + "Guide mig" i Hjælpecenter-emner | Venter på bruger | Draft-PR #318. Brugeren tester på telefon: Hjælpecenter → "Hvordan registrerer jeg min vægt?" → Guide mig |

