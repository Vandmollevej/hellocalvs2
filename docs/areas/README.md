# Arbejdsområder og mappeplan

Kortlagt 2026-09-14 mod den lokale arbejdskopi, inklusive eksisterende
ucommittede ændringer. Dette er en kildeoversigt og et forslag til opdeling,
ikke dokumentation for publicerede eller live-testede funktioner.

## Fire indgange

| Arbejdsområde | Startvejledning | Nuværende primære kode |
| --- | --- | --- |
| Hello Cal | [hello-cal.md](hello-cal.md) | `src/app/calendar`, `statistics`, `profile`, registrering og tilhørende API |
| Admin | [admin.md](admin.md) | `src/app/admin`, `src/app/api/admin`, `src/components/admin` |
| Produktoprettelse | [product-creation.md](product-creation.md) | `src/app/product`, `src/app/camera/create`, produkt-API og OCR |
| Integrationer | [integrations.md](integrations.md) | `src/app/api/integrations`, `src/lib/integrations`, integrationsindstillinger |

Alle kodestier her og i områdevejledningerne er relative til repositoryets
rod. `docs/areas` er dokumentationsmapper, ikke selvstændige apps. Åbn
repositoryets rod som arbejdsmappe; en enkelt route- eller dokumentationsmappe
indeholder ikke alle afhængigheder og kan ikke bygges selvstændigt.

## Anbefalet grænse

Bevar foreløbigt ét repository, én Next-app og ét Prisma-skema. Giv hvert
arbejdsområde egen opgave og startvejledning. Separate apps/repositories og
databaser er ikke vedtaget. Det eksisterende projekt har mange direkte
Prisma-kald fra API-ruter og delte serverfunktioner; MD-filer alene kan ikke
gøre disse til uafhængige projekter.

Følgende ejerskab er et forslag til fremtidige ændringer:

| Data/modul | Foreslået ansvar | Andre brugere af data |
| --- | --- | --- |
| Product, Barcode, Brand, Category, ProductImage, Ingredient, ProductIngredient | Fælles produktmodul | Hello Cal læser; oprettelse indsender; admin retter; eksterne produktkilder importerer |
| Registration, Dish, DishIngredient, Favorite | Hello Cal | Analyse læser registreringernes snapshots |
| User, Passkey, PasswordResetToken og sessioner | Fælles adgangsmodul | Alle områder; admin har særskilt adgangskontrol |
| WeightEntry, BodyMeasurement, WaterEntry, SleepSchedule, WorkShift, Activity, HealthMetric | Hello Cal sundhedsdata | Integrationer skriver tilladte målinger; analyse læser |
| Integration, DeviceToken | Integrationer | Hello Cal viser forbindelser og status |
| PointsTransaction, Subscription, PaymentMethod, Referral | Fælles points-/betalingsmodul | Hello Cal viser; produktgodkendelse kan udløse points |
| BugReport, ProductDuplicateLink, AdminAuditLog | Admin/kvalitetskontrol | Brugere og oprettelse leverer input |
| MessageTemplate, OutboundMessage, NotificationPreference, PushSubscription | Fælles beskedmodul | Admin konfigurerer; flere områder udløser beskeder |
| Medarbejderarbejde og aflønning | Foreslået særskilt modul under admin | Oprettelsesappen registrerer arbejdet; ikke det samme som brugerpoints |

Dette er en ansvarsmatrix, ikke en komplet feltliste eller nye adgangsrettigheder.
Det faktiske skema findes i `prisma/schema.prisma`; migrationer i
`prisma/migrations`. Der oprettes ingen kopier af skemaet pr. område.

## Konkrete koblinger, der skal bevares

- `src/lib/product-approval.ts` ændrer produktstatus, kalder `awardPoints`
  og lægger beskeder i kø. Admin og produktoprettelse er derfor ikke isolerede.
- `Product.createdByUserId` forbinder produkter til User. Skemaets Role har
  USER og ADMIN, men ingen særskilt medarbejderrolle. De nye medarbejderkrav
  er ikke dækket alene ved at give nogen almindelig admin-adgang.
- `Registration` har ernæringssnapshots. Senere produktændringer må ikke
  ændre historiske måltiders næringsdata.
