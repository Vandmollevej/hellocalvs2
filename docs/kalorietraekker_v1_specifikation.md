# (Forældet) Kalorietrækkeren - v1 produktspecifikation

**Denne fil er forældet og delvist forkert.** Appen hedder nu **HELLO CAL**, og den gyldige, opdaterede specifikation — genopbygget direkte fra den fulde ChatGPT-designsamtale — findes i [SPECIFICATION.md](SPECIFICATION.md) samt [UI.md](UI.md), [AI.md](AI.md), [DATABASE.md](DATABASE.md), [BACKEND.md](BACKEND.md) og [ADMIN.md](ADMIN.md).

Denne fils indhold nedenfor bevares kun som historisk reference og må ikke bruges som kilde.

---

Status: Samlet beslutningsgrundlag fra designforløbet.

> Dette dokument er grundlaget for videre UX-design, datamodel, API, adminløsning og implementering.

## 1. Produkt og platform

- Version 1 er en mobil PWA.
- Kun portrætvisning.
- Kun dansk i version 1.
- Appen skal kunne installeres på hjemmeskærmen og opdateres automatisk.
- Offline-understøttelse for de funktioner, der udtrykkeligt er aftalt.
- Eget logo. Arkitekturen skal kunne udvides til native apps senere.

## 2. Tema, tilgængelighed og interaktion

- Temaer: Lys, Mørk og Følg system. Følg system er standard.
- Dynamic Type understøttes.
- WCAG AA, VoiceOver og TalkBack understøttes.
- Ingen haptisk feedback og ingen app-lyde.
- Hovedfaner kan skiftes med vandret swipe.
- Når et fuldskærmsvindue er åbent, opfanger det swipes, så hovedfanerne ikke skifter.

## 3. Login, konto og sletning

- Login med Apple, Google, e-mail/adgangskode og passkeys.
- Flere loginmetoder kan knyttes til samme konto.
- E-mail og rigtigt navn kan ændres.
- Flere aktive enheder er tilladt. Ingen automatisk logout.
- Ingen biometrisk oplåsning ved hver åbning.
- Kontosletning sker straks uden venteperiode.
- Sletning kræver teksten SLET og ny godkendelse.
- Sletning omfatter konto, persondata, gruppeindhold og alle brugerens egne data.

## 4. Sundhedsintegration

- Apple Health er write-only. Appen læser aldrig data fra Apple Health.
- Samme princip gælder Health Connect.
- Brugeren styrer selv de nødvendige tilladelser.

## 5. Grupper

- Ubegrænset antal grupper, medlemmer og gruppemedlemskaber.
- Grupper har navn og valgfri kort beskrivelse, men intet gruppebillede.
- Administratorer kan omdøbe gruppen, redigere beskrivelsen, invitere, fjerne og ændre administratorstatus.
- Administratorer kan ikke redigere eller slette andre brugeres beskeder.
- At forlade en gruppe og at blive fjernet har samme effekt: alle egne opslag, kommentarer, reaktioner, delte statistikker, milepæle og øvrige data fjernes fra gruppen.
- Hvis kun ét medlem er tilbage, bliver personen administrator.
- Gruppen slettes automatisk, når sidste medlem forlader den. Ingen arkivering.

## 6. Gruppechat

- Én endeløs WhatsApp-lignende chat pr. gruppe.
- Understøtter tekst, automatiske milepælsopslag, svar, reaktioner, læsekvitteringer, skriveindikator, online/sidst set, omtaler, redigering og sletning af egne beskeder.
- Ingen billeder, video, lyd, filer, GIF, stickers, private chats, fastgjorte beskeder eller søgning.
- Redigering er ubegrænset.
- Sletning af egen besked fjerner den for alle.
- @omtaler bruger rigtige navne; ingen brugernavne.

## 7. Profiler og deling

- Profilen er én scrollbar side med komplet historik.
- Brugeren vælger selv, hvad der deles, og deling styres pr. gruppe.
- Opskrifter og ingredienser deles som referencer. Andre kan ikke ændre originalen, men kan vælge Gem som ny.
- Retter gemmes ikke i den fælles database, medmindre de er restaurantretter.
- Restaurantretter knyttes til kæden, ikke filialen.
- Nye restaurantdata gælder kun fremtidige registreringer; historiske registreringer ændres aldrig.

## 8. Hjælp, feedback og support

- Ingen AI-chat til hjælp.
- Hjælp består af onboarding og kontekstuel hjælp.
- Hver hovedfane har en sammenklappet hjælpesektion nederst på siden.
- Hjælp kan indeholde tekst, billeder og animationer.
- Hvad er nyt findes kun under Indstillinger.
- Send feedback er tekstbaseret. Kontakt support er separat.
- På fødevaresider findes Rapportér fejl med kommentarer og billeder.

