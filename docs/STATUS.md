# HELLO CAL — project status

Last updated: 2026-10-10

## 2026-10-10: Søgning — "Nescafé instant kaffe" og "instantkaffe" finder Nescafé

- Årsag: butiksvarerne hedder fx "Gold" (mærke Nescafé, varetype "Instant kaffe"), og søgningen læste kun navn og mærke; "instantkaffe" i ét ord matchede heller ikke "Instant Kaffe". Nu læses varetype, serie, variant, smag og søgeord med, og sammensatte ord matcher. Gælder web og native (samme API). Se DECISIONS 2026-10-10.
- Tjekket: tsc, eslint, `npm test` (4 nye tests grønne; de 2 kendte røde er røde på master), paritet, build, og lokalt mod Postgres med testvarer: før rettelsen fandt "instantkaffe" kun de generiske varer, efter findes Nescafé-varerne. Ikke prøvet mod produktionsdata.

## 2026-10-10: Søgning — brand og subbrand søgbare og altid øverst

- Subbrand er nu søgbart (titel, brand og subbrand, også når det kun vises som logo). Nævner søgningen et brand eller subbrand, står dets varer altid øverst, sorteret efter resten af søgningen. Nye parametre "Brand nævnt i søgningen" og "Subbrand nævnt i søgningen" (standard 100) + boksen "Søgeparametre" i admin → Søgealgoritmer. Se DECISIONS 2026-10-10.
- Migration `20261010230000_search_subbrand` (trigram-indeks på subbrand, `search_words` genopbygget med subbrand-ord) skal med deployet.
- Tjekket: tsc, eslint på ændrede filer, nye rangeringstests (`src/lib/product-search-ranking.test.mjs`) og brand-tests grønne. Ikke prøvet mod produktionsdata.

## 2026-10-10: Frida-skøn (∼) på varer uden energimærkning

- Ny robot `frida-estimates` (admin → Cron-jobs/Robotter, kl. 02:30 + efter importerne) giver varer uden energimærkning Fridas tal i de tomme felter (∼), opretter stregkoder på alle butiksvarer, regner Valdemarsro-retter ud, når alle linjer kan regnes med, og udfylder delte retter. Tvivlstilfælde: admin → Usikkerheder → Frida-match. Varesiden viser ∼ ved kcal og Fridas kildeangivelse nederst i det udfoldede næringsfelt (web + native). Se DECISIONS 2026-10-10.
- Migration `20261010200000_frida_estimates` (`products.fridaEstimateId`, tabel `frida_estimate_reviews`) skal med deployet. Agenterne (butiksimport, Frida, Valdemarsro) er ændret og bygges om.
- Tjekket: tsc, eslint på ændrede filer, `npm test` (8 nye matchetests grønne; de 2 røde, admin-genveje og sidetræ, er røde på master i forvejen), paritet, sync og build. Matchet er prøvet mod Frida-arket og de 50 eksempelvarer i repoet, ikke mod produktionsdatabasen; første kørsel skriver de rigtige tal i robotloggen.

## 2026-10-10: Søgning — varer uden energitabel kan nu findes

- Årsag: rangeringen fjernede varer uden søgevisninger ved korte søgninger (under 5 tegn), og varerne uden kalorietal havde aldrig været vist. Desuden tog puljen kun de 80 nyeste træffere. Nu rykker lav popularitet kun ned, og puljen vælges efter tekstmatch. Søgelisten viser "Næringsindhold ukendt" (web + native). `/foods` viste et gammelt cachet svar i stedet for det friske. Se DECISIONS 2026-10-10.
- Tjekket: tsc, eslint, paritet, lokal rangeringstest ("vin"/"øl" med en vare uden visninger). Ikke prøvet mod produktionsdata.

## 2026-10-10: Vægt-popup — Withings' webhook blev afvist af adgangsmuren

- Årsag til at tøj-popuppen stadig ikke kom: adgangsmuren (`middleware.ts` → `src/lib/access-wall.ts`) afviser alle klienter uden browser-User-Agent med 403. Withings' tjek af adressen og selve notifikationerne er serverkald, så tilmeldingen fejlede, og vejninger kom først med 15-minutters-jobbet. Webhooks (Withings, Garmin, Stripe, MobilePay) er nu undtaget bot-spærren; ruterne validerer selv.
- Første synk efter en genstart/deploy kører Withings' notifikations-tilmelding igen (én gang pr. integration pr. proces), så rettelsen virker inden for et kvarter efter deploy i stedet for ved næste token-fornyelse.
- Tjekket: tsc, eslint på ændrede filer, paritet. Ikke prøvet mod Withings' rigtige notifikationer; brugerens test: vej dig, og hold forsiden åben.
- Udestående rettet samtidig: alle `weighIn.*`-tekster (tøj-popup, synk-popup, vejningsdetaljer) er oversat til tysk, fransk, hollandsk, svensk og norsk (web + native via sync).

