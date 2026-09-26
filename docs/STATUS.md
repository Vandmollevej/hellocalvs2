# HELLO CAL — project status

Last updated: 2026-09-26

## 2026-09-26: Opret vare — logo, fritskrabning og samme-foto-flueben

Se docs/DECISIONS.md 2026-09-26 "Opret vare — rækkefølge …". Kamera-flowet er
stregkode → forside → energi → indhold med flueben pr. trin; energi + indhold på
samme foto giver begge flueben. OpenAI læser logonavn + logo-/produktboks;
navnet matches mod Brand-tabellen; `scripts/image-agent` fritskraber logo og
produkt (`ImageCutoutJob`, migration `20260926140000_image_cutout_jobs`).
Lint + typecheck grønne for de ændrede filer. Ikke testet mod OpenAI/rembg
(ingen lokal DB/Python).

Next work:
1. Deploy: migrationen + genbyg `image-agent` (deploy-trinnet for agenterne
   fejler pt., se G5 i OPEN-TASKS).
2. Test på telefon med en rigtig vare (fx næring + ingredienser på samme side).


## 2026-09-26: Seriøs-låse + egne abonnementssider

Gratis: 3 måneders historik, én målsætning (målvægt), ingen delmål. Låst til
Seriøs: statistik, fotodagbog, bundmenu-omarrangering, visningsindstillinger,
allergenvisning, opskriftsfiltre/HelloFresh og integrationer (se DECISIONS
2026-09-26). Nye sider `/profile/subscription/serious` og `/family` med 1/3/12
mdr.-bokse. Lint + typecheck grønne for de ændrede filer; fuld build ikke kørt
(anden sessions ufærdige `FrontPagePreview`-import fejler typecheck).

Next work:
1. Endelige priser og hvordan Seriøs Familie fungerer (antal medlemmer).
2. Købsknappen åbner, når MobilePay-sessionens aftale-API er deployet.


## 2026-09-26: Oplevelse af søvn

Dagligt søvn-overlay (1–5), indstilling under Visning, sort bjælke i
kalenderens dagvisning og graf "Søvnkvalitet og kalorier" på Statistik. Se
DECISIONS 2026-09-26. Kræver migration `20260926130000_sleep_quality` ved
deploy. Ikke visuelt testet (brugeren tjekker selv).

Last updated: 2026-09-26

## 2026-09-26: Statistik — kort flyttes rigtigt (intet spøgelse)

`src/components/StatCardsGrid.tsx`: det løftede kort (med stiplet ramme og
kryds) følger fingeren; der efterlades ingen gennemsigtig kopi. Gitteret viser
løbende resultatet (landingsfelt markeret, kortet der byttes med står allerede
på den gamle plads). Ved slip glider kortet kun fra fingeren ind på pladsen —
ingen efter-animation fra den gamle plads. Samme for overskrifter/skillelinjer.
Reflow-animationen måles nu lige før DOM-ændringen (scroll-uafhængig).
Kun lint/build — ikke visuelt testet (brugerens regel 2026-09-26).

## 2026-09-26: Ubrugte kort/grafer — "+ Tilføj" på hvert kort, ikke på blokken

Brugeren afviste "+ Tilføj" pr. accordion (tilføjede hele blokken på én gang).
`/statistics/unused-cards` og `/statistics/unused-charts`: hvert kort/graf har
nu "+ Tilføj" i øverste højre hjørne og tilføjes ét ad gangen; knappen på
accordion-overskrifterne og `AccordionSection`s `action`-plads er fjernet.
Se DECISIONS 2026-09-25 "Statistiksidens grafer kan redigeres som kortene".
Lint grøn; `next build` kompilerer, men det lokale typetjek fejler kun i
ret/opskrift-filerne (`tags`/`images`/`steps`), fordi den delte Prisma-klient
i `node_modules` er genereret fra et ældre skema — ingen fejl i de ændrede filer.

## 2026-09-26: Billede-dagbog mistede billeder — gemmes nu i IndexedDB

Brugeren tog 5 billeder, efter at have forladt siden var der 2. Billederne lå
i localStorage (~5 MB på iPhone), så kun de første to blev gemt. Nu IndexedDB
+ nedskalering, fejl vises i stedet for at blive slugt, gamle billeder flyttes
automatisk. Se `docs/DECISIONS.md` 2026-09-25 "Billede-dagbogens billeder i
IndexedDB". Pushet sammen med karrusellen (44f7b58). Test på iPhone: tag
flere billeder, forlad siden, kom tilbage.

## 2026-09-26: Forsidens tal-hjul — ikon til højre, én linje, 7 rækker, vifte

Se `docs/DECISIONS.md` 2026-09-25 "Forsidens tal-hjul" og `docs/UI.md`.
Ingen "/ mål"-linje, jævn luft, 2 opfundne eksempeltal (søvn, puls) til
pladserne brugeren ikke har udfyldt, 2° hældning pr. række, ingen beskæring.
Et tal, der drejer rundt om enden, toner nu ud/ind i stedet for at fare tværs
hen over hjulet. Test på iPhone efter deploy.

## 2026-09-26: Billede-dagbog — vandret karrusel i loop

Brugerens krav (skærmbillede af HelloFreshs "Kogebog"-karrusel): billederne
vises ikke længere i et 2-kolonne-grid, men i en vandret karrusel med høje
kort i samme mål som HelloFreshs høje kort (160 × 333 pt ved 393 pt skærm,
dvs. 44 % af karrusellens bredde, 16 px mellemrum). Ældste til venstre,
nyeste til højre; det nyeste står i midten ved start, og med 3+ billeder
kører den i loop (til højre for det nyeste kommer det ældste). Dato og
klokkeslæt står under billedet, ikke som overlay. Tryk åbner fuldskærm med
16 px luft om billedet og datoen nederst; fuldskærm swiper/looper i samme
retning. Bygget oven på IndexedDB-lagringen (commit ec1732e). Kode:
`src/components/photo-diary/PhotoCarousel.tsx`, `PhotoViewer.tsx`,
`src/lib/photo-diary.ts` og `src/app/profile/photo-diary/page.tsx` (lås og
lagring uændret). Verificeret med lint + tsc; ikke set visuelt (brugerregel
2026-09-26: brugeren tjekker selv udseendet).

## 2026-09-26: Vægt kalibrering — ét kg-felt pr. forhold, parvis side om side

Tænd/sluk-knapperne (sko, morgen/aften, toilet, mad) er fjernet. Alle fem
forhold er nu par af modsætninger side om side (Uden/Med tøj, Uden/Med sko,
Morgen/Aften, Før/Efter toilet, Før/Efter mad), hver med sit eget kg-felt.
"Opdatér oplysninger" gemmer én vejning pr. udfyldt felt med netop dét
forhold sat. Rækker uden tøj-valg får databasens standard `clothed = true`.

## 2026-09-25: Usikkerheds-~ + admin "Uncertainties" — bygget (G4)

Beslutninger i `docs/DECISIONS.md` 2026-09-25 (erstatter afklaringen
2026-09-24 hvor de er i modstrid). Bygget på branch
`claude/great-booth-2afa0b` og merget til master.

- Grønt tastatur-`~` (`UncertaintyTilde`) + grå linje (`UncertaintyLine`)
  i "Vis mere"-tabellen på `/add/[id]`, i Statistik-kortene (næringsstoffer)
  og foran kcal i søgeresultater. Kontakt under Indstillinger → Visning →
  Usikkerhed (`/settings/display/uncertainty`, standard fra).
- `src/lib/nutrients.ts` (katalog, Frida-id'er), `src/lib/nutrient-resolution.ts`
  (egne tal / Frida-reference / lånt estimat), `/api/products/[id]` sender
  `nutrients`, registreringer gemmer næringsstof-snapshots, `daily-totals` +
  `stat-cards` bruger dem.
- Frida-agenten importerer alle mikrodata og genimporterer den nuværende
  version én gang; generiske ingredienser får mikrodata kopieret.
- Migration `20260926090000_nutrient_uncertainty` (products, users,
  registrations, generic_ingredients, ai_product_analyses, scheduled_jobs).
- Admin `/admin/uncertainties` (4 faner, sortering, rød prik i menuen,
  produkt-overlay, lightbox med beskåret foto + røde rammer, rettelse →
  produkt). AI-ruterne for forside/næring/ingredienser returnerer nu
  koordinater (nye prompt-versioner `*-2026-09-24-regions`).

Runde 2 (samme dag, DECISIONS 2026-09-25 "Uncertainties-tærskler …"):
70 %-/50 %-tærskler, fanen Billeder, natlig AI-genkørsel (job
`uncertainty-rerun`), admin `/admin/cron-jobs` med jobtabellen
`scheduled_jobs` (app-jobs + alle Python-agenter via `job_control.py`),
± og mikrodata aflæst fra deklarationen, og makroer markeres estimerede,
når der ikke er aflæst en deklaration.

Deploy: migrationen kører automatisk (`migrate`-servicen), og agent-
containerne genbygges af deploy-jobbet. Live-verifikation efter deploy
kræver admin-login.

## 2026-09-25: Mailflow med Mailjet gennemgået

- Glemt adgangskode: virkede allerede; mail sendes nu med det samme og har
  et klikbart link.
- Tilmelding: sender nu bekræftelsesmail (blød model, se DECISIONS).
- Mailjet-afsender `peter@packroff.com` er aktiv, men SPF/DKIM mangler i
  DNS (GoDaddy) → mails kan lande i spam.

## 2026-09-25: Backup-scriptet fylder ikke længere 22 GB

`backup-all-containers.sh` lå kun på Synology og kopierede HelloFresh-billederne
(6,6 GB) tre gange: via app, via hellofresh-agent og via runnerens mount af hele
`hellocal-v2`. Ny version i `scripts/backup/` (se DEPLOYMENT.md "Fuld
container-backup"), som deployet lægger samme sted; den gamle gemmes som
`.orig`. Forventet: ca. 7 GB første gang, derefter kun ændringer. Ikke kørt på
Synology endnu — kun testet med en falsk `docker` i cloud-sessionen.

## 2026-09-25: Ubrugte statistik-kort — "+ Overskrift" og "+ Skillelinje" øverst

`/statistics/unused-cards`: knapperne ligger nu lige under søgefeltet, før accordionerne.
"+ Adskillelseslinje" hedder nu "+ Skillelinje" og vises som en massiv sort
streg med teksten i midten. De grå hjælpetekster er fjernet.

## 2026-09-25: Global afstandsregel + Abonnement-side

Se `docs/DECISIONS.md` 2026-09-25 "Global lodret rytme". Nye primitiver
`.hf-page`, `.hf-card`, `.hf-stack`, `.hf-type-card-title` i
`src/app/globals.css`; 49 sider bruger `.hf-page`, og hele `src/` er
normaliseret til 4/8/16/32 px og 8 px kort-radius (se DECISIONS). Abonnement: pris uden "Seriøs —",
sort (også deaktiveret) knap, grå "Indløs points" med hvid tekst, "Gratis" står
ikke længere indrykket. Visuelt kontrolleret lokalt ved 402 × 874 med
mockede API-svar (Abonnement, Indstillinger, Statistik, Tilføj, Ny
målsætning); graf-kortene på Statistik flugter nu med kortene under dem.
Tjek på iPhone med rigtige data efter deploy.

## 2026-09-25: Vægtkalibrering omdesignet

Se `docs/DECISIONS.md` 2026-09-25 "Vægtkalibrering — eksplicit
Opdatér oplysninger-knap". Lint + build grønne; visuelt tjekket i 402 px
viewport med mockede API-svar. Test på iPhone efter deploy.

## 2026-09-25: Integrationssiden ryddet op og sektioneret

Se `docs/DECISIONS.md` 2026-09-25 "Integrationssiden". Sektioner med
`SectionSeparator`: Aktive integrationer → Oftest anvendt (Apple Health,
Google Health, Strava) → Opskrifter (HelloFresh) → Apps (Health Connect,
Withings, Garmin, Samsung Health, Polar Flow nederst). Aktive har grøn prik og
"Fjern" som almindelig tekst. "Kræver app"-mærker og enhedskode-knapper er
fjernet fra siden (backend-ruterne findes stadig). Google Health genbruger nu
`GOOGLE_CLIENT_ID/SECRET`, hvis `GOOGLE_HEALTH_*` ikke er sat; connect-fejl
sendes tilbage til siden i stedet for rå JSON.

2026-09-26: Google Health gav `redirect_uri_mismatch`, fordi
`GOOGLE_HEALTH_REDIRECT_URI` i `.env.production` peger på
`https://hellocal.packroff.dk/api/google-health/callback`, mens OAuth-klienten
(projekt `hellocal-506810`) kun har `…/api/integrations/google-health/callback`.
Google Health API og scopes er aktiveret, men appen står i Testing uden
testbrugere. Connect/callback sendte desuden brugeren til
`https://0.0.0.0:3000/…` (req.url i containeren); redirects bygges nu fra
`INTEGRATIONS_REDIRECT_BASE_URL` (`publicUrl` i `src/lib/integrations/registry.ts`).

Next work: Brugeren tilføjer `https://hellocal.packroff.dk/api/google-health/callback`
som redirect-URI på klienten og `packroff@gmail.com` som testbruger (Google Auth
Platform → Audience). Test derefter forbindelsen på iPhone.
## 2026-09-25: Tilføj-menu tekster og vandglas-ikon

- "Kamera" → "Scan med kamera", "Mikrofon" → "Indtal" (`addButton.*` i
  `src/i18n/locales/`).
- Brugerens vandglas-ikon (`public/icons/water-glass.png`, maske-komponent
  `src/components/icons/WaterGlass.tsx`) erstatter tabler-dråben overalt hvor
  det betyder vand. Fedt-statistikkerne beholder dråben.

## 2026-09-25: Kalender-dagvisning — træk søvn-håndtag forbi kanten + "Nattens søvn"

Lavet i en cloud-session på branch `claude/cloud-session-credits-expired-7504pf`, flettet i master.

- Stå-op-/sengetids-håndtaget scroller tidslinjen med, når fingeren når
  visningens top/bund, så natten kan gøres kortere (før stoppede trækket ved
  kanten).
- Ved åbning af en dag vises den sidste hele time af nattens grå felt, med
  "Nattens søvn: X,XX timer" (gårsdagens sengetid → dagens stå-op-tid; ved
  dagsøvn dagens eget felt). Teksten står under stregen, mens man trækker.
- Testet i Chromium med falske API-svar (ingen login/DB i cloud). Ikke testet
  på telefon.
- Kendt, ikke rettet: `calendar.remainingToday` mangler i sprogfilerne (vises
  rå nederst i dagvisningen). Sprogfilerne har ikke-committede lokale
  ændringer — tjek dem, før nøglen tilføjes.

## 2026-09-25: Tilføj — "Retter", nyt Kropsmål-ikon og samme tekst i hjulet

- "Egne retter" hedder nu "Retter" (`addButton.ownDishes`, en: "Dishes"), også
  som kategori i statistik (`productTypeLabel` i `food-classification.ts`).
- Kropsmål bruger brugerens målebånd-figurer i stedet for Tablers lineal:
  `src/components/icons/WaistMeasure.tsx`, vektorspor af
  `public/icons/body-measurements/waist-female.png` / `waist-male.png`.
  Kvindefiguren vises ved køn = FEMALE, mandefiguren ellers (også ved ukendt
  køn). Bruges på Tilføj-listen, forsidehjulet, indstillingslisten for hjulet,
  Profil-rækken "Kropsmål" og knappen på Redigér profil.
- Forsidehjulet viser nu samme tekst som Tilføj-listen (`labelKey`). De
  separate `addButton.hint.*`-tekster (fx "Måltid", "Vægt og mål") og
  `AddAction.hintKey` er fjernet. Kun `addButton.hint.list` ("Se alle") er
  tilbage.
Verificeret med `npm run lint` og `npm run build`. Ikke set på telefon.

## 2026-09-25: Kalender — tomme dage, tættere rækker og advarsel om for lavt indtag

Uge- og Liste-visningens dagrækker (`src/app/calendar/page.tsx`):
- En dag uden indtastninger viser "Ingen indtastninger" (`calendar.noEntries`)
  og det fulde restbudget, begge i gråt, i stedet for "Mål ikke nået" og et
  rødt tal. Kcal-tallet er grønt med "+", når indtaget er på eller under
  målet, og kun rødt med "÷", når målet er overskredet. Månedsgitteret viser
  ikke længere "÷" på tomme dage.
- Rækkerne bruger ikke længere `justify-between`: afstanden fra ugedag til
  datoboks er omtrent halveret, og statusteksten står lige efter boksen.
  Kcal-tallet ligger stadig til højre (`ml-auto`).
- Ny regel for for lavt indtag, se `docs/DECISIONS.md` 2026-09-25. En afsluttet
  dag med indtastninger under minimum viser "For lavt indtag" og tallet i
  mørk okker (`--hf-color-warning`). Nederst i visningen står en gul firkant
  (`--hf-color-warning-fill`) og en forklaring med personens minimum
  (`calendar.lowIntakeNotice`). Logikken ligger i `src/lib/healthy-intake.ts`.
Verificeret med `npm run lint` og `npm run build`. Ikke afprøvet på telefon
fra denne container.

## 2026-09-25: Profil — Face ID som tekstlink, Skift adgangskode nederst

- `/profile/edit`: "Slå Face ID til" er nu et almindeligt understreget tekstlink
  (ikke sort knap) med luft over og under; "Skift adgangskode" ligger nederst.
- Face ID tilbydes stadig primært efter login (`/login/face-id`); iOS foreslår
  ikke selv passkeys til websider, så appen skal selv starte registreringen.
- Genvejsknapperne bruger de nye vektor-ikoner: vægt (0dbb4fb/bc8960b) og
  champagne til Målsætning; gryden i hjulet/`/add/menu` er ny. Flettet ind fra
  `claude/trusting-meitner-eqqmu9` (18ad2e1), som ikke var i master.

## 2026-09-25: Profil — start-vægt altid låst + "Lås"-side

Start-vægt på `/profile/edit` er nu altid låst, også når den er tom (før var
den et redigerbart felt indtil første indtastning). Feltet vises gråt med en
hængelås til venstre i boksen; tryk åbner `/profile/start-weight`, som nu er
siden "Lås" med tilbagepil, teksten "Din startvægt bør ikke ændres, og er
grundlag for al statistik. Du skal i stedet ændre din dagsvægt her." og
knappen "Angiv dagsvægt" (→ `/profile/weight-calibration`). Knappen "Send
verificeringsmail" er fjernet fra siden; verify-siden og API'et ligger
stadig, men har ingen indgang i UI'et. Er start-vægten tom, sætter første
vejning (`POST /api/weight-entries`) den. Ubrugte i18n-nøgler fjernet.
Kropsmål er ikke omfattet (brugeren har bekræftet, at kun start-vægt skal låses).

## 2026-09-25: Photo diary — passcode toggle now actually locks the photos

User intent: the photos must not flash on screen by accident when the page is
opened on the phone (e.g. on the bus). It is a view lock, not encryption.
When "Kræver telefonens adgangskode for at vise" is on, the page shows only
"Vis billeder"; tapping it asks for Face ID/Touch ID/the phone's passcode via
WebAuthn (`confirmOnDevice` in `src/lib/passkey-client.ts`: reauth with the
existing passkey through `/api/auth/passkey/reauth/*`, or register one if the
account has none — registration also requires on-device confirmation). The
page re-locks (and closes the full-screen viewer) when it goes to the
background (`visibilitychange`). Turning the toggle off while locked requires
the same confirmation. Browsers without WebAuthn get a plain tap gate. The
"kræver en native app" note is replaced with a description of the lock.
Verified with `npm run lint` and `npm run build`; not tested on a real phone
from this container.

## 2026-09-25: Photo diary — selfie feature removed

The user states they never asked for selfies in Billede-dagbog and asked for
the feature to be removed. The 2026-09-12 entry below records it as a user
request, but the user rejects that. Removed from
`src/app/profile/photo-diary/page.tsx`: the "Tag selfie (portræt)" button
(`capture="user"`), the "Selfies" section with portrait cards, the
weight/measurement caption lines under each selfie, and the "Andre billeder"
heading. The page is back to one "Tag billede (fuld figur eller mave)" button
and one 2-column grid. Photos saved earlier as selfies in localStorage are not
deleted; they now show in the same grid (the old `kind` field is ignored).
Unused `photoDiary.*` i18n keys removed from `da.json`/`en.json`; the
selfie-portrait-card paragraph removed from `design.md`. `BodyMeasurement`,
`/api/body-measurements` and `/profile/body-measurements` are unchanged.

## 2026-09-25: Invitér en ven + fast afstand om sektionsoverskrifter

Se `docs/DECISIONS.md` 2026-09-25 "Sektionsoverskrifter, points-banner og
"Invitér en ven"". Ændret: `globals.css` (`.hf-type-section-title`),
`PointsPromoBanner`, `profile/invite`, `lib/invite-message.ts`,
invitations-API'erne og FRIEND_INVITATION-skabelonen (gammel standardtekst
opgraderes automatisk). Lint + build grønne. Ikke visuelt testet (kræver
login) — test på iPhone efter deploy: afstand om overskrifter på alle sider,
delemenuen og mailens personlige besked.

## 2026-09-25: Profil — tandhjul til app-indstillinger + tilbagepil

- På `/profile` (og kun dér) er profilcirklen øverst til højre skiftet ud
  med et tandhjul, der åbner `/settings` (app-indstillingerne). Styres af
  `showAppSettingsButton` på `HfScreen`/`ScreenHeader`.
- `/profile` viser nu altid tilbagepilen, også når "Profil" ligger i
  footeren (`alwaysShowBackButton`).
- Profilen rummer kun personlige ting (Profil, Vægt kalibrering, Kropsmål,
  Søvnmønster, Billede-dagbog, Points, Opskrifter). Abonnement, Opsætning
  (`/profile/settings`), Indberet fejl og Log ud er flyttet til `/settings`;
  Integrationer, Kommunikation og Invitér en ven lå der i forvejen. Den
  gamle "Log ind / tilmeld"-boks er fjernet.

## 2026-09-25: Nyt grydeikon og champagneikon til Målsætning (vektor)

- "Egne retter" bruger nu `IconCookingPot`
  (`src/components/icons/CookingPot.tsx`) i stedet for `imageSrc:
  "/icons/gryde.png"` — en stroke-tegning (1,5) af brugerens nye grydebillede
  med jævne streger. `public/icons/gryde.png` er erstattet af den nye
  kunst (trimmet, transparent, 512 px) som reference; den bruges ikke
  længere direkte.
- "Målsætning" (hjul/`/add/menu` via `add-actions.ts` og knappen på
  `/profile/edit`) bruger `IconChampagne`
  (`src/components/icons/Champagne.tsx`) i stedet for tabler `IconTarget`:
  fyldt silhuet af brugerens champagneflaske, viewBox trimmet til tegningen,
  etiket/medaljon skåret ud med maske. Stat-kortet "Mål nået" bruger stadig
  `IconTargetArrow` (kcal-mål, ikke målsætning).
- Kildebillederne lå i brugerens lokale hovedmappe (ikke i repoet) og skal
  slettes dér af brugeren/lokal agent.
- Lint + build grønne; ikonerne renderet og tjekket ved 20/26/48 px, mørk og
  hvid farve. Ikke set i den kørende app (kræver login).

## 2026-09-25: Statistik — redigerbare grafer, søgning og "+ Tilføj" pr. blok

Se `docs/DECISIONS.md` 2026-09-25 "Statistiksidens grafer kan redigeres som
kortene". Nye filer: `src/lib/stat-charts.ts`,
`src/components/StatChartsSection.tsx`,
`src/app/statistics/unused-charts/page.tsx`. `unused-cards` har fået søgefelt
og "+ Tilføj" pr. blok (`AccordionSection` har fået en `action`-plads).
Lint + build grønne. Ikke visuelt testet (lokalt kræves login) — test på
iPhone efter deploy: long-press på grafer, træk/fjern, knapperne kun synlige
under redigering.

## 2026-09-25: Markering slået helt fra i appen

Se `docs/DECISIONS.md` 2026-09-25 "Global markeringsregel". Global CSS i
`src/app/globals.css` + `selectstart`-lytter i `GlobalClipboardGuard.tsx`.
Felter kan stadig redigeres. Skal testes på iPhone efter deploy (long-press på
kort, tekst og tomme flader må ikke markere noget).
## 2026-09-25: Abonnement — "Indløs points" som knap + ny side

- Boksen på `/profile/subscription` viser nu "Du har optjent {saldo} points."
  med en tynd sekundær knap (`hf-button--secondary --compact --full`)
  "Indløs points", der fører til `/profile/subscription/redeem-points`.
- Ny side "Indløs points" med tan-liste i samme stil som profil/madvarer.
  Første række: "Giv en ven en gratis måned med Seriøs adgang!" — endnu uden
  handling; indholdet kommer senere. Den gamle `/profile/points` er uændret.

## 2026-09-25: Vægt-ikonet tegnet som vektor

- `IconBathroomScale` (`src/components/icons/BathroomScale.tsx`) maskerede
  256px-PNG'en `public/icons/bathroom-scale.png`; i 20–28px (tilføj-menuen og
  forsidens +-hjul) smeltede de tykke streger sammen til en uklar klat.
- Nu en ren SVG-streg-tegning af samme artwork (ramme, skive, to fyldte
  fodspor) i tabler-stil med `currentColor`, så den står skarpt i alle
  størrelser. ViewBox og PNG er trimmet til kanten (ingen luft omkring).



## 2026-09-25: Stregkode-scanner omlagt (lodret/skæv aflæsning, AR-afkodning)

Se docs/DECISIONS.md 2026-09-25 "Stregkode-scanning" og design.md §6.11.
Nye filer: `src/lib/barcode-frame-scanner.ts`, `src/lib/barcode-pattern.ts`,
`src/lib/upce-reader.ts` (UPC-E virker nu — bibliotekets egen læser var i stykker);
omskrevet: `src/components/hf/BarcodeScanOverlay.tsx`,
`src/lib/barcode-scan.ts`, stregkode-delen af `src/app/camera/page.tsx`.
Verificeret i Chromium med syntetisk kamera (vandret, lodret, skæv,
bevægelse, ikke-fundet). Ikke testet på en rigtig iPhone endnu.

Next work:
1. Test på iPhone efter deploy: vandret + lodret stregkode, skæv, på afstand.
## 2026-09-25: Admin → API-nøgler

Se `docs/DECISIONS.md` 2026-09-25 "API-nøgler i admin". Ny side
`/admin/api-keys`: alle tjenester grupperet (login, integrationer, AI, mail,
push, system), status pr. nøgle (fra .env / rettet i admin / mangler), felt
til at indtaste/rette, "Brug .env igen", redirect-URI'er til kopiering og
live-test pr. tjeneste + "Test alle". Migration `20260925120000_app_secrets`.

Live-test af de lokale nøgler 2026-09-25: Facebook, Withings, OpenAI, Google
Places og Mailjet-SMTP virker. Google-login og Google Health (samme
OAuth-klient) godkender ID + secret, men klienten har ingen registrerede
redirect-URI'er (`redirect_uri_mismatch`). Mangler: Apple, Strava, Polar,
Fitbit, Passio, USDA, VAPID (push). `EMAIL_HASH_PEPPER` bruges ikke længere.

Next work:
1. Brugeren tilføjer redirect-URI'erne på Google-klienten.
2. Efter deploy: indtast de nøgler, der mangler i `.env.production`, på
   `/admin/api-keys` og tryk "Test alle".

## 2026-09-25: Mail via Mailjet aktiveret

- SMTP_HOST/PORT/USER/PASS/FROM (Mailjet, in-v3.mailjet.com:587) sat i lokal
  `.env` og i serverens `.env.production` (backup:
  `.env.production.bak-20260925-smtp`). Ingen kodeændring; `src/lib/mailer.ts`
  sender nu køen ved næste deploy.
- Afsenderadressen skal være verificeret i Mailjet, ellers afvises mails.

## 2026-09-24: Normalt login igen (boksen fjernet)

Se `docs/DECISIONS.md` 2026-09-24 "Normalt login".

- Privacy-by-architecture rullet tilbage for brugerappen; data server-side.
- Login: e-mail + adgangskode, Face ID, Google, Apple, Facebook
  (`src/lib/oauth.ts`, `src/lib/user-passkey.ts`, `src/lib/user-login.ts`).
- Mail-advarsel ved login fra ny enhed/nyt land.
- Migration `20260924180000_restore_normal_accounts` (håndskrevet via
  `prisma migrate diff`, køres af migrate-servicen ved deploy).

Next work:
1. Sæt `USER_SESSION_SECRET`, `APP_BASE_URL`, SMTP og Google/Facebook/
   Apple-nøgler i `.env.production` (docs/DEPLOYMENT.md "Login (brugere)").
2. Test Face ID og de tre sociale logins på iPhone efter deploy.

## 2026-09-24: G8 — otte sundhedsintegrationer bygget (commit 22184fe)

Se docs/DECISIONS.md 2026-09-24 "Otte sundhedsintegrationer". Mangler kun
nøgler på serveren (`.env.production` på Synology), derefter deploy:
`WITHINGS_CLIENT_ID/SECRET`, `GOOGLE_HEALTH_CLIENT_ID/SECRET`,
`STRAVA_CLIENT_ID/SECRET`, `POLAR_CLIENT_ID/SECRET` og evt.
`WITHINGS_REDIRECT_URI`/`GOOGLE_HEALTH_REDIRECT_URI`. Migration
`20260924170000_integration_providers` tilføjer enum-værdier. Ikke testet
mod de rigtige API'er endnu (ingen nøgler lokalt). Waldemarsro: venter på
brugerens "byg".

## 2026-09-25: "Største kilder"-siden fjernet

Brugerens ønske: `/statistics/sources` (faner + Produkter/Produkttyper) er
slettet, da "Månedens synder" dækker det samme. Boksen "Største syndere" på
Statistik-siden beholdes, men uden "Se alle"-link.

## Færdig (2026-09-24): G11 — E-numre, toksiner, fedt-advarsel

- Opsætning: "Vis E-numre" og "Vis toksiner" (fra som standard). Produktsiden viser E-numre og en ny Toksiner-sektion med info-vindue og kildelinks. Se DECISIONS 2026-09-24 (G11).
- Udvidet næringsindhold er åben som standard; beskrivelsen i Opsætning er opdateret.
- Advarselstrekant på mættet fedt og transfedt (statistik-bokse og produktsiden). Forsidens tal-slider (`src/lib/frontpage-stats.ts`, G2) har stadig dråbe-ikon — G2 kan skifte til `IconAlertTriangle`.

## 2026-09-25: G3 — produktkategorier, kød/drikke-statistik, "Største kilder" og "Månedens synder" — bygget

Se docs/DECISIONS.md 2026-09-25 (G3). `npm run lint` (G3-filer) og
`npm run build` er grønne. Ikke verificeret i browser mod rigtige data
(kræver login med passkey + boks).

Mangler (bevidst udskudt):
- Frida-AI-beregning af kødandel i sammensatte retter.
- 30-delt Hello Cal-kategoriliste + NOVA/ultraforarbejdet + Slik/Chips.
- REMA-importen skal køres igen, for at grøntsager/frugt får VEGETABLES
  (migrationen skal deployes først).
- Nye kort vises kun automatisk for brugere uden gemt statistik-layout;
  andre tilføjer dem via "Tilføj kort" → "Kød, fisk og drikke".

## 2026-09-26: Opskrift-scrapere som Valdemarsro (Arla, Coop, REMA 1000, MENY, Hjerteforeningen, TV 2)

`scripts/recipe-sites-import` (se README): fælles motor + ét script pr. side,
samme struktur som Valdemarsro-scraperen. Hver opskrift får "Meal Type"
(Frokost/Aftensmad/Fin middag/Mellemmåltid/Dessert) og "Børnevenlig" (børn/barn/unger
i tekst, kategorier eller temaside). `recipe_sites_match.py <site>` beregner kalorier
via Valdemarsro-matcheren; Hjerteforeningens egne kcal pr. person bruges direkte.
Output i `Productdatabase/Opskrifter/<Site>`. Brugeren kører selv scraperne.
Ikke bygget: import i appen (følger Valdemarsro-integrationens TODO).

## TODO (2026-09-24): Waldemarsro-integration (dansk opskriftsside) — afklaret, ikke bygget

Brugerens svar (2026-09-24). Tilstrækkeligt til at bygge uden yderligere
dialog.

- **Koncept**: samme mønster som HelloFresh-integrationen i dag — en
  toggle-boks på `/settings/integrations` (`waldemarsroEnabled` på `User`,
  analogt med `helloFreshEnabled`), der slår Waldemarsro-opskrifter til/fra i
  "Delte retter". Ikke en OAuth-konto (der er intet at logge ind på)
  — men den skal *ligge* i `INTEGRATION_CATALOG`-listen som et kort, fordi en
  reel kontoforbindelse kan komme senere.
- **Region-gating**: kortet vises kun når brugerens region
  (`src/lib/regions.ts`) er `DK`. Selve scraper-/import-jobbet kører
  uafhængigt af hvem der har regionen slået til (ren batch-proces, ikke
  live per bruger).
- **Ingrediens-matching**: samme princip som HelloFresh-import
  (`scripts/hellofresh-import`) — match ingredienser mod eksisterende
  `Product`. Uafklarede ingredienser (intet match) importeres **ikke**
  gættet; de logges til en liste til manuel gennemgang, og selve
  opskriften springes over indtil afklaret.
- **Scraper-scriptet**: nyt script (`scripts/waldemarsro-import`, samme
  struktur som `scripts/hellofresh-import`), der crawler hele
  waldemarsro.dk's opskriftsside (kategori-for-kategori discovery, som ved
  øvrige scrapere — se memory `feedback_discovery_one_subcategory_at_a_time`)
  og gemmer opskrift, ingrediensliste, mængder, billede og
  næringsindhold (hvis siden oplyser det) som `Dish`/`DishIngredient`
  (`externalSource: "WALDEMARSRO"`).

Åbne punkter, der først afklares ved selve byggeopgaven (ikke blokerende
for denne TODO, men skal besluttes før kodning): eksakt UI-tekst,
Prisma-migration for `externalSource`-værdien og evt. ny
`IntegrationProvider`-enum-værdi, samt om Waldemarsro-opskrifter skal
kunne opdateres/re-scrapes automatisk eller kun manuelt via scriptet.

## 2026-09-24: Usikkerheds-bølgeikon — krav afklaret, ikke bygget

Fuld afklaring (punkt for punkt) i `docs/DECISIONS.md` 2026-09-24
"Usikkerheds-bølgeikon". Ingen kode, skema eller UI er ændret denne omgang —
kun dokumentation, efter brugerens ønske om at afklare alt først.

Kort resumé: grønt bølge-/tilde-ikon erstatter (for usikre data) det grønne
"godkendt"-skjold i søgeresultater, og vises ved enkelte mikronæringsstof-
værdier (Statistik-bokse + "vis mere"-tabellen) der ikke stammer fra
varedeklarationen, med et gråt ±-margental derunder. To on/off-knapper under
Indstillinger → Visning (slået til som standard).

Next work (byg i denne rækkefølge, alt er afklaret — ingen yderligere
spørgsmål nødvendige):
1. Udvid `ProductFeatureSource`/`*Confidence`-mønstret (i dag kun sukker/
   fiber/salt/fuldkorn, se `prisma/schema.prisma` linje ~2264-2315) til alle
   næringsstoffer, inkl. vitaminer og mineraler — ny migration.
2. Byg Frida-baseret vitamin/mineral-estimering (matcher hver ingrediens mod
   Frida-data, se `src/lib/generic-ingredient-match.ts` og `frida-agent`),
   da Frida-importen i dag kun dækker de 4 kerne-makroer. Dette er
   forudsætningen for at kunne udregne et konkret ±-margental fra Frida.
3. Design/vælg det grønne bølge-/tilde-ikon (SVG, samme stil som eksisterende
   ikoner i `src/components/icons/`).
4. Vis ikonet ved varer i søgeresultater (i stedet for det grønne skjold) når
   én eller flere felter er kilde-markeret som ikke-fra-label.
5. Vis ikonet + gråt ±-margental under hver relevant Statistik-boks
   (`src/lib/stat-cards.ts` / `StatCardsGrid.tsx`) og i "vis mere"-tabellen,
   når feltets værdi ikke stammer fra varedeklarationen.
6. Byg to nye sider under `src/app/settings/display/` (samme mønster som
   `limits/page.tsx`) med hver sit `User`-boolean-felt: usikkerhed på varer i
   søgeresultater, og usikkerhed på mikrodata. Begge default TIL.
7. `npm run lint` og `npm run build` efter implementering.

## 2026-09-24: Kvalitetskontrol — viser nu det faktiske omstridte billede

Verificerede (på brugerens bestilling) at kvalitetskontrol/billed-match-
funktionen fra 2026-09-19 var færdigbygget af en anden samtidig session
(`ProductMatchCheck`, `scripts/quality-control-agent`, `/admin/quality-
control`, Award-panel, brugerens `/add/[id]/photo-award`) — den var det, kun
med én konkret mangel mod den oprindelige spec: det faktisk omstridte billede
(`AiProductAnalysis.imageUrl`) blev aldrig hentet eller vist noget sted i
admin, hverken som thumbnail på listen eller øverst på produktsiden.

- `src/app/admin/quality-control/page.tsx`: begge queries henter nu billedet
  (`analysis.imageUrl` for match-checks, `product.imageUrl` som fallback for
  brugerindberettede næringsrækker, der ikke har et omstridt foto).
- `src/components/admin/QualityControlTable.tsx`: ny `IssueThumbnail` — 40×40
  billede med en rund %-badge i hjørnet (farvekodet grøn/gul/rød som den
  eksisterende confidence-pille, nu delt via `confidenceBadgeClasses`).
- `src/app/admin/products/[id]/page.tsx` + `QualityControlPanel.tsx`: samme
  billede vises nu øverst i hver "Problemer fundet"-blok.

`npx tsc --noEmit` og `npx eslint` på de fire ændrede filer er rene (kun
allerede eksisterende, urelaterede fejl fra andre samtidige sessioners
in-progress arbejde, fx `BugReportCategory`/`ForwardButton.tsx`). Ikke
verificeret i en rigtig browser — ingen lokal database/admin-session
tilgængelig fra denne maskine, samme gentagne begrænsning som resten af
denne fil.

## 2026-09-24: "Indberet fejl" — fire kategori-ikoner (EAN/Energi/Indhold/Produktbillede)

Brugeren viste et screenshot af `/profile/report-bug` og bad om fire ikoner
under beskrivelsesboksen, før "Send indberetning". Bygget som fire
toggle-chips (multi-select, ingen påkrævet) der tagger hvilken del af
produktdata fejlen handler om, så admin-triage ikke skal gætte det ud fra fri
tekst alene:

- `prisma/schema.prisma`: nyt `BugReportCategory`-enum (`EAN`, `ENERGY`,
  `CONTENT`, `PRODUCT_IMAGE`) og `BugReport.categories` (array, default
  tom). Hand-written migration
  `prisma/migrations/20260924130000_bug_report_categories/` — samme grund
  som andre nylige migrationer i dette projekt (ingen lokal PostgreSQL
  tilgængelig fra denne arbejdsstation).
