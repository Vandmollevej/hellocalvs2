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

## Afsluttet 2026-10-11

- PR #400 er flettet som abd501c7d1d9370c88e24c4712c1d3d7d47997bc.
  https://github.com/Vandmollevej/hellocalvs2/pull/400
- Alle commits fra deploy er nu forfædre til origin/master.
- Lokalt: 378/378 tests; lint med 0 fejl og 12 eksisterende advarsler;
  build; Prisma validate/generate; syntaks af 18 Python-scripts;
  native sync/paritet (126 porteret, 6 eksisterende mangler, 113 kun web).
- Alle otte PR-checks er grønne. Native-buildet på den flettede commit
  er også grønt for Android, iPhone og paritet (run 38144958505).
- Build/deploy #714 er grønt, inklusive samtlige robotter:
  https://github.com/Vandmollevej/hellocalvs2/actions/runs/38144958492
- Serveren prøvekørte migrationen på en skemakopi og anvendte derefter
  20261011190000_remove_untouched_duplicate_flow uden fejl.
  Den nye app-container blev sund og erstattede den gamle.
- https://hellocal.io/api/health?deep=1 svarer HTTP 200 / status ok efter deploy.
- Manuel kontrol af Labels og dubletlister kræver admin-login; browseren
  var ikke logget ind. Python-scripts er ikke kørt mod brugerens regneark,
  og telefonfunktionerne er bygget i CI, ikke prøvet på en fysisk telefon.
- Hovedmappen, andre worktrees, lokale importdata og hemmeligheder er bevaret.
  Gamle supersederede branches beholdes som lokal historik. Rootens gamle
  deploy-checkout skiftes ikke automatisk, fordi det har brugerændringer.
