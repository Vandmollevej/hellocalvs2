# Samling af upushet Hello Cal-arbejde

Ejer: Codex, chat om GitHub-forbindelsen, 2026-10-11.
Brugeren har bedt om at gennemgå alt upushet arbejde og samle det sikkert.
Arbejdskopi: `worktrees/github-samling`, branch `codex/samlet-upushet-20261011`.
Udgangspunkt: `origin/master` ved `e0c103b5`.

## Gennemgang

- 160 registrerede worktrees gennemgået. Hovedmappen og de andre worktrees
  bevares; kun samlingskopien ændres.
- `deploy`: 54 lokale commits uden fælles commit-id på master. Git patch-id
  finder 45 uden identisk patch; dette betyder ikke 45 manglende funktioner.
  Master har siden fået 986 commits, og mange ændringer er allerede bygget
  videre i nyere udgaver.
- `deploy` sammenflettes med den aktuelle master. Masters adgangsmur,
  importens næringsbevaring, nye admin-lister, målsætninger, navigation og
  deploykonfiguration bevares ved konflikter. De manglende regnearksscripts,
  navneregler og Labels-siden samles ovenpå.
- 18 af hovedmappens 59 ændrede kode-/dokumentfiler er allerede med som
  identiske patches. De resterende er gennemgået mod den nyere master:
  admin-hastighed/listevalg, mailmaskering, Drinks, søgesynonymer og
  oversættelse findes allerede i nyere udgaver.
- Efterladt `GuideGate`/`Guide`-system erstattes af masters eksisterende
  flow-system (`b6d9bd97`). Det skal ikke indføres som endnu et guidesystem.
- OFF-fotobanneret med 25 points er overhalet af den dokumenterede
  genscanning med 10 points (`docs/DECISIONS.md`, 2026-10-09/11). Den gamle
  fotokolonne/migration indføres ikke ved siden af det aktuelle flow.
- `backup/master-before-sweep` og `wip/final-sweep` er gamle udgaver af
  funktioner, som siden er kommet på master (support, mål, widgets,
  konti, designmanual, analyser). Hele træerne må ikke genindsættes.
- `backup/off-billeder-v1`: OFF-billedkontrollen er allerede flyttet til
  Varedatabase i master og videreudviklet. Den gamle URL genindsættes ikke.
- `claude/native-apps`: native-finjusteringen findes allerede i den
  videreudviklede master (se STATUS, native 121/121). Gammel native-kode
  må ikke overskrive nyere skærme og paritet.
- G11-toksiner findes som `ef641f43`/`be1c9d33` på master; de lokale
  `04a08b79`/`303399b3` er samme arbejde med andre commit-id'er.
- Cardio og dubletrettelser findes i `codex/claude-opfoelgning`; denne
  branch samles efter gennemgang. Den oprindelige arbejdsmappe bevares.
- `hc-syn` har en faktisk upushet rettelse til valg af ental/flertal,
  som samles med søgningens nuværende implementering.
- `hc-flow-wt` har en efterladt migration for dublet-flowet Oprettelse;
  kontroller det aktuelle flow-id før medtagelse.
- `frosty-ellis-4a2003` er en gammel, uafsluttet konflikt om at gendanne
  normale konti. Master har allerede almindeligt login; konflikten
  løses ikke ved at genindføre det gamle vault-/kontotræ.
- `hellocal-build-check` er en delvist tømt buildkopi. Dens massesletninger
  er ikke produktændringer og kopieres ikke ind.
- Øvrige beskidte worktrees indeholder lokale launch-indstillinger,
  buildlogs, genererede klienter eller midlertidige scripts.

## Lokale data

Regneark, rå OFF-svar, produktbilleder, backups og referencebilleder er
lokale import-/arbejdsdata, som de eksisterende importvejledninger holder
uden for Git. De bevares på disken. Recovery-koder, tokens, certifikater,
lokale forbindelsesindstillinger og miljøfiler medtages aldrig.
Håndrettelser til OFF-importen er almindelige produktdata og samles
sammen med scripts, når de er gennemgået.

## Verifikation og næste skridt

Lokalt verificeret: 378/378 tests, lint med 0 fejl (12 eksisterende advarsler),
build, Prisma validate/generate, Python-syntaks, native sync og paritet.
Paritet: 126 porteret, 6 eksisterende mangler, 113 kun web.
Næste skridt: push, GitHub-checks, fletning og deploykontrol. Migrationen
er ikke kørt mod live data; deploy tester den først på en skemakopi.
