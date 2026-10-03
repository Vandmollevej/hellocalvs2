# Arkiv — færdige opgaver

Færdige rækker flyttet hertil fra `OPEN-TASKS.md`, så den fil kun viser
åbent arbejde. Rækkerne er kopieret uændret; "Næste skridt" rummer stadig
evt. brugergodkendelse eller test på telefon, der ikke kræver mere kode.
Genåbnes en opgave, flyttes rækken tilbage til `OPEN-TASKS.md`.

Arkiveret: 2026-10-03

## G1 — Kalender
Filer: `src/app/calendar/**`, kalender-komponenter.

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

## G2 — Statistik-siden (redigering, drag/drop)
Filer: statistik-siden, `src/components/StatsWheel.tsx`, `src/lib/frontpage-layout.ts`, `src/lib/frontpage-stats.ts`.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 7fd0a9a3 | Rettelser til kort-redigering: fjern 6 prikker, skillelinje, vibration stop, scroll, slette-cirkel, ét slider-design | Færdig (32995ab) | Slider-delen var allerede lavet (23163ec) |
| fb445e0d / 1ac06755 | Drag/drop til frie felter, stiplede rammer, dropzone til overskrift (1ac06755 er samme opgave) | Færdig (32995ab) | — |
| 2fb90f13 | Dublet af 7fd0a9a3 (samme 6 punkter) | Færdig (32995ab) | — |
| 961d7953 | Tal-slider på forsiden: midterste tal 25px indrykket, aftager til 0 som transparensen | Færdig (eba3638) | — |
| 00cf8440 | Gradient i højre side af tallene (synlighed) skal være helt flydende | Færdig (32995ab) | Opacity går nu lineært til 0 ved kanten |
| a9819635 | Trinløs størrelse/farve på slider (ingen spring pr. position) | Færdig (32995ab) | Ikonfarve + "/ mål"-linje glider nu trinløst |
| 65efa293 | Tal-hjulet: én linje uden "/ mål", ikon til HØJRE, jævn luft, 7 rækker (2 opfundne), 2° vifte pr. række, ingen beskæring | Færdig (8009704, pushet til master) | Konflikter med 0d21a46 (lokal master): behold denne version, den har 0d21a46's dæmpning med. Brugeren tester på iPhone |

## G3 — Produktkategorier + statistikbokse + "Månedens synder"
Filer: Prisma-skema (kategori), kategori-lib, nye statistikbokse, ny liste-side, knap i kalender (koordinér med G1).

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| c0d3a8fa / f5505465 | Ernæringsmæssige produktkategorier (alkohol, fedt, ost, yoghurt, …; ultraforarbejdet som tag) | Færdig (se git log "G3:") | Grove kategorier + klassifikation bygget. 30-listen er separat opgave |
| d7f6eb5c / 1578bf02 | Kød/fisk-bokse (g + kcal), sukkerholdige drikke, alkohol, "største syndere", liste-side, "Månedens synder" | Færdig (se git log "G3:") | Bygget. Knap i kalender tilføjet (kun én `ActionLink` i månedsvisning) |

## G4 — Usikkerhed (bølgeikon + Uncertainties-admin)
Filer: usikkerheds-ikon/komponent, mikronæringsvisning, indstillinger → Visning, admin Uncertainties.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| d2f522ca / 52205f52 | Globalt bølgeikon for usikre varer + mikrodata, margin i grå, on/off i indstillinger | Færdig (pushet til master 2026-09-25) | Specifikation: samtale ef2ba16f + DECISIONS 2026-09-25. Live-tjek kræver login |
| ff7fc6a5 | Admin "Uncertainties" (5 faner inkl. Billeder, 70/50 %-tærskler), natlig AI-genkørsel, admin "Cron-jobs" | Færdig (pushet til master 2026-09-25) | Live-tjek kræver admin-login |

