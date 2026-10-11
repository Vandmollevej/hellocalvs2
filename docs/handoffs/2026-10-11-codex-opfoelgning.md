# Opfølgning på ni afbrudte Claude-opgaver

Ejer: Codex, chat om samlet Claude-opfølgning, 2026-10-11.
Brugeren har godkendt fortsættelse, commits og push. Hovedmappen er på
`deploy` med omfattende efterladte ændringer; de må ikke stages samlet.
Arbejdskopi: `worktrees/opfoelgning`, gren `codex/claude-opfoelgning`.

| Nr. | Opgave | Kontrolleret status | Næste skridt |
| --- | --- | --- | --- |
| 1 | Admin-hastighed, cache, gradvis indlæsning og listevalg | a1e274cf er i origin/master | Kontroller deploy og resterende tunge opslag; browserkontrol kræver login |
| 2 | OFF Lidl/Aldi/Coop og håndrettelser | Scripts, rådata og rettelser findes lokalt; _run6.log slutter med 1000/1072 Coop-varer | Find slutresultaterne fra senere hentejob; kontroller import og ark før åbning |
| 3 | Mekanisk arkrensning og produkttype, dyrefoder slettes | Oprindelig nævnt handoff mangler i hovedmappen; regler findes i Excelark/NAVNEREGLER.md | Rekonstruer resultater fra journaler og backups; kontroller blacklist og originalkolonner |
| 4 | Webparitet uden kamerafunktioner | e3a67698 er i origin/master | Kør menuparitet, kontroller Screeninger og popups; Cardio tilføjes også til webmenuen |
| 5 | Mangler/status/markering/Handlinger på alle admin-produktlister | e0c103b5 er i origin/master; tidligere arbejdskopi på claude/admin-ens-bredde er ren | Find de sidste dubletændringer og kontroller slettede filtre og cacheinvalidering |
| 6 | Desktop må aldrig montere appforsiden | bf027fa5 er i origin/master | Kontroller AppHomeGate og deploy; eksisterende kontrakt er desktop fra 1024 px |
| 7 | dm/Wolt/EDEKA/REWE, variationer og gengangerrapport | build_dup_report.py og build_final_report.py findes i Claude scratchpad 80682e88 | Kontroller skeptikerresultater, Source URL-matching og gendannelse af mit/ohne/aus/in; byg rapporter |
| 8 | API-logoer, foldbare kort, fuld URL og kun Vipps | 571f86f5 og 6c425727 er i origin/master | Kontroller alle 21 PNG'er, tekster og deploy |
| 9 | Cardio PR #398 | Åben PR med konflikter; konflikter løst i arbejdskopi, native-tekster regenereret; webmenu suppleret | Lint, build, skema og paritet; commit/push til claude/cardio; flet efter grønne checks |

GitHub-connectorens opslag af workflow runs for master og Cardio returnerede
tomme lister. Det er ikke bevis for grønt deploy. Ingen opgave er afsluttet
alene på grundlag af tidligere chats påstande.
