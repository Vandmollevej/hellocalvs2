# HELLO CAL – samlet design- og funktionsspecifikation (ChatGPT-udkast, 2026-08-27)

Dette dokument er indsat som modtaget fra brugerens parallelle ChatGPT-designsamtale. Det er et arbejdsgrundlag/tjekliste, ikke en erstatning for `SPECIFICATION.md` — hvor de to er i konflikt, gælder `SPECIFICATION.md` og eksisterende implementerede beslutninger i `DECISIONS.md`.

Status pr. punkt: se `STATUS.md` → "Next work" for hvilke CAL/USR/SET/NAV/FAB/STA/FOOD/DES-punkter der allerede er implementeret.

---

## Formål

Dette dokument samler de aftalte ændringer og designkrav til Hello Cal. Det er tænkt som arbejdsgrundlag for Codex/agenter og skal bruges som en konkret implementeringsliste.

## 1. Kalender – månedsvisning

### 1.1 Statusmarkeringer

- Flueben for dage, hvor målet er nået, skal være mørkegrønne.
- Brug samme mørkegrønne farve som appens header.
- Der må ikke være ring/cirkel omkring dage, hvor målet er nået.
- De dage skal ellers se neutrale ud som de øvrige dage.
- Hvis målet ikke er nået:
  - vis et rødt minus-tegn, ikke et kryds/luk-ikon.
  - minus-tegnet skal have samme visuelle størrelse/proportion som fluebenet.
  - brug Hello Cal/HelloFresh-palettens røde accent, hvis en sådan allerede findes.
  - ellers definer en passende mørkerød nuance i den faste palette.

### 1.2 Markering af dags dato

- Den grønne ramme omkring en dato må kun bruges til dags dato.
- Den grønne ramme må ikke bruges som indikator for, om et mål er nået.

### 1.3 Tidligere og kommende dage

- Datoer fra forrige måned skal stadig vises, hvis de indgår i den aktuelle kalenderuge.
- Tidligere dage må gerne have statusmarkeringer.
- Flueben for tidligere dage skal fortsat være grønne.
- Det er kun selve datoen fra den tidligere måned, der skal være visuelt nedtonet.
- Denne nedtoning gælder kun tidligere dage, ikke kommende dage.

### 1.4 Fast grå palette

- Undgå mange tilfældige grånuancer.
- Definér en fast neutral palette med fx: lys grå, mellemgrå, mørkegrå.
- Genbrug de samme nuancer konsekvent.
- Den grå farve, der bruges til datoer fra forrige måned, kan fx også bruges til andre nedtonede elementer og kalenderomkransninger.

## 2. Kalender – månedlig status nederst

Den nuværende forklaring om grøn ramme/flueben skal fjernes.

### 2.1 Primær månedsstatus

Vis en statuslinje under kalenderen.

Inden for målsætning: grønt flueben + "Du er inden for din målsætning. Du har X kalorier til gode." (X sort/fed, resten grå).

Ikke inden for målsætning: rødt minus + "Du er ikke inden for din målsætning. Du har overskredet med X kalorier." (X sort/fed, resten grå/rolig).

### 2.2 Seneste 7 dage

Sekundær linje: "Over de sidste syv dage er du over/under din målsætning." — mindre/lysere, intet ikon.

### 2.3 Streak

Stjerne med antal streak-dage, kun ved ≥5 dage i træk; forsvinder øjeblikkeligt når streaken brydes.

### 2.4 Målopfyldelse i antal dage

"5 ud af 23 dage har du opnået din målsætning." — datid for tidligere måneder, nutid for indeværende.

## 3. Kalender – header og visningsvalg

- Kalenderikon foran overskriften "Kalender", med lille hvid pil ned der viser at det åbner visningsvalg.
- Dropdown: Måned, Listevisning, øvrige visninger. Den ca. 7-dages klikbare liste kaldes "Listevisning".

## 4. Listevisning – ugevisning som liste

- Hver række: ugedag, dato (i lille boks/omkransning der ligner kalenderens datoboks, mellemgrå standard, grøn for dags dato), statustekst ("Du nåede dit mål" / "Du overskred dit mål"), kalorier (grønt hvis mål nået, sort hvis ikke), flueben/minus til sidst (ikke forrest).
- Fjern forældet ring-forklaring.
- Fade-effekt hvis ikke alle 7 dage er synlige, uden at bundmenuen ser unødigt høj ud.
- Ugesnap: scroll lander først på 7. dag; fortsat scroll skifter hele ugen og opdaterer ugeintervallet i toppen.