## G6 — Madvare-flow (Tilføj madvare, Madvarer-siden)
Filer: `src/app/add/**`, `src/components/ForwardButton.tsx`, Madvarer-siden, fælles knap-komponent.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 155dc7cf | Forward-ikon i stedet for dele-ikon, "Log ind…"-tekst på linje med ikonet | Færdig (aaed6fb) | — |
| 56fda7bc | Mængde altid med enhed (g / ml / cl efter produkttype) | Færdig (3264ed1) | Var allerede lavet af anden session |
| ad648ee7 | HelloFresh kun i Opret ret + global regel: knapper fuld bredde (også bedt om i 6a503586) | Færdig (aaed6fb + trin-commit) | Kameraets "Produkt"-fane vises nu kun fra Opret ret |
| b309686e | Opret ret: HelloFresh-trin med 3 cirkler, "Tag billede"/"Opret manuelt", tekstlink "Opret egen ingrediens" → ny side for private ingredienser | Færdig (1540198 + trin-commit) | Trin-baren på Opsætning bruger nu den fælles HfProgressStepper (HelloFresh-stil). Venter på deploy sammen med alt andet (brugerens beslutning) |

## G7 — Profil
Filer: `src/app/profile/**`.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 9a0770ce | Ny oversigtsside over målsætninger (historik, grønt flueben, fast knap nederst) | Færdig (2a119d8, 737783e) | Var allerede bygget og opfylder kravene |
| 8b0a278f | Kropsmål med mand/kvinde-tegninger, kort som på statistik | Færdig og deployet (8649ac8, 1a90aee → live i 1cf8b2b) | Hals tilføjet efter brugerens ja; migration 20260926090000 kørt af deployet |
| d22c7e61 | Invitér en ven: betingelser som tekstlink, luft, fjern skillelinje | Færdig (6ab6eca, 62708b7) | Demo-data kan ikke laves: demo-brugeren er fjernet |
| ef8a5612 | "Skift adgangskode"-side | Færdig | Fandtes allerede (/profile/change-password) og passer med det gendannede adgangskode-login |
| 60da6b15 | Indstillinger: allergener i samme boks + "Vælg alle" | Færdig | Committet af en anden session |
| bc01cd73 | Højde-vælger fryser / "Færdig" / aktuel højde vises ikke | Færdig (6ab6eca) | Ikke testet i browser (kræver login) |
| 26393cba | Abonnement "Seriøs": næste betalingsdato, "Betalingsmetoder"-knap + profilpunkt | Færdig (a764b4d) | Demo-brugeren oprettes ikke (fjernet bevidst, DECISIONS 2026-09-25) |
| gear-appsettings | Profil: tandhjul (kun på /profile) → app-indstillinger (`/settings`) + tilbagepil på profilsiden | Færdig | App-punkter flyttet fra profil til `/settings`, log ud flyttet med |
| 65efa293 | Billede-dagbog mistede billeder (5 → 2): lager flyttet fra localStorage til IndexedDB | Færdig (44f7b58, pushet sammen med karrusellen 2c8b608) | Brugeren tester på iPhone: tag flere billeder, forlad siden, kom tilbage |

## G8 — Integrationer
Filer: `src/lib/integrations.ts`, integrationssiden, `/api/withings/**`, Google Health.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 6068f78a | 8 sundhedsintegrationer + nye ikoner | Færdig (22184fe) | Brugeren valgte "Byg alle 8" inden for boks-arkitekturen. Mangler kun nøgler på serveren + deploy |
| 5c45b0d7 | Opskrift-scrapere som Valdemarsro: Arla, Coop, REMA 1000, MENY, Hjerteforeningen, TV2 (+ Børnevenlig og måltidstype) | Færdig (kode) | Scrapere + kalorie-matcher i scripts/recipe-sites-import (README). Testet på de rigtige sider. Brugeren kører dem selv i VS Code; import i appen hører under Valdemarsro-integrationen |
| 300489b5 | Push til Health/integrationer + egen side pr. app med til/fra (hent/send) ved tilkobling og bagefter | Færdig (ce1bc7f, deployet) | Brugeren: skriveadgang i Google Cloud-klienten (nutrition/health_metrics writeonly) og Strava-appen (activity:write); native app til Apple Health/Health Connect mangler |

## G9 — Ikoner (forside + vand)
Filer: forsidens grydeikon, Vand-siden, `public/` assets.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| b4666faa | Grydeikon: trim `Gryde.png` og erstat på forsiden | Færdig (f5895a3) | Var allerede lavet: `public/icons/gryde.png` (770×759, trimmet), brugt i `src/lib/add-actions.ts` |
| 8f42a331 | Nyt grydeikon (jævne streger) + champagneikon til Målsætning | Færdig | SVG-ikoner i `src/components/icons/`. Brugeren sletter kildebillederne i sin lokale hovedmappe |
| 60e492ca | Vand-siden: 4 PNG'er (75/50/33/25 cl) | Færdig (6cf89c5) | Billeder i `public/icons/water/`, registrerer 750/500/330/250 ml. Afventer brugerens godkendelse af udseendet |
| ea9d1f7c | Dublet af 60e492ca (glas/flaske i række på fire) | Færdig (6cf89c5) | Lukket af G9: spørgsmålet om billede↔størrelse er besvaret af filnavnene i 60e492ca |

