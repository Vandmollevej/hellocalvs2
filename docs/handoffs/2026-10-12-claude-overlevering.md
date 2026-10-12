# Claude-overlevering: Hello Cal Excelopfølgning

Status: STOPPET OG OVERLEVERET, UAFSLUTTET. Brugerens frist var 12 oktober 2026 kl. 07:55:26 dansk tid. Originalrettelser stoppede før fristen. Ingen samlet færdiggodkendelse.

## Autorisation og frist

Færdiggør de afbrudte Excelopgaver. Bevar originalfelter, formler og andre sessioners ændringer. Ved fristen skal Codex stoppe sikkert, levere denne overlevering og en kort rapport og åbne alle ti originale arbejdsark samt rapporter i Excel, også de uafsluttede. Åbningen skal verificeres. Opfølgningen deaktiveres derefter; chatten arkiveres ikke ved uafsluttet arbejde.

## Seneste verificerede status

609 tomme produkttyper: Nemlig 394, SPAR 208, DRK 5, Wolt 2, Bilka 0. REMA, dm, EDEKA, REWE og Årstiderne har ingen tomme typer. Disse tal er bekræftet ved frisk fuldaudit kl. 07.43. Alle ti ark har identiske 45 kolonner. Genkør audit før fortsættelse.

I perioden efter fristinstruktionen er 99 tomme typer udfyldt (96 Nemlig, 1 DRK, 2 Bilka). De seneste 13 Nemlig-batches er genkontrolleret på Source URL: alle 686 forskellige endelige typeværdier svarer til de arkiverede forslag, inklusive efterfølgende korrektioner. Resultat: PASS i TEMP/final_nemlig_batches_check.json.

Alle 590 Nemlig-typer med kopieret `Varebeskrivelse`, priser og navigation er renset i seks kontrollerede batches. Det betyder ikke, at alle typer, variationer, brands, keywords, tilstandsflag og flertal er færdigkontrolleret.

SPAR er normaliseret fra 46 til 45 kolonner. Alle 5.192 værdier i ekstra OFF-krydstjekkolonnen er bevaret med Source URL og originaltitel i `Excelark/codex-samlet-status.xlsx`, fanen `SPAR OFF krydstjek`. Samtlige celler A:AS er bevaret. Backup før fjernelsen findes i `Excelark/backup/spar_2026-10-12_0720_foer_off_krydstjek_eksport.xlsx`.

Gengangerrapporten `Excelark/gengangere-fund.xlsx` har 5.388 vurderede kandidatpar: 1.174 samme, 704 usikre, 3.510 forskellige. Sidste skeptikertrin er afsluttet. Rapportens eventuelle rækkenumre skal genkobles på Source URL efter dyrefodersletninger; der er ikke automatisk flettet eller slettet dubletter.

OFF Coop: råfilen har 1.000 varer, tidligere log forventede 1.072. Genforsøg på world.openfoodfacts.org gav HTTP 503; alternativ world.openfoodfacts.net gav HTTP 401. Ny import er ikke kørt på ufuldstændige svar. Lidl/Aldi/Coop-håndrettelser kræver stadig afsluttende gennemgang.

GitHub-koden fra overleveringen er i master. PR398/399/400 er flettet; seneste kode-deploy abd501c7 og native-build er grønne. Senere opfølgningscommits er dokumentation på `codex/claude-opfoelgning`, ikke ekstra appkode. Hovedmappens checkout og andre worktrees er bevaret.

## Originale arbejdsfiler

Alle stier er under `C:\Users\Peter\Desktop\Hello Cal`:

- `Excelark/bilka.xlsx`
- `Produkter/rema1000_version 2.xlsx`
- `Produkter/SPAR/spar.xlsx`
- `Produkter/Nemlig/nemlig.xlsx`
- `Excelark/dm.xlsx`, `Excelark/edeka.xlsx`, `Excelark/rewe.xlsx`
- `Excelark/wolt.xlsx`, `Excelark/drk.xlsx`, `Excelark/aarstiderne.xlsx`

Rapporter: `Excelark/gengangere-fund.xlsx` og `Excelark/codex-samlet-status.xlsx`. Statusrapporten er genbygget fra frisk audit kl. 07.43: 861 kontrolkandidater inklusive 609 blanke typer og 5192 OFF-krydstjek. Kandidaterne skal gennemgås manuelt.

## Tilgang og bevaringskontrol

Originalkolonner 38–45 ændres aldrig. A/B-titelformler bevares. Rettelser baseres på originaltitler, faktiske Subtitle-felter og producentkilder ved tvetydige mærkevarer. Rækkematch sker på Source URL, fordi dyrefodersletninger har flyttet rækkenumre.

Bundlet Artifact Tool JS skriver rettelsesværdier i en lille arbejdsbog. En afgrænset XML-overførsel ændrer kun godkendte H-celler i originalen. Den kræver korrekt Source URL samt tom gammel celle eller eksakt `old_value`; før filen erstattes, sammenlignes alle øvrige celler/formler og ZIP-dele. Openpyxl bruges kun til læsning, aldrig til at gemme originalark.

