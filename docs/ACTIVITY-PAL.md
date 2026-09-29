# Aktivitetsniveau, energibehov og kaloriemål — plan

Status: **F0–F6 bygget** (2026-09-29): beregningsmoduler med tests, skema + migration `20260929190000_activity_pal_budget`, onboarding-trin `activity` med 8 sider, regnestykke-kort (`EnergyBreakdown`) i guiden og på Profil, API `/api/profile/activity`. Beslutningerne står i `DECISIONS.md` (2026-09-29: Aktivitetsniveau, PAL og kaloriemål). Kilderækkefølge: WHO og Sundhedsstyrelsen (definitioner af intensitet), DGE (PAL), Compendium of Physical Activities (MET). Kildelinks: se brugerens oprindelige brief i sessionen; de vigtigste er `pacompendium.com`, `dge.de/wissenschaft/referenzwerte/energie/` og sst.dk's anbefalinger for voksne 18–64 år.

## Formål

Give brugeren et energibehov og et kaloriemål, der er forståeligt og ærligt om sin usikkerhed, og som bliver bedre over tid. Forskellen fra andre apps:

1. Brugeren ser **regnestykket** vokse frem i stedet for et anonymt tal.
2. Spørgsmålene er konkrete ("hvordan var i går?") frem for "hvor aktiv er du?".
3. Tallet vises som **interval med "ca."**, aldrig som falsk præcision.
4. Estimatet **kalibreres løbende** mod vægt over tid og forklares.

## Begreber (må ikke blandes)

- **BMR** — hvilestofskifte (Mifflin-St Jeor for voksne, Schofield under 18; findes i `estimateBmr`).
- **Hverdags-PAL** — hverdagen uden motion: arbejde, gang, stående, transport, husarbejde. Ganges på BMR.
- **Træningstillæg** — brugerens typiske motion (fast tillæg, se nedenfor).
- **Logget/målt aktivitet** — konkrete aktiviteter (MET) eller enhedens målte aktive energi.
- **Kaloriemål** — energibehov ± vægtmål.

## Onboarding-flow (erstatter de 5 sider i DESIGN_V2 §8)

En side pr. spørgsmål (HelloFresh-slidersider), progression, "Ved ikke" altid muligt, "Tilføj gennem integration i stedet" på Vægt og Skridt. Findes en integration med skridt/aktiv energi, springes de relevante sider over.

| # | Side | Svar |
|---|---|---|
| 0 | Kort forklaring | "Hvile + hverdag + motion. Vi viser regnestykket." |
| 1 | Arbejde/studie | Næsten kun siddende · Mest siddende, lidt gang · Blandet · Mest stående/gående · Fysisk krævende |
| 2 | Gang/stående pr. dag | Under 1 t · 1–2 t · 2–4 t · 4–6 t · Over 6 t |
| 3 | Transport | Bil/kollektivt · Lidt gang · En del gang · Cykler/går jævnligt · Meget hver dag |
| 4 | Skridt | Under 3.000 · 3–5.000 · 5–7,5.000 · 7,5–10.000 · 10–15.000 · Over 15.000 · Ved ikke |
| 5 | Motion: hyppighed og varighed | Sessioner pr. uge (0–7) og typisk varighed (15/30/45/60/90+ min) |
| 6 | Intensitet (taletest, Sundhedsstyrelsen) | Næsten ikke forpustet · Let forpustet, kan tale normalt · Tydeligt forpustet · Svært at føre samtale |
| 7 | Resultat | Foreslået niveau, PAL, regnestykke, "Hvordan vurderes dette?", "Ret niveau" |

## Beregning

### Hverdags-PAL (forslag, justeres ved test)

`PAL_spørgeskema = 1,40 + arbejde + gang/stående + transport`, begrænset til 1,2–2,0 (uden motion)

| Arbejde | + | Gang/stående | + | Transport | + |
|---|---|---|---|---|---|
| Næsten kun siddende | 0,00 | Under 1 t | 0,00 | Bil/kollektivt | 0,00 |
| Mest siddende | 0,04 | 1–2 t | 0,03 | Lidt gang | 0,02 |
| Blandet | 0,09 | 2–4 t | 0,06 | En del gang | 0,04 |
| Mest stående/gående | 0,22 | 4–6 t | 0,10 | Cykler/går jævnligt | 0,06 |
| Fysisk krævende | 0,32 | Over 6 t | 0,14 | Meget hver dag | 0,09 |

(Arbejde og gang overlapper delvist; tallene er valgt, så eksempelprofilerne rammer niveauernes intervaller: kontor + bil = 1,40 (niveau 2), kontor + cykling + 2–4 t gang = 1,56 (niveau 3), butik + 4–6 t gang = 1,76 (niveau 4), tungt arbejde + meget gang = 1,95 (niveau 5). Tabellerne skal enhedstestes mod de fem niveaueksempler før bygning.)

