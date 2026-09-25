# Familieabonnement og børneprofiler

Status: afklaret 2026-09-25, under opbygning. Beslutningerne står også i
`docs/DECISIONS.md` 2026-09-25 "Familieabonnement". Denne fil samler
research, brugerens svar, åbne spørgsmål og byggeplanen.

## Formål

Forældre til børn med overvægt skal kunne se deres barns konto og selv taste
ind på barnets vegne. Barnet skal tydeligt kunne se, hvem der har adgang, og
hvornår andre har været inde, hvad de har set, og hvad de har ændret.

## Brugerens beslutninger (2026-09-25)

1. **Kun betalt.** Et familieabonnement er altid betalt, så børn aldrig ser
   reklamer eller partnertilbud.
2. **Betaleren bestemmer.** Den, der betaler, opsætter familien (hvem er med,
   hvem er barn) og giver andre personer adgang til et bestemt familiemedlem.
   Så længe en bruger er koblet på en anden betaler, er det betaleren, der
   bestemmer.
3. **Under 15 år kan man ikke selv oprette en konto.** Profilen skal oprettes
   af en forælder. Barnet kan derefter få sit eget login (valgfrit) via en
   kode fra forælderen.
4. **Barnet kan melde sig ud.** Barnet skal kunne oprette sin egen konto og
   låse de andre ude.
5. **Barnet ser alt som en voksen.** Samme visning som voksne, inkl. kalorier
   og vægt.
6. **Gennemsigtighed.** Barnet skal tydeligt kunne se, hvem der har adgang, og
   en log over, hvornår nogen har åbnet kontoen, hvad de har set, og hvad de
   har ændret. Nye hændelser vises i et panel, der glider ned fra toppen.
7. **Profilvælger.** Øverst i profilvælgeren vælger man profil og kan tilføje
   en ny ("Er det et barn?").

### Min fortolkning (bekræft eller ret)

- Punkt 3 + 4: Barnet kan først melde sig ud af familien (låse andre ude), når
  det er fyldt 15, da udmelding svarer til at oprette sin egen konto. Under 15
  år kan barnet se loggen, men ikke låse forælderen ude.
- Betaleren har altid adgang til alle familiens profiler. Andre voksne får kun
  adgang til de profiler, betaleren vælger.
- Voksne, der er inviteret ind i en familie, kan også se loggen over, hvem der
  har været inde på deres profil (samme regel for alle, ikke kun børn).

## Åbne spørgsmål

- **Beregninger for børn.** Mifflin-St Jeor, underskud/målvægt og advarslen
  "for lavt indtag" (`src/lib/healthy-intake.ts`) er lavet til voksne. Børn
  vokser, og energibehovet beregnes normalt med Schofield-ligningen og et
  aktivitetsniveau på 1,6–1,8 (EFSA). Målet for børn er som regel stabil vægt,
  så BMI falder med højden. Skal børneprofiler (under 18) bruge andre
  beregninger?
- **Pris og antal profiler.** Forslag: 179 kr./md. for op til 6 profiler
  (Seriøs koster 119 kr./md.; familieplaner ligger typisk på 1,4–1,7 × enkeltpris).
- **Hvem må slette hvad?** Må barnet slette en registrering, som forælderen har
  lavet, og omvendt?
- **Registrering for flere på én gang.** Aftensmad tastes én gang med en
  portion pr. person ("Til: Mig · Emma · Oscar" øverst på Tilføj). Ønskes det?

## Research (resumé)

- **De store holder børn ude:** MyFitnessPal 18+, Yazio 16+ (yngre med
  forældresamtykke), Lifesum 13+.
- **WW/Kurbo (8–17 år):** kritiseret af NEDA for at lade børn tracke hver bid og
  sætte vægttab som mål. FTC-bøde på 1,5 mio. USD i 2022 for manglende
  forældresamtykke; data og algoritmer skulle slettes.
- **Nicheapps:** FamilyMacro (forældrestyrede børneprofiler, fælles måltider),
  Sito, NurtureAI, Fitbit (forælder ser og logger for barnet). Ingen er rettet
  mod overvægt, ingen viser barnet, hvad forælderen har gjort, ingen på dansk.
- **Forælderen er den vigtigste drivkraft:** forældre-alene-behandling er lige
  så effektiv som familiebehandling (Boutelle 2011). AAP 2023: familiebaseret
  behandling med aktive forældre giver ikke flere spiseforstyrrelser.
