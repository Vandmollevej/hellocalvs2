# HELLO CAL – v1 produktspecifikation

Status: Rekonstrueret fra den fulde ChatGPT-designsamtale (OCR'et PDF-eksport, 189 sider). Et tidligere forsøg på at eksportere specifikationen via Codex mislykkedes og efterlod tomme skabelonfiler — denne version genopbygger indholdet direkte fra samtalen.

> Dette dokument er det samlede beslutningsgrundlag. [ADMIN.md](ADMIN.md), [AI.md](AI.md), [BACKEND.md](BACKEND.md), [DATABASE.md](DATABASE.md) og [UI.md](UI.md) uddyber hvert deres område. [DESIGN_V2.md](DESIGN_V2.md) er en supplerende, detaljeret UI-tjekliste (kalender, bundmenu, FAB, statistik, madvareside) modtaget fra en parallel designsamtale — hvor den er i konflikt med dette dokument, gælder dette dokument.

## 1. Produkt og platform

- Appen hedder **HELLO CAL**.
- Version 1 er en PWA (Progressive Web App), installerbar på hjemmeskærmen, opdateres automatisk. Ingen App Store/Google Play-flow i v1.
- Kun telefoner (iOS + Android), responsivt layout til telefonstørrelser — ingen tablet-, web- eller desktop-optimering i v1.
- Kun portrætvisning.
- Kun dansk sprog i v1. Arkitekturen forberedes til flere sprog: AI-oversættelse til alle sprog, men kun 6 sprog (dansk, engelsk, tysk, fransk, spansk, italiensk) er "verificerede/proofede" — resten mærkes "AI-genereret oversættelse". Brugere kan rapportere oversættelsesfejl.
- Appsprog følger telefonens sprog ved første opstart; ændres telefonsproget senere, spørges brugeren diskret (skifter ikke automatisk).
- Dato/tid/tal/enhedsformater følger telefonens regionale indstillinger som standard, men kan tilsidesættes enkeltvis under Indstillinger. Kcal er standardenhed, kJ er valgfrit.

## 2. Tema, tilgængelighed og interaktion

- Tema: Lys, Mørk, Følg system (Auto). Standard er Auto — gælder hele appen inkl. kamera, statistik og admin.
- Dynamic Type understøttes.
- Hele appen skal opfylde WCAG 2.2 AA (eller nyere) som et tværgående krav: VoiceOver/TalkBack, labels, ikke kun farve-afhængig info, kontrast, stor tekst, store trykflader, reducerbare animationer, tastatur/switch-control, tilgængelig eksport.
- Ingen haptisk feedback og ingen egne lydeffekter i v1.
- Hovedfaner skiftes med vandret swipe. Denne swipe deaktiveres, når et fuldskærmsvindue er åbent.
- Global regel: swipe kan altid lukke et fuldskærmsvindue (samme effekt som "Luk").
- Global regel: ingen "Gem"-knap noget sted i appen. Alt gemmes automatisk løbende. "Luk"/"Annuller" er de eneste relevante handlinger.
- Kort tryk = åbn/se detaljer. Langt tryk = tilføj direkte som ny registrering (med haptisk-lignende visuel "Tilføjet"-animation). Gælder favoritter, tidligere brugte, søgeresultater, kalender og statistik.

## 3. Login, konto og sletning

- Kontooprettelse er invite-baseret: administrator sender invitation via e-mail, SMS eller link.
- Login: e-mail/adgangskode, Apple, Google, 2FA og passkeys (Face ID/Touch ID/Windows Hello). Flere loginmetoder kan knyttes til samme konto.
- Kontooprettelse kræver e-mail-bekræftelse, accept af vilkår og valg om AI-samtykke. Ingen gæstetilstand.
- Én profil pr. konto. Ingen husstands-/familieprofiler. Appen er for alle aldersgrupper — alle konti er uafhængige, ingen forældrekontrol af andres konti.
- Flere aktive enheder er tilladt, data synkroniseres. Enheder kan logges ud enkeltvis (ingen "log ud af alle enheder"-funktion).
- Ingen automatisk logout ved inaktivitet. Ingen biometrisk lås ved hver åbning — appen åbner direkte hvis allerede logget ind.
- E-mail og navn kan ændres når som helst. E-mailændring kræver adgangskode + verifikationsmail til den nye adresse. Navneændring slår igennem overalt, inkl. historiske beskeder.
- Password-reset via tidsbegrænset, éngangs e-mail-link.
- Kontosletning sker øjeblikkeligt uden fortrydelsesperiode. Kræver at brugeren skriver "SLET" som bekræftelse.
- Sletning omfatter konto, persondata, gruppeindhold og alle brugerens egne data. Allerede anonymiserede AI-træningsdata kan ikke kobles til brugeren og slettes derfor ikke separat.
- Ingen "nulstil historik"-funktion — vil brugeren starte forfra, skal kontoen slettes og en ny oprettes.
- Bruger kan altid eksportere alle egne data i åbent format (ud over GDPR-udlevering).

## 4. Sundhedsintegration

- Apple Health og Google Health Connect er **write-only fra selve webappen**: HELLO CAL skriver data (vægt, kropsmål, kalorier, makro, vand, vitaminer/mineraler, træning, aktive kalorier, kropsfedt m.m.) hvis brugeren tillader det pr. datatype — webappen kan aldrig læse data derfra (Apple/Google tillader det kun for native apps). En separat, endnu ikke bygget native companion-app kan læse HealthKit/Health Connect og sende data videre til HELLO CALs egen database via et enhedstoken — se `docs/HEALTHKIT_COMPANION.md`. HELLO CAL forbliver den primære datakilde/database uanset kilden til den enkelte måling.
- Fitbit understøttes som selvstændig integration (ikke kun via Apple Health), inkl. hentning af aktivitet/forbrænding og evt. vægt fra tilknyttet smartvægt.
- Er en vægt-/aktivitetsintegration aktiv, overskriver den automatisk den aktuelle værdi i HELLO CAL (fx seneste vægtmåling).

## 5. Mål og aktivitetsniveau

- Ved onboarding vælges målsætning (vægttab, vægtøgning, vedligeholdelse, muskelopbygning, fedtprocent, kropssammensætning) — flere måltyper kan være aktive samtidig.
- Nuværende vægt, målvægt og ønsket slutdato angives, eller AI foreslår en realistisk slutdato. Ændring af dato eller kaloriebudget genberegner automatisk det andet.
- Aktivitetsniveau har 6 niveauer, beregnes automatisk (kan ikke vælges manuelt) via et guidet spørgeflow eller import fra Apple Health ved onboarding. Niveauet opdateres løbende fra Health-data.
- Kaloriemål genberegnes ikke automatisk. Hvis aktivitetsniveauet har ændret sig markant over 3 måneder OG vægten ikke følger målet, vises en prompt ved login med forslag til nyt mål: "Opdater mål" / "Spørg mig igen senere" / "Behold nuværende mål" / "Spørg mig ikke igen".
- Urealistiske mål blokeres ikke — appen advarer og giver evidensbaserede forslag, men brugeren bestemmer selv ("Appen er en rådgiver, ikke en dommer").
- Kaloriebank: ekstra forbrændte kalorier fra registreret aktivitet kan lægges 100 % i dagens budget, 100 % i en bank, eller deles via en slider — valgt hver gang ny aktivitet registreres, med visning af konsekvens for måldato.
- Vægtvisning arbejder med Målt vægt, Trendvægt (AI-beregnet) og Forventet vægt; AI lærer brugerens personlige udsvingsmønstre (morgen/aften, efter træning). Præcis visningslogik er endnu ikke færdigbesluttet.
- Mål, vægtnoter, dagbog og egne noter kan altid indtales/indtastes i naturligt sprog — AI udfylder felter, brugeren retter.

## 6. Forsiden og navigation

Se [UI.md](UI.md) for fuld detalje. Kort opsummeret:

- Bundnavigation: **Tilføj** (hjem), **Madvarer**, **Kalender**, **Statistik**.
- Forsiden ("Tilføj") har en central, halvcirkelformet **+**-knap (ca. 1/3 af skærmbredden) i den ergonomiske tommelfingerzone. Position kan flyttes venstre/højre i indstillinger.
- Tryk på +-knappen åbner en radial menu med tre ikoner: Kamera, Mikrofon, Søg.
- Ved siden af +-knappen vises et lodret nøgletalspanel (kalorier størst/først), og under +-knappen vises dagens registreringer som en lodret, scrollbar tidslinje (nyeste øverst).
- Øverste bjælke: venstre cirkel med brugerens initialer (åbner Profil/Indstillinger/Skift konto/Log ud), midt evt. dato, højre plads til luk-kryds på sider der kan lukkes.

## 7. Grupper

- Ubegrænset antal grupper, medlemmer og gruppemedlemskaber.
- Grupper har obligatorisk navn og valgfri kort beskrivelse. Intet gruppebillede/banner.
- Invitation kun via e-mail, SMS eller link (ingen søgning på brugernavn/e-mail). Har modtager ikke appen, føres de til App Store/Google Play og tilbage til invitationen.
- Grupper kan have flere ligestillede administratorer (ingen særskilt "ejer"). Administratorer kan omdøbe gruppen, redigere beskrivelsen, invitere, fjerne medlemmer og ændre admin-status.
- Administratorer kan **ikke** redigere eller slette andre brugeres beskeder.
- At forlade en gruppe og at blive fjernet har samme effekt: alle egne opslag, kommentarer, reaktioner, delte statistikker, milepæle og øvrige data fjernes fra gruppen. Forlad kræver en bekræftelsesdialog og logges i personlig historik.
- Hvis kun ét medlem er tilbage, bliver personen administrator. Gruppen slettes automatisk, når sidste medlem forlader den — ingen arkivering, ingen manuel sletning.
- Nye medlemmer kan læse hele gruppens historik fra start; indhold fra udmeldte medlemmer er slettet og ses ikke.
- Deling af data (vægtudvikling, statistik, træning) styres pr. gruppe, ikke globalt eller pr. person — alle medlemmer i en gruppe har samme adgangsniveau. Nye medlemmer arver automatisk gruppens eksisterende delingsrettigheder.
- Bruger er altid synlig som gruppemedlem, men styrer selv hvilke data der vises for andre.

## 8. Gruppechat

- Én permanent, kronologisk WhatsApp-lignende tekst-tråd pr. gruppe (ingen nye tråde pr. begivenhed).
- Understøtter: tekst, automatiske milepælsopslag, svar, et fast begrænset sæt reaktioner (ikke fri emoji), læsekvitteringer, leveringsstatus, skriveindikator, online/sidst set, @omtaler (valgt fra medlemsliste, ikke separate brugernavne), redigering og sletning af egne beskeder.
- Ingen billeder, video, lyd, filer, GIF'er, klistermærker, private beskeder, fastgjorte beskeder eller søgning i chatten.
- Redigering er ubegrænset i tid. Sletning af egen besked fjerner den for alle.
- Milepæle (fx målvægt nået) kan deles med udvalgte venner/grupper — helt valgfrit og brugerstyret, ingen automatiske AI-beskeder uden samtykke. Hver delt milepæl har én kommentar-/reaktionstråd synlig for alle inviterede.

## 9. Profiler og deling

- Profilen er én scrollbar side uden faner eller undersider, med komplet historik (ingen kunstig 30-dages-begrænsning).
- Profilen er privat som standard. Gøres den synlig, ser andre kun procentvis udvikling/aktivitet/community-bidrag — **ikke** vægt, kalorier eller konkret indtag.
- Delingsindstillinger sættes pr. gruppe (forskelligt indhold kan deles med forskellige grupper).
- Opskrifter og ingredienser deles som referencer — andre kan ikke ændre originalen, men kan vælge "Gem som ny".
- Egne retter kan deles med enkelt bruger eller gruppe. Modtager vælger "Tilføj til bibliotek" (følger opdateringer) eller "Gem som egen kopi". Hele måltider (ikke kun enkeltretter) kan også deles på samme vis; gruppemedlemmer får notifikation og vælger selv om det tilføjes.
- Retter gemmes ikke i den fælles database, medmindre de er restaurantretter. Restaurantretter knyttes til kæden, ikke filialen. Nye restaurantdata gælder kun fremtidige registreringer.
- Brugeren ejer egne data fuldt ud og kan altid ændre delingsindstillinger eller forlade en gruppe (GDPR-princip).

## 10. Hjælp, feedback og support

- Ingen AI-chat til hjælp. Hjælp består af en tvungen, interaktiv onboarding (learn-by-doing, ikke lange forklaringer) og kontekstuel hjælp.
- Hver hovedfane har en sammenklappet hjælpesektion nederst på siden (foldet sammen som standard).
- "Hvad er nyt" findes kun under Indstillinger — ingen tvungen popup efter opdateringer. Ingen beta-/eksperimentel funktionssektion.
- "Send feedback" (under Indstillinger) er tekst + kategori uden vedhæftninger. "Kontakt support" er separat (tekst, kan auto-vedhæfte tekniske oplysninger med samtykke).
- På fødevare-/retsider findes en fast "Rapportér fejl"-knap (dropdown med fejltype, valgfrit kommentarfelt, billede/kamera/galleri). Fejlrapporter fungerer udelukkende som træningsdata til admin — ingen sagsstyring, status eller "løst/ikke løst".
- Kun ved separat, frivilligt opt-in ("Hjælp med at gøre appen klogere") sendes AI-resultater/rettelser automatisk til admin som træningsdata; kan tilbagekaldes; ansigter/personoplysninger sløres automatisk.

## 11. Registreringsdetaljer

Se [UI.md](UI.md) for fuld detalje. Nøglepunkter:

- Øverst: Annuller til venstre (kasserer ændringer), Luk til højre (ændringer er allerede gemt løbende). Hovedskærmen opdateres først, når detaljen lukkes.
- Detaljevindue åbner altid i fuld skærm, aldrig som bottom sheet.
- Swipe venstre på en registrering viser en rød "Slet"-knap (Mail-app-stil) — intet slettes ved swipet selv, kun ved tryk. Ingen bekræftelse, intet fortryd-bjælke.
- Swipe højre = Favorit (opretter en duplikat til hurtig genbrug).
- AI foreslår titel; titlen redigeres direkte ved tryk uden separat redigeringsknap.
- Kalorier er låst, hvis de kommer fra en emballages næringsdeklaration (redigeres kun via mængde). For AI-estimerede retter kan kalorier overskrives manuelt; sletning af den manuelle værdi gendanner AI's standardværdi.
- AI ændrer aldrig en allerede gemt registrering automatisk, heller ikke ved senere modelforbedringer.
- Ingen synlig "sidst redigeret"; historik findes kun i loggen.

## 12. Fødevaredatabase, AI og scanning

Se [DATABASE.md](DATABASE.md) og [AI.md](AI.md) for fuld detalje. HELLO CAL bygger sin egen fødevaredatabase op over tid (foto af forside/næringsdeklaration/stregkode → AI læser og gemmer), med Open Food Facts som fallback for ukendte produkter, community-validering med et tillidssystem, og admin-godkendelse af nye stregkodeprodukter, brands og produktbilleder.

## 13. Kalender og statistik

- Kalenderoversigt viser en grøn markering, når (brugerdefinerede) mål er opfyldt en given dag, og en rolig rød markering, når det ikke er tilfældet.
- En streak-indikator (stjerne med antal dage) vises, når målet er nået mindst 5 dage i træk, og forsvinder straks streaken brydes. Ingen øvrige badges eller kunstige motiverende beskeder. AI giver kun faktabaserede indsigter.
- Statistikpanel viser samlet energi-/næringsfordeling over tid, inkl. kosttilskud (registreres som almindelige fødevarer, ingen separat type i v1).

## 14. Dataprincipper

- Historiske registreringer er snapshots og ændres aldrig af efterfølgende produkt-, restaurant- eller OCR-opdateringer.
- Fælles databasedata og brugerens registrering holdes adskilt via reference plus gemte snapshotfelter. Fletning og erstatning må kun ændre den interne reference, ikke det tidligere indtastede indhold.
- Brugeren ejer egne data.
- Database er "sandheden" — ingen data må kun eksistere lokalt uden synkronisering.

## 15. Åbne punkter

- Præcis vægtvisnings-logik (målt vs. trend vs. forventet vægt).
- Endelig liste over notifikationstyper.
- Endelig datamodel- og API-kontrakt (se [BACKEND.md](BACKEND.md) for arkitekturprincipper).
- PDF-import af opskrifter (arkitektur forberedes, ikke i v1).
- QR-kode-menuer / digital menuintegration (udskudt).
- Hello Fresh-kontologin (udskudt): integrationen skal senere understøtte login til brugerens Hello Fresh-konto. (Valg af antal personer/gram ved tilføjelse af en Hello Fresh-ret er implementeret, se `/tilfoej/[id]`.)