**Skridt-PAL:** under 3.000 → 1,30 · 3–5.000 → 1,40 · 5–7,5.000 → 1,50 · 7,5–10.000 → 1,60 · 10–15.000 → 1,75 · over 15.000 → 1,90.
**Samlet:** 70 % spørgeskema + 30 % skridt (50/50 ved målte skridt). Skridt ukendt: kun spørgeskema, lavere sikkerhed.
Skridt er en indikator, ikke en kalorieformel (tempo, terræn, vægt og skridtlængde mangler).

### Fem niveauer

Grænser lagt midt i hullerne i kildeintervallerne:

| Niveau | PAL-interval | Repr. PAL | Eksempel |
|---|---|---|---|
| 1 Meget lidt aktiv | under 1,40 | 1,30 | Sidder/ligger det meste af dagen, næsten ingen gang |
| 2 Stillesiddende | 1,40–1,55 | 1,45 | Kontor/studie, bil, begrænset gang |
| 3 Almindeligt aktiv | 1,55–1,75 | 1,65 | Stillesiddende job men jævnlig gang/cykling |
| 4 Meget aktiv | 1,75–1,95 | 1,85 | Butik, tjener, mekaniker, meget stående/gående |
| 5 Ekstremt aktiv | 1,95 og op | 2,00 | Tungt bygge-, land- eller skovarbejde |

Niveau 5 er **kun tungt fysisk hverdagsarbejde**. Stor træningsmængde og konkurrenceidræt hører under træningstillægget.
Børn under 18 bruger fortsat EFSA-værdierne (`childPhysicalActivityLevel`).

### Træningstillæg (fast tillæg, uden dobbeltregning)

- Netto-MET for intensiteten: taletest → MET-klasse (let 3, moderat 4,5, høj 7, meget høj 9; sluttes mod Compendium pr. aktivitet, når den logges).
- `træning/uge = sessioner × timer × (MET − 1) × kg`; `tillæg pr. dag = træning/uge ÷ 7`.
- **MET regnes altid netto (MET − 1):** hvilestofskiftet i træningstimen er allerede med i BMR × PAL. Brutto (MET × kg × t) giver ca. 1 MET for meget pr. time.
- **Regel for dagen:** har dagen logget eller målt aktivitet, gælder den *i stedet for* dagens tillæg (`max`-reglen: `dagens ekstra = logget`, ellers `tillæg`). Dage uden aktivitet får gennemsnitstillægget. Det giver et glat ugegennemsnit; en let overvurdering på hviledage rettes af kalibreringen.
- Har en enhed målt aktiv energi for dagen, erstatter den både hverdags-PAL-delen og tillægget: `dag = BMR + aktiv_målt`.

### Datakilder pr. dag (prioritet)

| # | Kilde | Beregning | Sikkerhed |
|---|---|---|---|
| 1 | Målt aktiv energi (Apple/Health Connect/Fitbit/Garmin) | BMR + målt | Høj |
| 2 | Distance + tid + vægt | gang/løb-MET efter hastighed (Compendium) | Middel-høj |
| 3 | Logget aktivitet + taletest | netto-MET × kg × t | Middel |
| 4 | Kun skridt | PAL justeres højst ±0,15 mod baseline | Lav |
| 5 | Ingen data | baseline-PAL + tillæg | Lav-middel |

Puls omsættes ikke direkte til kalorier; den bruges kun som intensitetssignal.

## Kalibrering (dynamisk, over tid)

- Ingen bekræftelse: estimatet justeres løbende og forklares ("Sådan har vi justeret" viser formel, dine data og brugt værdi).
- Læring: `TDEE_lært = gns. indtag − (Δ trendvægt × 7700 ÷ dage)` over glidende 28–56 dage på trendvægten (`weight-trend.ts`).
- Blanding: `brugt = formel × (1 − w) + lært × w` med `w` stigende med datamængden og højst ca. 0,7, så formlen aldrig helt forsvinder. De eksisterende grænser (mindst 14 loggede dage, 3 vejninger, 14 dages spænd, afvisning uden for 0,7–1,4 × formel) bevares.
- Udelad dage, hvor indtaget er under det sunde minimum (sandsynlig underlogning).
- Vis "din faktiske hverdags-PAL lige nu ≈ 1,52" som pædagogisk forklaring.
- Vægtens tal er estimat: vand, glykogen og salt flytter kortvarig vægt (jf. `weekly-energy-summary.ts`).

## Kaloriemål

