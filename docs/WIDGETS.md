# Hjemmeskærm-widgets (iPhone + Android) — forberedelse

Status: **design-fase**. Den native app findes ikke endnu (kræver Mac + Xcode
og Apple Developer-medlemskab, se `docs/DECISIONS.md` 2026-08-28 og
2026-09-26). Det, der er klar nu:

| Del | Fil |
| --- | --- |
| Fælles katalog (typer, størrelser, deep links, valgmuligheder) | `src/lib/widgets.ts` |
| Data til alle widgets i ét kald | `GET /api/widgets/snapshot` (`src/lib/widget-data.ts`) |
| Forhåndsvisning af designet med rigtige data | `/widgets` (ikke linket i menuerne) |

Designet godkendes på `/widgets`. Når det er godkendt, bygges de native
widgets (SwiftUI/WidgetKit og Jetpack Glance) 1:1 efter forhåndsvisningen.

## De seks punkter fra brugeren

| # | Widget | iPhone | Android | Tryk |
| --- | --- | --- | --- | --- |
| 1 | **Tilføj** — én knap med plus | lille (2×2) | 1×1 | `/add/menu` (listen over alt man kan tracke) |
| 2 | **Hurtig-tilføj** — række af knapper (søg, kamera, vand, vægt …) | mellem (4×2), op til 4 knapper | 4×1, kan trækkes bredere (op til 5) | hver knap åbner sin egen side |
| 3 | **Statistik-graf** — samme grafer som Statistik, 2 rækker høj | mellem; **én widget pr. graf**, som brugeren stabler i en Smart Stack og swiper op/ned | 4×2; **swipe til siden** mellem graferne i samme widget | `/statistics` |
| 4 | **Statistik-boks** — én boks, 2×2 | lille | 2×2 | `/statistics` |
| 5 | Tryk på statistik åbner Statistik — swipe gør ikke | ✓ (swipe i Smart Stack er systemets egen) | ✓ (swipe skifter kun graf) | |
| 6 | **Seneste registreringer** | mellem (3 rækker) eller stor (8 rækker) | 4×2, trækkes frit i højden; antal rækker følger højden | række → `/registration/[id]`, overskrift → `/calendar` |

Brugerens valg (2026-09-26):
- iPhone kan ikke swipe inde i en widget (Apple tillader kun tryk) → punkt 3 løses
  med **Smart Stack** (én widget pr. graf).
- iPhone har ingen fri højde → punkt 6 findes som **mellem + stor**; Android er
  frit justerbar.
- Appen bliver **helt native** på sigt (Swift + Kotlin), ikke en web-app i skal.

### Grafer (punkt 3)
`kcal` (7 dage, grøn søjle under mål, rød over, stiplet mållinje), `weight`
(7 dage, linje, stiplet målvægt) og `sleepQuality` (1–5, 7 dage).

### Statistik-boksen (punkt 4)
Brugeren vælger selv boksen i widgettens indstillinger (iPhone: "Rediger
widget", `AppIntentConfiguration`; Android: konfigurations-aktivitet). Valg:
- `kcalLeft` — kalorier tilbage i dag (standard; skifter til "Over dagens mål").
- `kcalEatenVsGoal` — spist i dag / mål, med fremskridtsring.
- Alle kort fra Statistik (`STAT_CARD_DEFS`, samme nøgler, 30 dages gennemsnit/total).

### Hurtig-tilføj (punkt 2)
Brugeren vælger knapperne i widgettens indstillinger. Listen er den samme som
tilføj-hjulet (`ADD_ACTIONS`), inkl. reglen om at menstruationscyklus kun vises
for kvinder med funktionen slået til. Standard: søg, kamera, vand, vægt.

## Data-kontrakt

`GET /api/widgets/snapshot?tzOffsetMinutes=120&locale=da`

- Login: `Authorization: Bearer hcal_…` (samme personlige enhedstoken som
  HealthKit-companion, `docs/HEALTHKIT_COMPANION.md`) eller login-cookie.
- `tzOffsetMinutes`: telefonens forskel til UTC i minutter (sommertid DK = 120),
  så "i dag" og 7-dages graferne følger telefonens ur.
- Svar: se typen `WidgetSnapshot` i `src/lib/widgets.ts` — `today`, `charts`,
  `statBoxes`, `addActions`, `recentEntries`, `paths`, samt
  `refreshAfterSeconds` (900).
- Alle labels er færdigoversatte i svaret; hver knap/række har `path` og
  `deepLink`.

Native opdatering: appen henter snapshot i baggrunden og gemmer det i den
delte App Group (iOS) / DataStore (Android); widgets læser kun den lokale
kopi. iPhone opdaterer widgets efter en tidslinje (ca. hvert 15. min, Apple
bestemmer) og straks efter hver registrering i appen
(`WidgetCenter.reloadAllTimelines()`); Android via WorkManager +
`GlanceAppWidget.updateAll()`.

## Deep links

Skemaet `hellocal://` + samme sti som web-appen, fx `hellocal://statistics`,
`hellocal://add/menu`, `hellocal://camera?mode=product`,
`hellocal://registration/<id>`. Se `widgetDeepLink()`.

## Kendte begrænsninger
- Kaloriemålet er stadig den faste `DAILY_KCAL_GOAL` (samme som Statistik), indtil
  personlige kaloriemål findes.
- Statistik-boksene grupperer dage efter serverens tidszone (som Statistik-siden);
  kun `today`/graferne bruger telefonens tidszone.
- Sportskort (`sport:*`) er ikke med i boks-listen endnu.