## G10 — Bundnavigation + global overskrift-stil
Filer: `src/components/BottomNav.tsx`, `src/app/globals.css`.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 5f2ee781 | Fjern stregen mellem footer og indhold + sektionsoverskrifter mindre, ikke fed, centreret med streg på hver side | Færdig (be3a05d) | Verificeret i preview. Afventer brugerens godkendelse af udseendet |
| a83d7a5a | Alle overskrifter med streger skal være samme klasse (Tidspunkt, datogrupper, statistik, "+ Skillelinje", Historik) | Færdig (136f502) | Deployet (Actions grøn). Obs: forside-indstillingernes "Knapper i hjulet" har en egen streg-overskrift, der kun findes på den lokale master — den skal over på `.hf-type-section-title`, når den lander på origin |
| 6a503586 | Footer-redigering: slette-krydserne er skåret af + ikoner skal kunne trækkes til siden for at bytte rækkefølge | Færdig (8d5ba9b) | `overflow-x-clip` så krydserne ikke klippes; ombytning efter pladsen under fingeren (ingen hop) + roligere glide-animation; ikon fra panelet indsættes på den plads, det slippes. Afventer test på telefon (HelloFresh/knap-delen hører til G6) |

## G11 — Næringsdata på produktsiden (E-numre, toksiner, fedt-advarsel)
Filer: produktsidens næringsvisning, statistik-boks-katalog (koordinér med G2), Opsætning/Visning (koordinér med G7).

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 03b329f3 / 5a3cdd2b | E-numre + toksiner som valgfri statistik-bokse og til/fra i Opsætning, vist på produktsiden; "udvidet næringsindhold" åben som standard | Færdig (5cea433) | Kontakter i Opsætning, toksinliste (FVST + EFSA, graviditet/amning/fertilitet først), produktside. Flettes ind i master, når G7 har committet profile/settings |
| 56f30763 | Advarselstrekant med udråbstegn ved mættet/usundt fedt | Færdig (5cea433) | Trekant på statistik-bokse + produktside. **G2:** forsidens tal-slider (`frontpage-stats.ts`) mangler samme ikon — G11 rører ikke filen |
| 31 | E-numre klikbare på varen og i ingredienslisten | Færdig (branch `claude/clickable-e-numbers-0g8aih`) | E-numre i ingredienstekst åbner `AdditiveInfoModal` via `splitENumbers` i `src/lib/additives.ts`; E-nummer-listen var allerede klikbar |

## Widgets (iPhone/Android)
Filer: `src/lib/widgets.ts`, `src/lib/widget-data.ts`, `src/lib/widget-add-actions.ts`, `src/app/api/widgets/**`, `src/app/widgets/**`, `src/components/widgets/**`, `docs/WIDGETS.md`.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| c4b41bf9 | Forbered widgets: plus-knap, hurtig-tilføj, statistik-graf (Smart Stack/swipe), 2×2 boks, seneste registreringer | Færdig (kode) — venter på Mac | Web-preview `/widgets` + native kildekode i `native/` (Swift + Kotlin, ukompileret). Næste: kompilér på Mac/Android Studio efter `native/README.md` |

## Færdige — kan lukkes

| Id | Opgave | Bevis |
| --- | --- | --- |
| 1584eca0 | Global tidspunkt-visning | `src/components/hf/TimeSection.tsx` |
| 1d1d05b2 | Profil-knapper "Vægt"/"Målsætning" | Gamle strenge findes ikke længere |
| 40d682e3 | Brugerændringer i næringsindhold → admin | STATUS 2026-09-23, `NutritionReportPanel` |
| 4cb55b0b / efe65bbb | Logo-placering + hængelås på energifordeling | `src/app/add/[id]/page.tsx`, DECISIONS |
| 7a744bd5 | Global copy/paste-blokering | `GlobalClipboardGuard.tsx` |
| 819c071c | Fødselsdato-vælger åbner på 1990 | `BirthDatePicker.tsx` |
| b649e8f4 | Anonymitet/kryptering | DECISIONS 117-121 |
| e542c2f4 | Produkttitel sort + brand grøn | `src/app/add/[id]/page.tsx` |
| 217a0faf | Stregkode auto-rotation, fjern manuelt felt | commit 1643610 |
| — | Stregkode: lodret/skæv aflæsning, AR-afkodning, lysere guide (2026-09-25) | DECISIONS 2026-09-25 "Stregkode-scanning" |