- Målformer: vedligehold, tabe sig, tage på. Vægtmål og tempo (kg/uge).
- Tempo: tabe 0,25 / 0,5 / 0,75 kg/uge (inden for sundhedsgrænserne nedenfor); tage på 0,1–0,25 kg/uge.
- `underskud/dag = tempo × 7700 ÷ 7` (0,5 kg/uge ≈ 550 kcal). `budget = energibehov ± underskud`, aldrig under `minimumHealthyKcal` (`healthy-intake.ts`).
- **Sundhedsgrænser (hårde, kan ikke overstyres af brugeren):** budget aldrig under BMR og aldrig under 1.200 kcal (kvinde/ukendt) eller 1.500 kcal (mand); underskud højst 20 % af energibehovet; tempo højst 0,5 kg/uge (0,75 kun ved BMI ≥ 30) og aldrig over 1 % af kropsvægten; vægtmål aldrig under BMI 18,5 (appen foreslår ikke under BMI 20); ved BMI under 25 kun vedligehold eller langsomt tempo (højst 0,25 kg/uge); tage på højst 0,25 kg/uge. Viser brugerens ønske noget lavere, vises det sunde alternativ med forklaring. Ekstreme svar (fx meget lavt vægtmål eller gentagne dage under gulvet) giver en rolig henvisning til læge, ikke et strengere mål.
- Under 18 år: ingen underskud, kun vedligehold (jf. FAMILY.md). Undervægt (BMI under 18,5): ingen vægttabsmål. Gravide/ammende: anbefal læge, ingen underskud.
- Forventet dato vises som interval og genberegnes ved hver ny vægt.
- `DAILY_KCAL_GOAL` i `src/lib/goals.ts` er nu kun fallback for dage før brugerens første budget-snapshot. `DAILY_PROTEIN_GOAL` og `WEIGHT_GOAL_KG` er stadig faste (uden for denne opgave).

## Usikkerhed

- Interval fra BMR-spredning (ca. ±10 %) og PAL-usikkerhed (±0,10 ved fuldt spørgeskema, ±0,20 ved "ved ikke", stigende ved manuel overstyring).
- Afrund til nærmeste 10; skriv "Ca. 2.740 kcal"; brug det eksisterende usikkerheds-~.
- Mangler vægt, højde, alder eller køn: intet tal, kun en opfordring.

## UI-tekster (skal skrives på da og en i `src/i18n/locales`)

- Regnestykke-kort med "Hvorfor?"-ark pr. linje (hvile, hverdag, motion, mål).
- "Hvordan vurderes dette?" pr. niveau med konkrete eksempler; skridttal markeres som vejledende, ikke officielle PAL-grænser.
- Advarsel ved manuel overstyring mere end ét trin fra forslaget.
- Kalibreringsboks: "Sådan har vi justeret".
- Ærlig tekst om usikkerhed og at estimatet forbedres med data.

## Datamodel (forslag)

- `User`: `palBase Float`, `palSource` (QUESTIONNAIRE / MANUAL / STEPS / CALIBRATED), `palConfidence`, `activityAnswers Json` (versioneret), `activityProfileUpdatedAt`; `activityLevel` udledes af `palBase`.
- `ActivityProfileSnapshot`: `userId`, `validFrom`, `palBase`, `source`, `answers`, `trainingAllowanceKcalPerDay`.
- `DailyBudgetSnapshot`: `userId`, `date`, `bmr`, `pal`, `baselineKcal`, `trainingKcal`, `method`, `confidence`, `low`, `high`, `goalDeltaKcal`, `budgetKcal`. Historiske dage bevarer det, der gjaldt dengang (snapshot-reglen).
- Aktivitetstyper: `met`, `intensityClass`. `Activity`: `met`, `distanceKm`, `perceivedEffort`, `energySource`, `avgHeartRate`.
- `GoalTarget`/målsætning udvides med mål-form og tempo (se Målsætning i STATUS.md).

## Faser

