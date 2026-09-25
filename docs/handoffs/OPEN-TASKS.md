# Åbne opgaver — fælles overlevering mellem konti

Opgaverne her blev startet på én Claude-konto og kan fortsættes på en anden.
Samme maskine, samme repo. Denne fil er den eneste fælles sandhed om, hvem der
laver hvad.

## Regler for alle sessioner

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
6. Når en opgave er færdig og committet: sæt `Status: Færdig (<commit>)`.
7. Løber din konto tør: sørg for at din linje her er opdateret og committet.

Status-værdier: `Ikke startet` · `Venter på bruger` · `I gang` · `Blokeret` · `Færdig`

Status opdateret: 2026-09-24 (overtaget fra konto A kl. 17:29)

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
Ejer: —

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| d2f522ca / 52205f52 | Globalt bølgeikon for usikre varer + mikrodata, margin i grå, on/off i indstillinger | Venter på bruger | Krav i STATUS (commit 1beb7a8). Mangler: ikon som tekst-tilde eller SVG? Frida-vitaminer skal evt. bygges først |
| ff7fc6a5 | Admin "Uncertainties" med 4 faner, rød prik, lightbox med beskåret OCR-billede | Venter på bruger | Krav i STATUS punkt 15. Brugeren sagde "Udfør" til sidst — bekræft om det betyder byg nu |

## G5 — Agent-app + logo-robot
Filer: ny agent-app, admin "scan-invites", logo-agent (Python/container).
Ejer: G5-overtagelse, konto B (2026-09-24)
⚠️ Fra G1 (2026-09-25): deploy-trinnet "Build and start catalog agents" i `.github/workflows` fejler ved hvert push til master siden 2026-09-24 ca. 18:00 (fx run for 50a5a47). App-deployet lykkes, men agent-containerne opdateres ikke. Brugeren har bedt G5 om at rette det — læs job-loggen på GitHub.

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
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
| 8b0a278f | Kropsmål med mand/kvinde-tegninger (fra hovedmappen), kort som på statistik | Ikke startet | Tjek om allerede lavet, ellers byg |
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
| 6068f78a | 8 sundhedsintegrationer + nye ikoner | Færdig (22184fe) | Brugeren valgte "Byg alle 8" inden for boks-arkitekturen. Mangler kun nøgler på serveren + deploy |
| 8d98b548 | Withings + Google Health koblet på, egen data-sync | Venter på bruger | Kode færdig (22184fe). Brugeren skal lægge nøglerne i .env.production på Synology, så deployes der. HelloFresh-trin-rettelsen i samme transcript hører til G6 |
| d0442775 | Waldemarsro (DK-only) + scraper | Venter på bruger | Krav afklaret og committet (ea7843a) — byg når brugeren siger til |

## G9 — Ikoner (forside + vand)
Filer: forsidens grydeikon, Vand-siden, `public/` assets.
Ejer: G9-overtagelse, konto B

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| b4666faa | Grydeikon: trim `Gryde.png` og erstat på forsiden | Færdig (f5895a3) | Var allerede lavet: `public/icons/gryde.png` (770×759, trimmet), brugt i `src/lib/add-actions.ts` |
| 60e492ca | Vand-siden: 4 PNG'er (75/50/33/25 cl) | Færdig (6cf89c5) | Billeder i `public/icons/water/`, registrerer 750/500/330/250 ml. Afventer brugerens godkendelse af udseendet |
| ea9d1f7c | Dublet af 60e492ca (glas/flaske i række på fire) | Færdig (6cf89c5) | Lukket af G9: spørgsmålet om billede↔størrelse er besvaret af filnavnene i 60e492ca |

## G10 — Bundnavigation + global overskrift-stil
Filer: `src/components/BottomNav.tsx`, `src/app/globals.css`.
Ukendte ændringer: ingen (alt G10-arbejde committet).
Ejer: G10-overtagelse, konto D (2026-09-24)

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 5f2ee781 | Fjern stregen mellem footer og indhold + sektionsoverskrifter mindre, ikke fed, centreret med streg på hver side | Færdig (be3a05d) | Verificeret i preview. Afventer brugerens godkendelse af udseendet |
| 6a503586 | Footer-redigering: slette-krydserne er skåret af + ikoner skal kunne trækkes til siden for at bytte rækkefølge | Færdig (8d5ba9b) | `overflow-x-clip` så krydserne ikke klippes; ombytning efter pladsen under fingeren (ingen hop) + roligere glide-animation; ikon fra panelet indsættes på den plads, det slippes. Afventer test på telefon (HelloFresh/knap-delen hører til G6) |

## G11 — Næringsdata på produktsiden (E-numre, toksiner, fedt-advarsel)
Filer: produktsidens næringsvisning, statistik-boks-katalog (koordinér med G2), Opsætning/Visning (koordinér med G7).
Ejer: —

| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| 03b329f3 / 5a3cdd2b | E-numre + toksiner som valgfri statistik-bokse og til/fra i Opsætning, vist på produktsiden; "udvidet næringsindhold" åben som standard | Venter på bruger | E-numre findes allerede. Toksiner: brugeren sagde de gælder indholdsfortegnelsen og kendte toksiner i bestemte grøntsager — afklar datakilde og byg |
| 56f30763 | Advarselstrekant med udråbstegn ved mættet/usundt fedt | Ikke startet | Tjek om allerede lavet, ellers byg |

## Venter på dig (ingen gruppe)
| Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- |
| d595e6bc | REMA-appelsin har "Zimbabwe" som produkttype → skal være land | Venter på bruger | Kør SQL via SSH/sudo med tabellen `products` (se transcript for kommandoen), så rettes rækken |

---

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

## Ikke fordelt
Ændret og ikke committet uden kendt ejer: `docs/AI.md`, `src/components/AddButton.tsx`,
`src/components/hf/PointsPromoBanner.tsx`, `src/i18n/locales/*.json`, `src/lib/vault/webauthn-client.ts`.
Nogle hører muligvis til login-/Mailjet-sessionerne på konto B. Rør dem ikke uden at læse diff'en først.