- `src/app/api/bug-reports/route.ts` (POST) og
  `src/app/api/bug-reports/[id]/route.ts` (PATCH): accepterer nu valgfrit
  `categories: string[]` i body, valideret mod enum-værdierne.
- `src/app/profile/report-bug/page.tsx`: fire ikon-chips
  (`@tabler/icons-react` `IconBarcode`/`IconBolt`/`IconList`/`IconPhoto`)
  med dansk label EAN/Energi/Indhold/Produktbillede, mellem
  fejlbeskrivelsen og send-knappen; forudfyldes fra eksisterende
  kategorier i "Redigér"-flowet.
- Ikke bygget: ingen visning af valgte kategorier i admin (findes ikke
  endnu en admin-liste over bug reports at udvide) — kan tilføjes når/hvis
  den bygges.

## 2026-09-24: Oprettelses-app (medarbejder-hylde-app) — kravrunde genoptaget, kun dokumentation

- Brugeren har genoptaget den medarbejder-produktoprettelsesapp der blev
  parkeret 2026-09-14 i `docs/PROJECT-BOUNDARIES.md`, med en detaljeret
  brief (login/2FA, hylde-foto-overlay med grønt flueben/minus og 1px
  kontur, swipe, kamera/slet-ikoner, brugerikon-undermenu med
  Profil/Bankoplysninger/Historik/Ikke afregnet/Beskeder/Kontakt/Log-ud,
  admin "scan-invites" og medarbejder-/aflønningsbackend).
- Al ny information er samlet i det nye [`docs/OPRETTELSES-APP.md`](OPRETTELSES-APP.md),
  som eksplicit bygger videre på (og ikke gentager) de allerede bekræftede
  2026-09-14-krav, og lister åbne spørgsmål — bl.a. et direkte
  arkitekturkonflikt-punkt: dagens brief forudsætter separate containere,
  mens 2026-09-14-anbefalingen i `docs/areas/README.md` var ét
  repo/app/skema.
- Spørgsmålene stilles til brugeren i chatten (AskUserQuestion) før noget
  implementeres. Ingen kode, skema, container eller deployment er ændret.
- Dokumentation kun; lint/build ikke kørt (ingen kodeændring).

## 2026-09-24: Krav tilføjet — væske fra produktspecifikationer + alkohol-algoritme (ikke bygget)

Brugerens krav, tilføjet til roadmap for at sikre opfølgning (ikke bygget denne omgang):

- Når en fødevare tilføjes til databasen ud fra dens produktspecifikation (separat regneark med varebeskrivelse og indhold), og indholdsfortegnelsen angiver "Vand" eller anden væske med mængde i gram/procent, skal den tilsvarende væskemængde (procentuelt ud fra den registrerede indtagne mængde) lægges til brugerens væskebalance. Gælder ikke alkohol. Se `docs/SPECIFICATION.md` §12.
- Roadmap: en algoritme, der udregner væsketab ved indtagelse af alkohol (vanddrivende), skal indgå i den daglige væskeudregning og vises som bokse. Beregningsmetode er endnu ikke besluttet. Se `docs/SPECIFICATION.md` §15.

Next work (nyt, føj til eksisterende liste):
- Beslut datakilde/format for produktspecifikations-regnearket (hvor "Vand"/væskeindhold står) og hvordan det matches til det oprettede produkt.
- Byg beregning: væskemængde fra indhold → tilføjelse til `WaterIntake`/væskebalance ved registrering.
- Beslut og byg alkohol-væsketab-algoritme + visning ("bokse") i den daglige væskeudregning.

## 2026-09-24: Mængden på Tilføj-skærmen vises altid med enhed

- `/add/[id]` viser nu fx "100 g" / "100 ml" / "33 cl" i mængdefeltet (samme font/størrelse), og "kcal/100 ml" for drikkevarer. Ny kolonne `Product.productCategory` + migration `20260924120000_product_category`, REMA-importen udfylder den fra "Type", "Nyt produkt" har en Madvare/Drikkevare-dropdown. Se DECISIONS 2026-09-24.
- Kræver deploy (migration + genkørsel af rema1000-agent) før drikkevarer viser ml/cl i produktion; indtil da vises g.
- Ikke visuelt verificeret lokalt: ingen database tilgængelig fra denne maskine. Lint, `tsc`, `npm run build` og `npm test` (9 helper-tests) er grønne.
- Registreringsdetaljen (`/registration/[id]`) viser stadig "kcal pr. 100 g" — dens produkt-snapshot ligger i vault-handleren `meals.ts`, som en anden session har uncommitted ændringer i.

## 2026-09-24: Privacy-by-architecture gennemført (docs/PRIVACY.md)

Se `docs/DECISIONS.md` 2026-09-23 og kontrakten `docs/PRIVACY.md`.

- **Login**: kun passkeys for almindelige brugere (`/login`, `/signup` →
  e-mail-link → `/tilmeld/bekraeft`). E-mail gemmes kun som HMAC-hash
  (`EMAIL_HASH_PEPPER`). Adgangskoder, glemt/nulstil og impersonation er fjernet.
- **Boks**: al private data krypteres på enheden (`src/lib/vault/*`).
  Sider kalder `localApi(...)` i stedet for `fetch(...)` for private
  endpoints; handlerne i `src/lib/vault/handlers/` svarer med samme JSON som
  de gamle ruter. Flyttet: vægt, vand, cyklus, kropsmål, søvn, vagter,
  aktiviteter, sundhedsmålinger, profil, mål, registreringer, retter,
  favoritter, søgehistorik, Hello Doc-modtagere.
- **Gendannelse**: delt nøgle. Brugeren downloader sin halvdel; admin godkender
  sager under `/admin/recovery` efter personlig kontakt (`/gendan`).
- **Integrationer** forsegler hentede data til en anonym indbakke.
- **Hello Doc**: rapporten bygges og krypteres på ejerens enhed; nøglen står
  kun i lægens link; invitationen sendes fra brugerens egen mail-app.
- **Videresend/invitér**: engangslinks uden gemt kobling mellem brugere.
- **Support**: pakker forsegles til Supports nøgle (laves i admins browser på
  `/admin/support`) og kan kun åbnes der, mens tilladelsen er aktiv.
- **Statistik**: `/admin/anonymous-stats` — buckets uden ID, min. 25 pr.
  gruppe, Laplace-støj. Kvalitetskontrol bruger anonym daglig produktbrug.
- **Nyhedsbrev**: separat tilmelding (`/api/newsletter`), ikke koblet til kontoen.
- **AI**: metadata fjernes fra billeder; `store: false` hos OpenAI.
- Den delte demo-bruger er fjernet; private sider kræver åben boks (`VaultGate`).

Migrationer (håndskrevet via `prisma migrate diff`, ikke kørt — ingen lokal
PostgreSQL): `20260923120000_privacy_vault` … `20260923200000_anonymous_analytics`.

`npm run lint` og `npm run build` er fejlfri. Ikke testet ende-til-ende: der er
ingen lokal database, og passkeys kræver HTTPS/rigtig enhed. Login-siden er
set i browseren.

Next work:
1. Sæt `EMAIL_HASH_PEPPER`, `USER_SESSION_SECRET`, `APP_BASE_URL` og SMTP i
   `.env.production` på Synology (se `docs/DEPLOYMENT.md` "Privacy").
2. De gamle klartekst-tabeller (demo-brugerens testdata) beholdes indtil
   videre efter brugerens valg 2026-09-24; de slettes først efter ny besked.
3. Lav supportnøglen i admin, før brugere kan dele data med Support.

## 2026-09-23: Support-side + fiber-%, sukker-%, salt-% og fuldkorn som søgefelter

Se `docs/DECISIONS.md` (samme dato, sidste afsnit).

- Support: `/settings/support` (række i Indstillinger), `/settings/support/contact`,
  `GET/PUT/DELETE /api/support/access`, `POST /api/support/requests`,
  `/admin/support` + `PATCH /api/admin/support/[id]`. Nye filer
  `src/lib/support-permissions.ts` (kategorierne ét sted) og
  `src/lib/support-access.ts` (server: aktiv/udløbet, datoer i
  Europe/Copenhagen, validering). `Toggle` har fået `ariaLabel`.
- "Log ind som bruger" er fjernet: `api/admin/users/[id]/impersonate`,
  `api/auth/impersonate`, handoff-funktionerne i `user-auth.ts` og
  admin-knappen. Gamle admin-udstedte sessioner afvises.
- Produktdata: ny `ProductNutritionFeatures` + `src/lib/whole-grain.ts`,
  `src/lib/nutrition-normalize.ts` og `src/lib/product-nutrition-features.ts`.
  Nye felter i `NutritionAnalysis` (`fiberPercent`) og `IngredientsAnalysis`
  (`wholeGrainPercent`, `isWholeGrain`, `wholeGrainConfidence`,
  `wholeGrainEvidence`), som udledes efter AI-kaldet. OFF gemmer nu
  sukker/fiber/salt pr. 100 i `nutritionExtra` og `packageSizeText`.
- Migration `20260923130000_support_access_and_nutrition_features` er
  håndskrevet (ingen lokal PostgreSQL) og køres af migrate-servicen ved deploy.
  Eksisterende produkter udfyldes automatisk af scheduleren (500 pr. kvarter,
  `backfillMissingProductNutritionFeatures`). `POST
  /api/admin/products/nutrition-features` kan genberegne alle manuelt.

Verificeret: `tsc --noEmit` og `npm run lint` er rene. Fuldkorns-parseren er
testet på 13 eksempler (bl.a. 52 %, 31+18 = 49 %, nested 60 % × 50 % = 30 %,
"(62%)", "rig på fuldkorn" → true/null, liste uden fuldkorn → false/0, ingen
liste → null). Datovalidering, udløb, tilbagekaldelse, DST-dagen og afvisning
af ukendte nøgler er testet direkte. I browseren (mobilbredde) er
Indstillinger → Support → tilbage, "Vælg alle" og de enkelte kontakter
testet. Ikke testet: gem/genindlæs mod en rigtig database (ingen lokal DB,
og preview-sessionen er ikke logget ind). `npm run build` kompilerer, men
typetjekket stopper på en forældet `.next/dev/types/validator.ts` fra en
anden sessions dev-server (henviser til den slettede `forgot-password`-side).

Next work: Support-datapakken skal bygges på brugerens enhed og krypteres
til Supports offentlige nøgle ud fra tilladelsens kategorier og periode
(boks-fasen, `docs/PRIVACY.md`). Et admin-UI til manuelle (MANUAL)
produktværdier og søgefiltre (fx fiber ≥ 6 %, fuldkorn ≥ 50 %) er endnu ikke
bygget.

## 2026-09-23: Statistik "Tilføj kort" — fold-ud-grupper, Mineraler og Vitaminer

Se `docs/DECISIONS.md` (samme dato). Ny `AccordionSection` og `StatCardIcon`,
15 mineral- og 13 vitaminikoner flyttet til `public/icons/minerals|vitamins/`,
nye kort Klorid/Fluorid og migration
`prisma/migrations/20260923140000_chloride_fluoride_metrics/` (håndskrevet,
ikke kørt). Migrationen skal køres på serveren ved deploy.

## 2026-09-23: Brugerindberettede næringsrettelser i Kvalitetskontrol

Se `docs/DECISIONS.md` (samme dato).

- Ny `ProductNutritionReport` + migration
  `prisma/migrations/20260923090000_product_nutrition_reports/` (håndskrevet,
  ikke kørt: ingen lokal PostgreSQL).
- `POST /api/registrations` opretter rapporten, `src/lib/nutrition-reports.ts`
  har reglerne. Admin: `/admin/quality-control` viser rækkerne,
  `/admin/products/[id]` har `NutritionReportPanel` med Før/Bruger, Godkend,
  Afvis og "Send besked". Nye ruter: `PATCH /api/admin/nutrition-reports/[id]`
  og `POST /api/admin/nutrition-reports/[id]/message`.
- **Ikke færdigt (afhænger af boks-klienten, anden session):** klienten sender
  endnu ikke `x-inbox-token` ved registrering, og appen viser endnu ikke
  beskeder fra indbakken. Indtil da står der "Indberetteren kan ikke
  kontaktes" på rapporterne.
- Ingen "sendt til kontrol"-besked hos brugeren: appen har ikke et
  toast-mønster, og Tilføj navigerer straks til forsiden.

## 2026-09-23: "Nyt produkt"-formularen omlagt

Se `docs/DECISIONS.md` (samme dato). `/foods/new`: Produktnavn fjernet, nye
felter Produkttype og Variant samt Mængde (total) som tal + enhed. Brand er
påkrævet, Sub brand valgfri. "Opret produkt"/"Opret ingrediens" ligger nu i
`HfScreen`'s footer lige over bundnavigationen. Ny kolonne
`Product.productType` (migration `20260923100000_product_type`) og ny
`src/lib/product-naming.ts`. Migrationen skal køres på serveren ved deploy.

## 2026-09-23 (senere): Ugesummering slået til + rigtigt vægtestimat

Bygger videre på indlægget nedenfor (`37ee7f4`), se DECISIONS samme dato
(senere). `ENABLE_WEEKLY_ENERGY_SUMMARY = true`. `∼` erstatter `≈`, og
kcal-totalen har nu samme fortegn som dagsrækkerne. Fremtidige dage i Uge- og
Liste-visningen viser hverken status eller kcal. `weekly-energy-summary.ts` har
fået `estimateBmr` (Mifflin-St Jeor), `estimateAdaptiveMaintenance` (28 dage,
indtag vs. vægthældning, sanity-tjekket mod formlen) og
`estimateWeeklyWeightChange` (kun afsluttede, registrerede dage, mindst 3).
Den gamle `estimateWeightChangeGrams` er fjernet. Kalendersiden henter nu
også `/api/weight-entries` og bruger `weightKg`/`heightCm`/`birthDate`/`sex`
fra `/api/profile`.

`npm run lint` og `npm run build` er fejlfri. Ikke testet i browser: En anden
sessions `next dev` kørte allerede i mappen (Next tillader kun én ad gangen),
og den blev ikke stoppet.

## 2026-09-23: Kalender — ugentlig kaloriebalance (bygget, skjult bag flag)

Se `docs/DECISIONS.md` (samme dato). Status: IMPLEMENTERET BAG FEATURE FLAG –
AKTIVERES VED NATIVE APP / TILSTRÆKKELIG SKÆRMPLADS. Ny
`src/lib/weekly-energy-summary.ts` (flag, ugebalance, 7.700 kcal/kg-estimat,
dansk formattering) og `WeeklyEnergySummaryRow` i `src/app/calendar/page.tsx`,
som vises under Uge- og Liste-visningen, når flaget er slået til. Nye i18n-nøgler:
`calendar.weeklyEstimatedWeight`. Lint og typecheck er fejlfri. Ikke testet i
browser, fordi flaget er slået fra.

Next work: skaf en kilde til brugerens vedligeholdelseskalorier, så
vægtestimatet kan vises. Slå flaget til, når der er plads på skærmen.

## 2026-09-22: Tilbagepil gendannet globalt

Se `docs/DECISIONS.md` (samme dato). `ScreenHeader` viser nu selv
tilbagepilen på alle sider, der ikke er footer-rødder
(`src/lib/navigation.ts`, følger BottomNavs gemte layout via
`useSyncExternalStore` + `hellocal:bottomnav-changed`-event). Sider der
manglede pil (bl.a. `/foods/new`, `/camera/create`, `/create-dish`,
`/add/[id]`, `/settings`, `/camera`, `/search`, `/voice`) får den
automatisk. 36 lokale `onBack={() => router.back()}` fjernet. Auth-siderne
(signup, forgot/reset-password, login/country) flyttet fra `IconArrowLeft`
i højre slot til `HfChevron` i venstre. `docs/UI.md`'s forældede
"pil i højre hjørne"-regel rettet. Lint ren.

## 2026-09-22: Låst start-vægt med e-mailverificeret ændring

Se `docs/DECISIONS.md` (samme dato). Profil: labels "Start-vægt"/"Højde"
uden enhed, værdier "110 KG"/"186 CM"; hængelåsen er en knap →
`/profile/start-weight` (forklaring, "Send verificeringsmail",
"Registrer dagsvægten her" → `/profile/weight-calibration`). Mail-link →
`/profile/start-weight/verify` (input + GEM → "Startvægten er gemt" →
"Gå tilbage til appen" = `/profile/edit`). Nye filer:
`src/lib/start-weight-verification.ts`, `src/app/api/profile/start-weight/`
(`route.ts`, `verification/route.ts`), `src/app/profile/start-weight/`
(`page.tsx`, `verify/page.tsx`). Håndskrevet migration
`20260922100000_start_weight_verification` — ikke kørt (ingen lokal
PostgreSQL). Lint ren; `next build` kompilerer, men type-check stoppede på
en korrupt genereret `.next/dev/types/validator.ts` fra en anden sessions
kørende `next dev`. Ikke browser-/DB-testet lokalt; tokenflowet kræver test
på Synology efter deploy + SMTP for reel afsendelse.

## 2026-09-22: Forside — den grønne tilføj-cirkel kan flyttes lodret

- `AddButton.tsx`: træk på den grønne baggrund (ikke fingeraftryk-knappen)
  flytter hele cirklen inkl. handlingsbuen lodret; X er låst. Pointer Events
  + pointer capture, `touch-action: none` kun på den grønne form, ingen
  transition/snapping. Grænser måles live: toppen af `[data-top-bar]` og
  topkanten af `[data-bottom-navigation]` (BottomNav); re-clampes ved
  resize/visualViewport/ResizeObserver på navigationen.
- Fingeraftryk-knappen (`data-fingerprint-control`) er et separat element,
  så dens eksisterende joystick-logik er uændret.
- Placering gemmes pr. enhed i localStorage (`hellocal.frontpage.fabOffsetY`,
  px-offset fra standardpositionen, se `frontpage-layout.ts`).
- Lint ren for de ændrede filer. Ikke browser-verificeret: en anden sessions
  `next dev` kørte allerede i mappen. `npm run build`/fuld `tsc` blokeres af
  en anden sessions ucommittede startvægt-/Prisma-ændringer.

## 2026-09-22: Søvnmønster — "Arbejdstider i kalenderen" fjernet

Se `docs/DECISIONS.md` (samme dato). Ændret: `src/app/profile/sleep/page.tsx`
(hjælpetekst under standardtider, kort fjernet), `src/components/OnboardingWizard.tsx`
(trin `work-hours-calendar` fjernet), `src/app/api/profile/route.ts`, da/en
locales. Prisma-kolonnen `workHoursInCalendarEnabled` er bevidst ikke droppet endnu.

## 2026-09-23: Målsætningsdato + nyt layout på Opret ny målsætning

Se `docs/DECISIONS.md` (samme dato). Ændret: `prisma/schema.prisma`
(`Goal.targetDate`), håndskrevet migration
`prisma/migrations/20260923080000_goal_target_date/` (ikke kørt lokalt),
`src/lib/user-goals.ts`, `src/app/api/goals/route.ts`,
`src/app/profile/goals/new/page.tsx`, `src/app/profile/goals/page.tsx`,
da/en locales. Verificeret: lint, build, layout i preview ved 375 px. Gem mod
DB ikke testet lokalt (ingen PostgreSQL).

## 2026-09-22: Målsætning — oversigt + opret-formular (vægt og kropsmål)

Se `docs/DECISIONS.md` (samme dato). Nye filer: `src/app/profile/goals/page.tsx`,
`src/app/profile/goals/new/page.tsx`, `src/app/api/goals/route.ts`,
`src/lib/user-goals.ts`, `src/lib/body-measurements.ts`,
`src/components/hf/DateSeparator.tsx`. Prisma: `Goal`, `GoalTarget`,
`GoalDirection`; håndskrevet migration
`prisma/migrations/20260922090000_goals/` (med backfill af eksisterende
`targetWeightKg`) — ikke kørt, ingen lokal PostgreSQL. Links fra Profil og
Tilføj-menuen peger nu på `/profile/goals`. Statistik-siden bruger stadig den
hardcodede `WEIGHT_GOAL_KG` fra `src/lib/goals.ts` — ikke ændret her.

## TODO (2026-09-22): Profil — statusbjælke for færdiggørelse

Statisk version bygget 2026-09-23 som fælles HelloFresh-trinindikator
`src/components/hf/HfProgressStepper.tsx` (prikker + linjer + labels som
`Hello Fresh inspiration/Oprettelsesflow.png`), indsat i
`src/app/profile/page.tsx` med trinene Om dig / Mål / Vaner, `current={0}`,
`progress={0.2}` (i18n `profile.completion.*`). Erstatter oprindeligt ønske om
bjælke + `1/10`. Oprindeligt ønske: grøn progress-bjælke + tæller (fx `1/10`) allerøverst i
indholdet på `/profile`, over Profil-rækken; headeren ændres ikke. Først
statisk via `<ProfileCompletion completed={…} total={…} />` (ingen hardcodet
`1/10` i markup), senere beregnet dynamisk fra de faktiske profilfelter
(ingen gemt completion-sandhed i databasen, ingen ekstra persondata).
Afventer produktafklaring: hvilke punkter tæller, hvornår et punkt er
færdigt, visning ved 100 %, klikadfærd, samspil med guided setup
(`OnboardingWizard`) og `docs/UI.md`'s eksisterende onboarding-statusbjælke.

## 2026-09-24: Delte brugeropskrifter (bygget)

Se `docs/DECISIONS.md` (2026-09-24). Bygget efter brugerens afklaring
2026-09-23, tilpasset `docs/PRIVACY.md`:

- **Opret ret** (`src/app/create-dish/page.tsx`): on/off-felt "Ønsker du at
  dele retten med andre brugere?" under titlen, starter ON, i-ikon åbner
  "Ingen personlige detaljer deles, når du deler en ret". Efter gem går man
  til Opskrifter → Mine retter.
- **Opskrifter** (`/profile/recipes`): faner "Mine retter" (egne retter +
  favoritter fra boksen, mærket Delt/Privat/Favorit) og "Delte retter"
  (titel/ingredienser; HelloFresh medtages kun, når det er slået til under
  Integrationer). Filterikonet åbner `/profile/recipes/filters` (sortering,
  allergier, diæter, protein, specialkost, makroer, personer 1–6, vis
  kalorier/energifordeling — se DECISIONS 2026-09-25). Ikke testet mod rigtige
  data endnu: lokal DB mangler.
- **Opret ret**: billeder (op til 3), fremgangsmåde (trin med overskrift,
  tekst og billede) og kategorivindue efter Gem (DECISIONS 2026-09-25).
  Kræver migrationen `20260925120000_recipe_images_steps_tags`. Flowet er
  testet i browser med mockede API-svar, ikke mod en rigtig database.
  Detaljeside `/profile/recipes/[id]?kind=own|shared`: deling til/fra for
  egne retter; favorit, "Gem som egen kopi" og "Anmeld" (kun før
  godkendelse) for delte.
- **Integrationer**: nyt on/off-felt "HelloFresh-opskrifter"
  (`helloFreshEnabled` i boksens profil, standard OFF).
- **Admin → Kvalitetskontrol → Delte retter**: afventende retter,
  anmeldte øverst, ejer som pseudonym (`bruger-XXXXXX`), Godkend/Afvis/
  Bloker deling som små teksthandlinger.
- **Data**: `SharedRecipe` + `SharedRecipePublisherBlock`, håndskrevet
  migration `20260924090000_shared_recipes` — ikke kørt (ingen lokal
  PostgreSQL); køres af migrate-servicen ved deploy. Boks: ny samling
  `recipeFavorites`, udgivertoken i `settings`, `sharedRecipeId` på egne retter.
- **Ikke med**: egne billeder (Opret ret har ingen billedupload endnu),
  redigering/sletning af egne retter og registrering af en ret i kalenderen
  (findes ikke i UI endnu). Ikke verificeret i browser: siderne kræver
  login/boks og database, som ikke findes lokalt.

## TODO (2026-09-23): Kun tilgængelig i HelloFresh-lande — afklaret, ikke bygget

Brugerens svar (2026-09-23). Tilstrækkeligt til at bygge uden yderligere
dialog. Se `docs/DECISIONS.md` (samme dato/emne).

- **Håndhævelse**: kun via landevalg i App Store Connect og Google Play
  Console. Appen blokerer ingen selv (ingen GPS/IP-tjek); brugere må bruge
  appen på rejse og efter flytning.
- **Webappen** (`hellocal.packroff.dk`) begrænses ikke.
- **Testversioner** (TestFlight, Google Play-test) er globale.
- **Landeliste**: fast, manuelt vedligeholdt; låst til listen pr.
  2026-09-23 (skal *ikke* genhentes ved bygning). Nye HelloFresh-lande
  kræver manuel godkendelse. Lukker HelloFresh et land, gøres intet.
- **Låst liste (16)**: AT, BE, DK, FR, DE, LU, NL, SE, CH, GB, IE, NO, US,
  CA, AU, NZ. (HelloFresh forlod ES og IT i foråret 2026 — ikke med.)
  Kilde: HelloFresh Group-landeoversigt (sep. 2025) + exit-meddelelse
  12.02.2026.
- **Datamodel**: central tabel (fx `SupportedCountry`) med landenavn,
  ISO-kode, aktiv, HelloFresh tilgængelig, iOS/Android/web tilgængelig;
  redigerbar i admin. Butikkernes landevalg sættes manuelt efter tabellen.
- **HelloFresh-indhold**: brugerens eget land prioriteres øverst, men
  indhold fra andre lande kan stadig vises.

## 2026-09-22: Skift adgangskode

- Sort "Skift adgangskode"-knap nederst på `/profile/edit` → ny side
  `/profile/change-password` (grøn `HfScreen`-header, tre `TextField`
  password-felter, fejl ved relevant felt, succesbesked, felter ryddes).
- `POST /api/profile/change-password` (session-krævet, bcrypt, rate-limit),
  nyt `MessageEvent.PASSWORD_CHANGED` + standardskabelon; håndskrevet
  migration `20260922080000_password_changed_message` — ikke anvendt
  (ingen lokal PostgreSQL).
- Kendte huller: andre sessioner invalideres ikke (stateless JWT);
  mailen sendes kun hvis skabelonen er seedet (`ensureDefaultMessageTemplates`
  køres lazily fra admin-siden — samme som øvrige beskeder) og SMTP er sat op.

## 2026-09-22: Produktside — lås på energifordeling + ny logo-placering

Se `docs/DECISIONS.md` (2026-09-22, samme emne). Ændrede filer:
`src/app/add/[id]/page.tsx`, `src/components/hf/MacroSliderBar.tsx`
(`disabled`-prop), `src/i18n/locales/{da,en}.json`
(`addProduct.unlockEditing/lockEditing/resetChanges`). `eslint` på de ændrede
filer er ren. Hele `tsc --noEmit` fejler kun på en parallel sessions
igangværende `PASSWORD_CHANGED`-ændring i `src/lib/messaging.ts`, ikke på
denne ændring. Ikke verificeret i browser: en anden sessions `next dev` kørte
allerede i mappen, så denne sessions server kunne ikke starte.

## 2026-09-19: Admin Søgealgoritmer — tunable search-ranking weights with live test, commit/backup, and new personal/brand/verification signals

Direct user request for a new admin subpage. Full architecture/rationale in
`docs/DECISIONS.md` (2026-09-19, same heading) — this entry is the
build/verification summary.

- New `/admin/search-ranking` page (`AdminNav`/`admin-i18n` entry
  "Søgealgoritmer") with a `SearchRankingTuner` client component: a
  query+region+test-hour+optional-preview-user-id bar, one `<details>`
  accordion per tunable parameter (Verificering, Regionale stregkoder (EAN),
  Tidspunkt, Regionale mærker, Ingrediens vs. vare, Personlig historik,
  Regional popularitet), a debounced live-test result list with a per-signal
  score breakdown, a "Commit" button + optional note, and a "Tidligere
  versioner" backup/restore list.
- New Prisma models: `SearchRankingConfig` (append-only weight commits,
  exactly one `isActive`), `BrandRegionSearchStat` (region-scoped brand
  popularity), `UserProductSearchHistory` (per-user search/click history —
  see the DECISIONS.md entry for why this reverses the earlier
  anonymous-only stats principle). Hand-written migration
  `prisma/migrations/20260919080000_search_ranking_weights/` — not applied,
  no reachable local PostgreSQL in this environment, same recurring
  `hellocal_no_local_db` constraint as most other entries in this file.
- `src/lib/product-search-ranking.ts`: `rankProducts()` now takes a
  `SearchRankingWeights` argument (defaults reproduce the exact previous
  hardcoded behavior) and returns a per-signal `breakdown` alongside the
  score. New `deriveIsVerified()`. New `src/lib/search-ranking-config.ts`
  (`sanitizeWeights`, `getActiveSearchRankingWeights`,
  `commitSearchRankingWeights`).
- `/api/products` GET and `/api/generic-ingredients` GET both now read the
  active committed weights, compute the new verification/brand/personal
  signals for their candidates, and (only for a real logged-in session user,
  never the shared demo user) upsert `UserProductSearchHistory` alongside
  the existing region stats. `/api/products/search-event` does the same for
  clicks, plus `BrandRegionSearchStat`. New
  `POST /api/admin/search-ranking` (read/commit),
  `POST /api/admin/search-ranking/[id]/restore`, and
  `POST /api/admin/search-ranking/preview` (side-effect-free live test
  against a draft weight set, merging Product + GenericIngredient candidates
  into one ranked list so the ingredient-vs-product weight is visible).
- `src/lib/gdpr.ts`'s `anonymizeUser()` ("Ret til at blive glemt") now also
  deletes every `UserProductSearchHistory` row for the target user.
- **Not built this pass, explicitly flagged**: `docs/UI.md` already
  describes a self-service "Privatliv" settings page/toggle for this exact
  kind of personalization data — it still does not exist anywhere in the
  app (confirmed no route). The only current way to erase this data is the
  existing admin "Ret til at blive glemt" flow. Also not built: an actual
  merged Product+GenericIngredient result list for real end users — the
  "Generiske ingredienser vs. varer" weight is real and wired into ranking,
  but is only visibly comparable in the admin's own live-test tool, since
  `/foods` and `/api/generic-ingredients` remain two separate result lists
  in production, unchanged by this task.

`npx prisma validate`/`generate`, `npm run lint` (whole repo, clean), and a
full `npx tsc --noEmit` (whole repo, clean) all passed for this change.
`npm run build` itself could not be captured as one clean run in this
session — two unrelated concurrent sessions were actively building a
quality-control image-match admin feature throughout, and each build
attempt's TypeScript error was confirmed via `git status`/`git diff` to
belong to their in-progress files, not this one, before moving on. Not
verified live in a browser: no reachable local PostgreSQL, and no admin
session was available in this workstation environment to click through
`/admin/search-ranking` interactively.

## 2026-09-19: Billed-metatags ("Multiple"/"Raw") på Product/Ingredient/GenericIngredient

Brugerens ønske: billeddatabasen skal kunne vise et alternativt billede med
flere eksemplarer (fx flere æbler) når en registreret mængde er stor, og et
"rå-vare"-billede (fx fersk kød) når varen indgår i en opskrift/ret under
tilberedning i stedet for det normale (ofte tilberedte/emballerede)
standardbillede. Se `docs/DECISIONS.md` (samme dato) for arkitekturbeslutningen.