## 2026-10-10: Søgning — viser alt, ignorerer accenter og retter stavefejl

- Deploy-hændelse: den fejlede migration står som fejlet i produktion (P3009), fordi agent-trinnet i `build.yml` kører `migrate` efter en fejlet prøvekørsel. Midlertidig `migrate resolve --rolled-back` ligger i `compose.production.yaml` og skal fjernes, når migrationen er anvendt. Se DEPLOYMENT 2026-10-10.

- Deploy-rettelse: migrationen fejlede på Postgres 17 ("function unaccent(unknown, text) does not exist"), fordi indeks/visninger bygges med begrænset `search_path`. `hc_search_norm()` og alle kald er nu skema-kvalificeret (`public.`). Prøvet lokalt med `SET search_path = pg_catalog, pg_temp` + REFRESH/REINDEX; produktionen var urørt (migrationstesten på skemakopien stoppede deployet).

- `GET /api/products`: varer uden kalorietal er ikke længere skjult; accent-ufølsomt match; ved 0 hits søges på rettet tekst (`correctedQuery`/`originalQuery`), ved 1-2 hits foreslås `suggestedQuery`; `&exact=1` slår det fra. Linjen "Viser resultater for … · Søg i stedet efter …" / "Mente du …?" er i `/search`, `/create-dish`, `/foods` og de tre native skærme; loftet på 6 rækker er fjernet i `/search` og Opret ret. Tekster i `searchCorrection` (7 sprog).
- Migration `20261010120000_search_unaccent_trgm` (extensions `unaccent`, `pg_trgm`, `fuzzystrmatch`, visning `search_words`) skal med deployet og er prøvet mod Postgres 16 lokalt, ikke mod produktionsdata. tsc og lint grønne; `npm run build` og paritet grønne; Kotlin ikke kompileret lokalt; ikke prøvet i browser/på telefon. Se DECISIONS samme dato.
## 2026-10-10: "Styres her"-link ved hver ekstern nøgle i admin

- Admin → API-nøgler: hvert felt viser "Styres her: <menusti>" med det præcise link hos udbyderen (Google Auth Platform → Clients, Meta App settings → Basic, Apple Keys/Services IDs/Membership, Mailjet SMTP/API-nøgler/afsendere, Stripe API keys/Webhooks, Garmin My Apps/Endpoint Configuration, AppGallery Connect My projects m.fl.). Egne API'er kræver nu et link. Se DECISIONS 2026-10-10 og REGLER.
- Hver tjeneste har et anker; forsidens Drift-widget, Beskeder og integrationssiderne linker direkte til tjenesten.
- Kun admin (web) — ingen native-skærm berørt. Tjekket: tsc, eslint på ændrede filer, `npm test` (de 2 kendte røde på master), paritet. Ikke prøvet i browser; Polar, Passio, TeamMessage og Vipps-portalen har ingen fast dyb adresse, så der linkes til det indloggede område med menustien.
## 2026-10-10: Withings-data i realtid og tøj-popup med det samme

- Withings melder nu nye data til `/api/integrations/withings/webhook`. Vægt, kropssammensætning, puls, blodtryk, temperatur, EKG og søvn hentes straks; aktivitet hentes, næste gang appen er fremme (`POST /api/integrations/app-open`, web + native). Forsiden (web + native) tjekker hvert 15. sekund og når appen kommer frem igen, så tøj-popuppen kommer inden for få sekunder. Se DECISIONS 2026-10-10.
- Eksisterende Withings-forbindelser tilmeldes automatisk ved første synkronisering efter deploy; ingen ny tilkobling og ingen migration. Kræver `APP_BASE_URL` på serveren (er sat).
- Tjekket: tsc, eslint på ændrede filer, paritet. Kotlin kompileres i GitHub Actions. Ikke prøvet mod Withings' rigtige notifikationer endnu.

## 2026-10-10: Subbrand over brandet ved produktcirklen