## 9. Dagens registreringer

- Nederst på start-/tilføjelsesskærmen vises Dagens registreringer.
- Nyeste står øverst.
- Hver række viser tidspunkt til venstre, titel i midten, kalorier under titlen og kvadratisk miniature til højre.
- Titlen vises på højst to linjer og forkortes derefter med ellipsis.
- Miniaturen bevarer billedformatet uden forvrængning og centreres med eventuel luft omkring.
- Tryk åbner posten direkte i fuld skærm uden preview.

## 10. Registreringsdetaljer

- Øverst: Annuller til venstre og Luk til højre.
- Ændringer gemmes løbende, men hovedskærmen opdateres først, når detaljen lukkes.
- Swipe/tilbage svarer til Luk, ikke Annuller.
- Minimal grafik og et lille billede øverst.
- Langt tryk på billedet åbner fuld størrelse med AI-markeringer og ingrediensliste under.
- AI foreslår titel; titlen redigeres direkte ved tryk uden separat redigeringsknap.
- Swipe venstre på en registrering viser Slet. Sletning sker straks uden bekræftelse eller fortryd.
- Ingen synlig 'sidst redigeret'; historik findes kun i loggen.

## 11. Ingredienser og måltidsanalyse

- Ingredienslisten viser én ingrediens pr. række uden gruppering eller manuel rækkefølge.
- Tryk på en ingrediens åbner et separat detaljeoverlay i den nødvendige højde.
- Baggrunden dækkes med 80 % hvidt overlay.
- Overlay lukkes med swipe til siden, tryk udenfor eller swipe op på billedet.
- For AI-estimerede måltider udfyldes vægt, mængde og kalorier automatisk.
- Kalorier kan ændres for AI-estimerede måltider. Sletning af manuel overskrivning gendanner AI-værdien.
- AI ændrer aldrig allerede gemte registreringer automatisk.
- Ved usikker genkendelse spørger appen konkret, fx 'Er dette en avocado?' med Ja, Vælg en anden og Skriv selv.

## 12. Pakkede produkter og næringsdata

- For pakkede produkter bruges næringsdeklarationen.
- Kalorier er låst; brugeren ændrer i stedet mængde, gram eller antal.
- Produktdata kan opdateres i databasen, men tidligere registreringer beholder de værdier, der blev gemt på registreringstidspunktet.
- Udgåede produkter markeres som Udgået og vises nederst blandt relevante søgeresultater.
- Et produkt kan have flere stregkoder.
- Et produkt kan have flere billeder, men ét fast officielt forsidebillede bruges overalt.
- Langt tryk åbner billedvisning med swipe. Indikatoren, fx 3/5, står i højre hjørne lige under billedet.

## 13. Foreslå ændring

- Øverst i produktvinduet vises et trekantet infoikon med i.
- Tryk åbner en lille dialog med Foreslå ændring.
- Herfra åbnes et vindue med redigerbar næringstabel, tekstfelt, vægt samt mulighed for at uploade eller tage flere billeder.
- Forslag behandles af administrator.
- Brugeren kan se indsendt, godkendt eller afvist som meddelelser, men ikke som særskilt statusoversigt på profilen.

## 14. Ukendt stregkode og fælles database

- Ukendt stregkode starter en guidet proces i fire trin med indikator 1/4 osv.
- Trin: stregkode, emballage/forside, næringsdeklaration og ingrediensliste/indhold.
- Efter hvert billede går appen automatisk videre.
- Øverst findes Forrige, Næste og Spring over.
- Stregkoden gemmes som kandidat til den fælles database.
- Administrator adviseres om hver ny tilføjelse og skal godkende billeder og OCR-resultat.
- Administrator kan godkende, rette, afvise, flette, erstatte billeder og vælge officielt forsidebillede.
- Ved dubletter advares administrator. Den ene kan slettes/flettes, og alle links flyttes til den bevarede post uden at ændre tidligere registreringers indhold.

## 15. Scannerlogik

- EAN/GTIN har altid førsteprioritet.
- Alle synlige koder markeres med tydelige gule bokse, også når der kun er én.
- Alle synlige koder læses parallelt i baggrunden. Scanneren må ikke låse sig til den første kode.
- Hvis én kode giver et kendt fødevarematch, åbnes produktet direkte og øvrige koder ignoreres.
- Hvis flere koder giver gyldige produktmatch, vises en liste.
- Irrelevante koder som QR-links, pant-, logistik- og emballagekoder kan blacklistes globalt og ignoreres fremover.
- Scanneren skal altid forsøge at finde enkeltkolli frem for sampak.
- Hvis en sampak scannes, åbnes det tilsvarende enkeltprodukt som 1 stk. Brugeren kan derefter vælge gram eller antal.