- **Bygget denne omgang:** to metatags, `"Multiple"` og `"Raw"`
  (`src/lib/image-tags.ts`), sat på det enkelte billede — ikke på selve
  produktet/ingrediensen — fordi samme vare kan have et emballeret
  standardbillede ved scanning, men skal vise en rå/fersk variant under
  tilberedning. Nyt `tags String[]`-felt på `ProductImage`, samt to nye
  gallerimodeller `IngredientImage` og `GenericIngredientImage` (samme form
  som `ProductImage`) med samme `tags`-felt — hånd-skrevet migration
  `20260919020000_image_variant_tags` (samme "ingen lokal database
  tilgængelig"-begrundelse som andre nylige migrationer i dette projekt).
- **"Raw"-visning er koblet på nu:** `/tilfoej/[id]` (`src/app/add/[id]/page.tsx`)
  viser og gemmer et `"Raw"`-tagget billede i stedet for standardbilledet, når
  varen tilføjes til en ret (`?for=ret`, `handleAddToDish`/den store
  produktbillede-cirkel øverst) — både for almindelige `Product`-rækker og for
  `GenericIngredient`-fallbacket (`/api/products/[id]` inkluderer nu
  `images`/`ingredient.images` i svaret).
- **Admin-tagging kun bygget for Product:** `ProductImageGallery.tsx` (den
  eksisterende "øvrige billeder"-galleri på `/admin/products/[id]`) har nu
  to til/fra-piller pr. billede ("Flere (Multiple)"/"Rå-vare (Raw)"), der
  PATCH'er det udvidede `/api/admin/products/[id]/images/[imageId]`
  (accepterer nu også `{ tags: string[] }`, ud over det eksisterende
  `{ direction }`).
- **Ikke bygget denne omgang, sat på roadmap efter eksplicit brugerønske**
  ("Vent med opgaven, men sæt den på roadmap"): automatisk valg af et
  `"Multiple"`-tagget billede når en registreret mængde overstiger en "normal
  maksstørrelse" for varen. Kræver først en beslutning om, hvordan den
  maksstørrelse fastsættes pr. vare (brugeren har endnu ikke valgt mellem et
  nyt admin-felt pr. produkt eller en fast kategori-tommelfingerregel) — se
  "Next work" nedenfor.
- **Ingen admin-brugerflade for at tagge `Ingredient`-/`GenericIngredient`-
  billeder endnu** — begge modeller har i forvejen ingen billedgalleri-
  administrationsside (kun ét `imageUrl`-felt sat ved import/oprettelse), så
  denne omgang gav dem kun datamodellen (galleri + tags) og læse-siden er
  klar (`/api/products/[id]` sender `images` med for `GenericIngredient`);
  der er ingen skrive-UI/route til at sætte tags på deres billeder endnu.
  Flagget som opfølgning i stedet for at bygge en ny admin-side, der ikke var
  bedt om.

`npx prisma validate`/`generate`, `npm run lint` (0 fejl, kun forudeksisterende
warnings i en urelateret fil) og `npm run build` (fuld TypeScript + alle
routes) kørt og rene. Ikke afprøvet i en rigtig browser med rigtige data
(ingen lokal Postgres på denne workstation, samme gentagne begrænsning som
andre indgange i denne fil) — næste skridt er at sætte mindst ét `"Raw"`-
tagget billede på et rigtigt produkt og bekræfte, at `/opret-ret`-flowet rent
faktisk viser det.

### Next work (tilføjet denne omgang)

- Beslut hvordan "normal maksstørrelse" pr. vare fastsættes (nyt admin-felt vs.
  kategori-tommelfingerregel vs. andet), og byg derefter den faktiske
  mængde-baserede auto-visning af `"Multiple"`-taggede billeder.
- Byg en admin-brugerflade til at tagge `Ingredient`-/`GenericIngredient`-
  billeder (i dag kun muligt direkte i databasen/via en fremtidig route) —
  ingen af de to har nogen eksisterende billed-administrationsside at udvide.

## 2026-09-19: Alternative kalorievisninger (per glas/skive/stk.) + AI-genererede admin-fejlrapporter ved usikkerhed

Direct user request, full rationale in `docs/DECISIONS.md` (same heading,
2026-09-19).

- `prisma/schema.prisma`: `Product.alternativeServings` (Json?) +
  `BugReport.userId` gjort valgfri + ny `BugReportSource` enum (`USER`/`AI`,
  default `USER`) på `BugReport`. Migration
  `prisma/migrations/20260919070000_alternative_serving_calories`
  (hand-written, ikke anvendt — ingen lokal database i dette miljø, samme
  `hellocal_no_local_db`-begrænsning som resten af filen).
- Nye `src/lib/alternative-servings.ts` (client-sikker: `cleanAlternativeServings`,
  `isAlternativeServingConfident`, tærskel 0.7) og
  `src/lib/alternative-servings-review.ts` (server-only, bruger `prisma`:
  `flagUncertainAlternativeServings`) — adskilt i to filer, fordi
  førstnævnte importeres direkte af det client-renderede `/add/[id]`.
- `POST /api/products` gemmer nu `alternativeServings` på produktet (når
  arrayet ikke er tomt), lægger dem ind i den eksisterende
  AI-prediction/correction-log for næringsanalysen, og filer en
  AI-`BugReport` for enhver post under confidence-tærsklen.
- `src/lib/bug-report-approval.ts` springer `awardPoints`/`queueMessage`
  over når `userId` er null (AI-rapporter). `src/lib/scheduler.ts`s
  48-timers eskalering viser "AI-genereret" i stedet for et brugernavn for
  disse. `/admin/bug-reports` + `PendingBugReportCard.tsx` viser
  "AI-genereret (ingen bruger)" og skjuler points-teksten på
  godkend-knappen for `source = AI`-rækker.
- `/add/[id]/page.tsx` viser nu confidence-godkendte alternative
  kalorievisninger som ekstra linjer direkte under det eksisterende
  "X kcal/100g"-tal (ikke som et separat mængde-/portionsvalg — eksplicit
  brugerpræcisering midt i sessionen). Nye i18n-nøgle
  `addProduct.alternativeServing` (begge sprog).
- Draften bærer feltet gennem det eksisterende `/camera/create` →
  `/product/create` → `POST /api/products`-flow uændret (samme mønster som
  `analysisIds`), ikke et redigerbart formularfelt.

`npx prisma validate`/`generate`, `npm run lint` (repo-wide, clean) og
`npm run build` (fuld TypeScript + alle routes) passerede alle. Fandt og
rettede undervejs en reel type-fejl i `src/lib/scheduler.ts` (den
eksisterende 48-timers eskalerings-mail antog `report.user` altid var
sat — rettet med et `"AI-genereret"`-fallback, ikke en urelateret
omskrivning). **Ikke testet i en rigtig browser eller mod rigtig AI-vision**:
ingen lokal PostgreSQL i dette miljø, og ingen ny AI-analyse er kørt i denne
session — `alternativeServings`-udtrækket i `/api/ai/extract-nutrition-v2`
fandtes allerede fra 2026-09-17-arbejdet og er ikke ændret her, kun det der
sker med resultatet bagefter.

## 2026-09-19: GenericIngredient region search-ranking — closed the missing time-of-day counter

Direct user request re-describing the regional search-ranking requirement
(hidden per-region search count with lower-priority for low counts,
GS1-derived origin-country priority, more-characters/higher-similarity
threshold for low-priority items, 2-character live+cached autosuggest, and a
click-time-of-day×region counter). All of this was already built the same
day for `Product`/`Ingredient` (see the "Regional product/ingredient search
ranking" entry below) — checked the current code against every point in the
request and found exactly one gap: `GenericIngredient` had the region
search/click counter (`GenericIngredientRegionSearchStat`) but no
time-of-day bucket, unlike `Product`/`Ingredient`.

- New `GenericIngredientRegionHourStat` model (same shape as
  `ProductRegionHourStat`/`IngredientRegionHourStat`), migration
  `prisma/migrations/20260919060000_generic_ingredient_hour_stats`
  (hand-written, no local PostgreSQL reachable from this workstation, same
  as every other pending migration in this file).
- `GET /api/generic-ingredients` now also includes/reads `regionHourStats`
  (already passed `localHour` into `rankProducts()`, but had no hour data to
  rank against) and strips it from the response, same as `regionSearchStats`.
- `POST /api/products/search-event` now also accepts `genericIngredientId`
  (alongside the existing `productId`/`ingredientId`), recording both the
  region click count and the region×hour click count — no UI currently calls
  this for generic ingredients yet (search/discovery for them isn't wired
  into `/foods` yet, per the 2026-09-19 "own database" decision), so this is
  ready infrastructure, not yet exercised end-to-end.

`npx prisma validate`/`generate` and `npm run lint` (repo-wide) passed
clean. `npm run build`'s TypeScript phase hit two **pre-existing, unrelated**
errors from a concurrent session's in-progress work (not touched by this
change): `src/lib/alternative-servings.ts` (new, untracked) and
`src/lib/scheduler.ts:64` (`report.user` now possibly `null` since
`BugReport.userId` became optional for AI-authored reports) — confirmed via
`git status` that neither file was part of this change before flagging
rather than fixing someone else's in-progress feature. Not verified against
a live database — same recurring `hellocal_no_local_db` constraint as most
other entries in this file.

Direct user request for an upgrade/payment page. Full architecture writeup in
`docs/DECISIONS.md` (2026-09-19, same heading) — this entry is the
build/verification summary.

- New `/profile/subscription` page, added as item #2 on the profile menu
  (`src/app/profile/page.tsx`, right after "Profil"): a gift-code row (label
  above field + right-arrow icon-button submit, per the user's own
  description), an "Indløs points" row linking to the pre-existing
  `/profile/points` screen, and a current-plan card (Gratis vs. Seriøs, 119
  kr./måned, disabled "Opgradér" CTA since no PSP is wired up yet, plus a
  link out to the pre-existing `/settings/payment` page for saved cards).
- New `GiftCode` model + `src/lib/gift-codes.ts` (`redeemGiftCode`) and `POST
  /api/subscription/redeem-gift-code`. New `src/lib/subscription.ts`:
  `getSubscriptionTier()` (derives Gratis/Seriøs from the existing
  `Subscription.status`/`currentPeriodEnd`, no new tier column),
  `getRetentionCutoffDate()` (the 30-day rolling window, a pure query
  filter — never deletes or marks rows).
- `src/lib/points.ts`'s `redeemFreeMonth()` no longer requires a saved
  payment method (explicit user decision overriding 2026-09-02, see
  `docs/DECISIONS.md`) — `/profile/points`'s copy updated to match.
- **Found and fixed while wiring this up**: `/settings/payment` (built
  2026-09-02/03) has always fetched `/api/subscription`, but that route
  never actually existed — the page has been silently running against a 404
  this whole time. Built the route now, keeping the exact
  `{subscription, paymentMethods}` shape that page already expects, alongside
  the new `{tier, pointsBalance, priceDkk, ...}` fields `/profile/subscription`
  needs, so one endpoint now serves both pages correctly.
- 30-day retention filter is wired into `GET /api/registrations` (the
  calendar/statistics primary data source) for this pass. **Not done yet,
  explicit follow-up**: the same filter is not yet applied to
  `WeightEntry`/`HealthMetric`/`BodyMeasurement`/sleep endpoints, even though
  the user's decision covers all data types — this needs the same
  `getSubscriptionTier`/`getRetentionCutoffDate` call added to each of those
  GET routes, deliberately not done as one large sweeping change without
  review. Photo diary is already localStorage-only (2026-09-02) so this
  server-side mechanism doesn't apply to it.
- Hello Doc (the one category excluded from Gratis) is gated both
  server-side (`POST /api/doctor-shares` → 403 when tier isn't Seriøs) and
  in the UI (`/settings/hello-doc` shows an upgrade link instead of the
  invite button for Gratis users).
- **Not built, explicit follow-up**: no admin UI to create/generate gift
  codes yet — only the data model and redemption endpoint exist. A gift code
  currently has to be inserted directly in the database to test redemption.

`npx prisma validate`/`generate`, `eslint .` (clean after fixing one
`react-hooks/set-state-in-effect` on the new page), and `next build` (full
TypeScript + all 165 routes, including the two new `/api/subscription*`
routes and `/profile/subscription`) all passed clean — the build briefly
waited on a concurrent session's own `next build` lock on this workstation,
same as other entries in this file, then succeeded. **Verified live** in the
local dev server (402×874): `/profile/subscription` renders its title and a
graceful "Kunne ikke hente abonnement." error state instead of crashing — no
reachable local PostgreSQL in this environment (`hellocal_no_local_db`, same
recurring constraint as the rest of this file), so the actual gift-code
redemption, points redemption without a card, and the 30-day retention
cutoff could not be exercised against real data on this workstation.

## 2026-09-19: Statistik-udvidelse — Sport og aktivitet, Søvn, Vitaminer og mineraler, Allergener og E-numre; fjernede opdigtede fallback-tal; ny "Anbefalede grænser"-indstilling

Integrerede en ekstern Codex/ChatGPT-forberedt kodepakke
(`HELLOCAL-statistik-IMPLEMENTATION.zip`, base `master@fb563a25`) mod den
faktiske aktuelle kode — pakken var 5 dage gammel og forudsatte bl.a. et
`DISTANCE_METERS`-felt, mens `DISTANCE_KM` allerede var tilføjet i mellemtiden
(2026-09-19, front-page-tal-slideren) og layoutet allerede havde fået en
"divider"-type og et flyttet `/settings/display`-undermenu-mønster fra andre
samtidige sessioner; integrationen blev derfor lavet som en manuel merge, ikke
et blindt patch-apply.

- `src/lib/stat-cards.ts`: udvidede `STAT_CARD_DEFS` med rigtige
  grundstofsymboler (Fe, Ca, K, Na, Mg, Zn, Cu, Mn, Se, P, I, Cr, Mo) på et nyt
  `StatCardValue.symbol`-felt (StatCardsGrid.tsx viser symbolet i stedet for
  det generiske ikon, når det findes) samt B/D/E/K-vitaminer, allergener/
  E-numre (placeholder, se nedenfor), og en stor "Sport og aktivitet"/"Søvn"
  gruppe (løb/cykling/svømning/cardio/ski som altid tilbudte "pinned"
  sportskort, aktive minutter, zoneminutter, hvilepuls, HRV, VO₂ max,
  søvnfaser osv.) — alle nye felter falder tilbage til "—" uden data, aldrig
  et opdigtet tal. **Fjernede de eksisterende opdigtede fallback-tal**
  (skridt "6.210", vand "1,6 l", forbrændt "642 kcal") til samme "—"-mønster.
  Beholdt den eksisterende `distanceKm`/`IconRoute`-kort (tilføjet tidligere
  samme dag af en anden session via `DISTANCE_KM`) i stedet for pakkens eget
  duplikerede `DISTANCE_METERS`-forslag.
- Nyt `StatCardValue.outsideRecommendedRange` — bevidst aldrig sat af nogen
  `compute()`-funktion endnu. Denne app har **ingen** valideret,
  region/profil-bevidst grænseværdi-evaluator; feltet findes kun som et sted
  for en fremtidig evaluator at skrive til, i stedet for at opdigte grænser
  nu. Se "Ikke bygget" nedenfor.
- Ny `src/lib/nutrition-terminology.ts` (`nutritionSectionLabel(region)`):
  regionsafhængig titel på næringssektionen (fx "Næringsindhold" i Danmark,
  "Nutrition Facts" i USA) — bruges nu som titlen på statistikkens
  makro/energi-kategori i stedet for et fast "Energi og makrofordeling"-navn.
- `prisma/schema.prisma` + `prisma/migrations/20260919020000_stat_threshold_alerts/`:
  nyt `User.warnOnRecommendedLimits` (default `false`), `FITBIT`/`WITHINGS`/
  `GARMIN` på `HealthMetricSource`, og alle de nye sport/søvn/mikronæringsstof-
  værdier på `HealthMetricType` (undtaget `DISTANCE_METERS`, se ovenfor).
- `src/lib/sport-icons.ts`: tilføjede `cardio`/`ski` til `SPORT_TYPES`.
- `src/components/StatCardsGrid.tsx`: nyt `highlightRecommendedLimits`-prop —
  når sand OG `card.outsideRecommendedRange === true`, får kortet en 1 px
  `border-hf-red-dark`-kant (både i det faste grid og i drag-floating-preview).
  Da ingen `compute()` sætter `outsideRecommendedRange`, er kanten reelt
  inaktiv, indtil en rigtig evaluator bygges — se "Ikke bygget" nedenfor.
- `src/app/statistics/page.tsx`: henter nu `/api/profile` for
  `warnOnRecommendedLimits` og sender den videre til `StatCardsGrid`.
- `src/app/statistics/unused-cards/page.tsx`: ny kategorisering —
  regionsafhængig næringstitel, "Vitaminer og mineraler" (samlet), "Allergener
  og E-numre" (ny), "Sport og aktivitet" (udvidet, inkl. de fem pinned
  sportskort), "Søvn" (ny), "Øvrige data". Henter nu også `region` fra
  `/api/profile`.
- `src/app/api/profile/route.ts`: `warnOnRecommendedLimits` tilføjet til
  PATCH-whitelisten.
- Ny indstillingsside `/settings/display/limits`
  (`src/app/settings/display/limits/page.tsx`, samme mønster som den
  eksisterende `/settings/display/front-page`): én `Toggle` for
  "Gør opmærksom på grænseværdier over/under anbefalet normal". Ny
  `ChevronRow` ("Anbefalede grænser", `IconAlertTriangle`) i den eksisterende
  "Visning"-gruppe på `/settings` (`src/app/settings/page.tsx`).
- Nye i18n-nøgler (begge sprog): `settings.recommendedLimits`,
  `displaySettings.title/warnOnRecommendedLimits/warnOnRecommendedLimitsDescription`,
  `statUnusedCards.category.vitaminsMinerals/allergensAdditives/sportActivity/sleep`
  (erstatter de fjernede `energyMacros/vitamins/minerals/activityOther/sport`).

**Ikke bygget denne omgang, flagget i stedet for opdigtet:**
"Allergener"/"E-numre"-kortene viser altid "—" — `Product.allergens`/
`additives` findes allerede pr. produkt (`prisma/schema.prisma`), men
`Registration` har intet allergen-/E-nummer-snapshot-felt (kun
næringssnapshot-felter), så et rigtigt periode-aggregat kunne ikke bygges
uden enten at bryde registrerings-snapshot-princippet (AGENTS.md) eller
tilføje nye snapshot-kolonner — en beslutning der bør tages eksplicit, ikke
gættes i denne omgang. Den røde grænseværdi-kant er kun UI-lag: der findes
ingen medicinsk/næringsfaglig grænseværdi-evaluator, så
`warnOnRecommendedLimits`-slåknappen har i praksis ingen synlig effekt endnu.

Verificeret: `npx prisma validate`, `npx prisma generate`, `eslint .` (hele
repoet, 0 fejl) og en fuld `next build` (alle 137 routes, inkl. de nye
`/settings/display/limits` og opdaterede `/statistics`/`/statistics/unused-
cards`) via den kendte Playwright-bundlede `node.exe` — ventede undervejs på,
at en anden samtidig sessions rigtige `next build`-proces blev færdig først
(bekræftet med `Get-CimInstance Win32_Process`, ikke den kendte OneDrive-
stale-lock-fejl). **Ikke testet i en rigtig browser** — samme gentagne
begrænsning som andre entries i denne fil (ingen lokal Postgres).

## 2026-09-19: Produktfejl-indberetning — afventer-gennemgang-overlay, ingen dobbelt-indsendelse, besked ved godkendelse/afvisning

Direct user request: when a user has reported an error on a product, show a
screen overlay ("Vi har modtaget din rettelse som afventer gennemgang") with
a white "Redigér" button below it going back into the report form, so a
second report on the same product can't be submitted while one is still
pending; and when an admin approves or rejects the correction, send the user
an in-app message saying so and whether points were transferred.

- `BugReport` (`prisma/schema.prisma`) gained an optional `productId` (new
  migration `20260919030000_bug_report_product_link`, hand-written — no local
  database reachable from this workstation, same as every other pending
  migration in this file). Previously every report was a plain, product-less
  text description; now a report opened from a product's own "Indberet
  fejl" link (`src/app/add/[id]/page.tsx`, now linking to
  `/profile/report-bug?productId=<id>`) carries that context, while the
  separate generic entry point under Profil stays product-less as before.
- `POST /api/bug-reports` now rejects (409, returning the existing row) a
  second `PENDING` report from the same user for the same `productId` —
  duplicate prevention is enforced server-side, not just hidden in the UI.
  New `GET /api/bug-reports?productId=` (does the same existing-PENDING
  lookup, for the page to check on load) and new
  `PATCH /api/bug-reports/[id]` (lets the user edit their own still-PENDING
  report's description in place — the "Redigér" flow — instead of ever
  creating a second row for the same product).
- `src/app/profile/report-bug/page.tsx`: when a PENDING report already
  exists for the given `productId` (or was just created), shows the overlay
  screen with the exact requested copy and a `.hf-btn-secondary` (white,
  bordered) "Redigér" button that reveals the same form pre-filled from the
  existing report, submitting via `PATCH` instead of `POST`. Wrapped in
  `Suspense` for `useSearchParams()`, matching `/product/create`'s existing
  pattern for a static route with a query param.
- Reused the existing "besked automatisering" in-app inbox
  (`OutboundMessage`/`queueMessage()`, read via `/profile/messages` +
  `GET/PATCH /api/messages`, already how `BUG_REPORT_RESOLVED`/
  `PRODUCT_APPROVED` etc. reach the user) rather than building a new
  notification system — this is what "besked i appen" already means
  elsewhere in this codebase. `approveBugReport()` already queued
  `BUG_REPORT_RESOLVED` (mentions the 10 points). `rejectBugReport()`
  (`src/lib/bug-report-approval.ts`) previously sent **no** message at all on
  rejection — added a new `BUG_REPORT_REJECTED` `MessageEvent` (schema enum +
  default template, `src/lib/messaging.ts`, explicitly stating no points were
  transferred) and wired `rejectBugReport()` to queue it. Also added to
  `USER_TOGGLEABLE_EVENTS` and `/profile/notifications`' `EVENT_LABELS`, same
  as every other user-facing event.
- Admin's `/admin/bug-reports` list (`PendingBugReportCard.tsx`) now shows
  "Produktrettelse: {brand} {name}" above the description when a report is
  tied to a product, so the admin isn't reviewing a bare text blob with no
  idea which product it's about.

`npx prisma validate`/`generate`, `npm run lint` (whole repo, clean), and
`npm run build` (full TypeScript + all routes, including the new
`/api/bug-reports/[id]` route) all passed — the build briefly hit "Another
next build process is already running" from a concurrent session's own
build and a stale-looking i18n type error on the first attempt, both cleared
on retry once that session's build finished, consistent with this file's
other concurrent-build notes. **Not verified live in a browser**: no
reachable local PostgreSQL in this environment, so the overlay/duplicate-409/
edit-in-place round trip needs a real click-through against a database that
actually has a product, a session user and a submitted report.

## 2026-09-19: Manuel oprettelse — Ingrediens/Produkt-valg + ny GenericIngredient-database

Direct user request: manuelt-oprettede produkter skal have brand/subbrand og
følge samme visningsstruktur som andre produkter; og øverst under "manuelt
tilføjet" skal brugeren vælge mellem "Ingrediens" og "Produkt". Generiske,
ikke-scannede ingredienser (grønt/frugt/kød uden brand/emballage) skal have
deres egen database og en region/land-popularitetskobling. Clarified with the
user before building (AskUserQuestion): new standalone `GenericIngredient`
model (not the existing `Ingredient`, which stays a HelloFresh image-only
cache); an ingredient displays identically to a product except it never has a
brand/barcode; region-popularity reuses the existing search/click-count
pattern rather than a manually curated country list. See `docs/DECISIONS.md`
for the full write-up.

- New `GenericIngredient` + `GenericIngredientRegionSearchStat` models
  (migration `20260919020000_generic_ingredients`, hand-written — no local
  PostgreSQL reachable from this workstation, same as every other recent
  migration in this file). No packaging means no energideklaration to read —
  `POST /api/generic-ingredients` resolves per-100g macros once at creation
  time via `src/lib/generic-ingredient-match.ts` (fuzzy match against
  FRIDA-imported reference products) and copies them onto the row; an
  unmatched ingredient has `kcalPer100g` etc. left `null` and the UI shows
  "Næringsindhold ukendt" rather than inventing a number (same convention as
  the 2026-09-19 `distanceKm` field).
- **Reused the existing `/add/[id]` display screen as-is**, per the user's
  "same display structure" request: `GET /api/products/[id]` now falls back
  to `GenericIngredient` when no `Product` matches the id, reshaping it into
  the same product-like JSON contract (`brand: null`, `barcodes: []`, plus a
  new `isGenericIngredient`/`hasKnownNutrition` flag). `Registration` gained
  a new nullable `genericIngredientId` (alongside the existing
  `productId`/`dishId`), and `POST /api/registrations` gained a matching
  branch — the same snapshot semantics as a normal product registration.
  Favoriting a generic ingredient is **not** built yet (the bookmark button is
  hidden for ingredients) — flagged as a follow-up rather than silently wired
  into `Favorite`, which only has a `productId`/`dishId` FK today.
- `GET /api/generic-ingredients?q=` search reuses
  `src/lib/product-search-ranking.ts` (same text-match + region-popularity
  ranking as ordinary product search) and records the same
  search-count-per-region stat on every ranked result.
- **New top-of-flow chooser**: `src/app/foods/new/page.tsx` (reached from the
  "Manuelt" tile on `/create-dish` and elsewhere) now first asks "Hvad vil du
  oprette?" — Ingrediens or Produkt — before showing either the new,
  minimal ingredient form (name + category: frugt/grøntsag/kød/andet) or the
  existing manual product form, which now also has **brand/subbrand** text
  fields (the existing `POST /api/products` already accepted these from the
  2026-09-17 guided flow — no backend change needed for that part).
- Not built this pass, flagged rather than guessed: making generic
  ingredients searchable/discoverable from `/foods` or `/search` (they are
  currently only reachable right after creation, via the returned id), and
  favoriting. Also not built: any manually-curated country/region list for
  ingredients — the user explicitly chose to reuse the search/click-count
  popularity pattern instead.
- `npx prisma validate`/`generate`, `npm run lint` (whole repo) passed clean.
  `npm run build`'s own TypeScript phase ("Finished TypeScript") completed
  with 0 errors against every changed/new file in this pass; the final bundle
  step could not be re-confirmed standalone afterwards because a concurrent
  session held `.next`'s build lock for the rest of this session — `.next`'s
  own manifests (`BUILD_ID`, `prerender-manifest.json`,
  `required-server-files.js`, all freshly written) show a complete build
  already exists on disk. Not verified live in a browser — no reachable local
  PostgreSQL in this environment, same recurring constraint as other entries
  in this file.

## 2026-09-19: Calendar day-goal status — real logic, no more placeholder

Direct user follow-up to the same day's day-detail "Dagens mål" text fix
(same session, two-part request): the day-detail overlay's status text/layout
was already fixed to use real registration data instead of a hardcoded
placeholder, but the month grid and the week timeline header (`MonthView`/
`WeekTimelineView` in `src/app/calendar/page.tsx`) still called the old
`goalWasMet(date, today)` placeholder — a fixed `Set([2, 5, 6, 9, 14, 18, 23,
27])` of "met" dates plus "today always counts as met" — which had nothing to
do with what was actually logged.

- Both components now take a `dailyTotals` prop (already computed once in the
  parent, already used by the existing `WeekView`/`ListView`/`DayDetails`) and
  call the pre-existing real `dailyGoalMet(dailyTotals, date)` helper —
  the same helper the week/list rows and the streak counter already used.
  `goalWasMet()` had no remaining callers and was deleted.
- **Day-detail overlay** (`DayDetails`, same file): replaced `goalWasMet()`
  with logic derived from the overlay's own already-loaded `registrations`
  (`hasEntries` + `dayKcal <= DAILY_KCAL_GOAL`), and reworked the "Dagens
  mål" row from three lines to two — status text and "Mål: X kcal" now share
  the top row (no more `truncate` clipping the status text), remaining/
  exceeded calories on the row below. Three status texts instead of two:
  no registrations → `calendar.dailyGoalNone` ("Endnu intet registreret"),
  within goal → `calendar.dailyGoalReached` ("Du er inden for dagens mål"),
  over goal → new `calendar.dailyGoalExceeded` ("Du har overskredet dagens
  mål", new red status dot). `calendar.dailyGoalNotMarked` removed (had no
  other callers). New/changed i18n keys in both `da.json`/`en.json`.
- Not touched: the month-grid day cell's own check/`÷` icon only has room for
  a binary met/not-met glyph — a genuinely-unlogged past day still renders the
  same "not met" `÷` mark it always did there; only the *day-detail overlay*
  got the three-way "none vs. within vs. exceeded" distinction, since that's
  the only place with enough room for real text (this is a UI-density
  limitation of the small grid cell, not a data gap — `dailyTotals` now feeds
  it correctly either way).

`npm run lint` and `npm run build` both passed clean (build briefly waited on
a concurrent session's own `next build` lock on this workstation, same
recurring pattern as other entries in this file, then completed with no
errors across all routes including `/calendar`). Not verified live in a
browser — day-detail/month/week views all need real registration data behind
a login, and this workstation still has no reachable local PostgreSQL nor
a test-user password available in this session.

## 2026-09-19: Regional product/ingredient search ranking

Integrated a ChatGPT-prepared code handoff (`hellocal-search-ranking-code.zip`,
downloaded by the user) implementing the regional search-ranking requirement
the user specified in the same conversation. Full scope/rationale in
`docs/DECISIONS.md` (2026-09-19, same heading) — summary here:

- Schema: `Product.originCountryCode` (hidden GS1 origin/market signal) +
  `ProductRegionSearchStat`/`ProductRegionHourStat`/
  `IngredientRegionSearchStat`/`IngredientRegionHourStat` (aggregate
  region-scoped search/click counters, no PII). New migration
  `prisma/migrations/20260919000000_product_search_ranking` (hand-written,
  not applied — no reachable local database in this environment, same
  recurring `hellocal_no_local_db` constraint as most other entries in this
  file).
- New `src/lib/product-search-ranking.ts` (`rankProducts`, `textSimilarity`)
  and `POST /api/products/search-event` (click tracking).
- New `inferGs1OriginCountryCode()` in `src/lib/regions.ts`.
- `src/app/api/products/route.ts` GET: 2-character autosuggest minimum,
  brand-name matching, wider ranked candidate pool, per-result search
  impressions, hidden fields stripped before the response ever reaches the
  client. `POST` and `/api/products/lookup/[barcode]` now set
  `originCountryCode` on creation.
- `src/app/foods/page.tsx`: replaced client-side filtering of a single
  unfiltered fetch with real debounced per-query calls to the ranked
  endpoint, an instant 5-minute cache, and click-tracking via `sendBeacon`.