- **Tal om mad, ikke vægt:** vægtsnak fra forældre giver flere slankekure og
  overspisning; snak om sund mad beskytter (Berge 2013).
- **Danmark:** Holbæk-modellen bruger ingen kaloriebegrænsning. Sundhedsstyrelsen
  vil have familien inddraget, frivilligt og uden stigmatisering.
- **Jura:** under 15 år kræver samtykke fra forældremyndighedsindehaveren
  (databeskyttelsesloven § 6, stk. 2, hævet fra 13 til 15 år i 2024).
  Helbredsdata kræver udtrykkeligt samtykke. Sundhedsloven § 17: fra 15 år giver
  den unge selv samtykke. sundhed.dk viser forældre barnets data til 15 år og en
  log over, hvem der har set dem.
- **Gennemsigtighed over for barnet:** UK Children's Code standard 11 kræver et
  tydeligt tegn, når en forælder følger med. EU's DSA-retningslinjer (juli 2025)
  peger samme vej.
- **Butikker:** Apple Familiedeling virker kun ved køb i App Store. Google Play
  stiller ekstra krav, når appen er rettet mod børn. Apple har et
  aldersinterval-API (under 13, 13–15, 16–17, 18+).

Kilder:
[FTC om Kurbo](https://www.ftc.gov/news-events/news/press-releases/2022/03/ftc-takes-action-against-company-formerly-known-weight-watchers-illegally-collecting-kids-sensitive) ·
[NEDA om Kurbo](https://www.nationaleatingdisorders.org/neda-statement-kurbo-ww-app/) ·
[FamilyMacro](https://familymacro.com/) ·
[Fitbit børn](https://support.google.com/fitbit/answer/14236703?hl=en) ·
[Boutelle 2011](https://pubmed.ncbi.nlm.nih.gov/20966907/) ·
[AAP 2023](https://www.healthychildren.org/English/news/Pages/evaluating-and-treating-obesity-in-children-and-adolescents.aspx) ·
[Berge 2013](https://jamanetwork.com/journals/jamapediatrics/fullarticle/1700514) ·
[Holbæk-modellen](https://www.holbaeksygehus.dk/job-og-uddannelse/forskning/holbaek-modellen) ·
[EFSA energi](https://pmc.ncbi.nlm.nih.gov/articles/PMC13159830/) ·
[Samtykkealder 15 år](https://grakom.dk/nyheder/aldersgraensen-for-samtykke-af-personoplysninger-forslaas-aendret-fra-13-til-15/) ·
[Sundhedsloven § 17](https://stps.dk/sundhedsfaglig/ansvar-og-retningslinjer/patienters-retsstilling/informeret-samtykke/boern-og-unge) ·
[sundhed.dk barns data](https://www.sundhed.dk/borger/service/kontakt/hjaelp-borger/barns-data/barnsdata/) ·
[ICO standard 11](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/11-parental-controls/) ·
[EU DSA-retningslinjer](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors) ·
[Apple Familiedeling](https://developer.apple.com/app-store/subscriptions/)

## Byggeplan

1. **Datamodel:** `Family` (ejer = betaler), `FamilyMember` (bruger, barn ja/nej,
   oprettet af), `FamilyAccessGrant` (hvem må se/taste for hvem),
   `ProfileAccessLog` (hvem, hvilken profil, åbnet/set/tilføjet/ændret/slettet,
   hvilket område, hvornår). Børneprofiler er almindelige `User`-rækker uden
   login (e-mail valgfri).
2. **Aktiv profil:** en cookie vælger profilen; serveren tjekker adgang ved hvert
   kald. Kun dagbogsdata (registreringer, vand, vægt, aktivitet, søvn, mål,
   kropsmål m.m.) følger den aktive profil. Login, adgangskode, abonnement,
   integrationer og familieopsætning bruger altid den, der er logget ind.
3. **Log:** hvert kald på en andens profil logges (åbnet, set, ændret).
4. **Profilvælger og familieside** under Profil, bjælke i toppen når man ser en
   andens profil, panel der glider ned med nye loghændelser, logside.
5. **Barnets eget login** via engangskode fra betaleren; udmelding fra 15 år.
6. **Abonnement:** familieplan, alle medlemmer får Seriøs, ingen reklamer eller
   partnertilbud på familieprofiler.