## 5. Kalender – landskab og dagsvisning

- Landskab: automatisk 7-dages Outlook-lignende ugevisning med tidsakse 00:00–24:00, kalorieindtag placeret på registreringstidspunktet.
- Klik på en dag åbner en lodret dagsvisning med samme tidsakse-princip.
- Swipe vandret mellem dage; fremad-navigation begrænses så man ikke swiper ind i tomme fremtidige dage.

## 6. Søvn og arbejdstider i kalenderen

### 6.1 Søvnmarkering

Brugeren angiver typiske senge- og stå-op-tider under personlige oplysninger. I dags- og ugevisning: sovetid = lysegrå baggrund, vågne timer = hvid baggrund.

### 6.2 Manuel justering direkte i dagsvisning

På overgangen mellem søvn og vågen: hold fingeren kort på grænsen (~0,5 sek, langt nok til ikke at udløses ved almindeligt swipe, men kortere end ikon-omarrangering) og træk op/ned for at justere sengetid/stå-op-tid. Efter ændring spørges brugeren om ændringen gælder kun denne dato eller standardmønstret.

**Status: implementeret 2026-08-27** i `src/app/kalender/page.tsx` (`SleepBands`, `SleepBoundaryHandle`, `WeekTimelineView`, `DayDetails`) mod eksisterende `SleepSchedule`/`WorkShift`-data og `/api/sleep-schedule`, `/api/work-shifts`.

## 7. Personlige oplysninger

Søvnmønster (fast sengetid/stå-op-tid, evt. pr. ugedag), skiftende arbejdstider-toggle, og mulighed for at registrere arbejdstider direkte i kalenderen. **Status: implementeret** (`src/app/profil/soevn/page.tsx`, `/api/profile`, `/api/sleep-schedule`, `/api/work-shifts`).

## 8. Opsætningsguide

Fuldskærms first-run-wizard med trin-progression, "Næste"/"Påmind mig senere"/"Vis ikke igen", spørgsmål om søvnmønster/skiftearbejde og smartwatch-import. **Status: delvist implementeret** (`OnboardingWizard` — kun de tre specificerede spørgsmål; resten af `SPECIFICATION.md` §5-onboarding er ikke defineret, jf. `DECISIONS.md` 2026-08-27).

## 9. Bundmenu

Større ikoner (match HelloFresh-proportioner), langt-tryk-redigeringstilstand med drag-reorder og panel med ubrugte ikoner (iOS Control Center-inspireret).

## 10. Flydende plus-knap / FAB

Flyt/snap venstre-højre med ghost-preview; status-hjulet bytter automatisk side. Visuelt design: mørk, næsten sort, afrundet firkant, hvidt centreret plus, ingen cirkel/outline/gradient/skygge. Separat inline "+ Ny"-komponent uden baggrund.

## 11. Statistikside

Hovedgraf med flere dataserier (kalorier, vægt, …), legend med prikker + pil ned, valg-panel (afkrydsning, huskes), modulære statistik-kort i to kolonner med langt-tryk-redigering, panel med ubrugte kort, og en trækbar "Overskrift"-skilledeler.

## 12. Statistik-kort – visuel reference

Afrundede, næsten kvadratiske ikonbokse (varm beige/grå, ca. `#EEEAE0`), mørk/fed tekst, samme rytme som HelloFresh-kategorifelter.

## 13. Madvareside / opskriftsside

Hero-billede, hoved-/underoverskrift, metadata-række, tags (varm beige pill, ca. `#EAE3D7`), handlingsknapper (lys/hvid, tynd border), sektionsoverskrifter, brødtekst, mørk CTA-bundknap.

## 14. Produktdetaljer, varedeklaration og accordion

Foldbare sektioner uden farvet boks, HelloFresh-chevron-standard (mørk, enkel streg, ingen cirkel/baggrund, samme stroke lukket/åben). **Status: `AccordionCard`-komponent findes** (`src/components/hf/AccordionCard.tsx`) — chevron-detaljer bør efterses mod dette dokuments 14.2 ved næste FOOD-arbejde.

## 15. Generelle designregler

HelloFresh som visuel reference hvor dokumentet specifikt henviser dertil; genbrug grå palette, chevrons, knapprincipper, radiusfamilie og typografisk hierarki konsekvent.

## 16. Foreslået opdeling til Codex/agenter

CAL-01 til DES-02 (se originalt punkt for fuld liste). Hver arbejdsopgave markeres implementeret/ikke implementeret i `STATUS.md`.