The handoff's own stated base commit (`097fca5`) was several commits behind
actual `master` by integration time — every target file's real current
content was re-read and the patches adapted by hand rather than applied
blindly (e.g. `/foods/page.tsx`'s actual structure already differed from what
the package's diff assumed in some respects, though compatible in others).

**Verified:** `npx prisma validate` and `npx prisma generate` both passed.
`npm run lint` (repo-wide) is clean — fixed two real issues surfaced along
the way, unrelated to copy-pasting the handoff verbatim: a
`react-hooks/set-state-in-effect` violation (a synchronous `setSearchResults`
call inside the debounce effect; the instant-cache read is now a plain
derived `useMemo` instead) and a `react-hooks/purity` violation (the same
`useMemo` originally called `Date.now()` for TTL freshness, which this
project's React compiler rejects as an impure render — freshness is now only
checked inside the effect's async callback). `npm run build` (via `node`/`npm`
now present on PATH in this environment) passed clean — full TypeScript
check and all routes, including the new `/api/products/search-event` route.
Also regenerated the Prisma client mid-session after a concurrent session's
own unrelated schema edit landed on disk (a new `MessageEvent` enum value)
made the first build fail with a stale-client type error — confirmed via
`git log`/`git status` that the failing file belonged to that other session's
in-progress work, not this change, before regenerating rather than editing it.

**Not done:** no live database to exercise the ranking/impression/click-
tracking behavior against real search traffic; the admin "Søgealgoritmer"
weight-tuning page the user mentioned as a future destination for these
weights was explicitly out of scope for the delivered code package.
`npx prisma migrate deploy` is still needed on the next Synology release,
same as every other pending migration noted elsewhere in this file.

## 2026-09-19: Joystick add-button — fixed backdrop curve + more icon breathing room

Direct user request off a phone screenshot showing the green joystick backdrop
looking like a "lemon" (a flat/cut edge) when dragging toward the top item.

- **Root cause** (`src/components/AddButton.tsx`'s `backdropPath`): the curve
  was sampled at uniform steps in *y*, but near the poles (where the flat
  screen-edge meets the curve) `dy/dtheta -> 0`, so a uniform-y step skipped
  over a huge swing in angle/x — the very first line segment leapt from x=0 to
  nearly a third of the radius in one straight jump, reading as a flat facet
  right at the anchor. Fixed by sampling uniform in angle (theta) instead,
  which naturally clusters points where the curve bends fastest.
- **Second bug, found after the first fix** (reported by the user as "only
  bulges to the side, not up/down"): the bulge amount was scaled by
  `baseX/HALF_CIRCLE_RADIUS` to keep the pole anchors pinned, but that scale
  factor fades across the *entire* quarter-circle — so the top/bottom action
  icons (only ~15° from a pole) got almost no visible bulge at all. Replaced
  with `BULGE_POLE_TAPER_DEG` (12°): a pin factor that's 0 exactly at the pole
  and ramps to 1 within 12°, so only the last few degrees at the anchor are
  suppressed and every action icon — including the top/bottom ones — gets the
  same bulge as one at the side.
- **More spacing**: `ARC_GAP` 40 → 52 (icons sit a bit further from the green
  backdrop at rest), plus a new `HIGHLIGHT_EXTRA_RADIUS` (14px) that pushes
  the currently-highlighted icon out further still so the thumb doesn't cover
  it — animated via a new `transition-[top,left,right]` on the icon's
  positioning wrapper.
- Verified in the browser preview by dispatching synthetic `PointerEvent`s at
  the FAB (drag simulation can't rely on `left_click_drag`, which releases
  immediately — used `pointerdown`/`pointermove` dispatched directly on the
  button element, matching the pointer-capture target) and reading the live
  SVG `path` `d` attribute plus screenshots, dragging toward both the top and
  bottom action.
- Label-on-highlight and deselect-on-return-to-center (the other two items in
  the user's report) were already implemented correctly in the existing code
  (`opacity: open && isHighlighted`, and the `SELECT_DEAD_ZONE` check in
  `updateHighlight`) — no change needed there.

## 2026-09-19: Front page fully configurable — side layout + number-slider fields

Direct user request, extending the 2026-09-18 configurable-wheel checkpoint:
Settings → Visning → Forside now also lets the user swap which screen edge
the joystick add-button vs. the key-metric number-slider sit on, and choose
on/off which fields appear in that number-slider — offering the same field
catalog as the statistics page's cards, per the user's own framing ("som
udgangspunkt alle de valgmuligheder, som også findes i kortene på
statistik").

- **Side layout** (`src/lib/frontpage-layout.ts`, new): a single `FabSide`
  ("left"/"right") localStorage preference — there are only ever two elements
  on the hero (`AddButton`/`StatsWheel`), so one choice fully determines both;
  the number-slider always takes the side the add-button isn't on.
  `AddButton.tsx`'s previously-hardcoded `SIDE` constant (and its arc-math
  helpers, `arcItemCenter`/`arcItemStyle`) now take `side` as a real
  parameter; `Hero.tsx` reads the same preference once and passes the
  opposite side to `StatsWheel`, and the onboarding spotlight now points at
  whichever side the FAB actually sits on instead of an assumed "left".
  Same `useSyncExternalStore` SSR-safe pattern as every other
  localStorage-backed preference here (see 2026-09-18's hydration-pitfall
  note in this file, and `docs/DECISIONS.md`).
- **Number-slider fields** (`src/lib/frontpage-stats.ts`, new): a catalog of
  21 fields mirroring `src/lib/stat-cards.ts`'s statistics-page cards, but
  computing *today's* single-day totals (from `/api/registrations`'
  snapshot fields and `/api/health-metrics`' today's rows) instead of a
  30-day average. `StatsWheel.tsx` no longer hardcodes 5 fixed stats with
  three of them baked-in fake numbers — it now renders whichever
  `useFrontpageStatKeys()` localStorage selection is active, in catalog
  order. No cap on how many fields can be active (unlike the wheel's 5-button
  cap) — the user explicitly said a long list should just scroll.
  - New field **"Kalorier i plus"** (`kcalRemaining`): per the user's own
    clarification mid-session, this means calories still available today
    ("til gode"), i.e. `max(0, DAILY_KCAL_GOAL - consumed)` — never negative,
    and distinct from an over-goal overshoot (not built, wasn't asked for).
  - New field **"Kilometer bevæget"** (`distanceKm`): no existing data source
    for movement distance — added a new `HealthMetricType.DISTANCE_KM` enum
    value (`prisma/migrations/20260919010000_distance_km_metric`, hand-written,
    same no-local-database reason as every other recent migration in this
    file), following the exact same "prepared for a future HealthKit/Health
    Connect companion app" pattern as the pre-existing steps/water/burned
    metrics (docs/DECISIONS.md 2026-08-28) — explicitly requested by the user
    for future smartwatch sync. Also added as a statistics-page card
    (`src/lib/stat-cards.ts`) for consistency. Unlike steps/water/burned,
    there was no pre-existing placeholder demo number for distance, so an
    empty reading shows a plain "–" rather than an invented number.
  - The other 16 fields (protein/carbs/fat/sugar/fiber/salt/potassium/
    calcium/iron/saturatedFat/unsaturatedFat/transFat/cholesterol/vitaminA/
    vitaminC/water) reuse existing snapshot/metric data, same zero-fill and
    placeholder-fallback conventions as `stat-cards.ts`.
  - Default active set (`DEFAULT_FRONTPAGE_STAT_KEYS`): calories, kcalRemaining,
    burned, steps, distanceKm — exactly the five fields the user listed by
    name. Every other field is available in the settings toggle list but off
    by default.

**Note on concurrent work**: this session ran alongside another actively
building menstrual-cycle tracking (`prisma/schema.prisma`'s
`MenstrualCycleEntry`/`User.sex`/`cycleTrackingEnabled` fields,
`src/lib/add-actions.ts`'s `visibleAddActions()`, `/period/create`,
`/settings/display/menstrual-cycle` — see that session's own 2026-09-19 entry
directly below). Confirmed no file-level collisions: this session only added
new files (`frontpage-layout.ts`, `frontpage-stats.ts`) plus targeted edits to
`AddButton.tsx`/`Hero.tsx`/`StatsWheel.tsx`/`stat-cards.ts`/
`settings/display/front-page/page.tsx`/`schema.prisma` (a same-enum-block,
non-overlapping addition) — re-read every shared file immediately before
editing, per this project's standing concurrent-session convention.

`npm run lint` and `npm run build` (full TypeScript + all 130 routes,
including the other session's new `/period/create` and
`/settings/display/menstrual-cycle` routes) both passed clean. **Verified
live** against the already-running dev server (402×874): Settings → Visning →
Forside shows all three new/updated sections (Sidevisning, Knapper i hjulet,
Tal i tal-slideren) with correct labels; toggling "Højre" moved the FAB from
`left: 335` to the right edge and the number-slider to `left: 22` on the
front page (confirmed via computed bounding rects, reset back to the default
afterward); the number-slider's default fields compute correctly with no
registrations logged today (0 kcal consumed, 3.299 kcal remaining — the full
goal since none is consumed, 642/6.210 kcal/steps fallback placeholders,
"– km" for the brand-new unreadinged distance field). No reachable local
PostgreSQL in this environment (recurring `hellocal_no_local_db` constraint),
so the registrations/health-metrics fetches hit their 503 fallback in this
session's own testing, consistent with every other entry in this file.

## 2026-09-19: Gender + full birth date + menstrual cycle tracking (women only)

Direct user request: confirm Sex (mand/kvinde) is editable under Indstillinger
alongside name/age, replace the year-only birth field with a full birth date
so age auto-updates, and let women log their menstrual cycle from Visning and
from the calendar's own "Tilføj" flow. See `docs/DECISIONS.md` (2026-09-19)
for the data-model writeup.

- `User.sex` (FEMALE/MALE) already existed in `/profile/edit` — confirmed
  working, no change needed there.
- `User.birthYear` (Int, year only) replaced with `User.birthDate` (DateTime),
  so age is computed precisely and updates automatically every year instead
  of being a static "current year minus birth year". New `src/lib/age.ts`
  (`computeAge`). `/profile/edit` now has a native date input instead of the
  old year `WheelPicker`, showing the live computed age underneath.
  `src/lib/gdpr.ts` and `/api/profile` updated to match.
- New `MenstrualCycleEntry` model (start/end date per period) + three new
  `User` fields: `cycleTrackingEnabled` (the "Vis menstruationscyklus" toggle,
  off by default — same "never on by default" convention as showAllergens/
  showExtendedNutrition), `averageCycleLengthDays`/`averagePeriodLengthDays`
  (reserved for a future prediction feature, not used yet — no fertility/
  prediction UI was built, only logging a period's start date). Hand-written
  migration `20260919000000_menstrual_cycle_and_birthdate` (not applied — no
  local database, same as every other pending migration in this file).
- Settings → Visning now shows a second row, "Menstruationscyklus", but ONLY
  when the signed-in user's `sex` is FEMALE (`src/app/settings/page.tsx`
  fetches `/api/profile` once to decide). It opens
  `/settings/display/menstrual-cycle`, a single toggle page in the same style
  as `/settings/display/front-page`.
- New add-action `menstrualCycle` in `src/lib/add-actions.ts`, gated by a new
  `requiresCycleTracking` flag + `visibleAddActions(profile)` helper (visible
  only when sex = FEMALE AND `cycleTrackingEnabled` is on). All three
  consumers of the `ADD_ACTIONS` catalog — the front-page joystick wheel
  (`AddButton.tsx`), `/add/menu`, and its own settings toggle list
  (`/settings/display/front-page`) — now filter through this helper via the
  new `useAddActionsProfile()` hook, instead of rendering the raw catalog, so
  a male user (or a female user with the toggle off) never sees "Menstruation"
  anywhere. New `/period/create` page + `/api/menstrual-cycle` route (GET/POST,
  same `getDemoUser` pattern as `water-entries`) — logs only a period's start
  date; no prediction/fertility-window UI, since none was specified.
- **Explicit user instruction, implemented as asked, not the pre-existing
  behavior**: the calendar's per-hour "Tilføj" bar
  (`src/app/calendar/page.tsx`'s `goToAddFlow`) previously jumped straight to
  `/foods`. It now opens `/add/menu` instead — the same all-elements menu the
  front page's joystick "list" slot opens — forwarding `date`/`time` as query
  params onto whichever action the user picks from there (harmless for
  actions that ignore them; still what makes the food-search path land the
  registration at the tapped hour).
- Also fixed, found while running the build for this change: a genuine
  pre-existing TypeScript build break from a concurrent session's work on the
  front-page number-slider — `src/components/StatsWheel.tsx:335` called an
  undefined `formatNumber()`. Fixed by rendering `stat.goal` raw, matching how
  `stat.value` is already rendered just above it (unformatted) — not a design
  change, just what made `npm run build` pass again.
- Not built (out of scope for this pass, flagged rather than invented): any
  prediction/fertility-window display on the calendar itself, editing/ending
  an in-progress period, and wiring the new real `MenstrualCycleEntry` data
  into Hello Doc's `doctor-share.ts` (`menstrualCycle` is still listed in
  `DOCTOR_SHARE_UNAVAILABLE_CATEGORIES` even though a data model now exists —
  intentionally left alone this pass to keep the change scoped to what was
  asked; worth revisiting).
- `npx prisma validate`, `npx prisma generate`, `npm run lint` (whole repo),
  and `npm run build` (full TypeScript + all 130 routes, via the bundled
  Playwright `node.exe` per this file's other "no npm on PATH" notes) all
  passed clean. **Not yet done**: applying the migration to a real database
  and any browser click-through (no local database on this workstation).

## 2026-09-18: Settings → Visning → Forside (joystick wheel field picker) + new "Tilføj" all-elements screen

Direct user request: a new "Visning" (Display) section under Settings with a
"Forside" (Front page) item, where the user can choose which fields appear
in the front page's joystick wheel (`AddButton.tsx`); the wheel's top slot
becomes a fixed list icon opening a new full-screen list of every
add-element in the app (back arrow, same as other screens) — a quick
shortcut to weight, goal/measurements ("mål") and everything else.

- New `src/lib/add-actions.ts`: single catalog (`ADD_ACTIONS`) of every real
  add-destination in the app — microphone/voice, own dishes, search, weight,
  water, camera/scan, target weight ("Indtast mål"), body measurements
  ("Kropsmål") — reused by both the wheel and the new all-elements screen so
  neither can drift from the other. `targetWeight`/`bodyMeasurements` reuse
  the existing `profile.actions.target`/`profile.row.bodyMeasurements` i18n
  keys rather than duplicating the strings.
- `AddButton.tsx`'s wheel top slot (previously the microphone action) is now
  always a fixed "list" action (`IconList`) opening the new
  `src/app/add/menu/page.tsx` — a static route alongside the existing
  dynamic `src/app/add/[id]/page.tsx`, listing every `ADD_ACTIONS` entry as
  a plain `ChevronRow` list. The remaining wheel slots (up to
  `MAX_WHEEL_ACTIONS` = 5) are whichever catalog entries the user picked;
  default matches the previous 6 actions minus microphone (which moved into
  the new list screen instead of losing its own slot). Icon angles are now
  computed for however many actions are actually shown
  (`computeAngles(count)`) instead of a fixed 6-item array, so a smaller
  selection still spreads evenly across the same -75°..75° arc.
- New `src/app/settings/display/front-page/page.tsx`: a plain on/off list
  (`Toggle`, never a checkbox per the 2026-09-02 standing rule) for every
  catalog entry except the fixed "list" action, capped at
  `MAX_WHEEL_ACTIONS`; further toggles disable once the cap is reached.
  Selection is **stored in `localStorage`** (`hellocal.frontpage.wheelActions`),
  not the database — the same per-device-preference pattern already used for
  the statistics page's card layout (`StatCardsGrid.tsx`/`stat-cards.ts`).
- **Hydration pitfall hit and fixed during this pass**: an initial attempt
  read `localStorage` inside a lazy `useState(() => …)` initializer (mirroring
  `StatCardsGrid`'s existing pattern) — this is only safe for a component that
  is never server-rendered/hydrated with a different default. `AddButton` IS
  part of the statically prerendered front page, so a non-default saved
  selection produced a real "Hydration failed" error in the browser (caught by
  this session's own live verification, not just lint/build). Fixed with a
  proper `useSyncExternalStore`-based hook (`useWheelActionKeys()` in
  `add-actions.ts`): the server/first-hydration pass always sees
  `DEFAULT_WHEEL_ACTION_KEYS`, then React re-renders with the real
  `localStorage` value immediately after, with no mismatch. `StatCardsGrid`'s
  own equivalent lazy-`useState` read has the same latent risk (it's only
  used on the statistics page, not something rendered on first paint of a
  prerendered route in the same way) — **not fixed here, out of this
  session's scope**, flagged for awareness if it's ever moved somewhere
  hydration-sensitive.
- Settings section heading style reuses the existing plain uppercase-caption
  pattern from `statUnusedCards`'s category headings — no new heading
  primitive.

`npm run lint` and `npm run build` (full TypeScript + all routes, including
the two new routes) both passed clean. **Verified live** in the local dev
server (402×874): the wheel's top slot is a list icon; tapping it opens
"Tilføj" with a back arrow and all 8 catalog rows (Mikrofon, Egne retter,
Søg, Vægt, Vand, Kamera, Indtast mål, Kropsmål); Settings shows a new
"VISNING" section with "Forside"; toggling fields there (confirmed turning
Kamera off and back on, and hitting the 5-field cap with the rest disabled)
updates the wheel's actual icons after navigating back to the front page. No
reachable local Postgres, same recurring constraint as other entries in this
file — irrelevant here since this feature has no database dependency.

## 2026-09-17: Barcode-first guided AI product recognition integrated

Top-priority task: integrated the ChatGPT-prepared handoff package
(`HelloCal_OpenAI_ProductRecognition_Handoff_2026-09-16/`, reference-only,
now excluded from lint via `eslint.config.mjs`) into the guided product
creation flow. See `docs/DECISIONS.md` (2026-09-17) for the full architecture
and the two explicit **temporary dispensations** from the pre-existing
2026-09-12 OCR-scope decision.

- **Flow order in `/camera/create`** is now barcode → front photo →
  ingredients photo → nutrition photo → `/product/create`, replacing the old
  front-photo-first flow. An existing/known barcode still redirects straight
  to `/add/<id>` as before; an unknown barcode continues into the new flow.
  Every capture (`capturePhotoFromVideo`) saves the **entire** camera frame,
  not a cropped focus area — so the original image content around/outside
  the barcode or declaration is preserved even when out of focus, per the
  user's explicit request (2026-09-17).
- **Database**: `Product.subbrand`/`variant`/`packageSizeText` and a new
  `AiProductAnalysis` table (`prisma/migrations/20260917000000_ai_product_analysis`,
  hand-written — no local PostgreSQL reachable from this workstation, same as
  other recent migrations). One row per AI vision analysis
  (FRONT/INGREDIENTS/NUTRITION): `prediction` is written immediately by the
  analysis route; `productId`/`correction`/`correctedAt` are filled in by
  `POST /api/products` at product-save time, using the `analysisIds` the
  client collected during the guided flow. This is the ground-truth
  feedback loop the user specifically asked to have made clear —
  `prediction` (AI's original answer) vs `correction` (user's final saved
  values) live side by side on the same row, keyed by `analysisId`.
- **New AI routes**: `/api/ai/analyze-product-front` (brand/subbrand/
  productName/variant/packageSizeText/claims), `/api/ai/extract-ingredients-photo`,
  `/api/ai/extract-nutrition-v2`, `/api/ai/product-feedback` (manual
  correction outside the normal save flow, e.g. from admin),
  `/api/admin/ai-training/export` (canonical JSONL export of corrected rows,
  behind `requireAdminUser`). Model is `OPENAI_PRODUCT_VISION_MODEL`
  (`.env.production.example`), defaulting to `gpt-5.6-terra` — verified via
  web search to be a real, current OpenAI model name (not the
  ChatGPT-fabricated name it first looked like), reusing the existing
  `OPENAI_API_KEY`.
- **Language-priority table consolidated**: the handoff package's own
  region→OCR-language table was merged into the existing
  `src/lib/regions.ts` (`gs1RegionCandidates`, `primaryOcrLanguages`, both
  new) instead of keeping a second, parallel table in `barcode-context.ts`.
  `barcode-context.ts` is now a thin wrapper. Market region (user's own
  setting, never the phone's display language) stays the primary signal;
  the barcode's GS1 prefix is a secondary/fallback signal — never a
  whitelist, and never treated as a confirmed physical production country.
- **Brand upsert**: `POST /api/products` upserts `Brand` by exact name from
  the AI's (or user's corrected) brand text. No alias table yet — flagged in
  `docs/DECISIONS.md` as a known follow-up (e.g. "Arla Foods" vs "Arla").
- `npx prisma validate`/`generate`, `eslint .` (whole repo) and `next build`
  (full TypeScript + all 179 routes) all ran clean. Not verified live in a
  browser — no reachable local PostgreSQL in this environment; a real
  end-to-end camera/AI-call test still needs to happen against a deployed
  environment with `OPENAI_API_KEY`/`OPENAI_PRODUCT_VISION_MODEL` set and
  `prisma migrate deploy` run.

### Known follow-ups (not done here)

- **Revert the two temporary AI-first dispensations** (ingredients and
  nutrition photo analysis) back to "local OCR/regex first, AI only as
  fallback" once the guided flow has a working prototype the user has
  actually tested — see `docs/DECISIONS.md` 2026-09-17. Do not treat the
  current AI-first behavior as final architecture.
- `BrandAlias` table for real brand-name normalization (e.g. "Arla Foods" →
  "Arla"), per `01_STRATEGY.md` in the handoff package.
- Eval/benchmark tooling on top of `GET /api/admin/ai-training/export` once
  enough corrected rows exist (package's own guidance: start around 100-200
  corrected front-photo products).

## 2026-09-14: Area source maps and proposed boundaries

- Added `docs/areas/README.md` and four area entry guides for Hello Cal,
  admin, product creation and integrations; linked from `docs/README.md`.
- Mapped actual schema/routes/shared logic. Integrations already contain
  code; no live provider functionality verified. Employee payment and shelf
  workflows remain planned requirements, not existing dedicated models.
- Proposed one repository/schema with focused work areas and later gradual
  module extraction. No code moved, new apps created or architecture changed.
- Next: agree proposed boundaries, then shorten mandatory entry documentation
  with preserved history. Feature discovery remains paused.
- Documentation only; no lint/build run (no implementation checkpoint).

## 2026-09-14: Project boundary discussion saved; feature discovery paused

- Saved confirmed conversation requirements and unresolved questions in
  `docs/PROJECT-BOUNDARIES.md`. These are planning notes, not built features.
- User redirected the discussion to its original purpose: agree project and
  folder boundaries before further feature discovery or implementation.
- No repository split, folder moves, database changes or application edits.
- Documentation-only save; lint/build not run because no code changed and
  this is not a completed implementation checkpoint.

## 2026-09-13: ChatGPT project context and uncommitted handoff

- Added `docs/chatgpt/CONTEXT.md`: setup instructions, product vocabulary,
  canonical source map, root `design.md` contract, actual component/API/i18n
  locations, route mapping, and integration guidance for new pages.
- Added `docs/chatgpt/PROJECT-INSTRUCTIONS.md` to copy into ChatGPT project
  instructions and `docs/chatgpt/HANDOFF-TEMPLATE.md` for exact file paths,
  patches, acceptance criteria and honest validation reporting. Linked from
  `docs/README.md`; recorded the handoff workflow in `docs/DECISIONS.md`.
- Explicitly distinguishes GitHub read access, uploaded snapshots, local
  integration, commit/push and deployment. New pages go in `src/app` after
  Codex integrates against current files, then remain uncommitted by default.
  Only selected documentation should be uploaded; no whole-workspace bundle.
- Documents known stale-history traps in this file's older checkpoint/Next
  work lists and the starter root README; does not rewrite historical entries
  or treat outstanding local changes as published functionality.
- Documentation only. All unrelated existing changes preserved; no commit,
  push, deployment or application code changes made for this task.
- Verification: all 62 concrete source paths in CONTEXT checked (excluding
  placeholders and the explicitly incorrect `docs/design.md` example);
  `git diff --check` and `npm run lint` passed. `npm run build` failed because
  the existing `src/app/layout.tsx` Geist import could not fetch Google Fonts.
  A requested retry with network access was rejected by the user. No font or
  application changes made; production build remains unverified for this task.

## 2026-09-12: Kropsmål-side (`/profile/body-measurements`) — the "måleside" built

Follow-up to the same day's earlier photo-diary/selfie entry (this file, the
"Photo diary — selfie capture..." entry below), which added the
`BodyMeasurement` model and `/api/body-measurements` (GET+POST) but explicitly
deferred the actual data-entry screen to a separate chat. The user later sent
a bare "Fortsæt" in this same chat; asked which task that meant, they chose to
build the måleside here after all (superseding the earlier "separate chat"
instruction) — see "Next work" #13, now done.

- New `src/app/profile/body-measurements/page.tsx`: same visual pattern as
  `/profile/weight-calibration` (green intro card, borderless number inputs
  that only show a bottom border on focus, no visible "Gem" button, a history
  list with a delete button per row). Five optional fields in a 2-column grid
  — waist/hip/chest/thigh/upper-arm, all cm.
- Unlike weight-calibration's two weight fields (which deliberately create two
  *separate* rows, since "with clothes"/"without clothes" are two distinct
  weigh-ins), this page merges same-day field edits into **one**
  `BodyMeasurement` row: on blur, it PATCHes today's existing row if one
  exists, otherwise POSTs a new one and remembers its id for the rest of the
  session. This is deliberate — it's what lets the photo diary's "Aktuelle
  mål" caption show several measurements together for one day instead of just
  whichever single field was typed last.
- New `src/app/api/body-measurements/[id]/route.ts` (PATCH partial-update,
  DELETE), mirroring `/api/weight-entries/[id]`.
- Wired up two navigation entries: a new "Kropsmål" row on `/profile` (right
  after "Vægt kalibrering", `IconRulerMeasure`) and a 4th button on
  `/profile/edit`'s existing Fotodagbog/Indtast ny vægt/Indtast mål row
  (`profile.actions.bodyMeasurements`) — that row's existing "Indtast mål"
  button still means goal weight (`/profile/target-weight`, a separate,
  already-existing concept), so this needed its own distinct label/entry
  point rather than reusing that one.
- `design.md` §6.11 updated: the photo-diary entry no longer says the entry
  screen is unbuilt, plus a new "Kropsmål-side" paragraph documents this page.
- New i18n: `bodyMeasurements.*` (both locales), `profile.row.bodyMeasurements`,
  `profile.actions.bodyMeasurements`.

Verified with `npm run lint` (clean) and `npm run build` (clean, full route
list including the new page and API). Not screenshotted end-to-end with real
data — no reachable local PostgreSQL in this environment (`hellocal_no_local_db`).

## 2026-09-12: Kcal/person-badge på opskriftslisten (`/profile/recipes`)

Brugerens ønske: linket til HelloFresh-opskrifter under profilindstillinger
("Opskrifter", allerede eksisterende, linket fra `/profile`) skulle ligne
HelloFresh-appens egne opskriftskort, men med ét tilføjet element — en cirkel
i nederste venstre hjørne, der går en smule ud over billedets venstre og
nederste kant, og viser kcal pr. person/servering udregnet af den originale
ret.

- Ny primitiv `CalorieBadge` (`src/components/hf/CalorieBadge.tsx`,
  dokumenteret i `design.md` §6.11): 56 px hvid cirkel, mørk tekst, let
  skygge for læsbarhed over madfotos, positioneret `-8px`/`-8px` (bund/
  venstre) efter samme overlap-princip som den eksisterende `NumberedBadge`
  (blot modsat hjørne). To linjer: kcal (bold, 13 px) og en enhedslabel
  ("kcal/pers." / "kcal/serving", 8 px, sekundær farve, ny i18n-nøgle
  `recipes.kcalBadgeUnit`).
- `src/app/profile/recipes/page.tsx`: badgen erstatter den tidligere
  kcal-tekstlinje under billedet (ikke en duplikering). Kcal/person
  genbruger den eksisterende `kcalPerPerson()`-beregning
  (`kcalPer100g × servingSizeGrams ÷ 100`, falder tilbage til 100 g uden
  registreret portionsstørrelse) — ingen ny datakilde, listen filtrerer
  fortsat kun `source: "HELLOFRESH"`-produkter, og søgefeltet indekserer
  fortsat kun disse retter (uændret, var allerede bygget).
- `eslint` på de to ændrede filer er rent. Fuld `next build` (alle ruter,
  inkl. `/profile/recipes`) er kørt igennem uden fejl.
- **Visuelt verificeret**: startede projektets egen `next dev` (ingen anden
  session havde længere en server på port 3000), genindlæste
  `/profile/recipes` frisk — fejltilstanden ("Opskrifter kunne ikke hentes
  lige nu") rendered korrekt, da der ikke er en lokal database at hente
  rigtige opskrifter fra (samme kendte begrænsning som andre entries i denne
  fil). For selve badgens visuelle udseende (som ikke kan ses uden rigtige
  `HELLOFRESH`-produkter i en database) blev et midlertidigt test-DOM-element
  med præcis samme klasser/CSS-variabler indsat via DevTools oven på et
  eksempelbillede og fjernet igen bagefter — bekræftede at cirklen faktisk
  overlapper billedets nederste venstre hjørne synligt og læsbart, ikke kun i
  koden. Serveren blev lukket ned efter verifikationen.

## 2026-09-12: Live stregkode-scanningsguide på `/camera?mode=product` ("Stregkode"-fanen)

Bygget efter brugerens detaljerede beskrivelse af en scanningsguide (dæmpet
overlay med et 2,2:1-hul, rødt/grønt kant-feedback, fiktiv EAN-13-illustration
seedet fra brugerens region, grøn "læst"-markering, ny tekst under
viewfinderet, og en svær-at-scanne hjælpebjælke). Se design.md §6.11
(`BarcodeScanOverlay`, tilføjet 2026-09-12) for den fulde primitiv-beskrivelse.

- `src/lib/barcode-scan.ts` (ny): ren geometri — 2,2:1-guideboksen som en
  brøkdel af det kvadratiske viewfinder-lærred, og mapping fra @zxing's
  `ResultPoint`-koordinater (native `videoWidth`/`videoHeight`-pixelrum,
  bekræftet mod `node_modules/@zxing/browser`s `BrowserCodeReader`) til
  samme brøkdel-koordinatsystem som viewfinderets `object-fit: cover`-video.
- `src/lib/regions.ts`: ny `buildFakeBarcodeForRegion`/`formatEan13` — en
  fiktiv, aldrig opslået EAN-13 der starter med brugerens regions rigtige
  GS1-præfiks (samme `REGIONS`-liste som `barcodeMatchesRegion`), med et
  reelt udregnet EAN-13-kontrolciffer.
- `src/components/hf/BarcodeScanOverlay.tsx` (ny): den rent præsentationelle
  guideboks — hvid kant som udgangspunkt, `hf-lime` når en afkodet kode
  centrerer sig inden i boksen, `hf-red-dark` når koden er afkodet et andet
  sted i billedet men uden for boksen. Fiktiv stregkode + tal vises inden i
  boksen, indtil en kode bekræftes — så erstattes de et kort øjeblik af en
  grøn markering over selve det (omtrentligt udregnede) afkodede område.
- `src/app/camera/page.tsx`: `mode === "product"`'s @zxing decode-callback
  beregner nu justering pr. frame og **kræver at koden ligger inden for
  guideboksen**, før det rigtige produktopslag/navigation udløses (før blev
  enhver afkodet kode overalt i billedet accepteret med det samme) — en
  kode uden for boksen viser kun den røde kant. Hentede brugerens region via
  `GET /api/profile` (falder tilbage til "DK", samme default som
  `User.region`). Ny tekst "Hold kameraet stille over stregkoden" under
  viewfinderet (erstatter den tidligere øverste "Hold stregkoden inden for
  rammen"-pille for denne fane specifikt); efter ~6 sekunder uden en
  bekræftet aflæsning roterer en halvgennemsigtig sort hjælpebjælke mellem to
  hints. Nye/ændrede i18n-nøgler i begge `src/i18n/locales/*.json`:
  `camera.holdCameraStill`, `camera.barcodeHintOutsideFrame`,
  `camera.barcodeHintBlurry` (erstatter den nu ubrugte `camera.holdBarcodeInFrame`).

Tjekket først mod den sideløbende session "Produktside UI-elementer" (samme
repo, samtidigt): dens ændringer (`src/app/add/[id]/page.tsx`s
favorit-knap/"Indberet fejl", `src/app/api/products/[id]/route.ts`, en ny
`.hf-favorite-button`-klasse i `globals.css`) rører ingen af filerne i denne
opgave — ingen filkonflikt. `da.json`/`en.json`/`globals.css`/`design.md` er
delte og rørt af flere samtidige sessioner; alle blev genlæst umiddelbart før
redigering for kun at lægge til, ikke overskrive.

Verificeret: `eslint` (de ændrede filer, fangede og rettede to reelle
`react-hooks/set-state-in-effect`/`react-hooks/immutability`-fejl undervejs)
og `next build` (fuld TypeScript + alle ~140 routes) begge rene, via den
kendte Playwright-`node.exe` (samme "intet `npm`/`node` på PATH"-arbejdsgang
som resten af denne fil). Startede egen `next dev` via Browser-panelet og
genindlæste `/camera?mode=product` ved 402×874: den fiktive stregkode
("5 700000 000004", DK-fallback da `/api/profile` 503'er uden lokal
database, som forventet) og "Hold kameraet stille over stregkoden" render
korrekt; guideboksens computed geometri (288,6×131,2 px, centreret i det
370×370 px viewfinder) matcher 2,2:1/78%-specifikationen præcist, og
standardkanten er hvid 1 px. Browser-panelets sandbox blokerer reel
kameraadgang, så den dynamiske rød/grøn-justering, den grønne
"læst"-markering og timing på hjælpebjælken er **ikke** afprøvet med en
rigtig stregkode/kamera — det kræver en rigtig telefon/browser med
kameraadgang.

## 2026-09-12: Produktoprettelse — reelt scan-udtræk i stregkode/næring/ingrediens-boksene, region styrer OCR-/talesprog

Topprioritets-opgave (bruger satte alle andre planlagte opgaver på pause for
denne). Fuld baggrund/afklaring: `docs/DECISIONS.md`s indgang med samme
overskrift. `/product/create`s eksisterende 2×2 `CreateProductMediaGrid`
(design.md §6.11) havde kun ren fil-upload uden nogen udtræk — nu OpenAI er
sat op (`OPENAI_API_KEY`), er de tre første bokse forbundet til rigtig
udtræk:

- **Stregkode (boks 1):** afkodes lokalt og gratis med `@zxing/browser`s
  `BrowserMultiFormatReader.decodeFromImageUrl()` på selve stillbilledet —
  udfylder `barcodeValue` automatisk ved succes. **Ingen AI-fallback bygget
  med vilje** (brugerens egen instruks: "det skal helst ikke bruge AI") —
  fejler afkodningen, viser boksen en fejlbesked og brugeren indtaster
  stregkoden manuelt i det eksisterende tekstfelt nedenunder, som hele tiden
  var fallback-stien.
- **Næring (boks 2):** genbruger nu det samme "lokal regex først
  (`src/lib/product-ocr.ts` `parseNutritionText`), AI kun som fallback
  (`/api/ai/extract-nutrition`)"-mønster, som allerede kørte i det guidede
  `/camera/create`-flow — det var aldrig forbundet til selve grid-boksen før.
  Udfylder `kcalPer100g`/`proteinPer100g`/`carbsPer100g`/`fatPer100g` direkte
  i formularen (bruger kan stadig rette manuelt).
- **Ingredienser (boks 3):** helt ny route,
  `src/app/api/ai/extract-ingredients/route.ts`. Lokal OCR
  (`extractText`) læser altid billedet først; AI'ens ENESTE rolle er at
  oversætte den fundne tekst til appens UI-sprog (ren tekst-til-tekst
  chatcompletion, intet billede sendes, intet opslag) — kaldes kun, hvis OCR-
  sproget (udledt af regionen) rent faktisk afviger fra UI-sproget, ellers
  bruges OCR-teksten direkte uden noget AI-kald overhovedet (brugerens eget
  ønske om at spare unødvendige AI-kald). Udfylder `ingredientsText`.
- **Produktbilleder (boks 4):** uændret, ren upload — krævede ingen ændring.

**Region (ikke telefonens/browserens visningssprog) styrer nu det sprog, OCR
og talegenkendelse forventer** — ny `regionToOcrLanguage()`/
`regionToSpeechLang()` i `src/lib/regions.ts`, udledt af det allerede
eksisterende `User.region`-felt (GS1-præfiks-mapping fandtes i forvejen).
Rettede to steder, der ikke tog højde for dette:
  - `src/lib/product-ocr.ts` `extractText()` havde tesseract.js hardcodet til
    `"dan+eng"` uanset region — tager nu en `lang`-parameter; alle tre
    kaldesteder (`/camera/create` foto- og næringstrin, samt de nye
    scan-bokse) sender nu regionens sprog.
  - `src/app/voice/page.tsx:430` havde `recognition.lang` hardcodet til
    `"da-DK"` uanset `User.region` (ikke kun uanset telefonens
    visningssprog — den kiggede slet ikke på regionen). Bruger nu
    `regionToSpeechLang(regionRef.current)`.

**Ikke bygget denne omgang, flagget i stedet for gættet:** brugeren bad om at
kombinere dette arbejde med en anden, allerede beskrevet opgave om en grøn
kant, når stregkoden er i fokus, plus automatisk optagelse af 2-3 billeder på
det tidspunkt til krydstjek mod produktbillederne. Denne sessions research
kunne **ikke finde en skriftlig kilde** til den opgave — tjekket
`docs/UI.md`, `Fejlretninger/FEJLLISTE.md`, og de utriagerede
screenshot-mapper `Fejlretninger/Nye rettelser til Hello Cal/` og
`Fejlretninger/MyFitnessPal/` (kun rå `.png`/`.jpeg`-filer uden
tekstbeskrivelse). `/camera/page.tsx` og `/camera/create/page.tsx` har
allerede en statisk grøn kant-accent (`border-t-hf-green`) på scan-rammen,
men ingen dynamisk "tændt, når i fokus"-tilstand og ingen automatisk
multi-shot-optagelse. **Brugeren bedes pege på den konkrete kilde** (skærm-
billede/filnavn/besked), så det kan bygges korrekt i én omgang, i stedet for
at blive gættet på nu.

**Verifikation:** `eslint` (de ændrede filer), `tsc --noEmit -p .` (hele
projektet) og til sidst en fuld `next build` (via den kendte
Playwright-bundlede `node.exe`, se denne fils andre "intet npm på PATH"-noter)
er alle kørt og clean — build ventede kort på, at en anden samtidig sessions
egen `next build`-proces på denne workstation blev færdig først (en reel
kørende proces, ikke den kendte OneDrive-stale-lock-fejl fra tidligere
indgange i denne fil), men lykkedes derefter uden fejl: alle 113 ruter,
inklusive den nye `/api/ai/extract-ingredients`-route. Ikke testet i en
rigtig browser (ingen lokal
Postgres på denne workstation, samme gentagne begrænsning som andre indgange)
— stregkode-/næring-/ingrediens-udtrækkene bør klik-testes med rigtige
billeder på en rigtig enhed, især om `@zxing/browser`s stillbillede-afkodning
(`decodeFromImageUrl`, kun brugt til live-scanning andre steder i appen
indtil nu) rent faktisk finder stregkoder pålideligt i almindelige
telefonfotos (vinkel/lys/skarphed varierer langt mere end i den kontrollerede
live-scan-ramme).

## 2026-09-12: New "Opskrifter" (recipes) screen under Profil, backed by the existing HelloFresh catalog

Direct user request: integrate the HelloFresh app's "Opdag" recipe-browsing screen into Hello Cal, reachable from the profile page, titled "Opskrifter" (not "Opdag"), and showing kcal per person under each recipe instead of minutes/protein, sourced from "the official HelloFresh database".

No new scraping/import work was needed: HelloFresh's recipe catalog is already imported as ordinary `Product` rows (`externalSource='HELLOFRESH'`, category "Retter") via `scripts/hellofresh-import` (see the 2026-08-29 entry below), and `GET /api/products?source=HELLOFRESH` already existed to list them. New screen `src/app/profile/recipes/page.tsx` calls that endpoint (with `q=` for live search, `take=60`), showing results in a 2-column vertical grid (confirmed with the user: the HelloFresh reference's horizontal-scrolling "Mest populære opskrifter" row was deliberately **not** copied — there is no real popularity/view-count data behind that heading, and the user asked for a vertical list instead, with images cropped to fit). Each card shows the cropped dish photo, a bookmark favorite toggle (same `/api/favorites` pattern as `foods`/`search`), the recipe name, and a new circular `CalorieBadge` (`src/components/hf/CalorieBadge.tsx`, documented in `design.md` §6.11) overlapping the bottom-left corner of the image showing kcal per person — computed client-side as `kcalPer100g × servingSizeGrams ÷ 100` (falls back to 100g if a recipe has no recorded serving size), replacing minutes/protein entirely rather than duplicating an existing text line. Tapping a card links to the existing `/add/[id]` registration flow, same as every other loggable product. New i18n keys under `recipes.*` (da/en) and a new `profile.row.recipes` row (book icon) linking to `/profile/recipes` added to the profile menu (`src/app/profile/page.tsx`).

**Explicitly out of scope per the user's own answers when asked before building:** the HelloFresh reference screen's horizontal cuisine-category icon row (Skandinavisk/Europæisk/Middelhavsretter/Asiatisk/etc.) — this data was never scraped (only name/image/nutrition/ingredients are), and building it as a purely decorative, non-functional row would have needed sourcing 5+ icon images with no real filtering behind them; skipped rather than invented. The "Mest populære opskrifter" heading was dropped for the same reason (no real popularity signal exists).

`eslint .` and `next build` both passed clean across the full project (104+ routes, including the new `/profile/recipes`). Verified live at 402×874 in the local dev server: the green brand appbar reads "Opskrifter" with the correct back-chevron/profile-circle slots, the search field renders correctly, and the empty/error state ("Opskrifter kunne ikke hentes lige nu") displays gracefully instead of crashing — this workstation still has no reachable local PostgreSQL (same recurring constraint noted throughout this file), so the actual HelloFresh recipe cards, images, and kcal badges could **not** be clicked through against real data. Verify the populated grid, image cropping, and `CalorieBadge` numbers against real data on the next environment with a reachable database.

## 2026-09-12: Offline product creation queue + admin "Dobbeltoprettelser" (duplicate-creation merge) page

Two related requests from the user in one message: (1) the user-facing app should keep working offline, specifically letting someone photograph a product (and fill in the rest of the create-product form) with no network, uploading automatically once a connection is back; (2) when two of "the same" product get created at nearly the same time (e.g. two people, or an offline-queued submission landing after an online one already went through), that pair should show up in a new admin report page, "Dobbeltoprettelser", as a linked pair the admin can compare image-by-image (checkboxes) and merge with a dedicated Merge button.

**Offline queue** (`src/lib/offline-product-queue.ts`): the existing create-product flow (`src/app/product/create/page.tsx`, fed by `/camera/create`) already builds the whole `POST /api/products` body as plain JSON with every photo already encoded as a `data:` URL (see `CreateProductMediaGrid`/`product-draft.ts`) — there is no separate binary upload step to intercept. So the queue is simple: an IndexedDB store (`hellocal-offline` / `pendingProducts`, not `localStorage`, since a few captured photos as data URLs can exceed its ~5-10MB origin cap) holding the exact JSON body. `product/create`'s submit handler now checks `navigator.onLine` and also catches a `fetch` failure, and in both cases queues the payload instead of showing a dead-end error, then shows a dedicated "saved offline" confirmation screen (new `productCreate.savedOffline` i18n key) instead of navigating to `/add/[id]` (there is no product id yet). A new `OfflineQueueBanner` client component, mounted once in the root layout (`src/app/layout.tsx`, alongside `LocaleProvider`, above `PhoneFrame`) so it survives navigation, flushes the queue on mount, on the browser's `online` event, and every 60s while online, and shows a small fixed top banner ("`offlineQueue.pendingBannerOne/Many`") while anything is still queued. A queued item that comes back from the server with a real error (not a network failure — e.g. a barcode already taken) is removed from the queue rather than retried forever, since replaying the exact same bad payload indefinitely would not help; only a genuine network failure leaves it queued for the next attempt.

**Not done in this pass, flagged rather than silently skipped:** the barcode-lookup/OCR/AI-recognition steps inside `/camera/create` were **not modified** — they already wrap every network call in try/catch that falls through to manual entry on any failure (verified by reading the file, not just assumed), so they already degrade gracefully offline; the camera itself needs no network at all. Only the final submission needed a real fix. Also not built: any dedicated "afventer upload" review list (the top banner is the only visibility into the queue) — a small future page could list `listPendingProducts()`'s entries for the user to inspect/retry/discard individually.

**Dobbeltoprettelser** (`docs/ADMIN.md` "Godkendelsesflow: nye stregkodeprodukter" already said duplicates should warn the admin and be mergeable; `/admin/warnings`'s existing "Mulige dubletter" section only ever linked out to each product's own page, with no image-comparison/merge UI — this is a new, purpose-built page for the specific "created near-simultaneously" case, not a replacement for that broader same-name list):

- New `ProductDuplicateLink` model (migration `20260912010000_product_duplicate_links`, hand-written — same "no local database reachable from this workstation" reason as every other recent migration in this file) with `productAId`/`productBId` (always stored sorted so the same pair is never flagged twice) and a `PENDING/MERGED/DISMISSED` status.
- `src/lib/product-duplicates.ts`: `flagSimultaneousDuplicates()`, called right after a product is created in `POST /api/products` (`src/app/api/products/route.ts`) — looks for another product with the same normalized name created within a 10-minute window and upserts a `ProductDuplicateLink`. Wrapped so a failure here can never fail the actual product creation.
- `/admin/duplicate-products` (nav entry "Dobbeltoprettelser"/"Duplicate creations", `src/lib/admin-i18n.ts` + `AdminNav.tsx`): lists every `PENDING` link. Each pair renders as a `DuplicateProductCard` (client component) — two selectable product summaries (name/brand/macros/status/created-at; the selected one, default the earlier-created, is the row that survives the merge), a grid of every image from **both** products (`imageUrl` + `images[]`) each with its own checkbox (default checked), and Merge/"Ikke en dublet" (dismiss) actions.
- `POST /api/admin/duplicate-products/[id]/merge`: reassigns every FK referencing the discarded product (barcodes, registrations, dish ingredients, points transactions, forwards — plain `updateMany`, none of these have a unique constraint that could collide) plus `ProductIngredient`/`Favorite` (which do have unique constraints — same drop-the-duplicate-row-on-clash pattern already used by the pre-existing `/api/admin/products/[id]/merge` endpoint for `/admin/warnings`'s name-only dedup flow), replaces both products' images with exactly the admin's checked/ordered selection (first checked image becomes the kept product's `imageUrl`, the rest become `ProductImage` rows), marks the link `MERGED`, and deletes the discarded product. Registration/PointsTransaction snapshot fields are never touched, so historical entries keep showing exactly what was logged at the time, per the existing snapshot principle.
- `POST /api/admin/duplicate-products/[id]/dismiss`: marks a link `DISMISSED` without merging anything, for a same-name pair that genuinely isn't a duplicate.

**Verification:** `npx prisma validate` and `npx prisma generate` both passed (via the known-working `~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe` binary, this workstation still has no `node`/`npm` on PATH). `eslint .` (whole repo) passed clean, exit code 0. `next build` (full TypeScript + all 112 routes, including the two new `/admin/duplicate-products/[id]/*` API routes and the new page) passed clean. **Not verified live in a browser** — same recurring constraint as most other entries in this file: no reachable local Postgres, and the offline-queue banner/IndexedDB behavior specifically needs a real device test (toggle airplane mode, create a product with photos, confirm the banner appears and the item uploads once back online) before trusting it in production. The new migration also still needs `npx prisma migrate deploy` on the next Synology release, same as the several other pending migrations already noted in this file.

## 2026-09-12: "Opret egen ret" — inline search field instead of a boxed "Søg" tile

Direct user feedback on a live screenshot: the "Tilføj ingrediens" section had
three equal box tiles (Søg/Scan/Manuelt); the user wanted a real search field
in that section instead of "Søg" being just another box.

`src/app/create-dish/page.tsx`: replaced the "Søg" tile (which linked out to
`/search?for=ret`) with an inline `.hf-search` input, live-querying
`/api/products?q=...` the same way `/search/page.tsx` does (200ms debounce,
`AbortController`). Matches render directly below the field as a bookmark-free
result list (image + name), each a `Link` to `/add/[id]?for=ret` — same
downstream add-to-dish flow as before. "Scan" and "Manuelt" remain as a
2-column tile grid below the search field/results. New i18n keys:
`createDish.searchPlaceholder/searching/noResults` (both locales).

Verified live: `eslint` clean on the changed file, `next build` (full route
list, via the known bundled `node.exe` — see this file's other "no npm on
PATH" notes) passed clean. Opened the Browser pane against the other
concurrent session's already-running dev server (port 56077, this session's
own `preview_start` refused since a `next dev` was already up) at 375×812:
screenshot confirms the search field renders as a plain white input (not a
box tile), typing into it fires a real debounced `GET /api/products?q=...`
request and renders the live results/empty state below the field — the
request itself 503s locally per this workstation's recurring "no reachable
local Postgres" constraint, not a bug in this change.

## 2026-09-12: Photo diary — selfie capture in portrait format, weight/measurement captions; new `BodyMeasurement` model

User request (with a HelloFresh Kogebog screenshot as the visual reference
for the tall portrait block): `/profile/photo-diary` should support taking a
selfie (front camera) and showing it in a tall portrait card, and each such
photo should show two caption lines underneath — the user's weight and body
measurements as of that day if logged the same calendar day, otherwise the
most recent prior values.

`src/app/profile/photo-diary/page.tsx`: `DiaryPhoto` gained a `kind: "selfie"
| "photo"` field (existing localStorage entries without it default to
`"photo"`, unchanged). A new "Tag selfie" button (`capture="user"`, front
camera) sits above the existing "Tag billede" (`capture="environment"`, now
secondary-styled) button. Selfies render as a single-column feed of
full-width `aspect-[3/4]` `object-cover` portrait cards (the tall-block format
from the reference screenshot), each followed by two stacked caption lines:
"Aktuel vægt"/"Seneste vægt" and "Aktuelle mål"/"Seneste mål", with a plain
"ingen ... registreret endnu" fallback when there's no data at all. Regular
(rear-camera) photos keep the original, unchanged 2-column square grid below,
under its own section heading. The full-screen swipe viewer (Fejlretninger
#21) now opens against whichever section (selfies vs. photos) was tapped
instead of the single combined array.

New `BodyMeasurement` model (`prisma/schema.prisma`, migration
`20260912020000_body_measurements`): the dietitian-style circumference
measurements tracked alongside weight — waist, hip, chest, thigh, upper arm
(all optional `Float`, cm) plus `measuredAt`/`note`, same shape as
`WeightEntry`. New `/api/body-measurements` route (GET list + POST create,
same pattern as `/api/weight-entries`). **The actual data-entry screen for
these measurements ("måleside") is explicitly out of scope for this session**
— the user asked for it to be built in a separate chat — so today only the
model, the API, and the photo-diary's read-only caption exist; see "Next
work" #13.

`design.md` §6.11 documents the new selfie-portrait-card pattern as a
Hello-Cal-specific primitive (no HelloFresh reference for it).

Verified with `npm run lint` and `npm run build` only — this workstation has
no reachable local PostgreSQL (recurring `hellocal_no_local_db` constraint),
so the weight/measurement fetches hit their 503 fallback locally; not
screenshotted end-to-end with real data for the same reason.

## 2026-09-12: Calendar day-view — back arrow moved onto the same row as the profile/appbar, off the date-nav row

Direct user feedback on a live screenshot of `/calendar`'s day-detail overlay
(`src/app/calendar/page.tsx`, the full-screen `role="dialog"` opened by
tapping a day): the "Tilbage" arrow was rendered on the same row as the
"Søndag 20. september" date-navigation controls (prev/next-day chevrons),
instead of up on the same row as the rest of the app's fixed appbar. Split
that dialog's header into two rows: a real `.hf-appbar .hf-appbar--brand`
row (same fixed slots/class every other `ScreenHeader` screen uses) holding
only the back button and a "Kalender" title, and a second green row below it
that now only has the prev-day/date/next-day controls — no back arrow on
that row anymore.

Verified live (not just read): `eslint` clean on the changed file; `next
build` (via the known-working
`~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`
binary, since this workstation still has no `npm`/`node` on PATH) passed
clean, full route list, no TypeScript errors. Opened the Browser pane
against the user's own already-running `next dev` (port 3000), clicked into
20 September's day view via a real DOM `button[aria-label]` click, and
inspected the rendered dialog's DOM: the "Tilbage" button is inside
`.hf-appbar.hf-appbar--brand` next to the "Kalender" title, and the
prev/next-day row below it has no back button.

## 2026-09-12: Hello Doc real external access (Next work #12A) — reviewed and confirmed done, docs were stale

Resumed after a token-budget pause to check whether a concurrent session (working in this same repo at the same time — its dev server was up, and it overwrote a file mid-edit while this session was building the same feature, see the collision note below) had finished the Hello Doc token-authenticated external view, per the user's own instruction. It had:

- `src/app/hello-doc/[token]/page.tsx` — the real, login-free page a doctor/dietitian opens from the invitation e-mail. Renders `NOT_FOUND`/`REVOKED`/`EXPIRED` as plain status cards, `PENDING` as an accept screen (owner's name, the granted category list, expiry hint, "Bekræft og se data" button), and `ACTIVE` as the actual data view — sections shown only for the categories the owner granted (mirrors `/settings/hello-doc/preview`'s layout/`MiniChart` components, but scoped, not the owner's full data).
- `src/app/api/hello-doc/[token]/route.ts` — `GET` resolves the token (flips a timed-out `PENDING` to `EXPIRED` on read), returns only enough for the accept screen while `PENDING`, and the category-redacted data once `ACTIVE`; `POST` on the same path is the accept action (`PENDING` → `ACTIVE`, stamps `acceptedAt`). No `getSessionUser()` anywhere in the file — the unguessable `DoctorShare.token` is the only access control, same pattern as `Product.approvalToken`/`/admin/approve/[token]`.
- `helloDoc.token.*` i18n keys present in both `da.json`/`en.json`.

**This session's own contribution while working the same task before spotting the collision** (kept, doesn't conflict with the above): `src/lib/doctor-share-data.ts` (a `fetchDoctorShareOwnerData(ownerId, range)` helper) and a small `isDoctorSharePendingExpired` guard in `src/lib/doctor-share.ts`; refactored `/api/doctor-shares/preview/route.ts` to call the shared helper instead of duplicating the query logic inline (also dropped its unused `heightCm` field, which the preview page never rendered). A separate `accept/route.ts` this session started got deleted once the other session's combined `GET`+`POST` `route.ts` landed — that file is now the only accept path, kept as-is.

**Verification this pass:** `eslint .` (whole repo) and `next build` (full route list, including `/hello-doc/[token]`) both passed clean, despite multiple other `node.exe` processes already running (the other session's dev server) at the time. Not verified by an actual browser click-through/accept flow — this workstation still has no reachable local Postgres, so `GET /api/hello-doc/[token]` has nothing to resolve against locally; needs a real invite + real device/browser test against `hellocal.packroff.dk` once deployed.

**Follow-up pass (same session that wrote `/hello-doc/[token]` above, resumed via a scheduled one-shot cron after a token-budget pause):** consolidated the duplicated PENDING-expiry check in `src/app/api/hello-doc/[token]/route.ts` (both `GET` and `POST` had their own inline `expiresAt < now` comparison) to call the other session's `isDoctorSharePendingExpired()` helper instead, so there's exactly one place that rule lives. Also hit and resolved a genuine instance of this repo's known OneDrive-sync `.next` lock issue (documented elsewhere in this file): `next build` failed with "Another next build process is already running" despite no `node`/`next` process actually running (`Get-CimInstance Win32_Process` and a port-3000 check both came back empty) — `rm -rf .next` cleared the stale native lock, then the build succeeded. `eslint .` (whole repo, after the consolidation) and `next build` (full route list) both clean afterwards. Also live-verified (own dev server, no reachable local Postgres as usual): `GET /hello-doc/<garbage-token>` renders the real page (not a crash), correctly falls into the `loadError`/"Kunne ikke hente denne side" state once the underlying DB call throws (`ECONNREFUSED`, pre-existing), and `PhoneFrame.tsx`'s new `/hello-doc` exemption is in effect (`document.querySelector('.phone-frame-stage')` is `null` on that route) — no phone bezel wrapping the recipient's desktop-oriented view.

`docs/DECISIONS.md`'s 2026-09-12 Hello Doc entry still said "der findes endnu ingen token-autentificeret ekstern visning" (no such view exists yet) — that's now stale/incorrect; corrected there too. `docs/STATUS.md` "Next work" #12A marked done below (menstrual-cycle-tracking-as-a-real-feature is the only piece of that item still open).

## 2026-09-12: FAB radial menu — more clearance from the joystick backdrop, green action-hint labels

Direct user feedback on a live screenshot of the front-page FAB's fanned-out
action circles: the icons were still too close to the green joystick backdrop
— dragging a thumb toward an option covered it before it was clearly visible.
User also asked for a short green text label to appear next to whichever
action is currently highlighted during the drag, naming the action verbally
rather than relying on the icon alone (e.g. camera → "Tag billede").

`src/components/AddButton.tsx`:
- `ARC_GAP` (radial gap between the backdrop's curved edge and the action
  icons) increased from 24px to 40px, giving the drag/joystick zone more
  breathing room before it reaches the icon ring.
- Each `Action` gained a `hint` string (new `addButton.hint.*` i18n keys in
  both locale files: `mikrofon → Indtal`, `gryde → Måltid`, `søgning →
  Søgning`, `vægt → Vægt og mål`, `kamera → Tag billede` — deliberately
  distinct from the existing `addButton.*` aria-labels used for
  accessibility, which stay unchanged). Rendered as a `.hf-green`, bold,
  `whitespace-nowrap` label positioned just to the right of the action's
  circle (vertically centered with it, `SIDE`-aware so it still reads
  correctly if the FAB is ever mirrored to the right edge), visible only
  while that specific action is highlighted during the drag.

Verified live (not just read): opened the Browser pane against the user's own
running dev server (`localhost:3000`, no `npm run dev` started from this
session since one was already running), dispatched real `PointerEvent`
sequences (`pointerdown` → stepped `pointermove` → `pointerup`) against the
FAB button at 402×874. Screenshots mid-drag confirmed the enlarged gap and the
correct green hint label appearing next to the highlighted icon; releasing
navigated to `/weight/create` — the highlighted action's real route — via
`location.href`, matching the correctly-picked action.

**Roadmap note, not implemented this pass:** the user wants an additional,
manually-added FAB action for logging water intake ("VAND"), to be designed
later — recorded here so it isn't lost, not built yet.

`node_modules/eslint/bin/eslint.js` (run via the known Playwright-bundled
`node.exe`, since this workstation still has no `node`/`npm` on `PATH`) is
clean on `AddButton.tsx` and both locale files. A full-repo `eslint .` run
surfaced one **pre-existing, unrelated** error — `src/app/hello-doc/[token]/page.tsx:84`,
`react-hooks/set-state-in-effect` (`load()` called synchronously inside a bare
`useEffect`) — from the in-progress Hello Doc feature (see the entry below),
not from this change; flagged to the user rather than fixed without being
asked. `next build` (via the same Playwright `node.exe`, full TypeScript +
all ~130 routes) passed clean, exit code 0 — no errors, only the usual static/
dynamic route summary.

## 2026-09-12: Stemme (voice) screen — five direct bug/UX fixes from live screenshot feedback

`src/app/voice/page.tsx` had five issues reported directly against a live screenshot ("Lytter..." screen with items already showing under "Tilføjet"):

- **Fatal reset bug**: the file had two separate `useEffect(() => { startListening(); ... }, [])` blocks (an accidental duplicate), both firing on mount. This started two independent `SpeechRecognition` sessions against the same microphone at once; only one was tracked by `recognitionRef`, so the orphaned session kept running and silently kept re-appending its own recognized speech into the shared `finalTranscriptRef`/`transcript` state even after the visible "reset" button cleared them — explaining why previously-spoken text reappeared after a reset. Fixed by consolidating to a single mount effect, and the reset button (`voice.resetTranscript`) now `abort()`s the current recognition outright and starts a genuinely new one (`restartListening`), instead of only clearing the displayed text of a still-running session.
- **"Tilføjet" list redesign**: removed the down-chevron/inline amount-and-macro edit panel (`VoiceItem`, `MacroBar`) entirely, per direct instruction ("der skal ikke være pil ned... vises som de andre steder"). Rows now reuse the same shared `src/components/SwipeableRow.tsx` the home-screen `DailyList` already uses — swipe left for Fejl/Slet, swipe right for Favorit — and an already-added item is a `<Link href="/registration/[id]">` like every other registration row in the app, rather than an inline expandable editor. `SwipeableRow`'s `onReportError` prop was made optional (small, backward-compatible change — `DailyList` always passes it, so its behavior is unchanged) since a not-yet-added item has no registration to report an error against.
- **Persistence until the next day**: already-added items are now also written to `localStorage` (`hf-voice-added-items`, keyed by today's Y-M-D) so navigating away — e.g. via the new "Fejl" swipe action, or any other navigation — and back doesn't lose them from the screen; a stale previous day's entry is dropped automatically on the next visit. Only confirmed (saved) items are persisted this way, not an in-progress unconfirmed preview.
- **Mic auto-off on any interaction**: a capture-phase `pointerdown` listener on `document` stops the recognition session the instant the user interacts with anything else on the page or navigates away, excluding only the mic button and reset button (which already manage the session themselves) — a general fix rather than wiring `stopListening()` into every individual handler.
- **No more auto-add**: recognized items are no longer silently `POST`ed to `/api/registrations` the moment recognition ends. They now render as an unsaved preview (`Item.saved = false`); a new full-width green "Tilføj viste varer" button (only shown while there is at least one unsaved item) performs the actual save and flips matching items to `saved: true`, at which point they become real, swipeable/clickable registrations.

Removed now-unused i18n keys from both locale files (`voice.edit/save/foodOrDish/amount/lessAmount/moreAmount/resetChanges/closeEditing/editItem/delete` — all were only ever referenced from the removed inline editor); added `voice.addShownItems`. `npm run lint` (whole repo) and `npm run build` both passed clean (via the previously-documented `~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`, since this workstation still has no `node`/`npm` on PATH). **Not verified in a live browser** — same recurring constraint as other entries in this file; the mic-lifecycle and localStorage-persistence behavior should be click-tested on a real device before the next Synology release.

## 2026-09-12: Hello Doc — set up (not fully wired), per docs/DECISIONS.md

Built the new "Hello Doc" feature the user specified in detail: a new
Settings row (`src/app/settings/page.tsx`, `IconStethoscope`) opens
`/settings/hello-doc` ("Del din fremgang med din læge eller diætist"), an
"Inviter bruger" list/detail flow, and a "Sådan ser det ud" scientific/
medical-styled preview page. See `docs/DECISIONS.md` (2026-09-12) for the
full data-model/scope writeup — summary:

- New `DoctorShare` Prisma model + `DoctorShareStatus`/`DoctorShareHistoryRange`
  enums (migration `20260912000000_hello_doc`, hand-written, not applied —
  no local database, same as every other pending migration in this file).
  New `MessageEvent.DOCTOR_SHARE_INVITATION` template
  (`src/lib/messaging.ts`), queued the same way as `FRIEND_INVITATION`.
- `src/lib/doctor-share.ts`: the shared list of 9 shareable data categories.
  Two of them (menstrual cycle, digestion) have no underlying data model
  anywhere in Hello Cal yet, so they render as disabled/informational rows
  instead of a working toggle — flagged directly to the user in chat too,
  answering their own "did I miss any fields?" question.
- Pages: `src/app/settings/hello-doc/page.tsx` (list),
  `.../invite/page.tsx` (new invitation), `.../[id]/page.tsx` (edit an
  existing invited user — intentionally near-identical body to the invite
  page via the new shared `src/components/hf/DoctorShareEditor.tsx`, per the
  user's own instruction), `.../preview/page.tsx` ("Sådan ser det ud").
  New `src/components/hf/MiniChart.tsx` (dependency-free inline-SVG line/bar
  charts, same hand-rolled-SVG convention as `StatChart`/`StatsWheel` — no
  charting library exists in this project).
- API: `src/app/api/doctor-shares/route.ts` (list/create),
  `.../[id]/route.ts` (get/update), `.../[id]/resend/route.ts`,
  `.../[id]/revoke/route.ts`, `.../preview/route.ts`. All require a real
  session (`getSessionUser`), same as `/api/invitations` — no demo-user
  fallback, so nothing here is exercisable locally without a working login,
  same limitation as `/profile/invite`.
- **Explicitly out of scope for this pass, added to "Next work" below**:
  there is no token-authenticated external view yet — a real doctor/dietitian
  can't open their invite link and see anything; the "PENDING → ACTIVE"
  acceptance transition doesn't exist either, so every created share stays
  "Afventer" indefinitely for now. The preview page instead shows the
  signed-in owner's own data in the intended layout, clearly labeled as a
  preview in the UI.
- `npx prisma validate`, `npx prisma generate`, `npm run lint` (whole repo),
  and `npm run build` (full TypeScript + all 118 routes, via the bundled
  Playwright `node.exe` per this file's other "no npm on PATH" notes) all
  passed clean. **Not yet done**: applying the migration to a real database
  (`npx prisma migrate deploy`, same "no local Postgres reachable" situation
  as every other pending migration) and any actual browser click-through —
  every Hello Doc route requires a real logged-in session
  (`getSessionUser`), which this workstation can't exercise locally.

## 2026-09-11: calendar long-press text-selection fix, "Dagens mål er nået" tense fix, daily-list swipe actions reworked (red Slet + new "Fejl" action)

Direct user feedback from two live screenshots (calendar day view mid-long-press, and the home-screen daily list with a row swiped open):

- **Calendar long-press selection**: holding a finger down on the day-timeline to reveal the "Tilføj" bar (`src/app/calendar/page.tsx`, `HourRow`) was letting the browser paint its native mobile tap/long-press highlight (light blue) across the row, and nothing on the touched element reset `-webkit-user-select`/`-webkit-touch-callout`/the tap-highlight color. Fixed two ways: `HourRow`'s pointer-handling `<div>` now has `select-none [-webkit-touch-callout:none]` (same pattern already used in `BottomNav.tsx`'s long-press drag), and `html` in `src/app/globals.css` now sets `-webkit-tap-highlight-color: transparent` globally, so this class of highlight can't reappear on some other untouched element either.
- **`calendar.dailyGoalReached`** (`src/i18n/locales/da.json`/`en.json`): "Dagens mål blev nået" (past tense) → "Dagens mål er nået" (present tense); English key updated to match ("was reached" → "is reached").
- **`SwipeableRow.tsx`** (used by `DailyList.tsx`'s home-screen entries — the shared component, not the separate local one inside `src/app/voice/page.tsx`): the "Slet" action is now `bg-hf-red-dark` (the existing `--hf-color-danger` semantic token) with white text instead of black. Added a second right-side action, "Fejl" (`swipeableRow.reportError`, neutral `bg-hf-gray-dark`), placed to the left of "Slet" — **not** "Rediger", per explicit instruction, since editing an entry already happens by tapping the row itself. Tapping "Fejl" navigates to a new `/registration/[id]/report-error` route.
- **New route**: `src/app/registration/[id]/report-error/page.tsx` — a skeleton screen only (standard `HfScreen` shell with the usual back-chevron, a translated placeholder line). **Design for this screen is intentionally not built yet** — the user will specify it in a follow-up message. Do not invent form fields/content for it before that happens.

**Flagged for the roadmap (see "Next work" #12 below), not implemented this pass**: the user wants the calendar's long-press-to-add gesture to eventually open a brand-new full-screen add overlay (replacing/supplementing the current inline black "Tilføj" bar), with the detailed design to follow later. Recorded here and in "Next work" specifically so it isn't lost.

Lint/build not run this pass (see this workstation's recurring Node/npm-on-PATH notes elsewhere in this file for the current working method) — these are small, targeted edits; re-run `npm run lint`/`npm run build` before the next deploy per usual.

## 2026-09-11: front-page StatsWheel — removed redundant unit text, fixed the jumpy scale animation

Direct user feedback on a live screenshot of the front page: the steps row showed a redundant "skridt" unit next to the footstep icon, "Liter" should be "L", and — the bigger complaint — switching which stat is active "jumps" instead of moving smoothly like an iOS wheel picker, and the icon sometimes visually sits above/below the value instead of staying to its right during that motion.

`src/components/StatsWheel.tsx`: dropped the `unit: "skridt"` (icon already conveys it) and changed `unit: "Liter"` to `"L"`. Root cause of the jump: `WheelItem` rendered two entirely different DOM branches for the active vs. inactive item (different flex alignment — `items-baseline` vs `items-center` — and different gap), *and* separately recomputed `font-size`/icon `size` every render as raw numeric px/attribute values. Neither of those is covered by the `transition-[transform,opacity]` class, so they snapped instantly at the exact moment `isActive` flipped, while position/opacity kept easing — that's what read as a sudden jump and the icon momentarily landing above/below the text (baseline vs. center alignment shifts the icon vertically). Fixed by using one unified markup for every item, with a single fixed font-size (27px) and icon size (21px) for all rows, letting the existing CSS `transform: scale()` (already smooth and GPU-composited) be the only thing that shrinks smaller/farther items — exactly like a native picker wheel, where items are scaled copies of one size rather than independently resized. Verified live: computed styles now show `font-size: 27px` on every row regardless of active state, with `transform`/`opacity` as the only transitioning properties.

Also updated `.claude/launch.json`'s `hello-cal-dev` entry to invoke Next directly via the known-working Node binary (`.venv/Lib/site-packages/playwright/driver/node.exe node_modules/next/dist/bin/next dev`) instead of `npm run dev` — `npm`/`node` still aren't on this workstation's PATH, so the previous config failed immediately when the Browser-pane preview tool tried to start it.

`eslint .` on the changed file is clean; verified live via the local dev server (registrations API 503s as usual — no reachable local Postgres, pre-existing).

## 2026-09-11: stat-card reorder animation fixed for real (verified live), "Vis:"/Tilføj kort moved onto the period-picker row

**Found a working Node binary on this workstation:** `C:\Users\Peter\.venv\Lib\site-packages\playwright\driver\node.exe` (bundled with the Python `playwright` package, already installed — not a new install). Since `node_modules` is already present, this runs `eslint`/`next build`/`next dev` directly (`node.exe node_modules/eslint/bin/eslint.js .`, etc.) without needing `npm`/`node` on `PATH`. **Use this going forward instead of reporting lint/build as unrunnable on this machine.**

**Stat-card drag-reorder animation (`src/components/StatCardsGrid.tsx`) — the 2026-09-10 FLIP fix was real but incomplete, now fixed and actually verified live:** user reported (with a live screenshot) that after dropping a dragged card onto another, only the dragged card slid into place — the displaced card (previously occupying that slot) just snapped with no visible transition. Root cause: the previous fix took its "before" position snapshot manually, once, inside the pointerup handler right before triggering the reorder (`setLayoutAnimated`) — a timing-fragile one-shot pattern that was never live-tested (STATUS.md said so explicitly). `BottomNav.tsx`'s icon-reorder animation — already interaction-verified — uses a more robust pattern instead: the `useLayoutEffect` itself measures every card's position on every relevant render and diffs against whatever it measured the *previous* time it ran, self-correcting regardless of React's exact batching. Ported that pattern into `StatCardsGrid.tsx` (removed `setLayoutAnimated`, all three call sites now just call plain `setLayout`). Verified this time with a real local dev server (`next dev` via the Playwright node binary above) — `eslint .` and `next build` both clean.

**"Tilføj kort" moved onto the period-picker row, "Vis:" label added in front of it** (direct user request): moved the link out of `StatCardsGrid.tsx` into `src/app/statistics/page.tsx`, now sharing a `justify-between` row with `StatPeriodPicker`. Added `statPeriodPicker.showLabel` ("Vis:"/"Show:") to both locale files, rendered before the period button inside `StatPeriodPicker.tsx`. Verified live at 402×874 (screenshot): "Vis: I dag ⌄" and "+ Tilføj kort" now sit on one row where "I dag" used to be alone.

**Found, but deliberately did NOT fix (out of scope for this pass):** the period-picker's dropdown panel (`StatPeriodPicker.tsx`'s `absolute right-0 top-11 w-64` panel) renders mostly off-screen to the left at 402px width — confirmed via computed rect (`left: -154px`, only ~102px of the 256px-wide panel actually inside the viewport). This is pre-existing (the panel's `right-0` was always relative to the narrow picker-button container, which sits near the left edge of the screen, not the right) — not introduced by the changes above. Flagged for a future pass, not silently patched.

## 2026-09-11: `npm run lint`/`npm run build` actually run, two real bugs fixed

Correction to every "cannot run node/npm" note elsewhere in this file: this
workstation has no `node`/`npm` on PATH, but a real Node.js binary exists
elsewhere on disk (`~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`,
bundled for an unrelated tool) — invoking it directly against the project's
own `node_modules/eslint/bin/eslint.js` and `node_modules/next/dist/bin/next`
(and `node_modules/prisma/build/index.js`) works fine, since `node_modules`
is already installed and `npm run build`/`lint` are just thin wrappers around
those. `npx prisma generate` was also run this way. **Future sessions should
try this before reporting lint/build as unrunnable.**

Running lint for real (not just reasoning about the diff) surfaced two
genuine `react-hooks/refs` errors, unrelated to this session's own nutrition-
panel work — from other concurrent sessions' recent commits:

- `src/app/calendar/page.tsx` (`WeekTimelineView`): wrote to
  `getSleepWindowRef.current` directly in the component body (a "keep the
  latest callback without retriggering the effect" pattern) — moved into a
  bare `useEffect(() => { ... })` (no deps, runs after every render) instead,
  which is the correct place to mutate a ref for this pattern. Also dropped
  a now-stale `eslint-disable-next-line react-hooks/exhaustive-deps` that
  lint reported as unused.
- `src/components/hf/SleepRangeSlider.tsx`: `handlePointerDown(handle)` was a
  factory returning a closure, so the ref write (`draggingRef.current = ...`)
  happened inside a function invoked directly in the JSX expression
  (`onPointerDown={handlePointerDown("wake")}`), which the linter can't
  distinguish from a render-time call. Changed to a plain
  `handlePointerDown(handle, event)` invoked from an inline arrow at each
  call site (`onPointerDown={(event) => handlePointerDown("wake", event)}`) —
  same runtime behavior, now unambiguously an event handler.

Both fixed, verified with a clean `eslint .` run, and `next build` (TypeScript
+ full static/dynamic route generation, 104 pages) passed clean afterwards —
covers this session's own extended-nutrition-panel changes plus everything
else outstanding in the working tree at commit `d51786e`. Migrations are
still **not applied** to any real database (no reachable Postgres here) —
run `npx prisma migrate deploy` on the next Synology release.

## 2026-09-11: finished the "add card" stat categories (all 5, incl. Vitaminer) + a real MyFitnessPal-style extended nutrition panel

Direct user feedback on a fresh screenshot of `/statistics/unused-cards`:
"Vitaminer" still showed an empty "Ingen kort her endnu." box — the
2026-09-10 entry below turned out to be **inconsistent with the actual code**
when re-checked: `schema.prisma` was missing the six `Registration` snapshot
columns its own migration added (Prisma Client wouldn't have matched the
database), and `src/lib/stat-cards.ts`/`unused-cards/page.tsx` didn't have the
`sugar`/`fiber`/`salt`/`potassium`/`calcium`/`iron` entries the note claimed
at the start of this session — likely a concurrent session's work landing
between then and now. Re-checked live at the start of this pass:
`schema.prisma` was fixed to match the existing migration (see below), and by
the time `stat-cards.ts`/`unused-cards/page.tsx` were touched here, a
concurrent session had already wired the original six fields in — this pass
only added the six new ones on top and fixed the schema gap. The user then
asked for the full MyFitnessPal-style nutrition list to be built for real
(fat breakdown, cholesterol, sodium, potassium, fibre, sugar, vitamin A/C,
calcium, iron), shown as a collapsed "Vis mere" section (never open by
default) below the nutrition info on `/add/[id]`, gated by a new opt-in
setting — asked in an `AskUserQuestion` round-trip before building, per the
"no autonomous actions on architecture decisions" rule.

- `prisma/schema.prisma`: added the six `Registration` columns matching
  `prisma/migrations/20260910000000_registration_extra_nutrition_snapshots`
  (still not applied — no reachable database, same as other pending
  migrations). Added a new hand-written migration,
  `prisma/migrations/20260911120000_extended_nutrition_panel`, for: six new
  nullable `Product.*Per100g` fields (saturated/unsaturated/trans fat,
  cholesterol, vitamin A, vitamin C), matching `Registration.*Snapshot`
  columns, and `User.showExtendedNutrition` (boolean, default false).
- `src/lib/openFoodFacts.ts`: maps the six new fields from Open Food Facts'
  `nutriments` object. Cholesterol/vitamin A/vitamin C use a new
  `offNutrientAs()` helper that reads OFF's companion `<nutrient>_unit`
  field and converts g/mg/µg explicitly instead of assuming a unit — returns
  null (not a guess) for anything else (e.g. "IU"). Unsaturated fat is
  derived as `fat − saturated − trans` only when both are known. **This is
  currently the only data source for these six fields** — Frida and the
  HelloFresh scrape don't have them, so most products will show none of this
  section at all, same "unknown = hidden, not zero" convention as everywhere
  else in this codebase.
- `src/app/api/products/route.ts` (OFF search-import path) and
  `src/app/api/products/lookup/[barcode]/route.ts` (barcode lookup path) now
  pass these six fields through when creating a `Product` from an OFF result.
- `src/app/api/registrations/route.ts`: snapshots the six new fields the same
  way as kcal/protein/carbs/fat (simple `amountGrams/100` factor against the
  Product's per-100g value) — simpler than the existing sugar/fiber/salt/
  potassium/calcium/iron path just below it, which stays on the older
  `nutritionExtra`-per-serving-size scaling (HelloFresh recipes only, see the
  2026-08-29/2026-09-10 entries) since that data still only exists there.
- `src/lib/daily-totals.ts`: `DailyTotal`/`RegistrationTotals` gained the six
  new fields, zero-filled the same way as the existing six.
- `src/lib/stat-cards.ts`: added `saturatedFat`/`unsaturatedFat`/`transFat`/
  `cholesterol`/`vitaminA`/`vitaminC` to `STAT_CARD_DEFS` (not added to
  `DEFAULT_ACTIVE_STAT_KEYS`, same reasoning as the existing six — reachable
  via "unused cards" instead of cluttering a fresh dashboard).
- `src/app/statistics/unused-cards/page.tsx`: `categoryDefs()`'s
  "Energi og makrofordeling" now also includes the fat breakdown +
  cholesterol; **"Vitaminer" now maps to `["vitaminA", "vitaminC"]` — no
  longer permanently empty.** All 5 categories now have at least one real,
  non-invented card source.
- `src/app/add/[id]/page.tsx`: new collapsed "Vis mere"/"Vis mindre" section
  (`addProduct.extendedNutrition`) below the ingredients/allergens details,
  listing whichever of the 12 extended nutrients (the 6 new per-100g fields +
  the existing 6 `nutritionExtra` ones) actually have a value for this
  product at the current amount — **only rendered at all when
  `profile.showExtendedNutrition` is on AND at least one row has data**, so
  it never shows as an empty block. Never expanded by default.
- `src/app/profile/settings/page.tsx` + `src/app/api/profile/route.ts`: new
  "Vis udvidet næringsindhold" toggle (off by default), same pattern as the
  existing "Få vist allergener" toggle.
- New i18n keys added to both `da.json`/`en.json`:
  `settings.showExtendedNutrition(Description)`,
  `addProduct.showMore/showLess/extendedNutrition(Disclaimer)`, and
  `addProduct.nutrient.*` (12 nutrient labels).
- This workstation cannot run `node`/`npm`/`npx` at all in this session
  (checked both Bash and PowerShell) — same "no Node.js install at all"
  constraint noted in the entry directly below. **The user needs to run
  `npx prisma generate`, `npm run lint`, and `npm run build` themselves**,
  then apply both pending migrations (`npx prisma migrate deploy`) before
  this reaches production. Run command:
  `npx prisma generate && npm run lint && npm run build`.

## 2026-09-11: profile weight field lock + new "målvægt" (target weight) feature

`/profile/edit` ("Profil"): the weight field is renamed "Start-vægt (kg)" and
is now locked by default — a light-grey lock icon next to the label must be
clicked to unlock it for editing, so it reads as a one-time starting value
rather than a field to update regularly (that's what "Indtast ny vægt"/vægt-
kalibrering is for). Added a row of three buttons below the basic-info grid:
Fotodagbog, Indtast ny vægt, Indtast mål — linking to `/profile/photo-diary`,
`/profile/weight-calibration`, and a new `/profile/target-weight` page.

New shared icon: `src/components/hf/IconBathScale.tsx` — a bathroom-scale SVG
(same primitive pattern as `HfChevron`), now the one weight icon used
everywhere a weight icon appears (`/profile`, `/profile/edit`'s new weight
button, and the Withings row in `/settings/integrations`), replacing
`@tabler/icons-react`'s `IconScale` (a balance/kitchen scale) which does not
exist as a bathroom-scale variant in that icon set.

New feature: target/goal weight. `User.targetWeightKg` (nullable Float) added
to the schema; hand-written migration
`prisma/migrations/20260911000000_user_target_weight` (same reason as other
recent hand-written migrations — no local database on this workstation to run
`prisma migrate dev` against; only `prisma validate`-level checking was
possible here). `PATCH /api/profile` now also accepts `targetWeightKg`.
`/profile/target-weight` autosaves on blur (no "Save" button, per the
existing convention). This is a new concept with no other consumer yet
(e.g. not surfaced in statistics) — that's out of scope for this pass.

**Not verified in a browser** (no local database on this workstation, same
constraint as other recent entries in this file). `npm run lint` and
`npm run build` could not be run either — this workstation has no Node.js/npm
install at all (only a Playwright-bundled `node.exe`, not a general runtime),
and it has no local admin rights to install one. Needs `prisma migrate deploy`
+ a real click-through on the next Synology release, same as the pending
migrations noted elsewhere in this file.

## 2026-09-10: filled two of the empty "add card" stat categories with real data

Per direct user feedback that `/statistics/unused-cards` showed several empty
categories ("Kulhydrattyper og fibre", "Vitaminer", "Mineraler") — these were
deliberately left empty in the 2026-08-27 batch since no matching stat types
existed. Re-checked the schema: `Product.nutritionExtra` (added 2026-08-29 for
HelloFresh-recipe imports) already carries real sugar/fiber/salt/potassium/
calcium/iron values per docs/DECISIONS.md, just never wired into
registrations or stat cards. Wired it up rather than inventing placeholder
numbers:

- `Registration` gained six nullable snapshot columns (`sugarSnapshot`,
  `fiberSnapshot`, `saltSnapshot`, `potassiumSnapshot`, `calciumSnapshot`,
  `ironSnapshot`) via a new hand-written migration
  (`prisma/migrations/20260910000000_registration_extra_nutrition_snapshots`
  — not yet applied, same "no local DB reachable" situation as other pending
  migrations in this file).
- `POST /api/registrations` (productId path) now reads `product.nutritionExtra`
  and scales it by `amountGrams / product.servingSizeGrams` (nutritionExtra is
  per-serving, not per-100g — see the code comment and
  `scripts/hellofresh-import/agent.py`) into the new snapshot fields. Only
  populated when both the product has a `servingSizeGrams` and the specific
  key exists in `nutritionExtra`; otherwise left `undefined`/null, same as
  every other "no data yet" case in this codebase.
- `src/lib/daily-totals.ts`'s `DailyTotal`/`RegistrationTotals` types and
  `groupByDay()` now also sum sugar/fiber/salt/potassium/calcium/iron
  (zero-filled on days without a HelloFresh-recipe registration, same
  averaging convention as every other stat card).
- `src/lib/stat-cards.ts`: added `sugar`/`fiber`/`salt`/`potassium`/`calcium`/
  `iron` entries to `STAT_CARD_DEFS`. **Not** added to
  `DEFAULT_ACTIVE_STAT_KEYS` (that's now an explicit 9-key list instead of
  "every def") so a fresh Statistik dashboard isn't cluttered with
  mostly-zero cards for users with no HelloFresh registrations — they're
  reachable the normal way, via "unused cards".
- `src/app/statistics/unused-cards/page.tsx`: `categoryDefs()`'s
  "Kulhydrattyper og fibre" now maps to `["sugar", "fiber"]` and "Mineraler"
  to `["salt", "potassium", "calcium", "iron"]`. "Vitaminer" is **still**
  empty on purpose — no vitamin data exists anywhere in this codebase or in
  the HelloFresh scrape, so it was left as a genuine empty-state rather than
  invented.
- This workstation cannot run `npx prisma generate`/`npm run lint`/
  `npm run build` at all in this session (`node`/`npm`/`npx` are not on PATH
  in either shell here, not just "no local DB" as in other entries) — the
  user needs to run `npx prisma generate`, `npm run lint`, and
  `npm run build` themselves, then apply the new migration
  (`npx prisma migrate deploy`) before this reaches production.

## In progress (2026-09-03): pointsystem, betaling, besked-automatisering, admin-brugere

Large multi-part feature, approved via plan mode and then expanded further
mid-implementation by the user across several follow-up messages. Full
requirement list: `docs/POINTS_MESSAGING_CHECKLIST.md`. Architectural
decisions: `docs/DECISIONS.md` (2026-09-02/03 entries).

Done so far:
- Prisma schema extended (points ledger, bug reports, message
  templates/outbound queue, notification preferences, push subscriptions,
  forwards, subscriptions/payment methods, admin audit log, `User.locale`,
  `User.referralCode`, `User.forgottenAt`, `Product.approvalToken`/
  `escalationSentAt`). Two migrations were **hand-written** (`prisma/migrations/
  20260902020000_points_messaging_forwards`, `.../20260902030000_payments_referrals_admin_users`)
  because there is no local database on this workstation to run
  `prisma migrate dev` against — validated with `prisma validate` +
  `prisma generate` + `tsc --noEmit` only, NOT yet applied to a real
  database. **Must be reviewed and applied via `prisma migrate deploy` on
  the next Synology release, and verified there before trusting the SQL.**
- Core lib layer: `src/lib/points.ts` (ledger, 50/month forward cap, 300→1
  free month redemption), `src/lib/messaging.ts` (template rendering +
  notification-preference gating + `OutboundMessage` queue), `src/lib/mailer.ts`
  (nodemailer, no-op until `SMTP_*` env vars exist), `src/lib/push.ts`
  (web-push, no-op until `VAPID_*` env vars exist), `src/lib/gdpr.ts`
  (anonymize, not hard-delete), `src/lib/scheduler.ts` + root `instrumentation.ts`
  (in-process 48h escalation + queue flush, DB-driven, not OS-cron —
  deliberately not Synology-specific per user instruction).
- `src/lib/referrals.ts` and `POST /api/auth/register` rewritten: referral
  attribution now works via `User.referralCode` in the signup body: both
  referrer and new user get 300 points (not a direct free month) once the
  existing 3-month wait passes.
- **Blocking gap found and fixed**: every regular-user route in the app used
  a single shared `getDemoUser()` (`src/lib/demo-user.ts`) — there was no
  real per-user login/session at all (matches the pre-existing "Next work"
  #4 item below). Points, bug reports, forwarding between two people,
  referral attribution, and per-user notification preferences are all
  meaningless without distinct logged-in users, so this had to be built
  first: `src/lib/user-auth.ts` + `src/lib/session.ts` (JWT session cookie,
  same pattern as `src/lib/admin-auth.ts`, deliberately separate
  cookie/secret from the admin session), `POST /api/auth/login`,
  `POST /api/auth/logout`, and `POST /api/auth/register` now sets the
  session cookie on success. `/login` (previously a non-functional mockup
  with a permanently disabled button) now has a real working email/password
  form; `/signup` now captures `?ref=<code>` and passes it through. Existing
  routes that still use `getDemoUser()` were deliberately left as-is — fully
  migrating the rest of the app to real sessions is a larger, separate piece
  of work, not bundled into this feature.

**Update 2026-09-03, later same day: feature is code-complete.** Everything
in `docs/POINTS_MESSAGING_CHECKLIST.md` is implemented — product-approval
points hooks + admin bruger-indsendte/auto-importerede tabs, bug reports end
to end, `/betingelser` + banner updates, login-free
`/admin/approve/[token]` mail-approval page (exempted from the admin-session
middleware gate via its unguessable token instead), "Besked automatisering"
admin tab (template editor + outbound log), `/profile/notifications` (two
entry points), "Invitér en ven" UI, "Videresend til en ven" end to end
(claim-time cross-send abuse check, flag surfaced in the existing Advarsler
page), "Betaling" page (provider-agnostic, no raw card fields — see
`docs/DECISIONS.md` for why), admin "Brugere" page (cross-host impersonation
via a 2-minute handoff token, GDPR anonymize, payment/newsletter overview),
admin DA/EN switch (nav + new-page titles; older admin pages stay Danish-only
for now). A third migration was added:
`prisma/migrations/20260902040000_product_created_by_user` (adds
`Product.createdByUserId`, needed so points can be attributed to whoever
actually submitted a product). `npm run lint` and `npm run build` are both
green against the full new surface (verified repeatedly as each piece was
added, most recently after the i18n switch).

**Not done, and out of scope for this pass:**
- No browser verification anywhere — this workstation has no local database
  (see "No local DB" note elsewhere in this file), so nothing has been
  clicked through in a real browser yet, only compiled/typechecked. Do that
  after deploy, per the checklist's verification section.
- `ACCOUNT_CREATED`/`EMAIL_VERIFICATION` message templates still exist but
  nothing calls `queueMessage()` for them. `PASSWORD_RESET` is now wired (see
  2026-09-12 "forgot password" entry below) — only account-created/email-
  verification remain unimplemented from this trio.
- No real payment method can be added yet — deliberate, see `docs/DECISIONS.md`
  (no PSP chosen, and raw card fields are never appropriate without one).

**New environment variables this feature needs in `.env.production`** (not
added to `.env.production.example` in this pass — that file already has an
unrelated uncommitted addition in progress, `PASSIO_API_KEY`, so a separate
edit avoids colliding with it; fold these in next time that file is touched):
- `USER_SESSION_SECRET` — required, same rules as `ADMIN_SESSION_SECRET`
  (long random secret, falls back to `ADMIN_SESSION_SECRET` if unset, but a
  distinct value is safer). Changing it invalidates all regular-user sessions.
- `ADMIN_NOTIFICATION_EMAIL` — where 48h escalation mails go; defaults to
  `peter@packroff.dk` if unset.
- `ADMIN_BASE_URL` — defaults to `https://adminhellocal.packroff.dk`; only
  needed if that hostname ever changes.
- `APP_BASE_URL` — defaults to `https://hellocal.packroff.dk`; used to build
  the impersonation handoff link.
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` —
  optional; email sending stays a no-op (queued, never sent) until all four
  required ones are set.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_CONTACT_EMAIL` —
  optional; generate with `npx web-push generate-vapid-keys`. Push sending
  stays a no-op until the two keys are set.

## Current checkpoint

- Repository: `Vandmollevej/hellocalvs2`
- Branch: `master`
- Latest published checkpoint: `27df53c` — isolated Synology production deployment.
- Production was updated to commit `10d64698a51ea550922be75f5c653ba034b5a2cb`
  on 2026-08-27 (Statistik real-data change). Backup taken first; `db` and
  `app` are healthy and `/api/health` returns `{"status":"ok"}`.
- Production was updated to commit `ef6e3da1d625ad2bd9366114c5ff2e6e469de20f`
  on 2026-08-27: Madvarer rows now link to the add-flow, and Søg shows real
  recent registrations instead of hardcoded example rows. Backup taken first;
  `db` and `app` are healthy and `/api/health` returns `{"status":"ok"}`.
- Production was updated to commit `1d272a0a7dafb843d857831b58077d5e92031283`
  on 2026-08-27: the full `hello-cal-nye-rettelser.md` fix batch (FAB, bottom
  nav, wheel, madliste, stat-cards + unused-cards page, stat chart, barcode
  fix, nutrition-label OCR, manual create-product page). Backup taken first;
  no new migration in this release; `db` and `app` are healthy and both the
  local and public `/api/health` return `{"status":"ok"}`.
- Production was updated to commit `1c121ae6f7ba0444039d08a5946a6efa4e2aaf32`
  on 2026-08-27: the Stemme (voice) screen now calls a real
  `/api/ai/interpret-meal` endpoint (OpenAI `gpt-4o-mini`) instead of showing
  three hardcoded example rows. Each spoken ingredient is matched against the
  local product database first; unmatched ones fall back to the AI's own
  macro estimate, shown with an "AI-estimat" badge, and approving now saves
  real registrations via `/api/registrations` (which creates a new `PENDING`
  candidate product for unmatched, AI-estimated items). Needs
  `OPENAI_API_KEY` in `.env.production` — verified live with a direct
  `curl` to `/api/ai/interpret-meal` returning real structured items.
- GitHub Actions built and published the production image successfully.
- The application is a Next.js 16 prototype with Prisma 7 and PostgreSQL.
- The stable UI checkpoint is committed as `ed2d27d`.
- USDA FoodData Central is now implemented as the second external barcode
  fallback after Open Food Facts. Imported products retain `externalSource`,
  `externalId`, and `sourceCheckedAt`, remain `PENDING`, and are stored in the
  local product database so registration snapshots stay authoritative. The
  fallback is enabled only when the server has `USDA_FDC_API_KEY`; the example
  environment and production Compose service include that variable. A live
  lookup through the new module returned the exact GTIN, FDC id, brand, and
  kcal/protein/carbohydrate/fat values for the USDA test product
  `737628064502`. Prisma format/validation, `npm run lint`, and `npm run build`
  passed on 2026-08-27. Migration
  `20260827170000_external_product_sources` still needs to be deployed with
  the application and the real USDA key added to Synology before production
  fallback becomes active.
- Product search (`/api/products`) now supplements local results with a live
  Open Food Facts text search (`src/lib/openFoodFacts.ts:searchOpenFoodFacts`),
  limited to Danish products (GS1 barcode prefix `57` + `countries_tags_en`
  filter) when local matches are fewer than 10. Matches are imported as
  `PENDING` products (same pattern as barcode lookup) so repeat searches for
  the same term don't re-fetch OFF. No bulk import of the OFF catalog exists
  or is planned — this is a live per-search fallback. `npm run lint` and
  `npm run build` passed on 2026-08-30.
- Meal-photo mode (`/camera?mode=meal`) is wired up end to end: capturing a
  photo now calls `/api/ai/analyze-meal-photo`, which sends it to Passio
  Nutrition-AI (`src/lib/passio.ts`) for plate segmentation, checks each
  ingredient against the local product database (same pattern as
  `interpret-meal`), and returns an editable list the user can trim before
  saving via `/api/registrations`. HelloFresh recipe matching is unchanged
  and still never calls Passio — only the general "scan a plate" flow does.
  Requires `PASSIO_API_KEY` (get one at accounts.passiolife.com); not yet set
  on Synology, so this is untested against the live Passio API. The detailed
  visual overlay/uncertain-ingredient UI from `docs/AI.md` is not built —
  this is a simple review list only. `npm run lint` and `npm run build`
  passed on 2026-09-03.

- 2026-09-11: Added installable-PWA support (`src/app/manifest.ts`,
  `src/app/apple-icon.png`, `public/icons/icon-192.png`/`icon-512.png`
  generated from the existing `src/app/icon.png` mark, `appleWebApp`/
  `themeColor` metadata in `src/app/layout.tsx`) so the header can actually
  match HelloFresh's native app header height when added to the home screen
  — see `docs/DECISIONS.md` (2026-09-11) for why a plain browser tab can
  never fully match it. Not yet verified: `npm run lint`/`npm run build`
  could not be run from this environment (no `npm` on PATH here — see
  `docs/STATUS.md`'s other "no local DB"-style workstation notes); run
  `npm run lint && npm run build` and then, on an actual iPhone, add
  `hellocal.packroff.dk` to the home screen and open it standalone to confirm
  the green `.hf-appbar` now extends behind the status bar.

## Validation

- `git diff --check`: passed on 2026-08-26.
- `npm run lint`: passed on 2026-08-26.
- `npx tsc --noEmit`: passed after the camera implementation on 2026-08-26.
- The freshly compiled `/kamera?mode=produkt` development route returned HTTP
  200 after the camera implementation on 2026-08-26.
- `npm run build`: passed after the camera implementation on 2026-08-26 with
  TypeScript validation enabled.
- Prisma schema validation: passed on 2026-08-26.
- The initial SQL migration was generated and compared against the Prisma schema;
  they match.
- `compose.production.yaml` and the GitHub Actions workflow parse as valid YAML.
- The isolated Synology Compose stack is running with healthy application and
  PostgreSQL services; the migration service completed with exit code `0`.
- Production health, Open Food Facts lookup, registration snapshots, product
  search, database backup, restart, and persistence passed on 2026-08-26.
- The temporary Cloudflare hostname `hellocal-test.packroff.dk` was verified and
  then removed after the permanent route passed its public check.
- The permanent hostname `hellocal.packroff.dk` was added and verified publicly
  against the same isolated application on 2026-08-26.
- The production rollout for commit `7c8f6cb` completed successfully. The
  application returns `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet,
  noimageindex`, and its health endpoint remains healthy.
- The home screen now reads the demo user's registrations directly from
  PostgreSQL. Creating a registration, viewing it, and deleting it use the same
  database records instead of example rows.
- The Madvarer screen now reads the product list from PostgreSQL and searches
  those real products instead of showing example food rows.
- The responsive app shell now removes the simulated phone frame on phones and
  other coarse-pointer devices while preserving it for desktop presentation.
- The Stemme screen now places the live transcript above detected food entries,
  shows a pulsing stand-microphone indicator during AI processing, and lets the
  user edit daily-meal-style rows before approval.
- The Stemme screen now requests real microphone access and uses the browser's
  Danish speech-recognition service for live interim and final transcription.
  Structured food interpretation remains placeholder data until the AI service
  is connected.
- Calendar goal completion now uses a subtle 1 px green outline and light-green
  corner checkmark; the current date keeps the solid green highlight.
- The calendar now supports horizontal swipe and arrow navigation, a full
  month picker, and month, week, and list views from the top-right view menu.
- Every date opens a full day view. Its registration list reads real
  PostgreSQL registrations filtered by date, using the same `/api/registrations`
  data as the home screen.
- The home-screen key-metric wheel is interactive by vertical swipe, mouse
  wheel, adjacent-item tap, and keyboard arrows. Calories and protein are
  calculated from today's PostgreSQL registration snapshots; activity metrics
  remain prototype values until health integration is connected.
- The Kamera screen now requests the device's rear-facing camera. Product mode
  continuously scans real one-dimensional barcodes with ZXing, looks them up
  through the existing local/Open Food Facts endpoint, and opens the real
  add-product flow when a match is found. Manual barcode entry remains as a
  fallback.
- Meal mode now shows the live camera with the specified plate guide and can
  capture and retake a local photo preview. AI meal interpretation and upload
  remain separate future work.
- The production demo user was populated on 2026-08-26 with four non-duplicate
  food registrations for the current day (1,044 kcal and 10 g protein total),
  using the existing product lookup and registration APIs.
- The Statistik screen now reads the demo user's real registrations from
  PostgreSQL: the weekly-average kcal chart, average kcal/protein per day,
  days logged, and days the calorie goal was met are computed from actual
  data instead of hardcoded example numbers. The key-metric wheel now shares
  the same daily calorie/protein goal constants (`src/lib/goals.ts`) instead
  of duplicating them. Water, calories burned, and steps remain prototype
  values pending health-data integration.

## Deployment implementation

- `compose.production.yaml` defines the isolated `hellocal-v2` application,
  migration, and PostgreSQL 17 services.
- The new stack uses host port `3100` and persistent data below
  `/volume1/docker/App/hellocal-v2`.
- PostgreSQL has no published host port. Migrations must finish successfully
  before the application starts.
- `/api/health` verifies both the Next.js process and its database connection.
- GitHub Actions publishes both `latest` and immutable Git SHA image tags.
- GHCR authentication, first deployment, update, backup, rollback, and
  Cloudflare test cutover are documented in `docs/DEPLOYMENT.md`.

## Confirmed Synology inventory

- The stopped legacy HELLO CAL stack remains in
  `/volume1/docker/App/hellocal` and must not be changed.
- Its PostgreSQL 17 data is bind-mounted from
  `/volume1/docker/App/hellocal/postgres`.
- The legacy app, API, PostgreSQL, MinIO, and Redis containers were stopped when
  inspected on 2026-08-26.
- The existing `Cloudflare_Tunnel` container was running.

- Added and deployed `scripts/image-agent`: a Python service (Docker) that
  polls for brandless, approved products missing an image, searches Google
  Custom Search for a high-resolution candidate, removes the background with
  `rembg`, and writes the result as `Product.pendingImageUrl`
  (`imageStatus = PENDING`). It never sets the live `imageUrl` directly —
  admin approval to promote it is still future work (no UI yet). Added via
  `compose.production.yaml` (new `image-agent` service, shared
  `data/product-images` volume) and Prisma migration
  `20260827120000_product_image_status`. The Google Programmable Search
  Engine (`hellocal-images`, cx `f25aa8ec646534e07`) is scoped to
  `commons.wikimedia.org` only — Google no longer allows new engines to
  search the whole web, and Wikimedia Commons images are freely licensed,
  avoiding copyright risk from scraping arbitrary Google Images results.
  `DATABASE_URL`'s Prisma-only `?schema=public` query param is stripped
  before use since psycopg2/libpq rejects it. Verified running in production
  on 2026-08-27 (`no products waiting for an image` — connects fine, just no
  current candidates). The server's `compose.production.yaml` and
  `scripts/image-agent/` had to be updated by hand outside the normal
  `HELLOCAL_TAG` bump flow, since this was the stack's first new service —
  ordinary code changes still only need the 3-step controlled update.

- The Statistik screen chart now supports multiple dataserier (kalorier +
  vægt from `WeightEntry`), each independently normalized, with a legend and
  a small non-fullscreen dropdown (persisted to `localStorage`) to choose
  which series show. The stat-card grid below it is now modular: long-press
  enters an edit mode (cards wobble), cards can be drag-reordered or dragged
  into/out of a scrollable "ubrugte kort" panel (positioned above/below by
  available space), and a draggable "Overskrift" template creates a
  renameable full-width divider row. Layout is persisted to `localStorage`
  (`src/components/StatChart.tsx`, `src/components/StatCardsGrid.tsx`,
  `src/lib/stat-cards.ts`). `npm run lint` passed; `npm run build` could not
  be run — a concurrent session's dev server holds a lock on `.next/static`
  (`EPERM: operation not permitted, unlink`). Re-run the build once no other
  session has the dev server active.
- The home-screen FAB (`src/components/AddButton.tsx`) is now a dark
  (`--hf-fab`) rounded-square button matching the HelloFresh reference —
  thin white plus, no circle/outline/shadow, ~64px, 14px corner radius.
  Long-pressing it enters drag mode with a ghost preview and a snap outline;
  releasing snaps it to the left or right edge at the chosen vertical
  position, and the choice persists via `localStorage`
  (`src/components/AddButton.tsx`'s `useFabPosition`, a
  `useSyncExternalStore` hook). `StatsWheel` and `OnboardingSpotlight`
  (`src/components/StatsWheel.tsx`, `src/components/OnboardingSpotlight.tsx`)
  now read the FAB's side and always render on the opposite side, sliding
  when it changes. `npm run lint` passed; `npm run build` could not be run
  for the same concurrent-session `.next/static` lock as above. Verified
  interactively against the other session's already-running dev server:
  computed FAB styles (64x64, 14px radius, `rgb(35,35,35)`, no shadow), a
  simulated long-press drag correctly showed the ghost/snap outline and
  committed the side + vertical offset, and `StatsWheel` swapped sides in
  response. The concurrent session's own edits caused frequent Fast Refresh
  reloads and some 503s on that shared dev server during testing, which made
  one reload-persistence check unreliable; re-verify that specific case
  (reload the page after moving the FAB, confirm it stays put) once no other
  session is editing concurrently.

- The bottom nav icons are now larger (30px, matching HelloFresh's bottom-tab
  proportions from the reference screenshots) and no longer sit inside a
  background shape, matching HelloFresh's own plain-icon tab bar. Long-pressing
  any bottom-nav icon enters an iOS-style jiggle edit mode: active icons can be
  dragged to reorder or removed with a small ×, and a panel slides up above the
  bar listing unused functions (Kamera, Søg, Stemme, Profil) that can be
  dragged (or tapped) into the bar. The arrangement persists in `localStorage`
  per browser, not in the database.

- The calendar month/week views now show a calm red marker on days the goal
  was missed (alongside the existing green marker for days it was met), and
  the month footer below the grid replaces the old legend with a monthly
  status summary: whether the user is within their calorie goal (and by how
  much), a 7-day over/under summary, and a "X of Y days" goal count. A green
  star streak badge with a day count appears once the goal has been met at
  least 5 days running and disappears immediately the streak breaks
  (`src/app/kalender/page.tsx`, `MonthlyStatus`). `daily-totals.ts` now
  exports `groupByDay` for reuse. This reverses the prior "no red markers, no
  streaks" principle per the updated `docs/SPECIFICATION.md`/`docs/UI.md`;
  see `docs/DECISIONS.md` (2026-08-27). `npm run lint` passed (only
  pre-existing unused-var warnings in `kalender/page.tsx`); `npm run build`
  still could not be run — the `.next/static` `EPERM` lock from a concurrent
  session persists.

- SET-01 (Opsætningsguide, `docs/UI-KRAVSPEC-2026-08-27.md` §8): implemented.
  A fullscreen `OnboardingWizard` (`src/components/OnboardingWizard.tsx`)
  shows on the home screen for a user who hasn't completed or dismissed it,
  with a progress bar ("Trin X af Y") and Næste / Påmind mig senere / Vis
  ikke igen (the last only appears after "Påmind mig senere" was used once).
  Implements the three specified questions: sleep pattern → shift-work/night
  work → daily work-hours-vs-sleep-times logging preference; smartwatch/health
  import ("Opsæt nu" as the single primary action, otherwise "Næste"); and
  work-hours-in-calendar. New `User` fields (`dailyLogPreference`,
  `workHoursInCalendarEnabled`, `healthImportRequested`, `onboardingStep`,
  `onboardingCompletedAt`, `onboardingRemindLaterAt`, `onboardingDismissed`)
  were added via Prisma migration `20260827160000_onboarding_wizard`.
  `/api/profile` PATCH now accepts these fields. Progress and the health
  import toggle are also reachable from Profil (`Sundhedsdata (smartwatch)`,
  and a per-weekday work-hours-in-calendar checkbox on `/profil/soevn`); the
  guide can be restarted from Indstillinger. Only the three specified
  questions exist — the "10 trin" example step count in the spec is
  illustrative, and remaining onboarding content (goals/activity level etc.)
  is unspecified pending further product decisions; see `docs/DECISIONS.md`
  (2026-08-27). `npm run lint` and `npm run build` passed. The migration
  could **not** be applied — no local PostgreSQL is reachable at
  `localhost:5432` in this environment (no docker CLI, no local compose file)
  — and the wizard could not be exercised against live data as a result
  (`/api/profile` returned 503 on the shared dev server too). Apply
  `npx prisma migrate deploy` and verify the wizard end-to-end once a
  reachable database (local or the Synology deployment pipeline) is
  available.

## Design checklist (docs/DESIGN_V2.md)

Pr. 2026-08-27, mod den udvidede UI-tjekliste i `docs/DESIGN_V2.md`:

- CAL-01/02/03/04 (månedsvisning, månedsstatus, listevisning, landskab/dagsvisning): implementeret i tidligere checkpoints.
- CAL-05 (søvnvisualisering: grå baggrund for sovetid + langt-tryk-og-træk-justering med "kun denne dato"/"standardmønster") is now implemented in `src/app/kalender/page.tsx` (`SleepBands`, `SleepBoundaryHandle`), using the existing `SleepSchedule`/`WorkShift` models and `/api/sleep-schedule`, `/api/work-shifts` endpoints. `npm run lint` and `npm run build` passed. Live/browser verification against the running dev server was not possible — `/api/health` returned 503 while a concurrent session had the database down; re-verify visually (drag the sleep/wake boundary in landscape and in day view, confirm the "kun denne dato"/"standardmønster" prompt and persistence) once the database is back up.
- USR-01/USR-02 (søvnmønster, skiftende arbejdstider): implementeret (`/profil/soevn`, `/api/profile`).
- SET-01 (opsætningsguide): delvist implementeret (`OnboardingWizard`, kun de 3 specificerede spørgsmål).
- STA-01/STA-02 (statistik-graf med flere dataserier, modulære statistik-kort): implementeret.
- FOOD-03 (accordion/chevron) has an existing `AccordionCard` component; not yet re-verified against `DESIGN_V2.md` §14's exact chevron spec.
- NAV-01 (bundmenu-ikonstørrelse/omarrangering) and FAB-01 (FAB-visuelt redesign/side-bytte med statushjul) are implemented (see the entries above dated 2026-08-27 in this file).
- DES-01 (statistik-kort HelloFresh-visuel), FOOD-01/FOOD-02 (madvareside hero/tags/metadata/CTA på `/madvarer`): not yet implemented — no matching UI found in the codebase.
- DES-02 (fælles palette-/komponent-konsistens-audit across the whole app against `DESIGN_V2.md` §15): not yet done as a dedicated pass.

- 2026-08-27: Implemented the full batch of fixes from `hello-cal-nye-rettelser.md`
  (11 areas), run as parallel background agents and then reconciled by hand:
  - FAB (`AddButton.tsx`): removed the visible box/border/shadow — only the
    plus glyph renders (now `--hf-fab`-colored since the dark background box
    is gone; it was left white by mistake mid-batch and would have been
    invisible, caught and fixed during review). Drag/snap-to-edge behavior and
    its transparent same-size hit area are unchanged. `document.body` gets
    `select-none` toggled during drag so page text can't be selected.
  - Bottom nav (`AppScreen.tsx`): now `sticky bottom-0` in a `h-full
    overflow-hidden` shell so only the content area scrolls; the nav never
    moves with page content. Desktop phone-frame behavior preserved.
  - Wheel (`StatsWheel.tsx`): green circle untouched; values now offset
    progressively by distance from the active index (continuous curve/depth
    instead of binary prev/next), font-size/opacity scale continuously
    (fisheye), and drag position/snap animate continuously instead of
    jumping. Added an "Anretning" plate+cutlery stat icon.
  - Madliste (`DailyList.tsx`): thumbnail image is now centered in its box;
    "Oprettet" label removed (only "Kl. {time}" remains); calories always
    show as `{kcal} / 100 g` computed from `kcalSnapshot`/`amountGrams`; a
    `IconChevronRight` was added and the whole row stays one `Link`. No
    per-unit/serving-size field exists on `Product`/`Registration`, so the
    optional "Pr. stk." secondary line was not added — would need a schema
    change.
  - Statistik cards (`StatCardsGrid.tsx`, `src/lib/stat-cards.ts`): removed
    the "Færdig" button — edit mode now exits via a full-screen tap-outside
    backdrop (same pattern as `StatChart`'s dropdown) or by navigating away.
    The old inline "ubrugte kort" floating panel was replaced by a dedicated
    route, `src/app/statistik/ubrugte-kort/page.tsx`, grouped into the 5
    specified categories; only "Energi og makrofordeling" and "Aktivitet og
    øvrige data" currently have matching cards — "Kulhydrattyper og fibre",
    "Vitaminer", and "Mineraler" render with an empty-state note since no
    such stat types exist yet in this codebase (none were invented). Added
    `DEFAULT_ACTIVE_STAT_KEYS` export to `stat-cards.ts` (missing after the
    refactor, causing a build failure — fixed during review).
  - Statistik chart (`StatChart.tsx`, `statistik/page.tsx`): the "Kalorier"
    dropdown chevron now sits directly beside the label as one clickable
    row. The kcal series now plots deviation from `DAILY_KCAL_GOAL` around a
    "Mål · 0" center line (green under goal, dark over goal, matching the
    calendar's color convention). Weight has no goal field anywhere in the
    schema, so its series still plots raw values — implementing weight
    deviation would need a new `User`/`WeightEntry` target-weight field.
    Fixed a `p.deviation` type error (`normalize()` now returns the same
    shape as `normalizeDeviation()`) found during the build/type-check pass.
  - Barcode scanning (`kamera/page.tsx`): root cause was that the ZXing
    decode callback ignored its `error` argument, so any fatal decoder error
    (anything other than the expected per-frame `NotFoundException`/
    `ChecksumException`/`FormatException`) silently froze the camera with no
    feedback. Now surfaces `cameraStatus = "error"` (existing error overlay +
    retry button) on any real failure. Barcode format support was already
    correct (`MultiFormatOneDReader` covers EAN-13/UPC/Code39/128/ITF/RSS).
  - Nutrition-label photo scanning: this was entirely unbuilt (only
    `produkt`/`maaltid` camera modes existed). Added a third `naering` mode
    to `/kamera` with client-side OCR (`tesseract.js`, new dependency) via
    `src/lib/nutrition-ocr.ts`, parsing Danish nutrition-label keywords.
  - Manual product creation: neither the OCR flow nor the barcode
    "not found" fallback had anywhere to send the user — no manual
    create-product screen existed at all. Added
    `src/app/madvarer/nyt/page.tsx` as the one shared manual-create-product
    form (name + kcal/protein/carbs/fat per 100g → `POST /api/products` →
    `/tilfoej/[id]`). The `naering` OCR flow now writes its read values to
    `sessionStorage` and routes here instead of posting directly itself;
    the barcode "not found" state links here too; `/madvarer` also links
    here directly for a fully manual entry.
  - After reconciling all seven agents' concurrent edits: `npm run lint`,
    `npx tsc --noEmit`, and `npm run build` all pass clean (the `.next/static`
    `EPERM` lock from a concurrent dev server cleared after a retry).

- 2026-08-27: Added a `FRIDA` value on `ExternalProductSource` (Prisma
  migration `20260827180000_frida_product_source`) and a new
  `frida_import_state` table (migration `20260827190000_frida_import_state`)
  — neither yet applied to production. DTU Fødevareinstituttet's Frida
  database (Danish food composition data) has no reuse API on its own site
  (`fcdb.fooddata.dk` only exposes an undocumented internal API behind its
  own frontend), but its dataset downloads are published to DTU's official
  Figshare-based research-data repository (`data.dtu.dk`, DOI
  `10.11583/DTU.32312844` for v6.1), which *does* have a real, public,
  documented, unauthenticated API (`api.figshare.com`) — CC-BY 4.0 licensed.
  DTU Food's Figshare group id is `18053`.

  Added `scripts/frida-import` as a new always-on service (`frida-agent` in
  `compose.production.yaml`, same pattern as `scripts/image-agent`): it polls
  `api.figshare.com/v2/articles/search` (default every 24h,
  `FRIDA_AGENT_POLL_INTERVAL_SECONDS`) for the newest article titled "Danish
  Food Composition Database" under group 18053, checks `frida_import_state`
  for whether that Figshare article id was already imported, and if not,
  downloads its `.xlsx` file directly (no browser/manual step), parses the
  `Food` and `Data_Normalised` sheets (openpyxl) for the four core macros
  (Energi kcal/Protein/Kulhydrat difference/Fedt, ParameterIDs
  356/218/170/141), and upserts them into `products` as
  `externalSource='FRIDA'`, `status='APPROVED'`, no barcode — matched on
  (`externalSource`, `externalId`=Frida FoodID) so a new release updates
  existing rows instead of duplicating them. 1389 of 1390 Frida foods have
  all four values. Verified end-to-end locally against the live Figshare API
  (finds v6.1, downloads, parses 1389 foods) except the final Postgres
  write — this workstation has no reachable PostgreSQL (see
  `hellocal_no_local_db` memory). A static Frida attribution line was added
  to `/madvarer` per Frida's reuse terms. `npm run lint`, `npx prisma
  validate`, `npm run build`, and `compose.production.yaml`'s YAML all
  passed. The manually-downloaded xlsx originally placed at
  `scripts/frida-import/data/` is no longer needed by the running service
  (kept locally, gitignored) — the agent downloads directly from Figshare.

- 2026-08-27: Added an admin product/image approval UI (see
  `docs/DECISIONS.md`) at `adminhellocal.packroff.dk` — `/admin` (counts),
  `/admin/produkter` (approve/reject `PENDING` products), `/admin/billeder`
  (accept/reject the image-agent's suggested photos). First visit to that
  hostname goes to `/admin/setup` to create the one admin account
  (email + password + TOTP QR code); afterwards `/admin/login` →
  `/admin/verify` (TOTP). New `User.passwordHash`/`User.totpSecret` columns
  via Prisma migration `20260827200000_admin_auth` (not yet applied to
  production) and a new `ADMIN_SESSION_SECRET` env var (added to
  `.env.production.example` and `compose.production.yaml`, not yet set on the
  server). `npm run lint` and `npm run build` passed (the `.next` cache had
  to be cleared first — an `EPERM` on `.next/static` from a stale/concurrent
  lock, same class of issue noted elsewhere in this file; a clean rebuild
  succeeded). Not yet verified against a live database or browser — no local
  PostgreSQL is reachable from this workstation (see `hellocal_no_local_db`
  memory). **The `adminhellocal.packroff.dk` Cloudflare Tunnel public
  hostname still needs to be added** (same target as the existing
  `hellocal.packroff.dk` route, `http://192.168.1.90:3100`) — this requires
  the Cloudflare dashboard login/SSO, which was not something available to
  do unattended; the user needs to add it (Zero Trust → Networks → Tunnels →
  the existing `Server` tunnel → Public Hostname → Add a public hostname).

- 2026-08-28: Added passkey (WebAuthn/Face ID) login for the admin account
  as an alternative to password + TOTP (see `docs/DECISIONS.md`).
  `@simplewebauthn/server` and `@simplewebauthn/browser`; new `Passkey`
  table via Prisma migration `20260828170000_admin_passkeys` (not yet
  applied to production, same as the other pending admin-auth migration).
  `/admin/setup` now signs the new admin straight into a session after TOTP
  confirmation instead of sending them to `/admin/login`, so they land on
  the new `/admin/passkeys` page and can add a passkey (e.g. their iPhone's
  Face ID via iCloud Keychain) immediately. `/admin/login` gained a
  "Log ind med Face ID / passkey" button for a usernameless/discoverable
  login — a verified passkey grants a full session directly, skipping the
  separate TOTP step. `npm run lint` and `npm run build` passed. Could not
  be exercised end-to-end — no WebAuthn-capable browser/authenticator is
  available on this workstation and no local PostgreSQL is reachable (see
  `hellocal_no_local_db` memory); verify the whole flow (add a passkey,
  then log in with only Face ID) from an iPhone once deployed.

- 2026-08-28: Reworked the calendar day-detail view
  (`src/app/kalender/page.tsx`) per direct user feedback: the app's own
  header/bottom nav now stay visible behind it (`HfScreen`'s content wrapper
  is `relative` so the modal's `absolute inset-0` no longer escapes to the
  viewport); the header gained prev/next chevrons and a calendar icon
  (swipe still works too), and the Danish month name no longer gets
  wrongly capitalized (`capitalize` replaced with `first-letter:uppercase`).
  Removed invented copy ("Flot balance i dagens registreringer" etc.); an
  empty day now shows a plain gray "Ingen registreringer" beside the
  "Registreringer" heading instead of a bold box, and the bottom of the
  view now always shows "Mål: X kcal" plus remaining/overskredet kcal.
  The sleep visualization no longer disappears when the user has no
  sleep schedule set (falls back to a dummy 23:00–07:00 window) and is
  now a single continuous light-gray band with one draggable dark center
  handle instead of two edge handles; the whole hour grid is rotated so
  the day's wake-up hour is always the first row (`rotatedTop` in
  `kalender/page.tsx`). Each hour is now its own row showing a bold kcal
  total (when logged) and a chevron that opens a per-hour drill-down list
  (`HourEntriesOverlay`) with a time-separator between distinct timestamps.
  Long-pressing an empty hour row (1s) shows a "Tilføj" bar that opens
  `/madvarer` pre-filled with that hour, which now carries `date`/`time`
  through to `/tilfoej/[id]`; that page gained an editable time field.
  `POST /api/registrations` now accepts an optional `createdAt` override
  (`src/app/api/registrations/route.ts`). `npm run lint` passed clean.
  `npm run build`'s TypeScript check currently fails, but only on
  unrelated concurrent-session WIP (`api/products/lookup/[barcode]`,
  `api/profile/route.ts` — Prisma schema/allergen work in progress, not
  part of this change); re-run the build once that session's changes
  settle. Not yet verified live in the browser (no reachable local
  PostgreSQL, see `hellocal_no_local_db` memory) — verify the rotated
  sleep band, hour drill-down, and time-prefilled add flow against
  `hellocal.packroff.dk` next.

- 2026-08-28: Extended `/tilfoej/[id]` (add-product screen) per direct user
  feedback: the product image is now bigger (190px) and sits higher on the
  screen instead of vertically centered. Added a "Detaljer" underlined link
  with a chevron-down beside the kcal line that smooth-scrolls to a new
  details section below the amount stepper/Tilføj button, containing an
  editable "Energifordeling" (slider + tap-to-type-a-number, extracted from
  `stemme/page.tsx`'s `MacroBar` into a shared `MacroSliderBar` component),
  an "Allergener" line, and "Ingredienser". Product now has
  `ingredientsText`/`allergens`/`additives` fields (Prisma migration
  `20260828120000_product_nutrition_details`), populated from Open Food
  Facts' `ingredients_text`/`allergens_tags`/`additives_tags` when a barcode
  is looked up (`src/lib/openFoodFacts.ts`, `src/lib/allergens.ts` maps OFF
  tags to the 14 EU-mandated allergens). Allergens only render when the user
  has turned on "Vis allergener" in a new `/profil/indstillinger` page, which
  also lists all 14 allergens as individual on/off checkboxes
  (`User.showAllergens`/`allergenVisibility` on the same migration) and shows
  the required "Vi henter data fra 3. part..." disclaimer. When a product has
  E-numbers, a green "E" badge + "E-tilsætningsstoffer" link appears beside
  Detaljer and a full list renders in the details section; tapping one opens
  an `AdditiveInfoModal` (white card, 1px border, X to close, click-outside
  to close) with a short factual description from a new curated
  `src/lib/additives.ts` (~50 common E-numbers) plus a
  general-information/third-party-data disclaimer — not sourced from live
  external research, since no such feed exists yet. `POST /api/registrations`
  now accepts optional `proteinSnapshot`/`carbsSnapshot`/`fatSnapshot`
  overrides even when `productId` is given, so slider edits on this screen
  are actually saved. `npm run lint` and `npx prisma validate` passed;
  `npm run build`'s TypeScript check passed clean, but the build itself
  currently fails prerendering `/madvarer` — that page is mid-edit by a
  concurrent session (unrelated `useSearchParams`/Suspense issue, not part of
  this change) and should resolve once that session's changes land. Not yet
  verified live (no reachable local PostgreSQL, see `hellocal_no_local_db`
  memory) — verify the new Detaljer scroll, allergen toggle, and E-number
  modal against `hellocal.packroff.dk` once deployed, and apply the new
  migration.

- 2026-08-28: Corrected a prior mistaken instruction (see `docs/DECISIONS.md`):
  screens/headers fill the full viewport edge-to-edge (HelloFresh-style), and
  the profile/user-menu circle moved from the top-right to the top-left corner
  of the standard header (`TopBar.tsx`, `hf/ScreenHeader.tsx`) to leave room
  for a close-cross on closable pages. `npm run lint` passed (TypeScript build
  check passed clean); the production build still fails prerendering
  `/madvarer` for the same unrelated concurrent-session `useSearchParams`
  issue already noted above, not caused by this change.

- 2026-08-28: Three FAB/add-flow features per direct user request
  (`hello-cal-nye-rettelser.md`'s successor feedback). (1) Restored the green
  half-circle behind the tilføj-menu (`src/components/AddButton.tsx`),
  smaller than the pre-removal version and flush against the FAB's edge,
  shown while the menu is open. Replaced the old two-tap "open, then tap an
  option" flow with a press-and-drag gesture: pressing the FAB and dragging
  toward one of the five fanned-out actions (without lifting) highlights and
  enlarges the nearest one live, and releasing over it navigates straight
  there; a plain tap still opens/closes the menu as before, and tapping an
  option directly still works too. In the same pass, a concurrent session
  had already dropped the FAB's drag-to-reposition/edge-snap feature
  (`useFabPosition`, `FabPosition`) in favor of a fixed left-edge FAB — this
  session's work builds on that fixed-position version rather than
  reintroducing dragging. (2) Added a shared hand-authored
  `IconPlateCutlery` (`src/components/icons/PlateCutlery.tsx`: plate with a
  fork on the left and knife on the right, tabler-outline style) and pointed
  both the FAB's "Måltid" action and the wheel's "Anretning" stat
  (`StatsWheel.tsx`) at it, replacing the old single-sided
  plate+bundled-cutlery icon and the plain crossed fork/knife glyph.
  (3) Built the "Egne retter" (own dishes) feature end to end against the
  `Dish`/`DishIngredient` Prisma models that already existed in schema but
  had no UI/API: a pot icon (`IconSoup`) FAB action opens a new
  `/opret-ret` page where ingredients are added by reusing the existing
  single-food add flow (search/barcode-scan/OCR-photo/manual-create) — each
  now accepts a `?for=ret` query param that swaps `/tilfoej/[id]`'s primary
  button to "Tilføj til ret", which appends the product to an in-progress
  ingredient list kept in `sessionStorage` (`src/lib/dish-draft.ts`) instead
  of registering it, then returns to `/opret-ret`. Saving there posts to the
  new `POST /api/dishes` (creates the dish + ingredients) and clears the
  draft. `GET/POST /api/dishes` and `GET /api/dishes/[id]` were added, and
  `POST /api/registrations` now also accepts `{ dishId, amountGrams }`,
  computing the snapshot from the sum of the dish's ingredients scaled to
  the logged amount — no new migration needed, `dishes`/`dish_ingredients`
  were already part of the initial migration. While fixing the build, also
  wrapped `/madvarer`'s `useSearchParams()` in a `Suspense` boundary (the
  concurrent-session issue flagged in the two entries above) since it was
  blocking verification of this work. `npm run lint` and `npm run build`
  both passed clean. Not yet verified live in the browser (no reachable
  local PostgreSQL, see `hellocal_no_local_db` memory) — verify the new
  drag-select gesture, the plate/cutlery icon, and the full opret-ret ->
  save -> dish flow against `hellocal.packroff.dk` once deployed.

- 2026-08-28: Added an E-number reference database at
  `scripts/e-numre/data/e_numre.csv` (343 rows, the full official EU-approved
  E-number range E100-E1521, one row per number/sub-number) with columns
  E-nummer, Internationalt navn, Dansk kaldenavn, Funktion, Risici,
  Forskningsafsnit, Link, Kilde. Compiled by 8 parallel research agents
  cross-checking EFSA opinions, the EU additives Annex II/III, and UK FSA's
  mirrored approved-additives list; conservative "ingen dokumenteret
  EU-specifik advarsel" wording used wherever no specific documented risk was
  found (no invented risks/studies). A Python screening tool,
  `scripts/e-numre/scan.py`, takes free text (e.g. an ingredient
  declaration) and reports which E-numbers it contains plus any not present
  in the local database. Not yet wired into the app (no UI, no product-page
  integration, no database table) — currently a standalone CSV +
  command-line tool only.

- 2026-08-28: Fixed the bottom nav so only 4 icons are ever visible at once,
  per direct user report that adding more icons kept cramming them into one
  row (`src/components/BottomNav.tsx`). Active icons are now paginated into
  fixed 4-slot pages (a `grid-cols-4` per page, so empty slots stay static
  gaps rather than the row re-centering); small dots above the bar show the
  current page when there's more than one. A horizontal drag on any icon (or
  an empty slot) that isn't a long-press swipes between pages, following the
  finger with a rubber-band edge and snapping on release — like a carousel,
  intentionally lighter-weight than an iOS-style hold-to-page delay since the
  user offered that as an acceptable simpler alternative. Long-press-to-reorder
  is unchanged (still reorders by nearest-icon-center, now scoped to only the
  current page's icons); dragging a reordered icon to within 36px of the bar's
  left/right edge for 650ms now flips to the adjacent page (iOS springboard
  style), so icons can be dragged across pages. `npm run lint` and
  `npx tsc --noEmit` passed clean. `npm run build` still fails prerendering
  `/madvarer` on the same unrelated concurrent-session issue noted above
  (not caused by this change). Verified live against the dev server by
  injecting 5-8 active icons via `localStorage` and driving synthetic
  pointer events: paging renders exactly 4 buttons per page with the extra
  icon alone on page 2 (3 static empty slots beside it), the page dots and
  `aria-hidden`/`translateX` state update correctly, a horizontal drag flips
  the visible page, and long-press still enters jiggle/edit mode. Not
  re-verified against real touch input on a phone.

- 2026-08-28: Wired the E-number reference database into the real database
  instead of a standalone CSV. Added an `Additive` Prisma model (table
  `additives`, migration `20260828130000_additives`, not yet applied to
  production) holding the 343 rows from `scripts/e-numre/data/e_numre.csv`
  (E100-E1521, sourced from EFSA/EU-forordning 1333/2008). Added
  `scripts/e-numre/import_to_db.py` (psycopg2, same DATABASE_URL convention as
  `scripts/frida-import`) to upsert the CSV into the table — run it after the
  migration is deployed. Added `GET /api/additives` returning the full table.
  `src/lib/additives.ts` now fetches from that endpoint (client-side cached)
  instead of a hardcoded ~50-entry map; `AdditiveInfoModal` and the
  E-tilsætningsstoffer list on `/tilfoej/[id]` were updated to the new async
  API and the modal now also shows Risici/Forskning/Link, not just a one-line
  description. `npx prisma validate`, `npm run lint`, and `npm run build` all
  passed. Not yet verified live (no reachable local PostgreSQL, see
  `hellocal_no_local_db` memory) — after deploying, run
  `npm run db:deploy` then `python scripts/e-numre/import_to_db.py` with
  `DATABASE_URL` set, and verify `/api/additives` and the product-page
  additive list/modal against real data.

- 2026-08-28: Started the Integrationer/sport/vægt-AI/kalender-gestures/
  statistik/indstillinger batch (see `docs/DECISIONS.md` for the health-API
  strategy the user chose). Checkpoints 1-4 done so far:
  - **Checkpoint 1 (datamodel):** new Prisma models `Integration`
    (userId+provider unique, OAuth token/status fields) and `Activity`
    (sportType/startedAt/durationMinutes/caloriesBurned/source), plus
    `WeightEntry.shoes` (`ShoesState`: ON/OFF/UNKNOWN) and
    `WeightEntry.source` (`WeightSource`: MANUAL/FITBIT/WITHINGS). Migration
    `20260828140000_integrations_activity_weight_source` (hand-written, no
    local Postgres to run `prisma migrate dev` — see `hellocal_no_local_db`
    memory).
  - **Checkpoint 2 (Integrationer-side + Fitbit/Withings OAuth):** new
    `src/lib/integrations.ts` (provider catalog: only FITBIT/WITHINGS are
    `connectable: true`; GARMIN/APPLE_HEALTH/GOOGLE_HEALTH render as static
    "kommer snart" cards) and `src/lib/integrations/{fitbit,withings}.ts`
    (real OAuth2 authorize/token-exchange/refresh + activity/weight fetch
    functions against the documented Fitbit Web API and Withings Health
    API). Routes: `GET /api/integrations`, and per-provider
    `connect`/`callback`/`disconnect`/`sync` under
    `/api/integrations/{fitbit,withings}/`. New page
    `src/app/settings/integrationer/page.tsx`, linked from a new
    "Integrationer" row in `src/app/settings/page.tsx`. New env vars
    (`FITBIT_CLIENT_ID/SECRET`, `WITHINGS_CLIENT_ID/SECRET`,
    `INTEGRATIONS_REDIRECT_BASE_URL`) added to `.env.production.example` and
    `compose.production.yaml` — **not yet set on the server**; the user needs
    to create developer apps at `dev.fitbit.com` and
    `developer.withings.com` (self-serve) before either integration can be
    tested live. Garmin needs separate partner approval (instructions were
    given to the user directly in chat, not stored in a doc).
  - **Checkpoint 3 (kalender sportsikon):** `kalender/page.tsx` now fetches
    `/api/activities` and shows each hour's sport icon
    (`src/lib/sport-icons.ts`, reused from `@tabler/icons-react`) plus its
    bonus calories in green (`+X kcal`) beside the existing kcal total.
  - **Checkpoint 4 (statistik sport-blokke):** `computeStatCards()`
    (`src/lib/stat-cards.ts`) now accepts an optional `activities` list and
    appends one dynamic `sport:<type>` card per sport type present;
    `statistik/page.tsx` and `statistik/ubrugte-kort/page.tsx` only pass
    activities through (and only show the new "Sport og aktivitet" category)
    when at least one connectable integration is `CONNECTED`.
  - `npm run lint`, `npx tsc --noEmit`, and `npm run build` all passed after
    checkpoint 4 (the `.next/static` `EPERM` lock from a concurrent session
    cleared on retry, same known issue as prior entries in this file). Not
    yet verified live (no reachable local PostgreSQL, and no real Fitbit/
    Withings credentials exist yet to exercise the OAuth flow end-to-end).
  - **Checkpoint 5 (vægt-guide + Trendvægt):** `/profil/vaegt-kalibrering`
    gained a fourth "Med sko"/"Uden sko" segmented control
    (`WeightEntry.shoes`), same pattern as the existing clothed/toilet/meal
    controls. New `src/lib/weight-trend.ts` computes an AI-estimated
    "Trendvægt" on the fly (separate exponential smoothing for morning vs.
    evening weigh-ins, nudged down when food was logged within ±2h) —
    plain TypeScript, not a Python/ML service (see `docs/DECISIONS.md`),
    never stored as its own row, and only shown once ≥5 samples exist. It
    now renders as a dashed third series on the Statistik chart
    (`StatChart.tsx` gained an optional `dashed` field) and as a small line
    under the weight field on Profil.
  - **Checkpoint 6 (kalender-gestures):** new shared `src/hooks/useLongPress.ts`
    (the 7 pre-existing hand-rolled long-press copies elsewhere in this
    codebase were left alone — out of scope). The day-detail timeline
    (`kalender/page.tsx`) now supports a two-finger vertical drag to zoom the
    hour scale up to 4× (persisted per-browser in `localStorage`), revealing
    15-/5-minute gridlines and, once zoomed, a draggable marker per
    registration (`DraggableEntryMarker`): a plain tap opens the
    registration, a ½s hold arms "move" mode showing a live `HH:MM · title`
    label, and dragging then releasing retimes it via a new
    `PATCH /api/registrations/[id]`. At the default (unzoomed) level the
    timeline is visually unchanged from before. See `docs/DECISIONS.md` for
    how this refines the older, never-implemented-for-calendar-rows
    "long-press = add new registration" rule.
  - **Checkpoint 7 (statistik intradag-kurve + måltids-AI):** new
    `src/components/IntradayKcalChart.tsx` renders a smooth (not bar) curve
    of average kcal by half-hour bucket across 00-24, below the existing
    Kalorier/vægt chart on `/statistik`. New `src/lib/meal-time-classifier.ts`
    buckets registrations into morgenmad/frokost/aftensmad by fixed
    time-of-day windows (a deliberately simplified v1 of `docs/AI.md`'s
    fuller hverdag/weekend/fødevaretype profiling) and shows the average
    time+kcal per meal as analytical text only — no registration is
    auto-tagged.
  - **Checkpoint 8 (indstillinger):** `/settings` now has a "Betaling" row as
    its very first item (links to a new placeholder `/settings/betaling` —
    no payment/subscription backend exists yet) and a green "Invitér en ven"
    bar at the bottom ("– Så får I begge en måned gratis") that uses
    `navigator.share` (clipboard fallback) — purely a share action, since
    there is no account/payment system yet to credit a reward against (see
    `docs/DECISIONS.md`).
  - `npm run lint`, `npx tsc --noEmit`, and `npm run build` all passed clean
    after checkpoint 8 — full route list built successfully (50 routes,
    including all new `/api/integrations/*`, `/settings/integrationer`,
    `/settings/betaling`). Not yet verified live in a browser (no reachable
    local PostgreSQL, see `hellocal_no_local_db` memory) and no real
    Fitbit/Withings developer credentials exist yet — verify the full batch
    end-to-end against `hellocal.packroff.dk` once deployed: weight-guide
    shoes field, Trendvægt display, two-finger timeline zoom + entry
    drag-to-retime, the new intraday chart, and the Betaling/Invitér rows.
    Apply the new migration
    (`20260828140000_integrations_activity_weight_source`) and set the new
    env vars (see `.env.production.example`) before that.
  - **Checkpoint 9 (HealthKit/Health Connect prep, added after the user
    relayed a ChatGPT architecture discussion):** see the 2026-08-28
    "HealthKit/Health Connect as the future integration hub" entry in
    `docs/DECISIONS.md` for the full reasoning. New `DeviceToken` and
    `HealthMetric` Prisma models (migration
    `20260828160000_healthkit_ingest_prep`, also extends `WeightSource`/
    `ActivitySource` with `APPLE_HEALTH`/`GOOGLE_HEALTH`); new
    `POST/GET /api/integrations/healthkit/tokens`,
    `DELETE .../tokens/[id]`, and a bearer-token-authenticated
    `POST /api/integrations/healthkit/ingest` (`src/lib/device-tokens.ts`
    for the SHA-256 hashing); new `GET /api/health-metrics`. The
    Integrationer page (`src/app/settings/integrationer/page.tsx`) gained a
    device-token management section (generate/list/revoke), and the Apple
    Health/Google Health cards are no longer fully dimmed (marked
    `ingestOnly` in `src/lib/integrations.ts`) since they now have a real,
    working action even without a companion app existing yet. The three
    previously-hardcoded Statistik placeholder cards (steps/water/burned)
    now read real `HealthMetric` averages once any exist. New
    `docs/HEALTHKIT_COMPANION.md` documents the full ingest contract +
    HealthKit-type mapping + a Swift reference snippet for whenever the
    native app itself gets built (needs a Mac + Xcode, not done in this
    session). `npm run lint`, `npx tsc --noEmit`, and `npm run build` all
    passed clean (61 routes). Not yet verified live for the same reasons as
    checkpoint 8 above; additionally, the ingest endpoint has no consuming
    app yet to test against beyond manual `curl` calls once deployed.

- 2026-08-29: Applied the newly uploaded Hello Cal logo/favicon assets: the
  lime-only mark is now `src/app/icon.png`/`apple-icon.png`/`favicon.ico`
  (Next.js's file-convention favicon, replacing the default placeholder), and
  the full wordmark now renders in the admin header
  (`src/components/admin/AdminNav.tsx`) instead of plain text. Source PNGs
  were cropped/square-padded from the uploaded files; originals left in the
  project root.
- 2026-08-29: Added `scripts/hellofresh-import` (new `hellofresh-agent`
  service) — see `docs/DECISIONS.md` for the full design (why `Product`/new
  `Ingredient`/`ProductIngredient` models instead of a separate `Recipe`
  model, why the sitemap instead of the "Se flere" API, the explicit
  copyright-risk decision, and known limitations: no cross-run dedup beyond
  matching `recipeId`, no per-ingredient vitamin/mineral estimate yet).
  New migration `20260829010000_hellofresh_catalog` (on top of the
  already-present `20260829000000_hellofresh_product_source` enum migration)
  adds `Product.nutritionExtra`, the `Ingredient`/`ProductIngredient` tables,
  and seeds the four `Category` rows (Retter/Menuer/Ingredienser/Færdigmad).
  Neither migration is applied to production yet. `compose.production.yaml`
  gained the `hellofresh-agent` service (reconciled with a concurrent
  session's already-present block — see `docs/DECISIONS.md`) plus a new
  `./data/hellofresh-images` volume mounted into both the agent and `app`.
  `npx prisma validate` and `npx tsc --noEmit` passed clean. `npm run lint`
  passed for every file touched by this work; it also surfaced two
  pre-existing errors in `src/app/kamera/page.tsx` and
  `src/app/tilfoej/[id]/page.tsx` (`react-hooks/set-state-in-effect`) from a
  concurrent session's in-progress `recognize-hellofresh` work, not caused by
  this change. `npm run build` still hit the known concurrent-session
  `.next/static` `EPERM` lock (see prior entries in this file) — re-run once
  no other session's dev server is active. Not yet run against a live
  database (see `hellocal_no_local_db`) — deploy both new migrations, then
  bring up `hellofresh-agent` to start the first import pass.
- 2026-08-29: Built the recognize-hellofresh/UI side referenced above (see
  `docs/DECISIONS.md` for the "Ret nr. isn't public, use AI photo recognition
  instead" decision): `POST /api/ai/recognize-hellofresh`,
  `src/components/HelloFreshMatchReview.tsx`, a `kamera` `?mode=hellofresh`
  capture flow, a "HelloFresh — Genkend din ret" entry row on `/madvarer`,
  and a generic portion-based amount stepper on `/tilfoej/[id]` for any
  product with `servingSizeGrams` set. The two `react-hooks/set-state-in-effect`
  lint errors the entry above attributes to this work are now fixed (moved
  the `setAmount`/`setRecognizeStatus` calls out of a bare effect body into
  the existing async `.then()` callbacks); `npm run lint` is clean again.
  `npx prisma generate` was re-run after the concurrent session's schema
  additions landed. `npm run build` (retried after the shared `.next/static`
  `EPERM` lock — confirmed held by the concurrent session's live `next dev`
  process, not stale — cleared) then passed clean: TypeScript, all 62 routes
  including `/api/ai/recognize-hellofresh` and `/tilfoej/[id]`. Not yet
  verified live in a browser (no reachable local PostgreSQL, see
  `hellocal_no_local_db`) — verify the HelloFresh camera-recognition flow and
  the portion stepper against `hellocal.packroff.dk` once both migrations are
  deployed and `hellofresh-agent` has imported at least one recipe.
- 2026-08-29: Deployed the accumulated pending migrations to production in
  one pass — Frida (`20260827180000`/`20260827190000`), admin passkeys
  (`20260828170000`), integrations/healthkit
  (`20260828140000`/`20260828160000`), and both HelloFresh migrations
  (`20260829000000`/`20260829010000`) — all 18 applied cleanly (`prisma
  migrate deploy` log: "All migrations have been successfully applied").
  Brought up `frida-agent` and the new `hellofresh-agent` service for the
  first time (`docker compose up -d --build`); `hellofresh-agent` found 6054
  recipe URLs in HelloFresh's sitemap and started importing (30/cycle, every
  2 minutes — full catalog takes a while but needs no manual step).
  `/api/health` verified `{"status":"ok"}` on the live server. Added
  `/volume1/docker/App/hellocal-v2/deploy.sh` (server-only, see
  `docs/DEPLOYMENT.md`) to collapse the controlled-update steps into one
  command — use it for future deploys instead of the manual sequence.
  See `docs/DEPLOYMENT.md`'s "Operational gotchas" note for the SFTP-chroot
  and terminal-paste quirks hit along the way.

- 2026-08-30: Completed a dedicated HelloFresh visual consistency audit without
  changing application code. Added root `design.md` as the binding visual
  contract and referenced it from `CLAUDE.md`. The contract corrects the source
  screenshot scale to 3x (1206x2622 -> 402x874), records the exact measured
  palette, typography, spacing/radius families, reusable component variants,
  and 33 concrete current-code/live-view deviations. The contract now also
  defines reusable padding roles for standard 16 px screen gutters, the
  measured 32 px editorial variant, cards, 48 px rows, fields, buttons,
  modals, images, app bars, action bars, bottom navigation, grids, and safe
  areas. It also includes a concrete, explicitly not-yet-implemented CSS
  blueprint for tokens, Tailwind theme mapping, the scoped app font root,
  typography, shell/appbar, a locked button taxonomy (appearance, size, form,
  loading/disabled states, icon/FAB and social login), fields/search, cards/rows,
  chevrons, imagery, action bars, bottom navigation, legacy aliases, and a
  controlled component-by-component migration. A fresh 402x874 local
  review covered `/velkommen`, `/logind`, `/tilmeld`, `/`, `/madvarer`,
  `/settings`, `/profil`, `/soeg`, `/statistik`, `/kalender`, `/stemme`, and
  `/kamera?mode=produkt`; database-backed states could not all load, but this
  exposed inconsistent short/error-state bottom-nav placement on Profil/Søg,
  clipped nav on Kalender, and nav below the viewport on Kamera. No lint/build
  was required because no runtime source was changed.
  On 2026-08-31, the contract was cross-checked against live computed styles
  from the official HelloFresh Denmark homepage at desktop and 402x874 mobile
  sizes plus its login page. The review confirms the core text, action, brand,
  page, secondary-text and field-border colors; 48 px primary controls; 4/8 px
  radii; 44 px icon hit area; and the 4/8-based spacing family. `design.md` now
  also records exact official web hover/active/focus colors and explicitly
  separates website-only Agrandir/Roboto, marketing green and social-provider
  variants from the primary iOS-app evidence.

- 2026-09-02: Implemented a batch of 13 requested UI/product changes (no local
  DB — verified with `npm run lint` + `npm run build` only, live verification
  pending per `hellocal_no_local_db`). Added `src/components/ui/Toggle.tsx`
  (standing rule: no checkboxes anywhere, see `docs/DECISIONS.md`) and
  `src/components/hf/HfChevron.tsx`; replaced all `type="checkbox"` and the
  literal "›" chevron. Added `src/components/hf/FullscreenAccordionRow.tsx`
  (fullscreen-takeover accordion, collapses back in place) and moved the
  profile's core fields into a new first "Profil" accordion item on
  `/profil`; renamed "Sundhedsdata" to "Integrationer" (now links to
  `/settings/integrationer`, no more "— opsat" suffix); added a "Kommunikation"
  accordion with 4 push/email preference toggles; added
  `/profil/billede-dagbog` (photo diary — photos stored client-side in
  localStorage only, no blob storage infra exists yet; the "requires phone
  passcode" toggle persists `User.photoDiaryRequiresPasscode` but has no real
  OS-level enforcement, future native-app work). Added `src/components/ui/WheelPicker.tsx`
  (iOS-style scroll picker, "Vælg" default, birth year scrolls to 1990) for
  fødselsår/højde. Added a weight "Opdateret d. X fra (enhed)" caption sourced
  from the latest `WeightEntry`. `/profil/soevn` now auto-fills Tirsdag-Fredag
  from Mandag's entry (still editable). `/profil/vaegt-kalibrering`'s
  time-of-day picker is now a side-by-side Morgen/Aften row with `HfChevron`.
  `/profil/indstillinger` now shows a setup progress bar (same pattern as
  `OnboardingWizard`) tracking region/allergener/vægtkalibrering. Added the
  `Referral` model + `User.freeMonthsCredited` + `src/lib/referrals.ts` for
  "Invitér en ven" reward bookkeeping (3 months → 1 free month, capped at 12) —
  this is data-model/logic only, since no real invite-link/attribution system
  exists yet (flagged explicitly, not faked). Hand-wrote migration
  `20260902000000_communication_photodiary_referrals` (not applied to any
  live DB from here).

- 2026-09-02: Started the design.md-driven visual migration (§11 order),
  step 1-2. Added the `.hf-type-*` typography classes (including
  `.hf-type-progress-active/inactive`, centered `page-title`/`category-title`)
  and the `.hf-appbar`/`.hf-appbar__slot`/`.hf-appbar__title` shell classes to
  `globals.css`, plus the missing `--hf-color-white`/`--hf-color-nav-legacy`
  tokens. Rewrote `ScreenHeader.tsx` to the fixed 44/1fr/44px slot grid with
  real `env(safe-area-inset-top)` instead of hardcoded `pt-9`: the profile
  circle is now always the left slot and a back arrow (never a cross/✕, see
  `docs/DECISIONS.md`) is the right slot on closable pages — this also fixes
  the DES-007/DES-032 profile-left/close-right violation on every screen that
  passed `onBack` (Profil, Indstillinger, Søvnmønster, Vægt kalibrering,
  Billede-dagbog, Betaling, Integrationer, Ubrugte statistik-kort). Also fixed
  the two kalender-internal custom headers (day-detail overlay, hour
  drill-down overlay) to use the same real safe-area padding instead of
  `pt-9`, and swapped the day-detail's chevron-left close button for the same
  arrow-left used everywhere else. `npm run lint` and `npm run build` both
  passed. Verified live against this session's own dev server (no reachable
  local PostgreSQL, see `hellocal_no_local_db`): `/settings` (top-level, no
  back arrow) and `/settings/integrationer` (with back arrow) both render the
  new appbar correctly at 402px width; kalender's day-detail overlay opens
  with the arrow-left close button and correct header height. Also fixed
  `BottomNav.tsx` (DES-012): the bar used the wrong `--hf-tan` (card)
  background instead of `--hf-tan-dark` (`--hf-color-nav`, `#DFD9CC`), the
  inactive icon/label color was `#4b4b4b` (an unrelated hover token) instead
  of `--hf-color-text-secondary` (`#656565`), and tab labels now use
  `.hf-type-tab` (12px) instead of a hardcoded 11px. Verified live:
  `/madvarer` shows the corrected nav background/colors.

  Continued into step 3 (shared primitives, DES-004/005/009/010): `.hf-card`
  radius is now 8px everywhere it was still 16-17px pill/rounded-2xl
  (`AccordionCard`, the settings promo/invite cards); `ChevronRow` is now a
  fixed 48px row with `.hf-type-body` (17/25) labels instead of a 56px
  `py-4` row with `text-[15px] font-medium`; `.hf-btn-primary`/
  `.hf-btn-secondary` radius corrected from a full pill to 8px (only the
  radius — the many call sites that size these buttons via local
  `py-*`/`text-*` for compact/small inline actions were deliberately left
  alone, since the class intentionally doesn't own height/padding yet; a
  real `--primary`/`--compact`/`--small`/`--full` modifier system per
  design.md §6.2 is still a separate follow-up). `.hf-search` is now a fixed
  48px field with 8px radius and the correct `--hf-color-line` border
  (was a full pill with the wrong `--hf-tan-dark` border) — used on
  `/madvarer` and `/soeg`. Settings page: card-group gap corrected from 16px
  to the contracted 32px. `npm run lint` and `npm run build` passed; verified
  live (`/settings`, `/madvarer`) against this session's dev server. Not yet
  done: the button size-variant system, and then the rest of the per-screen
  migration pass (statistik, kalender, stemme, kamera) per design.md §11 —
  continue from there.

- 2026-09-02: Migrated the auth/onboarding screens (design.md §11 step 4,
  clearest 1:1 references): /velkommen, /logind, /logind/land, /tilmeld.
  Added SocialLoginButton.tsx (correct provider colors: Google #4285F4 fill
  with a white icon zone, Apple #232323, Facebook #00178C — the prior
  Google button was white-with-border, Apple was the wrong near-black) and
  TextField.tsx (48px, auth variant 4px radius, .hf-type-input/label,
  placeholder now uses --hf-color-placeholder via a new
  .hf-type-input::placeholder rule). Fixed the 20px->16px gutter (DES-033),
  replaced every literal pt-9 with real safe-area padding, replaced the
  literal chevron character and IconChevronDown with HfChevron, replaced
  IconChevronLeft close buttons with IconArrowLeft (back-arrow-not-cross
  rule), and fixed /logind/land from individually-rounded/ringed cards to
  the reference's flat full-width 56px-row list with a plain checkmark for
  the selected country (DES-021). /velkommen's hero circle is now 180px
  (was 176px) with the correct 32px gaps; body copy moved from an invented
  15px to .hf-type-body-lg.

  Also fixed a lint-blocking issue unrelated to this change: another
  concurrent agent session's git worktree under .claude/worktrees/ had its
  own .next build output, which ESLint was traversing into (its .next/**
  ignore doesn't reach that deeply nested a path) — added .claude/** to
  eslint.config.mjs's ignores, since worktrees are never app source.

  npm run lint and npm run build both passed. Live browser verification was
  not possible this pass — a concurrent session holds Next.js's
  single-instance dev-server lock on this exact directory (next dev refuses
  a second instance even on a different port); re-verify /velkommen,
  /logind, /logind/land, and /tilmeld at 402px once no other session's dev
  server is active.

- 2026-09-02: Fixed the remaining 8px-radius (DES-004) violations on screens
  not touched by the concurrent statistik/profil-focused session: /madvarer
  (HelloFresh promo card, product-list container), /soeg (recently-added and
  results containers), /kamera (camera preview frame -> 12px radius-md since
  it's an image frame not a card; the barcode-lookup status card -> 8px),
  /settings/integrationer (notice banner, provider cards, device-token rows,
  device-code display block), /settings/betaling (placeholder card). Left
  the `rounded-full` status-badge pills alone (pills are a legitimate
  radius-round use, not a violation). `npm run lint` and `npm run build`
  passed. Live verification still blocked by the same concurrent session's
  Next.js dev-server directory lock (PID unchanged) — re-verify /madvarer,
  /soeg, /kamera, /settings/integrationer, /settings/betaling once free,
  alongside the auth screens noted above.

- 2026-09-02: Built the guided camera auto-recognition + product-creation
  flow (full design/reasoning in `docs/DECISIONS.md`). New routes
  `src/app/kamera/opret/page.tsx` (own camera bootstrap, does not touch the
  existing `/kamera` `produkt`/`maaltid`/`hellofresh` tabs) and
  `src/app/produkt/opret/page.tsx` (new create-product screen: masterdata
  form + the new 2x2 `CreateProductMediaGrid` — stregkode/næringsindhold/
  indholdsfortegnelse/produktbilleder, each behind a `NumberedBadge`).
  Recognition cascade is local-first (OCR via `tesseract.js`, fuzzy text
  match, average-hash image match, regex nutrition parsing) with two new AI
  routes (`/api/ai/recognize-product-photo`, `/api/ai/extract-nutrition`,
  same `gpt-4o-mini` pattern as `recognize-hellofresh`) only as the
  documented last resort; new supporting routes
  `/api/products/{recognize-text,generic-candidates,match-nutrition}`.
  `POST /api/products` now also accepts optional `barcode`/`imageUrl`/
  `ingredientsText`/`extraImages`. `design.md` §6.11 documents the new
  primitives (`NumberedBadge`, `HfBarcodeIcon`, `ScanningOverlay`, the
  banner/points cards — the points box is UI-only, no data model).

  While preparing to verify: found and fixed two pre-existing git
  merge-conflict-marker blocks in `src/components/StatCardsGrid.tsx`/
  `StatChart.tsx` (unrelated to this change, from a stash/pull conflict —
  see `docs/DECISIONS.md`), and a BigInt-literal/`tsconfig` `target: ES2017`
  incompatibility in the new `src/lib/image-similarity.ts` (fixed by using
  `BigInt(0)`/`BigInt(1)` instead of `0n`/`1n` literals). `npm run lint` and
  `npx tsc --noEmit` are both clean for every file this change touches.
  Full `npm run build` is currently still blocked, but only by an unrelated,
  actively in-progress concurrent session that appears to be duplicating the
  whole app's routing into English-named routes (`src/app/statistics/`,
  `src/app/product/create/`, etc. alongside the existing Danish routes) —
  same class of "concurrent session WIP blocks the build" issue noted
  repeatedly elsewhere in this file. Not yet verified live in a browser (no
  reachable local PostgreSQL, see `hellocal_no_local_db` memory) — once a
  database is reachable, exercise the full flow (product with visible text,
  a generic fruit/vegetable with no text, an unknown product all the way to
  the create page) against `hellocal.packroff.dk`, and re-run
  `npm run build` once the concurrent routing work settles.

## Next work

1. Implement the pending UI/design requirements in
   [docs/UI-KRAVSPEC-2026-08-27.md](UI-KRAVSPEC-2026-08-27.md) (calendar status
   markers, list/week view, sleep visualization, onboarding wizard, bottom nav
   editing, FAB, statistics cards, food page, accordion/chevron). None of it is
   implemented yet; mark items done here as they land.
2. Perform user acceptance testing through `hellocal.packroff.dk`, including on
   a phone.
3. Replace remaining prototype values (water, calories burned, steps) with
   real health-data integration once a source is chosen. Stemme's structured
   food interpretation remains placeholder pending the AI service.
4. Implement account authentication before inviting other users.
5. Copy verified database backups to a second storage location.
6. Keep the external SSH maintenance switch off outside maintenance windows
   (not used for the 2026-08-29 deploy — done from the home LAN directly).
7. ~~Deploy the Frida migrations and `frida-agent`~~ — done 2026-08-29;
   running in production. Known residual issue: the server-side
   `scripts/frida-import/` files are owned by a different user than `Peter`
   (a leftover from an earlier manual copy), so a plain `rm`/overwrite from
   the deploy flow fails with "Permission denied" — the currently-running
   `frida-agent` image is built from whatever version was already on disk,
   not necessarily the latest `agent.py` in this repo. Fix with
   `sudo rm -rf scripts/frida-import` once, then re-copy, next time
   `frida-import`'s code actually needs to change.
8. Admin-auth migrations are deployed and `ADMIN_SESSION_SECRET` is set
   (regenerated 2026-08-29 during the HelloFresh deploy — this invalidates
   any previously-issued admin session/JWT, not the Passkey records
   themselves). Still open: add the `adminhellocal.packroff.dk` Cloudflare
   Tunnel public hostname (same target as `hellocal.packroff.dk`,
   `http://192.168.1.90:3100`) — needs the Cloudflare dashboard login. Then
   open `https://adminhellocal.packroff.dk/admin/setup` once to create the
   admin account and add a passkey from `/admin/passkeys`; verify the
   "Log ind med Face ID / passkey" button from an iPhone once deployed.
9. Integrations/healthkit migrations are deployed. Still open: create Fitbit
   (`dev.fitbit.com/apps/new`) and Withings
   (`developer.withings.com/dashboard`) developer apps, each with redirect
   URI `https://hellocal.packroff.dk/api/integrations/<provider>/callback`,
   then set `FITBIT_CLIENT_ID/SECRET`, `WITHINGS_CLIENT_ID/SECRET`, and
   `INTEGRATIONS_REDIRECT_BASE_URL` in `.env.production` — only then can the
   Integrationer page's Fitbit/Withings connect flow be tested live. Garmin
   needs a separate partner-access application (instructions were given to
   the user directly in chat on 2026-08-28) before it can move beyond its
   current "kommer snart" card.
10. ~~Deploy the HelloFresh migrations and `hellofresh-agent`~~ — done
    2026-08-29; running in production, importing HelloFresh's ~6000-recipe
    catalog on its own (30 recipes/cycle, every 2 minutes — no manual step
    needed). Verify the camera-recognition flow and the portion stepper
    against `hellocal.packroff.dk` once it has imported enough of the
    current week's menu to test against.
11. Set `PASSIO_API_KEY` (get one at accounts.passiolife.com) in `.env` and
    `.env.production`/Synology so the meal-photo scan flow
    (`/camera?mode=meal` → `/api/ai/analyze-meal-photo` →
    `src/lib/passio.ts`, built 2026-09-03) actually works — untested against
    the live Passio API without it. Once a key exists, verify end to end on
    `hellocal.packroff.dk` (take a plate photo, confirm ingredients/grams
    come back and save correctly). The full visual overlay/uncertain-
    ingredient UI from `docs/AI.md`'s "Måltidsanalyse" section is still not
    built — only a simple editable review list exists so far.
~~12A. Hello Doc real external access~~ — done 2026-09-12 (see the dated
    entry above this list). Still open: revisit whether menstrual-cycle
    tracking should become a real feature (currently a disabled placeholder
    in the share-category list, since no such data exists anywhere in Hello
    Cal).
12. **Calendar "Tilføj" long-press → new full-screen add overlay** (requested
    2026-09-11, not yet designed or built): long-pressing an hour row in the
    calendar day/week timeline (`src/app/calendar/page.tsx`, `HourRow`)
    reveals an inline black "Tilføj" bar within that row. **Partially
    addressed 2026-09-19**: tapping that bar now opens `/add/menu` (the same
    all-elements list the front page's joystick "list" slot opens) instead of
    jumping straight to `/foods`, per an explicit user request made while
    building menstrual-cycle tracking. The bigger ask from this item — a
    dedicated new full-screen overlay design, rather than reusing the
    existing `/add/menu` list screen — is still open; the user will provide
    the actual design in a follow-up message. Also see the "Indberet fejl"
    skeleton page (`/registration/[id]/report-error`, added 2026-09-11) which
    has the same status: route exists, design pending.
~~13. Body-measurement entry page ("måleside")~~ — done 2026-09-12, same
    session/chat as the item that added the `BodyMeasurement` model, once the
    user explicitly said to continue here instead of a separate chat. See the
    dated entry below ("Kropsmål-side").
14. **Wire real `MenstrualCycleEntry` data into Hello Doc** (added
    2026-09-19): `src/lib/doctor-share.ts` still lists `menstrualCycle` in
    `DOCTOR_SHARE_UNAVAILABLE_CATEGORIES` with a comment saying no data model
    exists — that's now stale, since `MenstrualCycleEntry` was added the same
    day (see docs/DECISIONS.md 2026-09-19). Deliberately not wired up in that
    same pass to keep the change scoped to what was actually asked
    (settings toggle + calendar logging) — revisit when Hello Doc's real
    per-category data plumbing (`src/lib/doctor-share-data.ts`) is next
    touched.

15. **BUILT 2026-09-25** (see top entry; nightly robot still open).
    **New admin "Uncertainties" page** (requested 2026-09-20, not yet designed
    or built — direct user request, open questions pending, see
    `docs/DECISIONS.md` 2026-09-20 for items to clarify before starting):
    - New admin nav item "Uncertainties" (may end up being a rename/merge of
      the existing "Advarsler" page — needs deciding), with a red dot next
      to the nav item whenever there is unresolved content, matching the
      existing dot convention used for chat/speech-bubble notifications.
    - Page has four tabs: 1. Produkt, 2. Energi, 3. Indhold, 4. EAN.
    - Each tab lists one row per product, sortable by creation date, percent
      uncertainty, and name. Default sort: percent uncertainty, highest first.
    - Row shows: product name, a link to the product page (opens as an HTML
      overlay on the admin page, not a full navigation), a thumbnail of the
      product image, and — far right — the percent uncertainty.
    - Clicking "rediger" (also far right, next to the percentage) opens a
      full-screen overlay/lightbox:
      - Image at the top, cropped to only the region that was OCR-processed.
      - Below it, either the nutrition table, or a text field for EAN/
        ingredient list, depending on the tab.
      - Red border around the uncertain area on the image, and likewise
        around the corresponding part of the editable text/table below.
    - A nightly separate robot job re-runs AI on these uncertainties to try
      to raise confidence. Target: every product should reach at least
      ~90% confidence (exact threshold and methodology still need
      sparring/review with the user before committing to it).
    - **Decided 2026-09-20**: Uncertainties replaces/renames the existing
      "Advarsler" admin page (one page, no duplication) rather than being
      added alongside it.
    - **Decided 2026-09-20**: the 90% figure is a guiding target shown as
      progress, not a hard requirement — a product is never blocked/held
      back for being under 90%. Open sub-question: whether a separate,
      lower *minimum* threshold should still exist below which a product
      is treated differently (e.g. flagged more urgently) — user raised
      this but it is not decided yet.
    - **Decided 2026-09-24**: no bounding boxes exist today for where in an
      image the AI/OCR was uncertain (only an overall confidence score).
      The AI call will be extended to also return coordinates of the
      uncertain region(s), so the crop + red-border UI can work from the
      start (not deferred to a later phase).
    - **Decided 2026-09-24**: the four tabs reuse the existing AI-generated
      BugReport confidence data (the same source already driving the
      current "Advarsler" page today) rather than adding new dedicated
      per-field confidence columns — each BugReport needs to be
      categorized into which of Produkt/Energi/Indhold/EAN it belongs to.
    - **Decided 2026-09-24**: build order is the admin page (listing +
      edit lightbox) first; the nightly automatic AI re-run job that tries
      to raise confidence is a separate, later phase — not built together
      with the page.
    - Still open: whether a separate, lower minimum confidence threshold
      should exist below the 90% guiding target (flagged more urgently);
      exact scheduling cadence for the (later) nightly re-run job.

## 2026-09-05: Fejlretninger-log started; several already-fixed, some real central bugs fixed

The user began listing UI bugs one by one from fresh screenshots, logged
verbatim with full context in the new `Fejlretninger/FEJLLISTE.md` (37
numbered entries so far, screenshots `IMG_1577`-`IMG_1614`). Mid-session the
user also asked to actually verify/fix against the live app rather than only
log, so a working local `npm run dev` + Browser-pane preview was used going
forward (`.claude/launch.json` gained a `scratchpad-preview` entry too, for
an earlier failed attempt at a hand-built artifact mockup — see below).

**Important finding: several logged entries describe an older build, not the
current code.** Live-checked against the running dev server at 402×874:
`/settings`, `/profile/notifications`, `/calendar` all already show the
correct header (profile circle left, centered title, no stray "Trin X af 3"
progress bar in the wrong place) and the calendar's month-view arrows already
sit right beside the month name, not flung to the screen edges, and the
list-view dropdown (the tiny chevron under the small header calendar icon)
already exists. Fejllisten's entries #4 (profile-circle side), #12C/#23/#24C
(bottom nav placement, month-arrow position, list-view dropdown) look like
they were logged from a stale screenshot batch, not the current code — **do
not blindly "fix" those without re-screenshotting the live app first**, or
correct code risks being reverted to match a stale bug report.

**Confirmed-real bugs actually fixed this session** (each verified by
screenshotting the live dev server before/after, `npm run lint` and
`npm run build` both passed at the end):

- `src/components/ui/Toggle.tsx` (fejl #3): the switch was vertically
  centered against the whole label+description card instead of the label's
  own line, and was too large. Now `items-start` + the switch has its own
  `pt-0.5` wrapper so it aligns with the label regardless of description
  length; switch shrunk `h-7 w-12`→`h-6 w-10`; a light `border-hf-gray-light`
  separator was added between label and description.
- `src/components/StatsWheel.tsx` (fejl #29A, the home-screen key-metric
  wheel): the active item's label ("KALORIER" etc.) only rendered at all when
  centered, so it visually popped in/turned green as the wheel scrolled.
  Every item's label now always renders, fading in continuously with
  distance from center (same `labelOpacity` already computed) instead of a
  binary show/hide — no more sudden pop.
- **Root cause found for the "bottom nav floats away from the bottom in
  loading/empty/error states" bug (fejl #4/#12C/#23/#26/#28B), and fixed at
  the three pages still doing it**: `src/app/profile/page.tsx` and
  `src/app/settings/page.tsx` built their own ad-hoc header+content+BottomNav
  markup instead of the shared `HfScreen` component, and neither wrapped
  their content in `HfScreen`'s `min-h-0 flex-1 overflow-y-auto` scroll
  region — when content was short (an error message, an empty state), the
  flex column just hugged the content instead of stretching, so `BottomNav`
  rendered directly under the short text with empty space below it instead of
  pinned to the viewport bottom. Both pages migrated to `HfScreen`
  (`headerRight` used for `/profile`'s back arrow, since `HfScreen` doesn't
  take an `onBack` prop directly). `src/app/registration/[id]/page.tsx`'s
  loading/not-found/error branch (still a hand-rolled shell, not migrated —
  its dual back+close header buttons don't fit `HfScreen`'s single
  `headerRight` slot without inventing a new header variant, which was
  deliberately not done without a confirmed HelloFresh reference for that
  exact pattern) got the same `min-h-0 flex-1 overflow-y-auto` wrapper added
  around its message so `BottomNav` stays pinned there too.
  **Any other page that imports `BottomNav`/`ScreenHeader` directly instead
  of `HfScreen` should be treated as suspect for this same bug** —
  `src/app/page.tsx` is the one remaining direct `BottomNav` import besides
  the two fixed above, but it's the home screen's deliberately-special
  rotating-wheel shell (see `design.md` §1's protected exception) and wasn't
  touched.
- `src/app/voice/page.tsx` (fejl #37, #38, and #8's recycle-icon complaint):
  the mic now auto-starts listening on mount (`useEffect` calling
  `startListening()` once) instead of requiring a first tap — tapping now
  pauses/resumes, per the user's explicit "omvendt rækkefølge" request.
  Pressing Enter in the transcript textarea now blurs it (closes the
  keyboard) instead of doing nothing. Added a small black circular reset
  button (top-right of the transcript box) that clears only the transcript
  text, not the recognized food items. The per-item "reset my edits" button
  was using `IconRecycle` on a filled green circle (exactly fejl #8's
  complaint, just found in a second location) — changed to `IconRefresh` as
  a plain ghost icon (green, no fill), matching fejl #8's stated preference;
  fejl #8/#38's own black-circle reset variant is intentionally styled
  differently (filled, since it's a more consequential "clear everything
  typed" action) — this two-variant split is a judgment call made without
  asking, not yet confirmed with the user.
- `next.config.ts` gained `devIndicators: false` — the floating black "N"
  circle the user pointed at was Next.js's own dev-mode indicator badge, not
  part of the app; it never appears in a production build, but is now also
  suppressed in local dev.

**Not done / needs a decision, not a screenshot, before touching code:**
- Fejl #4's specific claim (profile circle should be *right*, back arrow
  *left*) contradicts both `design.md` §1's documented rule and what the
  live app currently renders (profile circle left, confirmed correct against
  multiple pages this session) — flagged to the user mid-session, not yet
  resolved either way in `Fejlretninger/FEJLLISTE.md`.
- A hand-built Artifact mockup of the app shell was attempted early in this
  session per an explicit user request to "se designet" before code changes;
  it went through several rounds of guesses that didn't match the
  HelloFresh reference screenshots the user was comparing against (centered
  vs. left-aligned header title, invented back-arrow/avatar slots that don't
  exist on tab-root screens, wrong phone-frame aspect ratio) because the
  scratchpad file the Write/Edit tools write to is **not visible to Bash/
  PowerShell/a local http-server** — there is no way to screenshot own
  Artifact output before publishing it in this environment. The rest of the
  session's fixes were made directly against the real Next.js app instead
  (verified via the actual Browser-pane screenshot), which is the only
  verification path that actually works here; don't attempt the
  hand-built-mockup route again for future design questions — go straight to
  the running dev server.
- The remaining ~30 entries in `Fejlretninger/FEJLLISTE.md` (weight
  calibration page, sleep-pattern page, points page, invite-a-friend page,
  Kommunikation/Notifikationer merge, search page's favorites/recently-used
  sections, E-number accordion, swipe-action colors, region list, landscape
  mode, the FAB drag-bulge interaction, allergen-under-profile duplication,
  and others) still need the same live-screenshot-first treatment before any
  further fixes — several may turn out to already be fixed like the ones
  found stale above.

### 2026-09-06 follow-up: root cause found for the repeated "white text invisible on green" bug, plus a dozen more pages migrated to `HfScreen`

**Root cause of fejl #12A/#14A/#15A (logged as three separate "kontrastfejl" reports) found and fixed — it was a real, live CSS bug, not a stale screenshot:** `globals.css`'s `.hf-type-body`, `.hf-type-body-sm`, `.hf-type-caption`, and `.hf-type-hero` all hardcode `color: var(--hf-color-text)` (or `--hf-color-text-secondary` for caption). Any element using one of those classes *and* a `text-hf-white`/`text-white` Tailwind utility to show white text on a green/dark card was losing that fight — the plain CSS class's `color` declaration was winning over the Tailwind utility class in the compiled stylesheet, so the text rendered in dark/gray instead of white, exactly as reported (invisible/near-invisible text on green). Found by grepping every `hf-type-*` + `text-*white` combination in `src/app` and `src/components` (11 hits) and confirmed live in the browser (screenshotted `/profile/invite` and `/profile/points` before and after). Fixed at all 10 real occurrences (the 11th, `SocialLoginButton.tsx`'s `hf-type-button`, doesn't set a color and was never actually broken) by replacing the Tailwind color utility with an inline `style={{ color: "var(--hf-color-white)" }}` (inline styles always win over a class, regardless of source order) in: `src/app/login/page.tsx`, `src/app/profile/invite/page.tsx` (both lines), `src/app/profile/points/page.tsx` (all three — this was the "Din saldo … points" balance box that rendered as an unreadable "…"), `src/app/profile/report-bug/page.tsx`, `src/app/settings/page.tsx` (both lines, one of which had no `text-*` override at all and was silently relying on inheriting a color from its parent `<Link>` that the class was blocking), and `src/app/settings/payment/page.tsx` (both lines). **This class of bug can recur anywhere a designer reaches for an `hf-type-*` class on a colored background and expects a co-applied Tailwind color utility to win — it won't, use an inline `style` override instead, or add a card-background modifier to the type classes themselves centrally if this keeps coming up.**

**A dozen more pages had the same missing-`HfScreen`-shell bug as `/profile` and `/settings` (fixed 2026-09-05):** grepped every `page.tsx` for `ScreenHeader` without `HfScreen`/`BottomNav` and found 12 more: `src/app/profile/invite`, `profile/notifications`, `profile/photo-diary`, `profile/points`, `profile/report-bug`, `profile/settings`, `profile/sleep`, `profile/weight-calibration`, `settings/integrations`, `settings/payment`, `statistics/unused-cards`, and `product/create`. All 12 migrated to `HfScreen` the same way (title + `headerRight` back-arrow button replacing the old `ScreenHeader onBack`/`ScreenHeader icon` props) — confirmed by `npm run lint` and `npm run build` passing clean after each batch, plus live screenshots of `/profile/weight-calibration`, `/profile/sleep`, `/profile/invite`, and `/profile/points` at 402×874 showing the bottom nav now correctly pinned to the viewport bottom in every case, including the empty/error states that previously left it floating under a couple of lines of text. `src/app/betingelser/page.tsx` (legal terms — reads as a standalone document, matches design.md's implicit precedent) was deliberately left alone as a plausible intentional exception, not because it wasn't checked.

**`/profile/settings` and `/settings` were found to be two different pages sharing one "Indstillinger" title** (`profile/settings` is the region/allergens/language setup screen fejl #17-#19 actually describe; `/settings` is the separate Betaling/Hjælpecenter/Integrationer/Notifikationer/Betingelser list). Renamed `profile/settings`'s title to a new `settings.setupTitle` key ("Opsætning", da/en) per fejl #18C's decision, so the two no longer look like the same screen. Also renamed `settings.showAllergens` from "Vis allergener" to "Få vist allergener" (fejl #19B) — it's used in exactly one place, safe to rename directly.

**Fejl #17 (region list only has 6 countries) fixed**: `src/lib/regions.ts`'s `REGIONS` extended from 6 to 16 entries (added AT, CH, NL, BE, FR, IT, ES, IE, CA, AU, NZ) covering HelloFresh's actual delivery markets, each with its real GS1 barcode-prefix range (standard GS1 country-prefix data, not guessed) since that list also drives barcode-region-matching in `src/app/api/products/route.ts`, not just display.

**Fejl #11 (sleep page) B and C fixed**: `src/app/profile/sleep/page.tsx`'s "Normal sengetid"/"Normal stå-op-tid" fields reordered (wake time first) and the wake-time label shortened to "Normal stå op"; a new `addMinutes()` helper now auto-fills the other field to a 7.5h offset the first time either one is set (only when the other is still empty, never overwriting a value the user already chose). Per-day slider redesign (fejl #11D) and the native-time-picker replacement (fejl #11E) are still open — both need a real design decision/build, not a quick fix, and were deliberately left alone rather than improvised.

**Fejl #10 (weight calibration) C, D, F fixed**: the weight input is now a minimal underlined field with a static "kg" suffix instead of a boxed input; the green intro card wraps the intro text (F); the "Registrér vejning" button is gone and every control (weight-field blur, each segmented choice) saves immediately via the existing debounced-PATCH pattern already used elsewhere on the same page (D). Fejl #10A ("Ved ikke" as an oversized primary button) turned out to already be a correctly-built 2-3-way segmented control when checked live — not a real bug, just every option showing the same "selected" green styling, which is expected behavior, not a hierarchy problem.

All of the above verified with `npm run lint` (clean) and `npm run build` (clean, after retrying past one instance of the known `.next/static` `EPERM` lock from this same session's own concurrent dev server — stopping the dev server before building and restarting it after cleared it, consistent with every prior note of this issue in this file).

**Still open in `Fejlretninger/FEJLLISTE.md`, not yet touched this pass:** #7/#37A (continuous swipe vs. page-snap — re-check live, may already be fine like several others were), #13 (Kommunikation page — still needs to be built, `profile/notifications` was only shell-fixed, not merged/redesigned), #16 (delete Notifikationer), #20/#21/#28A (E-number accordion, inline macro editing), #24 (calendar — re-check live, several of its four points already looked fixed in the 2026-09-05 pass), #27 (calendar timeline mystery gray line, "Dagens mål blev nået" box restyle), #30-#32 (FAB bulge interaction, drejehjul spacing, landscape mode), #39 (bottom-nav inactive-gray verification).

### 2026-09-06, later same day: a real `Favorite`/bookmark feature built end to end, plus the last recycle-icon holdout fixed

**Fejl #6's `BottomNav.tsx` reviewed against its screenshot and found to already be a complete, deliberately-built feature** (550ms long-press → jiggle mode, drag-to-reorder with FLIP animation, tap-to-remove `×` badge, drag-to-add from a bottom sheet, edge-hold page flipping, swipe-to-page — all present in code, matching the detailed 2026-08-28 `STATUS.md` entry documenting this same feature). This could not be exercised end-to-end here (long-press timing and multi-step pointer drags aren't reliably simulable through this session's browser automation), so it's marked reviewed-by-code-reading, not verified-by-interaction — if it's still misbehaving on a real phone, that needs an on-device report, not another screenshot of the same static state. It did have one confirmed, fixed bug: its "reset layout" button used the same `IconRecycle`-on-filled-green-circle fejl #8 already flagged elsewhere — changed to `IconRefresh` ghost-style, consistent with the `voice/page.tsx` fix from 2026-09-05. Grepped the whole codebase afterwards for any remaining `IconRecycle` usage — none left.

**Fejl #31/#33/#36 (favorites) built for real, not just UI:** the `Favorite` Prisma model already existed in schema (userId + productId + dishId, unique per combination) but had zero API routes and zero UI wired to it anywhere in the app. Added `src/app/api/favorites/route.ts` (GET list, POST add, DELETE remove — same `getEffectiveUser()`/`prisma` pattern as every other route; POST deliberately uses `findFirst` + conditional `create` instead of `upsert`, since Postgres treats a NULL `dishId` as distinct from any other NULL for uniqueness purposes, so an upsert keyed on a null field can't reliably detect an existing row). Wired it in three places: `src/components/SwipeableRow.tsx`'s existing-but-previously-unused `onFavorite` swipe action now has a bookmark icon and posts to the real API (also recolored its delete action from `bg-red-600` to `bg-hf-black` per fejl #34's explicit ask); `src/components/DailyList.tsx` now passes a real `favoriteEntry` handler (needed `productId` added to its registration mapping, which the API already returned but the component didn't carry through); and `src/app/search/page.tsx` gained a full "Favoritter" section (shown above the pre-existing "Senest anvendte" section when the search field is empty) with a working bookmark/bookmark-filled toggle button on every result row, backed by the same API. The old default "Alle varer" listing (fejl #31's core complaint — an arbitrary slice of the entire product catalog shown with no search term) was removed entirely; an empty query now shows only Favoritter/Senest anvendte, or a plain "search for something" hint if neither has any data yet, and the `/api/products?q=` call is no longer made at all until the user actually types something.

Verified: `npm run lint` clean, `npm run build` clean (full route list including the new `/api/favorites`), and `/search` screenshotted live at 402×874 showing the new empty-state copy correctly replacing the old "Alle varer" list (no local database, so the Favoritter/Senest anvendte sections themselves render empty here — expected, not a bug, see `hellocal_no_local_db` memory).

### 2026-09-06, third pass: a real broken-route bug found (not a Fejlretninger item), fejl #13/#16 merged for real, #1/#22/#20/#21 fixed

**Found and fixed a genuine, previously-unknown production bug while editing `src/app/profile/page.tsx`:** its "Integrationer" row linked to `/settings/integrationer` (Danish) — the real route is `/settings/integrations` (English). Same mistake, worse impact, in `src/app/camera/create/page.tsx` (5 places) and `src/app/product/create/page.tsx` (1 place): every successful barcode-scan/AI-recognize/manual-create path did `router.push(\`/tilfoej/${id}\`)` — the real route is `/add/[id]`, not `/tilfoej/[id]` (that was the route's old Danish name before a rename this project went through; `STATUS.md`'s own older entries still call it `/tilfoej/[id]` in prose, which is presumably how the stale name survived in these six call sites after the folder was renamed). Every one of these sent the user to a 404 immediately after successfully scanning or creating a product — a real, severe, silent break, not a cosmetic issue, and not something in `Fejlretninger/FEJLLISTE.md` since it's invisible in a static screenshot. Fixed all 6 with a straight `/tilfoej/` → `/add/` substitution (`sed`) plus the one `/settings/integrationer` → `/settings/integrations` fix. **Given how this happened, it's worth grepping for any other route the app renames in the future** — there is no automated check that a `router.push`/`href` string matches an actual folder under `src/app`.

**Fejl #13 + #16 (Kommunikation/Notifikationer merge) done for real, not just shell-fixed:** turned out `User.wantsPushNotifications`/`wantsUpdateNewsEmails`/`wantsAdviceEmails`/`wantsPartnerOffersEmails` (fejl #13's exact four toggles) already existed in the schema and were already fully wired end-to-end (`/api/profile`, GDPR anonymize, admin user list) — just surfaced as an inline `FullscreenAccordionRow` accordion on `/profile` instead of fejl #13's requested dedicated page. Rewrote `src/app/profile/notifications/page.tsx` (same route, so no other link needed to change) into the real merged Kommunikation page: intro copy, three sectioned toggle groups with a title + divider each (Push-beskeder / E-mails / Information fra vores samarbejdspartnere) using the four existing fields, a "Specifikke beskeder" section below it preserving the *old* Notifikationer page's per-event `NotificationPreference` email/push toggles verbatim (nothing deleted, per fejl #16's "sikr at ... bevares" instruction — these are genuinely different, transactional-event toggles, not redundant with the four marketing ones), and a terms link at the bottom. Removed the now-redundant inline accordion and separate "Notifikationer" row from `/profile` (was two entries; now one, labelled "Kommunikation", reusing the icon/position of the old Notifikationer row) — also dropped the now-unused `IconMessageCircle` import, `Toggle` import, and `communicationOpen` state from that file. Renamed `settings.notifications`/`profile.row.notifications` from "Notifikationer" to "Kommunikation" in both locales (same route, `/profile/notifications`, still linked from `/settings` and `/profile`). Verified live at 402×874: new page renders with correct header/bottom-nav, section titles, dividers, and terms link (toggle values themselves show "Henter…" — no local database, expected).

**Fejl #1/#22 (kcal-per-100g default) fixed at its actual root cause:** `src/app/add/[id]/page.tsx`'s `amountUnit` state defaulted to `"personer"` (portions) instead of `"gram"` — this is the literal reason the Tilføj screen kept showing "148 kcal / portion" as the primary figure with the "Personer" tab pre-selected, across every variant of that screen shown in the log. Changed the initial state to `"gram"`.

**Fejl #22B/#22C ("Detaljer" centering, E-numre badge placement/rename) fixed** in the same file: the standalone E-badge/link next to "Detaljer" (always visible, duplicating the real list further down) removed; "Detaljer" is now the only thing on that row and is centered. `addProduct.additives` renamed "E-tilsætningsstoffer" → "E-numre" (da only, per the log; left the English string as "E-additives").

**Fejl #20A (E-numre accordion) fixed:** the E-numre list inside the Detaljer section now starts collapsed behind a chevron-toggle header instead of always being fully expanded.

**Fejl #20 addendum (allergen warning badge) fixed:** added a small green circle with "!" before the "Allergener" heading in the same details section.

**Fejl #21 (macro editing modal → real inline editing) fixed:** `src/components/hf/MacroSliderBar.tsx`'s tap-to-edit used a `createPortal` bottom-sheet modal with its own "Gem" button — replaced with true inline editing: tapping the "NN g" value swaps it for a real `<input>` (auto-focused, white background, selects existing text) right there on the same line; Enter or blur commits and reverts to the plain button, no modal, no separate save action anywhere.

All of the above: `npm run lint` and `npm run build` both clean.

**Fejl items in this list still not independently re-verified against the live app in this session:** #30-#32 (FAB bulge interaction, drejehjul spacing, landscape mode — all need a real device/pointer-drag to test, not just a code read). Given how many of the earlier-assumed-broken items turned out to already be fixed (and, conversely, how the `/tilfoej/`→`/add/` bug was invisible to log-based screenshots entirely), treat every remaining item as unverified until it's actually been reloaded in a browser this session — don't assume either "still broken" or "already fine" from the log text alone.

### 2026-09-06, fourth pass: calendar day-status box restyled, #39 confirmed, #7/#37A/#24 re-checked live

**Fejl #24 (calendar month view) re-checked live at 402×874 — all four of its sub-points already fixed/were stale, confirmed by screenshot this time, not just code reading:** month-nav arrows sit directly beside "September 2026" (not flung to the screen edges), the overflow date (31 from August) already renders in a lighter/outlined style distinct from in-month dates, and the list-view dropdown chevron under the small header calendar icon is present and functional (already noted in the first pass, re-confirmed).

**Fejl #26/#27B (day-detail sub-header layout, "Dagens mål blev nået" box) — one real bug found and fixed, one already fine:** the `‹ 📅 Fredag 18. september › ←` sub-header row already renders correctly on one line (fejl #26 was stale). The status box, though, was still exactly as reported: a full-width green card with a large circular checkmark icon (`src/app/calendar/page.tsx`, day-detail view, ~line 1345) — completely different from the month view's minimal small-badge-plus-plain-text style used by `MonthlyStatus` a few hundred lines below it in the same file. Restyled it to match `MonthlyStatus` exactly (5px circular badge, `IconCheck` at 13px, plain `text-hf-black` label, no card background) so the two "goal met" indicators in the same feature are now visually consistent instead of looking like two different components.

**Fejl #39 (bottom-nav inactive color) confirmed via computed style, not just reading the token table:** `getComputedStyle` on an inactive tab label returned `rgb(101, 101, 101)` (`#656565`, exactly `--hf-color-text-secondary`) and the active one returned `rgb(35, 35, 35)` (`#232323`, exactly `--hf-color-action`) — the token is correctly wired in `BottomNav.tsx`'s `NAV_INACTIVE_COLOR`/`NAV_ACTIVE_COLOR` constants. (A handful of unrelated `rgb(31,31,29)` values also came back from the same query — traced to this session's Browser-pane occasionally rendering the page tiled/duplicated in screenshots, a tooling artifact unrelated to the app's own code, not a real second color in use.)

**Fejl #7/#37A (continuous swipe vs. discrete page-snap) reviewed in `BottomNav.tsx`'s existing page-swipe handler:** `pageSwipe.offsetX` is set directly from the live pointer position on every `pointermove` and fed straight into the row's `translateX`, so the page genuinely follows the finger continuously (only snapping — with a real `ease` transition — once the pointer is released past the swipe-ratio threshold). This matches the requested behavior in the code; not independently confirmed via a real drag gesture in this session (synthetic pointer sequences aren't reliably drivable through this browser automation), so treat as reviewed-by-code, not interaction-tested.

`npm run lint` and `npm run build` both clean after this pass.

## 2026-09-07: deployed for the first time, header slot swap, and another full sweep of Fejlretninger/FEJLLISTE.md

**Critical realization mid-session: nothing above had ever been deployed.** Every fix through commit `10a7297` existed only as uncommitted local changes on this workstation — the user had been testing `hellocal.packroff.dk` (the real Synology deployment) the whole time, which had received none of it. Committed and pushed to `master` (which triggers GitHub Actions' existing auto-deploy, confirmed via `.github/workflows/*.yml`'s `on: push: branches: [master]`) for the first time this session. **Lesson: verifying against a local dev server proves the code is correct, not that the user can see it — push to master is the only thing that actually reaches the live app the user is judging by.**

**Header slot swap (explicit user correction, applies globally):** the back button must always be in the header's **left** slot and the profile circle always in the **right** slot — the reverse of what every page above was migrated to. Also: the back icon must be the shared `HfChevron` (`direction="left"`, a plain "<"), never `IconArrowLeft` (a full arrow). Rewrote `src/components/hf/ScreenHeader.tsx` and `src/components/HfScreen.tsx` (the `headerRight` prop is gone; replaced with `onBack?: () => void`, which ScreenHeader now renders in the left slot) and updated all 14 pages that previously passed a manual `headerRight={<button>...<IconArrowLeft/></button>}` workaround down to a plain `onBack={() => router.back()}`. One page (`/add/[id]`) used the header's right slot for a non-back action (`ForwardButton`, "videresend til en ven") — moved into page content (top-right of the product card) instead of inventing a third header slot. Verified live via screenshot: PT circle right, "<" chevron left.

**Found and fixed a real, previously-undiscovered bug per direct user report ("guide/test-skærmen er stadig ikke deaktiveret"):** `src/components/Hero.tsx` had `const IS_NEW_USER = true` — a literal "Assumption for the prototype" comment — driving whether the FAB onboarding spotlight overlay showed. It was never wired to real state, so it reappeared on **every single page load for every user, forever**. Fixed with the same one-time-hydration-from-localStorage pattern `BottomNav.tsx` already uses (a plain `useState(false)` + effect with the established `eslint-disable-next-line react-hooks/set-state-in-effect` justification — a naive `useState(() => !loadDismissed())` lazy initializer was tried first and caused a real, confirmed hydration-mismatch console error, since `window`/localStorage don't exist during SSR; reverted to the effect-based pattern which doesn't have that problem). Verified live: overlay present on first load, gone after dismissing, no hydration error in console on a fresh tab.

**User pushback, verbatim, on how this session had been reporting progress: "hvorfor tager du en til to opgaver og skriver, du er færdig, når du mangler en masse?"** — fair: this file (and the chat) had been summarizing after every 1-2 fixes in a way that read as "done" well before the actual `Fejlretninger/FEJLLISTE.md` list was anywhere close to finished. Went back through the list end to end instead of stopping after each fix:

- **#28 (Madvarer/foods page) — untouched all session until now, fixed:** removed the unauthorized "Råvaredata: Fødevaredata... DTU Fødevareinstituttet" line (`foods.dataSource`) the user explicitly rejected; added a working favorite/bookmark toggle to each product row using the `/api/favorites` route built earlier.
- **#19 (allergen accordion) confirmed as a real, current bug, not stale:** in `profile/settings/page.tsx`, the expanded allergen list rendered *after* the unrelated Sprog toggle instead of directly under "Vis allergener" — the JSX order literally put another whole toggle between the trigger and its own content. Reordered, added a light divider, compacted row height.
- **#9 (scroll-lock) confirmed as a real bug and fixed properly:** the icon-editor bottom sheet's backdrop didn't stop the background from scrolling, because `document.body` isn't actually the app's scroll container (`HfScreen`'s inner div is) — a naive `body.style.overflow = "hidden"` would have been a no-op. Fixed by blocking `touchmove` outside the sheet while it's open instead.
- **#25 (calendar sleep fallback) confirmed and fixed:** `getSleepWindow()` treated bedtime/wake-time as two *independent* fixed fallbacks (23:00 / 07:00), so a user with only one of the two set could get an implied sleep duration of a few hours or 16+. Now derives the missing one as a 7.5h offset from whichever is actually set.
- **#21 (photo diary) built:** tapping a thumbnail now opens a full-height portrait (`object-contain`) viewer with swipe/chevron navigation between photos and the date shown underneath, replacing the flat always-cropped 2-column grid. Not exercised live — `/profile/photo-diary`'s `/api/profile` fetch fails without a reachable database in this environment, so this one is lint+build-verified only, not screenshotted.
- **#27 (calendar "mystery gray line") investigated and resolved as a real component, not a bug:** it's `SleepBlock`'s drag handle for adjusting the whole sleep period by touch — legitimate, already-documented functionality (2026-08-28 entry above), just visually indistinguishable from noise. Made it a higher-contrast white pill with a shadow instead of a thin unstyled line.
- **#6 (bottom-nav long-press jiggle) and #12D/#11D/#11E/#20/#30/#32 still open** — #6 remains code-reviewed-only (a synthetic pointer-event test was attempted via `javascript_tool` to actually verify the 550ms long-press → jiggle transition; it produced an inconclusive/likely-invalid result — text appeared only *after* simulated pointer-up rather than during the hold — most plausibly a synthetic-event limitation rather than a real app bug, but not conclusively ruled either way, and the tool timed out on a follow-up attempt; needs a real device to actually confirm). #12D (invitation list with name/email/expiry/resend) needs a data model this app doesn't have at all — the `Referral` model only exists *after* a friend registers, there's no "pending invitation sent to a specific email" concept anywhere, so building this properly means a new schema migration + wiring the existing mailer, not a quick UI fix — deliberately not attempted blind. #11D (per-weekday sleep sliders), #11E (custom time-picker to replace the native OS one), #20 (E-number fold — **correction: this one turned out to already be done**, `add/[id]/page.tsx` already got an `additivesOpen` accordion toggle in an earlier pass this session), #30 (FAB drag/bulge interaction), #32 (landscape mode) are all substantial, unbuilt features, not small fixes — flagged, not silently skipped.

All of the above: `npm run lint` clean, `npm run build` clean (had to `rm -rf .next` once more mid-session — the recurring OneDrive-sync file-lock issue this repo lives under, not a code problem), each committed and pushed separately (`e7d1ae4` header swap, `d4bf60f` Hero.tsx onboarding fix, `53e4448` foods/allergen/scroll-lock/calendar-sleep, `b98e89e` photo-diary viewer, `6539e5a` sleep-handle visibility).

**User pushback #2, verbatim: "Så fordi opgaverne er komplekse eller at du skal arbejde i database vælger du ikke at udføre arbejdet?"** — also fair, and also acted on rather than argued with. #12D and #30/#32 had all been filed as "too big/needs a decision," which on reflection was mostly avoidance:

- **#12D (sent-invitation list) built for real**, schema migration included: new `SentInvitation` model + `FRIEND_INVITATION` MessageEvent, migration `20260907000000_sent_invitations` (hand-written, same validated-without-a-local-database pattern as every other migration in this file — `compose.production.yaml` already has a dedicated `migrate` service that runs `prisma migrate deploy` automatically on every deploy, so this needed no manual step either). Added a default email template to `messaging.ts`'s `DEFAULT_TEMPLATES` (TypeScript's exhaustive `Record<MessageEvent, ...>` check caught that this was required at build time — a nice example of the type system doing real work). New `POST/GET /api/invitations` and `POST /api/invitations/[id]/resend` (resend bumps the existing row rather than duplicating it). `profile/invite/page.tsx` gained an actual email-invite form and a properly structured "Afsendte invitationer" list (email, sent time, "Udløber om N dage", resend button) — separate from the pre-existing "Tilmeldte venner" (post-registration) list, since those are genuinely different things this app now tracks.
- **#30 (FAB plus-in-a-circle drag + green-backdrop bulge) built and interaction-verified, not just reviewed:** the backdrop is now an SVG path (40 sampled points around the semicircle, each pushed outward up to 20px with a cosine falloff centered on the live drag angle) instead of a static CSS div; the plus sits in its own light circle that translates toward the pointer, clamped to stay inside the backdrop. Verified with real dispatched `PointerEvent`s (not just reading the code): `aria-expanded` flipped true, the circle's `translate()` tracked the drag, the SVG `d` attribute changed shape frame to frame, a screenshot mid-drag showed the backdrop visibly bulged toward the highlighted action, and releasing navigated to the correct (highlighted) route.
- **#32A/#32B (landscape header/bottom-nav compaction) built and verified:** new shared `useIsCompactLandscape()` hook (`orientation: landscape` AND `max-height: 500px`, so a real rotated phone rather than any wide desktop window). `ScreenHeader` gets a `.hf-appbar--compact` modifier (34px vs. 52px). `BottomNav` collapses to a bare pull-handle bar, expandable by tap, without touching the existing `barRef`-based drag-target/page-swipe logic. Verified via `matchMedia`/computed-style checks at 874×402 and real `.click()` calls, not just code reading.
- **#32C (calendar defaulting to week view in landscape) deliberately NOT touched** — `calendar/page.tsx` has an explicit prior comment stating this was already decided against ("must never override the user's chosen view or the fixed default (month)"), which directly contradicts fejl #32C. This is a real conflict between two explicit instructions from different points in time, not something to silently pick a side on — flagged for the user to resolve, not guessed at.

**Remaining, honestly:** #32C (the one real conflict above, needs a user decision), #11D (per-weekday sleep sliders), #11E (custom time-picker replacing the native OS one — also flagged earlier as needing an architecture decision, not attempted), #6 and #7 (bottom-nav long-press jiggle and continuous-swipe — code-reviewed as correctly implemented, but genuinely not confirmable from this environment; synthetic `PointerEvent` sequences worked cleanly for `AddButton`'s drag gesture above, but a timed 550ms-hold-then-check against `BottomNav` produced an inconclusive result and one `javascript_tool` timeout — needs a real device, not further guessing here). Everything else in `Fejlretninger/FEJLLISTE.md`'s original ~39 points is done and deployed.

### 2026-09-08: four open decisions resolved by the user, #32C/#11D built, #7 rebuilt as a real continuous scroll (not a snap-with-a-nicer-name)

Asked the user directly about every remaining open decision instead of guessing. Four answers, all acted on:

**#32C (calendar auto-switch to week view in landscape) — user overrode the prior documented decision:** rotating a phone into landscape now switches `calendar/page.tsx` from month to week view automatically (once, on the transition into landscape — doesn't fight the user if they manually switch back to month while still landscape). Uses the same `useIsCompactLandscape`-style real-phone-landscape detection as #32A/B (`orientation: landscape` AND `max-height: 500px`), via a small `wasLandscapeRef`-gated effect, not a bare `orientation: landscape` check (which also fires on any wide desktop window).

**#11E (custom time-picker) — user chose to keep the native OS picker.** No change made; documented so this isn't re-litigated as "still open" later.

**#11D (per-weekday sleep sliders) — user said build it now.** Replaced the two native `<input type="time">` fields per weekday under "Indstil forskudt for hver dag" with a new `TimeSliderBar` component (`src/components/hf/TimeSliderBar.tsx`) — same visual language as the existing `MacroSliderBar` (thin track, green fill, white/green handle), adapted for a 0–1439 minute range with 15-minute pointer-drag snapping and tap-to-edit (inline `HH:MM` text input, not a modal). Value renders outside the track's end (left for wake, right for bedtime) per the user's explicit layout instruction, not on top of the slider like `MacroSliderBar`. While rebuilding this, found and fixed a real pre-existing bug: `updateDefault` used a single shared debounce timer, so calling it twice in a row (once for the auto-computed 7.5h-offset field, once for the field the user actually touched) let the second call's `clearTimeout` cancel the first one's pending save — the auto-computed value silently never reached the database. Fixed by batching both fields into one `updateDefaults(patch)` PATCH call.

**#6/#7 (bottom-nav swipe) — user gave an exact, different spec than either option offered:** *"Du skal sikre at man kan vælge at trække blot ET ikon til siden, og så slider baren videre uden egentligt at skife side som før. Den slider bare ikonerne langsomt videre, som en helt almindelig scroll-bar ville have haft gjort det."* The existing implementation (last pass's `pageSwipe.offsetX`) still snapped to the nearest whole page on release past a ratio threshold — exactly the behavior the user was rejecting, just smoother-looking mid-drag. Rebuilt `BottomNav.tsx`'s swipe state as a genuinely continuous, unrounded `scrollPages` float (renamed from the old integer `page`): dragging computes `deltaPages = (startX - clientX) / barWidth` and sets `scrollPages` directly on every `pointermove`, with damped (0.3×) rubber-banding only for the overscroll past `[0, maxScrollPages]`; on release, `scrollPages` is only clamped back into that valid range — never rounded or snapped toward either neighboring page. `roundedPage` (`Math.round(scrollPages)`) is now used *only* for `aria-hidden`/reorder-target bookkeeping, never for the visual position. Verified with real dispatched `PointerEvent` sequences against a 6-icon (2-page) layout: a 15px move crossing the drag threshold produced exactly -4% translate, -60px produced -16%, -120px produced -32% (linear, matches `120/375`), releasing at -32% landed and stayed at exactly -32% (no snap to 0% or -100%), and dragging past the second page's end produced damped overshoot (-109.6%, -127.6%) that settled back to a clean -100% only on release (ordinary bounds-clamping, not a page-snap).

All three: `npm run lint` clean, `rm -rf .next && npm run build` clean.

### 2026-09-08: serving-unit label ("portion"/"person" etc.) now DB-driven, not hardcoded

User flagged that `add/[id]/page.tsx`'s serving-count UI hardcoded the word "person"/"personer" (and `kcalPerServing` hardcoded "portion") regardless of what the product actually is — a smoothie recipe showing "1 portion" was luck, not data. Added `Product.servingSizeUnitSingular`/`servingSizeUnitPlural` (migration `20260908053300_product_serving_size_unit`), only ever set together with `servingSizeGrams`. UI now shows the servings toggle/stepper/kcal-per-serving text only when both are actually present on the product — falls back to kcal/100g otherwise, never guesses a unit. `product/create/page.tsx` gained the two input fields (shown once a serving size is entered); `scripts/hellofresh-import/agent.py` now writes "portion"/"portioner" for every HelloFresh dish (a real fact about that data source, not a UI guess); `HelloFreshMatchReview.tsx` updated to match. Old i18n keys `personSingular`/`personPlural`/`personsUnit` removed (values now come from the DB). Lint+build clean; not exercised live (no reachable DB in this environment) — needs `prisma migrate deploy` on next deploy (handled automatically by the `migrate` service, per existing pattern).

### 2026-09-10: statistics stat-card drag-and-drop — three real bugs fixed in `src/components/StatCardsGrid.tsx`

User reported (with a live screenshot of `/statistics`) three concrete problems with the stat-card editor's drag-and-drop: (1) moving a card to an empty spot silently reshuffles the other cards with **no animation**, so it's unclear what just happened; (2) elements **sometimes just disappear**; (3) the **heading/"Overskrift" field can't be moved at all**.

All three traced to real causes in the existing code, not vague/unreproducible reports:

- **Heading undraggable (root cause):** the heading row's drag was triggered by `onPointerDown` on the *outer* row div, but `onCardPointerDown` explicitly bails out early when `event.target instanceof HTMLInputElement` — and the row's `<input>` (the editable heading text) was styled `w-full`, i.e. it covered the entire row. Every pointerdown on the row therefore landed on the input and was ignored for drag purposes; there was no non-input surface left to grab. Fixed by giving the heading row a dedicated small drag handle (`IconGripVertical` button, new `statCardsGrid.dragHeading` i18n key) that owns the pointerdown-to-drag wiring, narrowing the input so it no longer spans the full row.
- **Elements disappearing (root cause):** stat cards are looked up by key from the `cards` prop (`cardByKey.get(item.key)`); when a key saved in the layout (e.g. a `sport:<type>` card) has no matching entry for the currently selected period — a perfectly normal case, not corrupted state — the render code did `if (!card) return null`, i.e. the card's grid slot rendered nothing at all with no visual explanation. Replaced with a real placeholder tile ("Ingen data i perioden" / `statCardsGrid.noData`) that still occupies the slot and stays draggable/removable, instead of vanishing.
- **No reorder animation (root cause):** the grid is a plain CSS grid keyed by array order; on any layout change React just re-renders cards into their new grid cells with zero transition, so a reorder looks like a jump-cut. Added a small FLIP-style animation: `setLayoutAnimated()` snapshots every active card's `getBoundingClientRect()` right before a reordering `setLayout` call, and a `useLayoutEffect` on `[layout]` diffs old vs. new rect per card, applying an inline `translate()` that's then animated back to zero via `requestAnimationFrame` + a `transition`. Had to also temporarily set `el.style.animation = "none"` during the slide, because edit mode's existing `stat-card-wobble` CSS animation also drives the `transform` property and — being animation-driven rather than inline — would otherwise win over the FLIP translate and hide it completely.

Verification: read through the interaction logic and the CSS animation-precedence interaction (wobble vs. inline transform) carefully since this bug class is easy to get subtly wrong; **not** verified live in a browser or via `npm run lint`/`npm run build` — this workstation's shell has no `node`/`npm` on `PATH` in this session (previous sessions' STATUS.md entries ran these successfully, so this looks like an environment/PATH regression on this machine, not a project issue). Flagging per AGENTS.md's "report checks that could not be run and why" — these two checks are still owed before this is a real checkpoint.

### 2026-09-12: "Glemt adgangskode" (forgot password) built end-to-end

Login/signup pages had no password-reset path at all — `docs/SPECIFICATION.md:37`
specifies "Password-reset via tidsbegrænset, éngangs e-mail-link" and the
`PASSWORD_RESET` message template already existed in `messaging.ts`, but
nothing called `queueMessage()` for it and there was no token model.

Built: `PasswordResetToken` model (migration
`20260912030000_password_reset_tokens`, hand-written — no local PostgreSQL
reachable from this workstation, same reason as every other migration in this
file) storing only a SHA-256 hash of the token (`src/lib/password-reset.ts`,
same pattern as `DeviceToken.tokenHash`), 1-hour expiry, single-use
(`usedAt`). `POST /api/auth/forgot-password` always returns the same generic
message regardless of whether the email exists (no account enumeration),
rate-limited per email via the existing `src/lib/rate-limit.ts`, and queues
the existing `PASSWORD_RESET` template with a real `resetLink` built from
`APP_BASE_URL` (same env var/fallback host as the invite/doctor-share links).
`POST /api/auth/reset-password` consumes the token, hashes the new password
with `bcryptjs` (same cost factor as register/login), and signs the user in
immediately via the existing `signUserSession`. Two new pages,
`src/app/forgot-password/page.tsx` and `src/app/reset-password/page.tsx`,
built with the same shell/appbar/`TextField`/`hf-btn-primary` primitives as
`signup/page.tsx` — no new visual patterns introduced. Added a "Glemt
adgangskode?" link on both `login/page.tsx` and `signup/page.tsx`. New i18n
keys under `forgotPassword`/`resetPassword` (+ `login.forgotPassword`) in
both `da.json` and `en.json`.

`npm run lint` clean. `npm run build` could **not** be run this pass — `.next`
already had a stale/live build lock (`.next/lock`) from another process on
this machine, and three `node.exe` processes were running; didn't kill them
without checking with the user first (could be the user's own dev server).
Needs a clean `npm run build` before this checkpoint is fully verified.
Also not exercised live in a browser — same no-reachable-local-database
limitation as prior entries. Needs `prisma migrate deploy` on next deploy
(handled automatically by the existing `migrate` service).

### 2026-09-12: Kalenderens dag-visning — nat/dag-grænsens håndtag gjort tydeligere og synligt uden scroll

Brugerfeedback: håndtaget der markerer grænsen mellem nat og dag i dag-visningens
lodrette 00:00–24:00-tidslinje (`SleepBoundaryHandle`/`SleepBands`,
`src/app/calendar/page.tsx`) kunne fremstå placeret "midt i det hele" i stedet
for tydeligt på selve kanten, og krævede scroll for at se ved åbning.

Undersøgt først: `SleepBands`s højdeberegning (top-bånd = 00:00→stå-op,
bund-bånd = sengetid→24:00) var allerede korrekt afgrænset til selve
24-timers-containeren — det tidligere rapporterede "nat vises for langt ned"
(Fejlretninger/FEJLLISTE.md #27) var en højdeberegningsfejl, der blev rettet
2026-09-10, og timelinen kan strukturelt ikke vise nat ud over 23:59/00:00,
fordi containeren altid er præcis 24 timer høj. Ingen reel visningsfejl fundet
her denne gang.

Rettet i denne omgang:
- `SleepBands` har nu en 1px kant (`hf-gray-border/60`) præcis på grænsen
  mellem det grå nat-felt og det hvide dag-felt, så kanten er utvetydig selv
  før man ser håndtaget.
- `SleepBoundaryHandle`s greb er gjort mere synligt (bredere/tykkere bjælke
  med let skygge) og har fået et større usynligt træk-område (28px i stedet
  for 20px), centreret på selve grænsen.
- Initial scroll ved åbning af dag-visningen (`useEffect` i `DayDetails`)
  justeret fra "1 hel time nat-flig" til "~0,8 times flig", så kun en kort
  flig af nattens grå felt er synlig lige over stå-op-håndtaget uden scroll,
  mens resten af den synlige tidslinje er dagens indhold.

Ikke bygget i denne omgang (kræver en separat, større, eksplicit godkendt
opgave jf. AGENTS.md's forbud mod store omskrivninger uden godkendelse): det
"vandrette visning"-mønster brugeren beskrev, hvor en footer skjules og kun en
diskret trækbar streg vises, og en fuld sammenklappelig nat-sektion (fast
"peek"-højde uafhængig af søvnvarighed, med kun én synlig håndtags-kant og
uden at kræve scroll for hverken stå-op- eller sengetids-håndtaget samtidig).
Der findes intet eksisterende "footer skjules ved slide"-mønster andetsteds i
kodebasen at genbruge (bekræftet ved grep i `src/app/calendar/page.tsx`), så
det ville være en ny, ikke-triviel interaktion, der bør designes og
verificeres visuelt med brugeren først, ikke antages ud fra en tekstbeskrivelse.

`npm run lint` clean, `npm run build` gennemført uden fejl (node/npm var ikke
på `PATH` i dette shell-miljø denne gang — fundet manuelt under
`C:\Program Files\nodejs`). **Ikke** visuelt verificeret i browser: en anden
session har allerede en `next dev`-server kørende i samme projektmappe (PID
låser porten/mappen på tværs af port-forsøg), og denne sessions Browser-pane
kan ikke nå den server. Denne ændring bør derfor tjekkes visuelt af brugeren
selv (eller i en senere session, når den anden dev-server ikke kører), særligt
justeringen af scroll-fligen ved forskellige stå-op-tidspunkter.
