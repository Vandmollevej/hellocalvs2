# HELLO CAL — aflevering fra ChatGPT til Codex

Kopiér skabelonen til din konkrete opgave og udfyld felterne. Fjern irrelevante afsnit. Opret ikke eksempelfilerne automatisk. Resultatet skal som standard afvente commit, push og deploy.

## Opgave og resultat

- Titel:
- Brugerens ønskede adfærd (gerne før → efter):
- Afgrænsning:
- Leverancestatus: forslag / filer til integration / lokalt integreret / verificeret.

## Faktisk læst grundlag

- Repository, branch og commit (eller "kan ikke fastslås"):
- Dato og eventuelle lokale/uploadede filer, der afviger fra GitHub:
- Produktkrav og beslutninger (fil + afsnit):
- Designregler og referencebilleder (fil + afsnit):
- Eksisterende komponenter, API'er og sidereferencer:
- Manglende nødvendig kontekst / konkrete konflikter:

## Filoversigt

| Handling | Præcis målsti fra repoets rod | Formål |
| --- | --- | --- |
| Ny / ændret | `<sti>` | `<formål>` |

Ved nye filer: vedlæg fuldt indhold. Ved eksisterende filer: vedlæg en målrettet unified diff eller præcist afgrænsede ændringer mod det angivne grundlag. Ingen udeladte dele markeret "resten uændret" i en fil, som skal erstatte en eksisterende fil. Oversæt nye nøgler til både da/en. Angiv eventuelle nye assets og deres oprindelse.

## Side og integration

- URL og tilhørende page.tsx:
- Hvorfra åbnes siden, og hvilken navigationsfil ændres?
- Tilbage/luk, header og bundnavigation:
- Genbrugte UI-komponenter, konkrete props og CSS-klasser:
- Datakilder/API: metode, sti, request, response og fejl:
- Brugeridentitet og adgangskontrol:
- Lagring, snapshots og eventuelle migrationer:
- Nye oversættelsesnøgler:
- Tilstande: normal, loading, empty, error, disabled, selected/expanded:
- Nye centrale designvarianter eller produktbeslutninger, hvis nødvendige:

## Acceptkriterier og verifikation

Beskriv observerbare handlinger og forventede resultater, ikke kun "ser korrekt ud".

| Kontrol | Forventning | Faktisk resultat |
| --- | --- | --- |
| Navigation ind/tilbage | `<adfærd>` | Ikke kørt / bestået / fejlet |
| Data og lagring inkl. genåbning | `<adfærd>` | Ikke kørt / bestået / fejlet |
| Fejl/tomme data | `<adfærd>` | Ikke kørt / bestået / fejlet |
| Mobil 402 × 874 og smallere | `<layout/states>` | Ikke kørt / bestået / fejlet |
| Lint | Ingen fejl | Ikke kørt / bestået / fejlet |
| Build | Gennemført | Ikke kørt / bestået / fejlet |

Notér præcise begrænsninger, fx manglende database, kamera eller installeret Next.js-guide. En mockup eller kodegennemlæsning er ikke visuel verifikation af appen.

## Besked til Codex

> Integrér denne leverance i HELLO CAL. Læs AGENTS.md og de aktuelle projektkilder, kontroller git status og bevar alle eksisterende ændringer. Sammenhold patches med det aktuelle checkout, læs den relevante installerede Next.js-guide og læg filerne i de angivne målmapper. Kontroller navigation, API, snapshots, design og oversættelser. Kør lint/build og relevant funktionel/visuel kontrol. Opdater STATUS og eventuelle varige beslutninger. Lad resultatet ligge lokalt uden commit, push eller deploy. Fortæl præcist hvad der er integreret, hvad der er verificeret, og hvad der eventuelt mangler.