- Varesiden (web + native): subbrandet står oven over brandet til højre for cirklen; begge vises som logo, når det findes, ellers som navn i fed grøn tekst. Se DECISIONS 2026-10-10.
- Ny tabel `subbrand_logos` (migration `20261010120000_subbrand_logos`), `subbrandLogoUrl` i `/api/products/[id]`. Logo-upload i admin og logo-robottens `_import` sætter en fil som subbrand-logo, når intet brand men et subbrand hedder som filen (fx de ventende `Ota Solgryn`, `Kinder Bueno`, `Schulstad Det Gode` i `_import`). Migrationen skal med deployet; Kotlin kompileres i GitHub Actions.

## 2026-10-10: cl-drikkevarer og omregningstabel væsker → gram

- Varer med mængde i cl vises altid i cl (aldrig gram), uanset kategori (web `product-display-unit.ts`, native `FoodLogic.kt`).
- Ny omregningstabel (137 væsker + tørvarer målt i dl, bygget ud fra Frida-varerne): Viden om mad → "Omregning: væsker til gram" (`/viden-om/omregning`, native `KitchenConversions.kt`), `GET /api/kitchen-conversions`. Retter har Mål/Gram-skift over ingredienserne (HelloFresh + egne/delte, web + native), og Indsæt tekst/Scan regner dl/spsk om med tabellen. Tilføj vare fra Opret ret: væsker viser gram med småt i hjørnet af mængdeboksen og et op/ned-ikon; tryk bytter til gram som primært. Se DECISIONS.
- Tjekket: tsc, eslint på ændrede filer, `npm test` (de 2 røde tests — admin-genveje og sidetræ — er røde på master i forvejen), paritet og sync. Ikke prøvet i browser/på telefon.

## 2026-10-10: Trender netop nu som slider med 10 retter

- Delte retter: "Trender netop nu" er nu en vandret slider med op til 10 kort (web `RecipeCard`, native `RecipeCard`). Rangering: klik den seneste måned (seneste uge tæller dobbelt); mangler der klik, fyldes op med tilfældige retter (fast rækkefølge pr. dag), så der altid er mindst tre, når der findes retter.
- Nyt: tabel `recipe_clicks` (migration `20261010100000_recipe_clicks`), `POST /api/recipe-clicks`, `trending=1` på `/api/shared-recipes`. Klik registreres ved tryk på en ret i listen/slideren (højst ét pr. time pr. bruger pr. ret).
- Valdemarsro: importen er bygget (2026-10-08), men agenten skal først deployes og køre; 150 retter pr. nat. Indtil da er knappen Valdemarsro tom. Migrationen skal med deployet. Lint/tsc/build ikke kørt (ingen `node_modules`), Kotlin ikke kompileret, ikke prøvet i browser.

## 2026-10-10: Tøjvalg ved vejning formuleret som "Med …"

- Tilføj vægt (web + native, via sprogfilerne): rækkerne hedder nu "Med undertøj", "Med bukser", "Med top / T-shirt", "Med overdel" (tidl. Sweater), "Med sko" og "Med mobil og andet i lommerne"; "Efter toiletbesøg" uændret. Ingen kodeændring; nøglerne er de samme. Paritet grøn; ikke visuelt testet.

## 2026-10-10: Indberet fejl — bundark pr. punkt, kamera og tak-boks

- `/profile/report-bug` (fra en vare): punkterne er ikke længere dropdowns, men rækker der åbner et bundark med punktet som overskrift, notefelt og under det kamera ("Tag billede", fjern/tag nyt). "Gem" lukker arket; den sorte "Send indberetning"-knap nederst sender alt. Efter indsendelse bliver siden stående, og banneret er erstattet af et sort felt "TAK! Vi har modtaget din indberetning…".
- Fotos: ny kolonne `bug_reports.sectionPhotos` (migration `20261010080000_bug_report_section_photos`), gemt uden EXIF i `public/product-images/bug-report-images` (`src/lib/bug-report-image-storage.ts`), sendt som `sectionPhotos` i POST/PATCH `/api/bug-reports`, vist under hvert punkt i admin. Et punkt med kun foto får teksten "Se vedhæftet foto".
- Native `ReportBugScreen.kt` følger med (`HcBottomSheet`, `Device.takePhoto`). Migrationen skal med deployet. Ikke prøvet i browser/på telefon; Kotlin ikke kompileret lokalt.