- Fitbit-sync skriver Activity og WeightEntry; Withings-sync skriver
  WeightEntry. Healthkit-ingest bruger DeviceToken og skriver sundhedsdata.
  Eksisterende kode er ikke bevis for fungerende eksterne forbindelser.
- `src/app/api/products/route.ts` blander lokalt produktopslag med import
  fra Open Food Facts. Flytning skal bevare både opslag og importadfærd.
- Lokalkøen i `src/lib/offline-product-queue.ts` genbruges af den aktuelle
  oprettelse. Den dokumenterer ikke i sig selv den nye medarbejderapps
  ønskede baggrundsbehandling og aflønningsregistrering.

## Fælles design og filer

Bevar `design.md` som autoritet. Læs §§1, 3–5, 8 og 12 samt de relevante
komponentafsnit i §6 ved UI-arbejde. Blueprint/audit er ikke nødvendigvis
implementeret kode. Delte komponenter findes især i `src/components/hf`;
fælles styling i `src/app/globals.css`, ramme i `src/app/layout.tsx` og
oversættelser i `src/i18n`. Admin har også `src/lib/admin-i18n.ts`.
Kopier ikke komponenterne til fire uafhængige designsystemer.

Skema, migrationer, fælles produktlogik, adgangskontrol, globale styles,
layout og sprog-filer er tværgående filer: beskriv påvirkede områder før
ændring og koordinér samtidige opgaver. En mappevejledning er ikke en
teknisk adgangsbegrænsning.

## Foreslået fysisk struktur senere — ikke oprettet

Bevar routes i `src/app`. Flyt gradvist forretningslogik til fokuserede
moduler efter en konkret afhængighedsgennemgang:

```text
src/modules/
  products/       fælles produktdata, validering og kvalitet
  product-creation/ indsendelse, OCR og kø
  diary/          registrering og snapshots
  analytics/      analyseberegninger
  account/        profil og onboarding
  integrations/   tjenesteforbindelser og datakonvertering
  rewards/        brugerpoints og indløsning
  employees/      fremtidigt medarbejderarbejde og aflønning
  messaging/      fælles beskeder
```

Det er fremtidige destinationer, ikke eksisterende mapper. Admin og Hello
Cal forbliver visninger over modulerne. Flyt kun ét modul ad gangen med
opdaterede imports og lint/build; ingen stor flytning i denne kortlægning.

## Arbejdsgang for efterfølgende chats

Start én opgave pr. område med følgende tekst, og indsæt vejledningens sti:

> Arbejd i Hello Cal-repositoryet. Læs AGENTS.md, den aktuelle status og
> docs/areas/README.md samt docs/areas/[område].md. Kontrollér den konkrete
> opgaves databehov mod de relevante Prisma-modeller, API'er og komponenter.
> Skeln mellem eksisterende kode, planlagte krav og verificeret drift.
> Angiv mangler med filhenvisninger og ejerskab. Undlad nye funktioner og
> tværgående arkitekturændringer i denne gennemgang.

Områdevejledningerne erstatter ikke AGENTS.md. For at reducere obligatorisk
læsning yderligere er næste dokumentationsskridt at gøre STATUS til et kort
aktuelt overblik, flytte historik med bevarede henvisninger og tilpasse
rodinstruktionen. Det er ikke udført her. Samtidige implementeringsopgaver
bør have isolerede Git-worktrees; den eksisterende ucommittede arbejdskopi
skal håndteres eksplicit, så en ny worktree ikke antages at indeholde den.

## Næste beslutning

Tag stilling til dette forslag om fire arbejdsområder med fælles kode og
database. Derefter kan dokumentationsoprydning og den første begrænsede
moduludskillelse planlægges. Funktionsspørgsmålene i
`docs/PROJECT-BOUNDARIES.md` forbliver parkeret.

## Kontrol og begrænsninger

Kildekortet er kontrolleret ved læsning af route-/biblioteksfiler, skema,
package.json og produktdokumentation. Ingen live-database, leverandørkonti
eller deployment er undersøgt. Dette er ikke en fuld importgraf eller
funktionsaudit. Kun dokumentation ændret; ingen runtime-tests kørt.