| Fase | Indhold |
|---|---|
| F0 | **Færdig.** Plan, `DECISIONS.md`, `OPEN-TASKS.md`; `caloriesBurned` afklaret som netto. |
| F1 | **Færdig.** `src/lib/pal-model.ts` (PAL, niveauer, netto-MET, tillæg, dagsestimat) og `src/lib/energy-budget.ts` (budget med sundhedsgrænser), tests i `*.test.mjs`; `activity-level.ts` bruger nu niveauernes repræsentative PAL; skema: `User.palBase/palSource/palConfidence/activityAnswers/trainingAllowanceKcal/goalMode/goalPaceKgPerWeek`, ny `ActivityProfileSnapshot`. |
| F2 | **Færdig.** `src/components/onboarding/ActivityStep.tsx` (intro, arbejde, gang/stående, transport, skridt, motion, intensitet, resultat; intensitet springes over uden motion), `src/components/EnergyBreakdown.tsx` (regnestykke med "Hvorfor?" pr. linje, interval, sundhedsjusteringer), `src/lib/activity-profile.ts` + `src/app/api/profile/activity/route.ts` (GET regnestykke, PUT svar, PATCH manuelt niveau). Manuelt valg i Profil går også gennem `applyManualLevel`. Vilkårsuddrag i `terms-hints.ts`. Kaloriemål vises kun, når `goalMode` er sat — der er endnu ingen UI til det (F6). |
| F3 | **Færdig.** `src/lib/activity-met.ts` (MET-tabel pr. sportstype × taletest, gang/løb efter hastighed når distance kendes, netto-kcal) med tests. `Activity` har nu `met`, `distanceKm`, `perceivedEffort`, `energySource` (USER / ESTIMATED_MET / DEVICE), migration `20260929200000_activity_met`. `/activity/create` viser taletest, distance (gang/løb) og anslåede kcal som placeholder; eget tal vinder. `POST /api/activities` anslår kcal, hvis feltet udelades; `GET /api/activities/estimate` giver forhåndsvisning. Integrationer skriver stadig `energySource` = USER (default) — F4 sætter DEVICE. |
| F4 | **Færdig.** `pal-model.maintenanceKcal` + `stepsAdjustedPal` (±0,15). `weekly-energy-summary.ts`: `EnergyProfile` har `palBase`/`trainingAllowanceKcal`; `deviceDataByDay(metrics)` samler `ACTIVE_ENERGY_KCAL`/`STEPS` pr. dag (pr. kilde summeret, højeste kilde vinder, så to kilder aldrig lægges sammen); dagsvedligehold: målt aktiv energi → BMR + målt; ellers BMR × PAL (skridtjusteret) + logget eller tillæg. Kalenderen henter `/api/health-metrics` og sender profil + enhedsdata ind (to små ændringer i `src/app/calendar/page.tsx`, se OPEN-TASKS). Integrationers aktiviteter får `energySource = DEVICE`. |
| F5 | **Færdig.** `src/lib/energy-calibration.ts` (56 dages vindue, mindst 14 loggede dage ≥ sundt minimum, mindst 3 trendvægt-punkter over 14 dage, afvisning uden for 0,7–1,4 × formel, w = 0 → 0,7 fra 14 til 42 loggede dage) med tests. `activity-profile.calibrateUser` kører ved hver `GET /api/profile/activity`, henter registreringer/vejninger/aktiviteter/enhedsdata, skalerer hverdags-PAL med brugt/formel og gemmer (kilde CALIBRATED + snapshot) kun når PAL flytter ≥ 0,02 og højst én gang i døgnet. Regnestykket viser linjen "Justeret efter din vægt" med "Hvorfor?" (dage, snit-indtag, hældning, lært tal, vægt %) og status, når der ikke kan justeres endnu. Budgettet bygger på det kalibrerede behov. |
| F6 | **Bygget (UI + API).** `src/components/EnergyGoalEditor.tsx` (målform, tempo — tempo over `maxLossPace` kan ikke vælges — målvægt, forventet dato-interval 0,8–1,25 × uger, regnestykke med budget), side `/profile/energy-goal` (række på Målsætning), side "Mål" sidst i onboarding-trinnet. `PATCH /api/profile` tager `goalMode`/`goalPaceKgPerWeek`. **Budget pr. dato, kun fremadrettet (brugerens valg 2026-09-29):** `DailyBudgetSnapshot` (migration `20260929210000_daily_budget_snapshots`) skrives/opdateres for i dag, hver gang regnestykket vises (`GET /api/profile/activity`). `src/lib/daily-budget.ts` slår datoens budget op: egen snapshot → seneste tidligere (bæres frem) → `DAILY_KCAL_GOAL` for dage før den første. Kalender (context `DailyGoalContext`, alle visninger + ugebalance), statistik (`ChartSeries.goals` pr. punkt), forsidens talhjul og widgets bruger det; `GET /api/daily-budgets` leverer snapshots. Historik regnes aldrig om. |

## Åbne punkter

1. `SPECIFICATION.md` §5 siger, at niveauet ikke kan vælges manuelt; kravet om manuel korrektion (punkt 11) er en ændring. Foreslået: tilladt via "Ret niveau" med advarsel og `palSource = MANUAL` (kræver at §5 opdateres).
2. `Activity.caloriesBurned` er **netto** (afklaret i F0): feltet er brugerindtastet eller enhedens aktive energi, og pulsudsving regnes som ekstra over hvile. Nye MET-beregninger skal derfor også være netto.
3. Graviditets-/amme-flag findes måske ikke; afklar hvordan de beskyttes mod underskud.
4. Hvordan tabellerne (arbejde, gang, transport, skridt) og MET-klasserne kalibreres: enhedstest mod de fem niveaueksempler, derefter nøgtern gennemgang af en række profiler.