## G12 — Ens 48 px-højde på felter, dropdowns, knapper og rækker
Filer: `.hf-field` / `.hf-control` / `.hf-control-row` + `--hf-control-height` i `src/app/globals.css` (blokken over `.hf-search`), og klassebyt i de enkelte .tsx-filer.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | Klasser + første 16 filer (login, betaling, TextField m.fl.) | Færdig (64c5125, d7b4ec3) | — |
| — | Resten (62 filer: profil, statistik, admin, kamera, hello-doc …) | Færdig (bdc754d) | — |
| — | Sidste 5 filer: kalender, Indstillinger, Support, Forside-visning, admin/API-nøgler | Færdig (3a3b398) | — |
| — | Sidste 5 filer: `calendar/page.tsx`, `settings/page.tsx`, `settings/support/page.tsx`, `settings/display/front-page/page.tsx`, `admin/ApiKeysManager.tsx` | Færdig (3a3b398) | Gammel G12-række, der lå under G13 som "Blokeret"; løst af G12 i 3a3b398 (se ovenfor). Oprindelig note: Andre sessioner har ikke-committede ændringer i dem. Når de er committet: kalender-rækker (min-h-11/py-3 → `hf-control-row`), support-rækker (h-12 → `hf-control-row`), knapper (h-12 → `hf-control`), front-page-rækker (py-3 → `hf-control-row`), ApiKeysManager `inputClass` (py-2 → `hf-field`) |
| — | 48 px på alle enkeltlinje-felter, dropdowns, fuldbredde-knapper, rækker (inkl. admin) | Færdig | — |

## G13 — HelloFresh-opskriftsvisning (som i HelloFresh-appen)
Filer: `src/app/profile/recipes/hellofresh/**`, `src/components/recipe-view/**`, `src/lib/hellofresh-recipe.ts`, `src/app/api/hellofresh-recipes/**`, `scripts/hellofresh-import/agent.py`.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| ed3c2525 | HelloFresh-opskrifter vises præcis som i HelloFresh-appen, fælles `.rv-*`-klasser (ikke egne retter) | Færdig (se git log "HelloFresh recipe view") | Deploy: migration 20260927100000 + genstart hellofresh-agent (genhenter alle opskrifter én gang). Afventer brugerens visuelle godkendelse |

## G-FLOWS — Admin "Flows" + telefon-editor
Filer: `src/components/admin/PhonePreviewEditor.tsx`, `src/components/admin/FlowEditor.tsx`, `src/app/admin/flows/**`, `src/app/api/admin/flows/**`, `src/lib/flows.ts`.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 745f1ab5 | Telefon-editor (iPhone 17) til mails/notifikationer/svarskabeloner + hovedmenu "Flows" med flow-sider | Færdig (se git log "Admin: phone editor") | Guide-builderen (tooltips) er flyttet ind i `flows`-gruppen i `AdminShell.tsx` efter brugerens ønske |
| 41 | Design-screening af admin-flowsider mod HelloFresh-retningen | Færdig (branch `claude/admin-flowsider-design-4tzgb4`) | Afventer brugerens visuelle test på desktop + telefon |

## G-WAVES — Bølge-baggrund på forsiden
Filer: `src/lib/home-waves.ts`, `src/components/HomeWaves.tsx`, `.home-wave*` i `globals.css`, `src/app/page.tsx` (lag-opbygning), `StatsWheel.tsx` (kun `clipPath`).

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | Rolig, tilfældig bølge-animation bag forsiden med frostet-glas-bund og tåge | Færdig (kode) | Afventer brugerens visuelle godkendelse på telefon; justér tempo/farve efter feedback |

## G-BANNER — Ét banner øverst på varesiden
Filer: `src/components/hf/UpdatePointsBanner.tsx`, `src/components/add/AddProductView.tsx`.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| — | Grønt "Scan varen igen"-banner koblet af; hvidt opdater-banner har grønnes grå trækstreg | Færdig (PR #226) | Brugeren bad om merge 2026-10-03; ikke testet på telefon |