## 16. Søgning

- Søgning opdateres løbende, mens brugeren skriver.
- Produktminiaturer vises i søgeresultaterne.
- Favoritter og tidligere brugte varer prioriteres øverst.
- De første seks resultater skal være de mest relevante. Brugeren kan fortsætte ved blot at scrolle; ingen Vis flere-knap.
- Relevans vægter favoritter, tidligere brug, hyppighed, seneste brug, tekstmatch og produktstatus.
- Søgningen understøtter fejlstavninger og delvise ord.
- Ved automatisk rettelse vises lille tekst 'Søger på: [rettet tekst]' med et kryds, som fjerner rettelsen og søger på originalen.
- Personlig historik påvirker rettelser og rangering.
- Når brugeren skriver, vises det bedste tidligere match som lys inline-autosuggestion direkte i søgefeltet.
- Hvis resultatet ikke er klart hurtigt, sløres resultatblokken diskret for at vise, at appen arbejder.
- Et produkt vælges altid ved aktivt tryk. Enter vælger aldrig øverste resultat automatisk.

## 17. Favoritter

- Efter en vare er tilføjet, kan den markeres som favorit via swipe-handling.
- Der bruges ikke et separat favoritikon på produktsiden.
- Favoritter prioriteres øverst i søgning og forslag.

## 18. Meddelelser

- Under profilikonet findes Meddelelser.
- Listen viser nyeste øverst.
- Til venstre vises et typeikon, fx cirkel med G for gruppe, flueben for godkendt, kryds for afvist, pil for opdatering og udråbstegn for system.
- Ulæste meddelelser har lys baggrund, fed tekst og høj kontrast.
- Læste meddelelser har lys grå baggrund, ikke-fed tekst og lavere kontrast.
- Ingen badges eller tællere på appikon eller i appen.
- Swipe venstre på en meddelelse viser Slet. Ingen Slet alle.
- Meddelelser åbner i et nyt fuldskærmsvindue og lukkes med sideswipe, swipe op eller X øverst.
- Typer omfatter indsendt/godkendt/afvist forslag, gruppehændelser, nye versioner, nye funktioner og systeminformation.

## 19. Notifikationsindstillinger

- Push-notifikationer kan slås til og fra pr. type med afkrydsningsfelter.
- Der findes både Slå alle til og Slå alle fra.
- En samlet ændring opdaterer alle felter, som derefter kan justeres enkeltvis.

## 20. Opskrifter

- Kun manuelle opskrifter.
- AI kobler aldrig automatisk et billede til en opskrift.
- En opskrift indeholder ingredienser, mængder og antal portioner.
- Opskrifter kan deles med udvalgte grupper.
- Andre brugere kan gemme en delt opskrift som ny, men ikke redigere originalen.

## 21. Ingrediensdatabase og billeder

- Ingredienser kan være private, delt med udvalgte grupper eller globale efter administratorgodkendelse.
- Kun generiske råvarer som tomat og løg får AI-genererede transparente PNG-billeder; ikke pakkede produkter.
- Billedstilen skal være fotorealistisk med ens vinkel, lys, skala, transparent baggrund, ingen effekter og kun ét objekt.
- Administrator kan godkende, redigere, afvise, flette eller regenerere.

## 22. Produkt- og ingrediensvinduer

- Ingrediens- og opskriftsdetaljer har Apples standard Share-ikon øverst til højre.
- Share-ikonet bruges til deling, privatliv, delingsindstillinger og senere eksport/link.
- På ingrediensdetaljen findes flydende runde knapper øverst til højre til søgning og dokument/menu samt mikrofon nederst.
- Mikrofonen bruges til dikterede rettelser og manglende ingredienser.
- Tryk på søgning forskyder detaljen ca. to tredjedele mod højre og åbner en søgeflade til venstre med samme design som forsiden.
- Søgefladen lukkes med luk, tryk på synlig højre del eller swipe fra højre mod venstre.

## 23. Dataprincipper

- Historiske registreringer er snapshots og ændres aldrig af efterfølgende produkt-, restaurant- eller OCR-opdateringer.
- Fælles databasedata og brugerens registrering skal holdes adskilt via reference plus gemte snapshotfelter.
- Fletning og erstatning må kun ændre den interne reference, ikke det tidligere indtastede indhold.
- Brugeren ejer egne data.

## 24. Åbne punkter

- Detaljeret offline-/synkroniseringsstrategi.
- Endelig datamodel og API-kontrakter.
- Adminroller, auditlog og køprioritering.
- Præcis tærskel for automatisk søgekorrektion.
- Endelig liste over notifikationstyper.
- Teknisk løsning for kamera, OCR, AI-genkendelse og global blacklist.
