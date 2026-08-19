# Datamodel, produkter, stregkoder og admin-relateret data — HELLO CAL

Se [SPECIFICATION.md](SPECIFICATION.md) for det samlede overblik.

## Grundprincipper

- Historiske registreringer er snapshots og ændres aldrig af efterfølgende produkt-, restaurant- eller OCR-opdateringer. Fælles databasedata og brugerens registrering holdes adskilt via reference plus gemte snapshotfelter. Fletning og erstatning må kun ændre den interne reference, ikke det tidligere indtastede indhold.
- Databasen er "sandheden" — ingen data må kun eksistere lokalt uden synkronisering.
- HELLO CAL bygger sin egen produktdatabase op over tid: første gang et produkt registreres, tages billeder af forside, næringsdeklaration og stregkode, og AI læser og gemmer produktet. Næste gang genkendes det automatisk via billede eller stregkode.
- Stregkodescanning bruger opslag i Open Food Facts som fallback for ukendte produkter.
- Sletning: kun slet, ingen arkivfunktion. Historiske registreringer bevares uændret; en slettet vare kan "gen-tilføjes" fra en tidligere dag (fungerer som en simpel backup).

## Produkter og stregkoder

- Stregkoder er unikke. Findes produktet allerede, bruges det; samtidige oprettelser flettes automatisk (ingen dubletter).
- Et produkt kan have flere tilknyttede stregkoder (nyt design, kampagneemballage m.m.).
- Udgåede produkter slettes aldrig — de markeres "Udgået", forbliver søgbare/registrerbare og vises nederst blandt relevante søgeresultater.
- Ændres et produkts opskrift/næringsindhold, oprettes en ny produktversion; kun fremtidige registreringer bruger de nye data, gamle registreringer forbliver uændrede.
- Et produkt kan have flere billeder, men ét fast officielt forsidebillede bruges overalt. Langt tryk/hold åbner fuldskærmsvisning med swipe og en billedtæller (fx 3/5).
- Produkt med flere pakkestørrelser vises som én vare i søgning; på produktsiden vises undervarer (samme indhold, andre størrelser/stregkoder) nedenunder.
- Findes et internationalt produkt allerede (fx via Open Food Facts), duplikeres/merges det ind i HELLO CALs egen database og kobles til eget brand-logo-bibliotek.
- Fejlmelding fra det internationale bibliotek gemmes som et lokalt override-lag: det internationale ID bevares, den lokale rettelse overskriver kun de rettede felter, og internationale opdateringer må ikke overskrive godkendte lokale rettelser.

## Brands

- Fælles branddatabase (ikke et separat producent-niveau — fx registreres Nesquik som brand, ikke under Nestlé): brandnavn, transparent PNG-logo, alternative stavemåder, AI-genererede søgeord/synonymer, tilknyttede produkter.
- En automatisk logo-agent finder eller behandler brandlogoet; admin har en brandoversigt til kvalitetskontrol og godkendelse (afventer/godkendt/afvist).

## Validering og community

- En fælles valideringsmotor kører for alle importerede/scannede fødevarer: regex, enheder, min/max-værdier pr. kategori, uoverensstemmelser mellem kcal og makroer, dubletter.
- Mistænkelige værdier vises altid med en tydelig advarsel (skjules aldrig). Efter et vist antal brugervalideringer/fejlrapporter deaktiveres varen automatisk, og admin underrettes.
- Community-valideret rettelsessystem: brugere foreslår rettelser, andre stemmer, og høj enighed giver automatisk godkendelse — ellers går forslaget til admin. Én stemme pr. bruger pr. forslag.
- Tillidssystem: alle brugere starter ens; tilliden stiger eller falder ud fra korrekte/forkerte rettelser. Høj tillid giver større vægt i afstemningen. Admin kan altid tilsidesætte resultatet.
- Søgerangering vægter: nyeste version, tilføjelsesfrekvens, trend, brugerhistorik, datakvalitet og geografi/sæson. En trendalgoritme nedjusterer produkter med advarsler eller fejl.
- Ingen labels som "Populær"/"Ny"/"Ofte valgt af dig" i søgeresultater — kun "Tidligere valgt" for brugerens egne tidligere registreringer.

