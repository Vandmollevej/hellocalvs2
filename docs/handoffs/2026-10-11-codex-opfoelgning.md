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

## Kontrol efter genoptagelse

- Cardio PR #398 er flettet via normal GitHub-UI som ae9c4b7e (otte grønne checks). Connectorens merge-/PR-skriveadgang giver 403, men browseren er nu logget ind. Admin-commit af84f85d ligger i PR #399 mod master, hvor checks afventes. Automatisk godkendelseskontrol afviste direkte master-push; den vej må ikke bruges som omgåelse.
- Sidste dubletændringer fandtes i Claude scratchpad cee053bd, ikke den tidligere kontrollerede rene arbejdskopi. De er overført hertil og suppleret med filtre i tælling/grupper, cacheinvalidering og scroll-genindlæsning efter bulk.
- Lint: 0 fejl, 12 eksisterende advarsler. Build: alle 402 sider. Webmenu: 6 tests grønne. Native-paritet og skemavalidering grønne.
- Actions API viser nu success for deploys e3a67698, 6c425727, 6d87e4b6 og e0c103b5. Cardio-deploy ae9c4b7e kører. Funktionel live-kontrol mangler stadig.
- dm/Wolt/EDEKA/REWE: originalkolonner og titelformler uændrede; EDEKA har 36 færre rækker. Wolt har 5 og EDEKA 14 tomme produkttyper, der kræver kontrol.
- Gengangervurdering: alle 5.388 par har forfatterresultat; 137 positive par mangler skeptikerkontrol før den endelige rapport.
- Coop-rådata indeholder 1.000 unikke varer af forventede 1.072. Forsøg på de sidste sider gav HTTP 401/503 og ændrede ikke rådata.
- Alle 21 API-logoer er kontrolleret som kvadratiske RGBA-PNG med transparens.