Nemligs afbrudte skrivning er særskilt kontrolleret mod backup efter fuglefoder og før de sidste fire katte-/fuglefoderrækker: alle bevarede C:AS-værdier uden for H identiske, præcis fire kendte dyrefoderrækker væk. Senere rettelser har hver deres fulde bevaringskontrol.

## Værktøjer, registre og backups

TEMP: `C:\Users\Peter\AppData\Local\Temp\codex-opfoelgning`.

- `audit_all.py`: frisk oversigt over alle ti ark og blanke typer; skriver `all_sheets_audit.json`.
- `audit_name_rules.py`: regelkandidater; skriver `name_rules_audit.json`. Kandidater er ikke automatisk sikre fejl.
- `manual_nemlig.py`, `manual_spar.py`, `manual_drk.py`: sidste batch ligger her; genkør ikke uændret, da cellerne allerede er udfyldt.
- `patch_types.mjs <store>`: author rettelser, vent ALTID på exit0 før apply.
- `apply_types_xml.py <store>`: sikker H-overførsel. Generisk `type-patch.json` og `authored-types.xlsx` må ikke overskrives mens et apply-job kører. Standard uden argument er EDEKA og må ikke bruges ukritisk.
- `prepare_page_tail*.py`: de seks Nemlig-oprydningsbatches; arkiverede forslag med fuld `old_value` findes i `Gennemgang/codex-produkttype-batches`.
- `normalize_spar_columns.py`: allerede kørt; må ikke genkøres uændret.
- `build_report.mjs samlet`: skriver statusrapport fra `summary_report_data.json`. Uden argument skriver den gengangerrapporten; pas på overskrivning.
- `nemlig_preservation_check.json` dokumenterer særkontrollen. `spar_off_crosscheck.json` er ekstra tabsfrit register.

Backups ligger i `Excelark/backup`. Gendan aldrig et helt gammelt ark oven på nyere rettelser. Alle godkendte ændringer har separate JSON-batches i `Gennemgang/codex-produkttype-batches`.

## Næste trin og kendte faldgruber

1. Læs `Excelark/NAVNEREGLER.md`, `docs/REGLER.md` og det lange checkpoint. Genkør audits før nye rettelser.
2. Færdiggør resterende tomme typer, brand/subbrand, variation, keywords, tilstand og flertal. Typefelter alene er ikke hele navneopgaven.
3. Flyt tilstandsord til `_is_cooked` uden at miste betydning. Nogle tidligere typer som Poppet hvede og Røget fisk er endnu ikke opdelt. De sammensatte færdigretter fra seneste Nemlig-batch kræver korrekt tilbehør/variation.
4. Kontroller sukker/fedt/alkohol og kvantitet mod originals. SPAR Senseo Strong row2354 har mistænkelig Quantity36g for36pads; ingen automatisk rettelse uden dokumentation.
5. Nyeste mapping fandt pizzasauce fejlagtigt som Krydderi; straks korrigeret til Pizzasauce. Genbrug ikke kategorimapping `Krydderi, Sauce` uden originalkontrol.
6. Gendan aldrig variationer ved at fjerne indledende med/uden/mit/ohne/aus/in. Tidligere1.076 sådanne fejl er allerede gendannet; betydningen skal bevares.
7. OFF-krydskolonnen er nu tabsfrit eksporteret. Færdiggør Coop og håndrettelser når kilden svarer; tællingen1.072 er historisk, ikke et nyt live-svar.
8. Genbyg samlet statusrapport og evt. gengangerrækkereferencer. Rapporter skal markeres uafsluttede indtil alt er verificeret.

## Fristafslutning

Alle 12 filer er til stede og deres SHA256/filstørrelse er registreret før åbning i TEMP/deadline_open_inventory.json kl. 07.46. Der er ingen aktive egne skrivejobs. Computer Use er initialiseret, og list_apps har bekræftet installeret Excel (Microsoft.Office.EXCEL.EXE.15), som endnu ikke er startet. Endelig tid og verificeret Excel-åbning udfyldes ved fristen. Indtil da fortsætter arbejdet. Seneste checkpoint: `worktrees/opfoelgning/docs/handoffs/2026-10-11-codex-opfoelgning.md`.

## Endeligt stop og åbningens resultat
Seneste clock ved genoptagelsen returnerede 12 oktober07:41:20UTC(09:41dansk),altså efter fristen. Der er ikke skrevet flere originalark efter afsluttendeaudit07:43dansk. Alle12filer er integritetskontrolleret,ZIPCRCgyldigeogSHA256uændrede.
FørsteExcel-start viaComputerUsegav app approval timed out. Nyt startforsøg returnerede udenfejl. Efterfølgende list_windows blev STOPPET AF BRUGEREN med fysiskEscape;værktøjetforbødflereComputerUse-kald. Derfor er ingenafde12arbejdsbøgersåbninggennemførtellerverificeret. ComputerUse er ikke genforsøgt efterEscape. Filerne er bevaret pådepræcisestierovenfor. Åbningkrævernytbrugerinitiativ.
Opfølgningdeaktiveret(PAUSED). Chatikke arkiveret,daExcelopgavenstadiguafsluttet. Claude kanfortsættefra609tomme typerog861kandidatermeddearkiveredescriptsogbackups. Ingenaktiveegneskrivejobs. Overleveringen er stoppestatus,ikke færdigmelding.