## Kategorier

- Kun én primær kategori pr. produkt/ret (ikke flere samtidig). AI foreslår automatisk en kategori, ellers sættes "Ukategoriseret".
- Faste kategorier i v1 — brugeren kan ikke selv oprette nye kategorier.
- Søgeresultater viser ikke kategorier og har ingen kategorifiltre (afvist pga. lav sikkerhed i søgningen) — kun et rent søgefelt, sortering efter mest populære, pakkestørrelse eller alfabetisk.

## Egne retter

- Egne retter er statiske (ændres kun manuelt af brugeren) med en ingrediensliste (antal/vægt). Ved registrering angiver brugeren den faktiske mængde, og kalorierne beregnes proportionalt.
- Rettens samlede vægt beregnes automatisk (sum af ingredienser), men kan overskrives af brugeren og bliver derefter ny standard.
- Redigering af en egen ret giver tre valg: Opdater (kun fremtidige registreringer) / Gem som ny ret / Opdater og overskriv historiske registreringer (med advarsel).
- Portioner og gram understøttes begge; antal personer er et valgfrit tilføjelsesfelt.
- En ret er en samling af ingredienser (mad og drikke kombineret) — ikke en kategori i sig selv.
- Alle retter (uanset kilde: fælles database, restaurant, AI-estimat, ekstern URL, delt) har samme to handlinger: stjerne (favorit) og "Gem i bibliotek" (opretter en redigerbar kopi — originalen ændres aldrig). Favorit og "Gem i bibliotek" er helt separate funktioner.

## Opskrifter (eksterne/URL)

- Import fra URL/søgning tager hele opskriften med: ingredienser, mængder, antal personer, kalorier/makroer, fremgangsmåde og kilde/URL.
- Gemmes kun, når brugeren aktivt trykker Gem. Mærkes "Ekstern kilde" og indgår **ikke** i den fælles database eller community-validering.
- Kan deles med bruger/gruppe og forbliver mærket "Ekstern kilde" hos alle.
- Kun manuelt admin-godkendte domæner understøttes. Brugeren kan anmode om et nyt domæne via support.
- PDF-import af opskrifter er ikke med i v1, men arkitekturen skal forberedes til det.

## Restauranter

- Restauranter understøttes i v1 via godkendte offentlige URL'er/AI-udtræk. Store kæder (fx McDonald's) kan få egne crawlere. Fejl/mangler sendes til admin-kontrol.
- Restaurantretter knyttes til kæden, ikke den enkelte filial (samme menukort).

## Madudbyder-crawler (fx måltidskasser)

- En bagvedliggende dataagent indsamler retter, kalorier og makroer fra madudbydere (fx HelloFresh) via faste connectors (ikke en skrøbelig scraper).
- Crawleren scanner alle tilknyttede udbydere en gang hver nat. Nye/ændrede retter opdateres, udgåede markeres inaktive (slettes ikke).
- I v1 indgår kun danske madudbydere. Listen over udbydere vedligeholdes manuelt af admin (ikke automatisk opdagelse).

## "Mit bibliotek" og historik (datamodel)

- "Mit bibliotek" er én samlet liste over madvarer, drikkevarer og retter (erstatter separate lister) med søgefelt, filtre (type + brand) og sortering.
- Favoritter er et filter ovenpå biblioteket, ikke en separat liste.
- En vare forbliver i "Tilføjet mad"-listen, så længe den er registreret på mindst én dag ELLER er favorit — fjernes automatisk, når begge betingelser ophører.
- Historikken gælder hele kontoen, er kronologisk opdelt efter år/måned, og logger kun ændringer/tilføjelser (ikke søgninger/visninger). Ingen filtre i historikken. Fungerer som fortryd-mekanisme i stedet for et tidsbegrænset undo.

## Kosttilskud og måltidstyper

- Kosttilskud registreres som almindelige fødevarer i v1 (ingen separat type). Statistikpanelet viser samlet energi-/næringsfordeling over tid.
- Måltidstyper: brugeren kan oprette egne faste typer samt engangsbetegnelser. Ordet "snack" undgås som fast kategori. AI foreslår type ud fra tidspunkt/historik og lærer af rettelser.
