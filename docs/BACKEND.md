# Backend, API og synkronisering — HELLO CAL

Se [SPECIFICATION.md](SPECIFICATION.md) for det samlede overblik.

## Hosting og drift

- Backend hostes på brugerens egen Synology NAS (Docker/Container Manager) — ikke Supabase, Vercel eller anden cloud-udbyder.
- Fjernadgang sker via en eksisterende Cloudflare Tunnel — ingen portforwarding.
- Udvikling sker via GitHub (privat repo); drift sker på Synology. Deployment kører via en self-hosted GitHub Actions runner på Synology, for at undgå åbne porte og betalte Actions-minutter.
- Udviklingsfase 1: lokal udvikling uden Docker. Fase 2: flyt til Synology med Docker/Container Manager.

## Database

- **PostgreSQL** (`postgres:16-alpine`), kørende som egen container via `docker-compose.yml` i repoets rod — det officielle Postgres Docker-image kører fint på Synologys Container Manager (både x86- og ARM-baserede modeller), har lavt ressourceforbrug (alpine) og er den mest udbredte, bedst understøttede databasemotor til selvhosting i container.
- Valgt frem for SQLite, fordi appen har flere samtidige skrivende brugere (grupper/chat, community-validering, admin-godkendelse) — SQLite er ikke bygget til samtidig skrivebelastning fra flere brugere.
- Adgang fra appen sker via **Prisma ORM** (`prisma/schema.prisma`) med `@prisma/adapter-pg`-driveren (Prisma 7-krav til direkte databaseforbindelser). Forbindelsesstrengen sættes i `.env` (`DATABASE_URL`, aldrig committet — se `.gitignore`).
- Lokalt: `npm run db:up` starter Postgres-containeren, `npm run db:migrate` opretter/opdaterer skemaet. På Synology: `npm run db:deploy` (kører migrationer uden at generere nye, til produktionsbrug).
- Skemaet i `prisma/schema.prisma` er et første udkast, der dækker kerneprincipperne fra [DATABASE.md](DATABASE.md): brugere, produkter/brands/stregkoder, egne retter/ingredienser, og registreringer som **snapshots** (kalorier/makroer gemmes på registreringen selv, så senere produktopdateringer aldrig ændrer historiske registreringer). Grupper/chat, community-validering/tillidssystem og admin-godkendelsesflow er endnu ikke modelleret og tilføjes i senere iterationer.

## API og AI-omkostninger

- OpenAI API og et Codex-abonnement er to separate betalinger. Codex-betalingen dækker udviklingshjælpen, ikke appens AI-kald.
- API-nøglen skal ligge server-side og aldrig direkte i klienten (iPhone- eller webapp), da den ellers kan blive stjålet.
- AI (OpenAI) bruges kun, når det er nødvendigt. Resultater caches, og dyre AI-kald undgås, hvis data allerede findes i HELLO CALs egen database. En lokal, billig validator screener billeder, før dyre AI-tokens bruges (se [AI.md](AI.md)).

## Dokumentation som kontrakt for Codex

Følgende dokumenter fungerer som en fast kontrakt for AI-assisteret udvikling (Codex):

- **AGENTS.md** — kodeprincipper og spilleregler for AI-assisteret udvikling.
- **PRODUCT.md** — produktbeskrivelse.
- **ARCHITECTURE.md** — teknisk arkitektur.
- **DATABASE.md** — datamodel (se også [DATABASE.md](DATABASE.md) i dette repo).
- **UI.md** — UI/UX-beslutninger (se også [UI.md](UI.md) i dette repo).
- **ROADMAP.md** — plan for kommende funktioner.
- **DECISIONS.md** — logbog over trufne beslutninger.
- **API.md** — API-kontrakter.

AGENTS.md-principperne, som skal følges af enhver AI-assisteret kodeændring:

- Kode skal være læsbar, simpel og modulær.
- Ingen forretningslogik i UI-laget.
- Ingen hardcodede secrets.
- Dokumentationen opdateres, når koden ændres.
- Store omskrivninger kræver eksplicit godkendelse fra brugeren. Mindre forbedringer/rettelser kræver ikke.

> Et tidligere forsøg på at levere hele specifikationen som en Codex-projektmappe/ZIP mislykkedes — filerne var tomme skabeloner, og en række konkrete UI-beslutninger (bl.a. halvcirkel-plusknappen på forsiden, profil- og notifikationsplacering, bundmenuen) gik tabt i den leverance. De nuværende filer i dette repo er genopbygget direkte fra selve designsamtalen for at rette op på det.

## Sundhedsintegrationer

- Apple Health og Google Health Connect: HELLO CAL **skriver** data (vægt, kropsmål, kalorier, makro, vand, vitaminer/mineraler, træning, aktive kalorier, kropsfedt m.m.), hvis brugeren tillader det pr. datatype — appen **læser aldrig** data fra dem. HELLO CAL er den primære datakilde, ikke en satellit til Apple Health.
- Fitbit understøttes som selvstændig integration: appen henter selv aktivitet/forbrænding og evt. vægt fra en tilknyttet smartvægt, i stedet for kun at gå via Apple Health/Health Connect.
- Er en vægt- eller aktivitetsintegration aktiv, overskriver den automatisk den aktuelle værdi i HELLO CAL.

## Offline og synkronisering

- Tidligere data (registreringer, historik, favoritter, opskrifter, tidligere fødevarer) er tilgængelige lokalt uden forbindelse.
- Et banner advarer brugeren, når der ikke er forbindelse. Stemme- og cloud-AI-funktioner deaktiveres offline; søgning fungerer kun lokalt med en tydelig tekst om dette.
- Billeder, der tages offline, gemmes til senere upload — brugeren vælger selv, hvornår de uploades (ikke automatisk).
- Alt synkroniseres automatisk, når forbindelsen genoprettes. Databasen er "sandheden" — data må ikke kun eksistere lokalt permanent.

## GDPR og dataeksport

- Kontosletning sker øjeblikkeligt (ingen fortrydelsesperiode) og understøtter GDPR's "Right to be Forgotten". Allerede anonymiserede AI-træningsdata kan ikke længere kobles til brugeren og slettes derfor ikke separat.
- Brugeren kan altid eksportere alle egne data i et åbent format, uafhængigt af en formel GDPR-udleveringsanmodning.

## Fremtidig specifikationsstruktur

Planen fra designsamtalen er at låse v1-specifikationen og derefter arbejde ud fra emnefiler frem for én lang tekst: UI/UX, AI, fødevaredatabase, scanner, grupper, admin, backend/API, datamodel, algoritmer og offline/synkronisering. Denne mappes filstruktur (SPECIFICATION/ADMIN/AI/BACKEND/DATABASE/UI) er en tilpasset udgave af den plan.
