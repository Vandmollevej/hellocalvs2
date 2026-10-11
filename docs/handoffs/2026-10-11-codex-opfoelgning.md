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

- 19:04-opfølgning: 400 af Årstidernes 413 manglende produkttyper er nu indskrevet i originalarket: først 297 entydige navne, derefter 103 manuelt kontrollerede rettelser (bl.a. Kaffe i stedet for Proexo/Ceylan/Hortensias, korrekt te, pasta og krydderier). Alle øvrige celler, herunder originalfelter, mængde/antal, variationer og titelformler, er sammenlignet uændrede ved begge overførsler. Backup før første ændring: Excelark/backup/aarstiderne_2026-10-11_foer_codex_produkttyper.xlsx. Genkørbare gennemgange ligger i Temp/codex-opfoelgning/prepare_aarstiderne.py og finish_clear_aarstiderne.py. 13 tomme typer udestår: kolonial-/nøddekasser, Cocohagen-varianter, latte/chokoladedrik og morgenmadsnavne uden entydig type. Brand/variation/keywords og flertalskolonne er ikke ukritisk hentet fra arbejdskopien og kræver fortsat regelkontrol. DRK og de øvrige mangler udestår.

- 18:54-opfølgning: de to resterende EDEKA-dyrefoderrækker er eksporteret til Produkter/Blacklistede produkter/edeka_dyrefoder_2026-10-11_codex.csv og slettet fra originalarket. Nu 4.863 produkter; alle bevarede værdier fra kolonne C til AS er sammenlignet uændrede, og begge titelformler er kontrolleret på samtlige rækker efter forskydningen. Autofilter/dimension/filter-navn følger de nye rækkenumre. Backup: Excelark/backup/edeka_2026-10-11_foer_codex_dyrefoder.xlsx. Genkørbart værktøj: Temp/codex-opfoelgning/remove_edeka_pets.py. Den tidligere auditfil all_sheets_audit.json har nu gamle EDEKA-rækkenumre og skal genopbygges før nye rettelser. Næste arbejde: gennemgå/rette Årstidernes 413 og DRKs 700 manglende produkttyper samt færdiggøre samlet rapport.

- 18:44-opfølgning: 14 manglende EDEKA-produkttyper er nu indskrevet i originalen Excelark/edeka.xlsx ud fra entydige navne/kildeadresser (Whisky, Proteinriegel, Lebkuchenherzen, Lebkuchen, Rieslingsekt). Artifact Tool har skrevet rettelsesværdierne; en afgrænset XML-overførsel bevarer originalens formler og øvrige ZIP-dele byte for byte. Backup: Excelark/backup/edeka_2026-10-11_foer_codex_produkttyper.xlsx. Rettelsesliste og genkørbare værktøjer: Temp/codex-opfoelgning/type-patch.json, patch_types.mjs, apply_types_xml.py. De to dyrefoderrækker mangler stadig at blive eksporteret og slettet. EDEKA må derfor ikke åbnes som færdigt endnu.

- Heartbeat-kontrol: gengangere-fund.xlsx genåbnet og alle otte faner kontrolleret uden Excel-fejlceller. 704 usikre og 1.174 samme-par stemmer med vurderingerne (981 mangler én stregkode, 97 uden stregkode, 96 med to). Desuden 32 DK-DE-stregkoder, 222 billedmangler og 36 stregkodeproblemer. Samlet rapport og originalarksrettelser udestår fortsat. Autoarkivering er konfigureret til først at ske efter alle ni opgaver og vellykket åbning af færdige Excelark.

- PR #399 er nu flettet som 53e86336. Cardio-deploy ae9c4b7e er grønt. Ingen Actions-kørsel for 53e86336 blev returneret ved sidste API-kontrol; deploy af denne merge skal derfor stadig verificeres.
- Gengangerrapporten er skrevet til hovedmappens Excelark/gengangere-fund.xlsx. Alle 5.388 kandidatpar er vurderet; de sidste 137 skeptikerpar er afsluttet (114 accepteret, 23 afvist). Rapportens endelige kontrol og samlet rapport mangler.
- DRK har 700 tomme produkttyper, Årstiderne 413. Genfundne kopier ligger i Gennemgang/mine_skrivninger_2026-10-11; de har 718 henholdsvis 413 udfyldte typer og ingen ændrede originalfelter. Forslagene indeholder dog fejl (fx kaffe angivet som Proexo, krydderi som Stødt) og må ikke kopieres ukritisk. Mængde/antal i originalerne er nyere og skal bevares. Sammenligninger ligger i Temp/codex-opfoelgning/recovered_drk.json og recovered_aarstiderne.json.
- Brugerens globale regel om løbende opfølgning er registreret i REGLER.md. Aktiv heartbeat hvert 10. minut: f-rdigg-r-hello-cal-opf-lgning. Arbejdet fortsætter; arkene åbnes først efter færdigt arbejde og kontrol.

- Cardio PR #398 er flettet via normal GitHub-UI som ae9c4b7e (otte grønne checks). Connectorens merge-/PR-skriveadgang giver 403, men browseren er nu logget ind. Admin-commit af84f85d ligger i PR #399 mod master, hvor checks afventes. Automatisk godkendelseskontrol afviste direkte master-push; den vej må ikke bruges som omgåelse.
- Sidste dubletændringer fandtes i Claude scratchpad cee053bd, ikke den tidligere kontrollerede rene arbejdskopi. De er overført hertil og suppleret med filtre i tælling/grupper, cacheinvalidering og scroll-genindlæsning efter bulk.
- Lint: 0 fejl, 12 eksisterende advarsler. Build: alle 402 sider. Webmenu: 6 tests grønne. Native-paritet og skemavalidering grønne.
- Actions API viser nu success for deploys e3a67698, 6c425727, 6d87e4b6 og e0c103b5. Cardio-deploy ae9c4b7e kører. Funktionel live-kontrol mangler stadig.
- dm/Wolt/EDEKA/REWE: originalkolonner og titelformler uændrede; EDEKA har 36 færre rækker. Wolt har 5 og EDEKA 14 tomme produkttyper, der kræver kontrol.
- Gengangervurdering: alle 5.388 par har forfatterresultat; 137 positive par mangler skeptikerkontrol før den endelige rapport.
- Coop-rådata indeholder 1.000 unikke varer af forventede 1.072. Forsøg på de sidste sider gav HTTP 401/503 og ændrede ikke rådata.
- Alle 21 API-logoer er kontrolleret som kvadratiske RGBA-PNG med transparens.
