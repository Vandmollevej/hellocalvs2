# Godkendelsesflow og administration — HELLO CAL

Se [SPECIFICATION.md](SPECIFICATION.md) for det samlede overblik.

## Roller

- Kun to roller i v1: **Bruger** og **Administrator**. Ingen moderator- eller support-mellemroller.
- Intet separat admin-system eller admin-app — administratoren logger ind i samme app og får ekstra menupunkter (samme kodebase og design som resten af appen).
- Administratoren kan **ikke** logge ind som en bruger uden samtykke. Det kræver, at brugeren aktivt godkender en adgangsanmodning (via notifikation), sessionen er tidsbegrænset, og alt logges.

## Godkendelsesflow: nye stregkodeprodukter

- Ukendt stregkode gemmes som kandidat til den fælles database, når brugeren har gennemført det guidede firetrins-flow (stregkode, forside, næringsdeklaration, ingrediensliste).
- Administrator adviseres om hver ny tilføjelse og skal godkende billeder og OCR-resultat, før produktet optages i den fælles database.
- Administrator kan godkende, rette, afvise, flette, erstatte billeder og vælge det officielle forsidebillede.
- Ved dubletter advares administrator. Den ene post kan slettes/flettes, og alle links flyttes til den bevarede post — uden at ændre indholdet af tidligere registreringer (de bruger stadig deres gemte snapshot).

## Godkendelsesflow: "Foreslå ændring"

- Brugere kan foreslå ændringer til eksisterende produkter (næringstabel, vægt, kommentar, billeder) via et info-ikon på produktsiden.
- Forslag behandles af administrator (godkend/afvis/rediger).
- Brugeren ser kun resultatet som en meddelelse (indsendt/godkendt/afvist) — ikke som en separat statusoversigt på profilen.

## Godkendelsesflow: brands og produktbilleder

- Administrator har en brandoversigt til kvalitetskontrol af automatisk fundne/genererede brandlogoer (status: afventer/godkendt/afvist).
- Produktbillede-agenten søger/genererer automatisk et transparent PNG; usikre eller dårlige billeder sendes til admin-kontrol.
- Brugeroprettede ingrediensbilleder (kun for generiske råvarer) får status "Afventer godkendelse", indtil admin har godkendt dem. Alle godkendte billeder skal følge en fast stilguide (transparent baggrund, ensartet vinkel/lys/skala, ét motiv pr. billede).

## Community-validering og tillidssystem

- Brugere kan foreslå rettelser til produktdata; andre brugere stemmer. Høj enighed giver automatisk godkendelse, ellers går forslaget til admin.
- Et tillidssystem justerer, hvor meget en brugers stemme/rettelse vægter, baseret på tidligere korrekte/forkerte bidrag. Administrator kan altid tilsidesætte resultatet af afstemningen.
- Efter et vist antal fejlrapporter/negative valideringer deaktiveres en vare automatisk, og administrator underrettes.

## Blacklist (scanning)

- Irrelevante koder (QR-links, pant-, logistik- og emballagekoder) kan blacklistes globalt, så de ignoreres af scanneren fremover. Administrator tilføjer/fjerner koder fra listen.

## Fejlrapporter

- Fejlrapporter (fra "Rapportér fejl"-knappen på fødevare-/retsider, og automatisk indsamlet ved brugerens rettelser hvis samtykke er givet) fungerer udelukkende som træningsdata.
- Der er ingen sagsstyring, ingen status og intet "løst/ikke løst" over for brugeren. Administrator kan filtrere, søge, gruppere og prioritere fejlrapporter til AI-træning.
- Rapporter sløres automatisk for ansigter og personoplysninger, før de er tilgængelige for admin.

## Madudbyder-crawler

- Listen over tilknyttede madudbydere (fx måltidskasse-leverandører) til den natlige crawler vedligeholdes manuelt af administrator — ikke automatisk opdagelse.

## Domæner til opskriftsimport

- Kun domæner, som administrator manuelt har godkendt, kan bruges til import af eksterne opskrifter via URL. Brugere kan anmode om tilføjelse af nye domæner via support.
