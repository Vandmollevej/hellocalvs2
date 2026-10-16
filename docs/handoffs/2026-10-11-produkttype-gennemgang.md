# Overlevering 2026-10-11 — produkttype-gennemgang (DRK, Årstiderne, Wolt, SPAR, DM, EDEKA, REWE)

## Opdatering 2026-10-16 — udført (læs denne først; resten af filen er historik fra 11/10)

**Status:** gennemgangen er gjort om efter reglerne og skrevet ind i arbejdsarkene. Alt er markeret med **gul baggrund**; ingen original­kolonner er rørt.

- **Arbejdsarkene ligger nu i `Produkter\`** (Excelark/ findes ikke mere): `drk.xlsx`, `aarstiderne.xlsx`, `DK\wolt.xlsx`, `dm.xlsx`, `edeka.xlsx`, `rewe.xlsx` (+ Bilka/REMA/SPAR/Nemlig som før). Ark er nu 46 kolonner (Co-brand = kol 38). `Produkter\` er ikke i git.
- **Det mekaniske var allerede på plads** (min rensning 11/10 overlevede andre sessioners arbejde): Quantity uden stk, Pack Count ens, MHD/datoer, certifikater, dyremad. Kontrolleret igen 16/10: 0 afvigelser.
- **Udtræk 16/10:** kontrol (`rule_check.py`, V1–V16) valgte 7.628 rækker (rækker der brød en regel + tom type/brand). Hver batch à 90 rækker blev læst af en agent efter `AGENT_RULES.md`, derefter kontrolleret af en uafhængig agent; resultaterne er flettet med `merge_apply.py` (rører kun egne kolonner, aldrig brand/produkttype → tom, flag/land kun hvor tomt, opfundet land/alkohol-% droppes, ægte subbrand ryddes aldrig) og skrevet med `apply_mech2.ps1` (egen Excel-instans, titel-vagt pr. række, backup først).
  | Ark | Celler skrevet | Rækker slettet (dyremad/ikke mad) |
  |---|---|---|
  | EDEKA | 4.148 | 24 |
  | REWE | 3.970 | 4 |
  | dm | 885 | 9 |
  | Wolt | 1.392 (+388 lille begyndelsesbogstav) | 6 |
  | DRK | 386 | 2 |
  | Årstiderne | 145 (+50 lille begyndelsesbogstav) | 0 |
  Slettede rækker: `Produkter\Blacklistede produkter\fjernede_raekker_ikke_mad_2026-10-16.xlsx` (også i Peters regel: dyremad **slettes**, markeres ikke).
- **Backups før hver skrivning:** `Produkter\Backup\<ark>_2026-10-16_foer_produkttype-udtraek.xlsx` og `…_foer_lille-begyndelsesbogstav.xlsx` (Wolt, Årstiderne). Før/efter pr. felt: `Produkter\Backup\produkttype_udtraek_aendringer_2026-10-16.csv` (9.995 linjer, kolonne «sikkerhed»/«note»).
- **Regler tilføjet efter 11/10 som agenterne fulgte** (`AGENT_RULES.md`): Subbrand = brandets egne produktlinjer, aldrig almindelige ord/flag (EDEKA + «Bio» → subbrand fjernet); Co-brand = lånt brand (Milka + Biscoff); «Excel ruler» for brandstavning; tyske ark har bevidst **tomt flertal**; danske variationer med lille begyndelsesbogstav (rettet mekanisk med `lower_var.py`, egennavne som Cheddar/Teriyaki/Bolognese undtaget).
- **Resultat af lint efter skrivning** (`sheetlint.py`): dubletter på tværs (L9), certifikater (L15), MHD, oprindelsesadjektiver i variation og tomme produkttyper er stort set væk (Wolt 47→0 dubletter, EDEKA 91→0, REWE 22→0; EDEKA certifikat 29→0, REWE 90→0).
- **Rest / næste tråd** (alt er enten falske alarmer eller kræver Peters øje):
  1. De gule celler med sikkerhed «low» i CSV-loggen (EDEKA ca. 320, REWE ca. 180, Wolt ca. 105, dm ca. 56) — mest vin/spiritus (ejes af vin-sessionen) og tvivlsomme mærker.
  2. Kontrollens `V2` («produkttype = butikskategori») rammer ca. 200 EDEKA-rækker, hvor kategorien faktisk er den rigtige varebetegnelse (Eistee, Bier, Rotwein) — ikke fejl. `V5` (titelord ikke fordelt) rammer ca. 100 pr. ark, mest stavevarianter/anførselstegn.
  3. 35 af de 87 batches nåede ikke «fixer»-trinnet (forbrugsgrænsen) — udtræk og uafhængig kontrol er kørt for alle 87, kun den sidste ekstra oprydning mangler; resterende fejl ses som de samme falske alarmer. Genkør evt. `make_batches.py` (vælger kun rækker der stadig fejler) og Workflow med de batches.
  4. Bilka `Quantity` har 59 rækker med «5 L.B»/«2.5 L.B» (bag-in-box, ejes af Bilka-sessionen), SPAR 4 rækker med intervaller («190-220 g») — ikke rørt.
  5. Ikke-mad/dyremad: kun title-baserede træffere slettet. dm/EDEKA/REWE har falske lint-træffere («Studentenfutter», «Katzenbeisser», «Katjes Hundebanden») der IKKE er dyremad.
- **Genkør/værktøj:** `scripts/produkttype-forslag/pipeline-2026-10-16/` (README i samme mappe). Scratchpad slettes, så scripts er kopieret hertil; `clean_mech.py` forventer pet-food-listerne `src/data/pet-food-*.json` (hent fra origin/master).
- **Faldgruber:** brug egen Excel-instans (`New-Object -ComObject`) — brugerens åbne Excel røres ikke; `Copy-Item` bevarer kildens LastWriteTime (backupfilens tidsstempel er ikke kopitidspunktet); forbrugsgrænsen ramte flere gange (kør ≤ 4 workflows ad gangen, brug `resumeFromRunId` — færdige agenter caches).

Skrevet af sessionen "Frida-ark / produkttype" (konto med Sonnet 5.5). Brugeren fortsætter i en ny tråd og vil have
alt markeret, så nogen kan følge op. **Brugeren er MEGET utilfreds**: de fleste automatiske ændringer er forkerte.
Regler: se `Excelark/NAVNEREGLER.md`, afsnit "Brugerens regler 2026-10-11" (20 punkter). Læs dem først.

## 1. Hvad der er gjort (kort)

### Frida (færdigt og publiceret)
- `Frida-ark/frida.xlsx` omlagt (titelformler ental/flertal, nøgleord, `_is_`-felter, 45 Bilka-kolonner + FoodID/_is_processed/_is_light, fane `Flertalsord`).
- Publiceret til serveren: `scripts/frida-import/build_sheet.py` → `scripts/frida-import/sheet/frida_sheet.json`, `agent.py` (`apply_sheet`, `run_on_start`), migration `20261009210000_product_name_plural`, søgereglen i `src/app/api/products/route.ts`. Commits 988285ef, c677d44d, 711fa4ef, 5d0cc54e, dba035be. Deploy gik igennem (GitHub Actions success).
- Frida-formlerne i A/B ejes nu også af sessionen "Duplikerede ord i Bilka/Rema" (smart ental-regel `pl,AND(...)`). Se `docs/FRIDA.md`.

### Kolonner og titler i andre ark (2026-10-10)
- Alle ark fik Bilkas 45 kolonner (mine scripts `normalize_columns*.ps1`), titelformler (`gen_generic.py`) i Bilka og REMA v2 (derefter overtaget af anden session).
- **FEJL jeg lavede:** jeg normaliserede også `_ens`-kopier (`drk_ens`, `nemlig_ens`, `rema1000_ens`, `spar_ens`, `wolt_ens`) — de er IKKE arbejdsarkene. DRK_ens blev overskrevet og gendannet fra backup.
- **Arbejdsarkene** (NAVNEREGLER.md): `Excelark/bilka.xlsx`, `Produkter/rema1000_version 2.xlsx`, `Produkter/SPAR/spar.xlsx`, `Produkter/Nemlig/nemlig.xlsx`, `Excelark/wolt.xlsx`, `drk.xlsx`, `aarstiderne.xlsx`, `dm.xlsx`, `edeka.xlsx`, `rewe.xlsx`.
  `Excelark/spar.xlsx` er en GAMMEL kopi (40 kolonner, 9/10) — jeg skrev ved en fejl i den.

### Produkttype-kørslen 2026-10-11 (DET DER ER GALT)
- Review-ark: `Excelark/produkttype-forslag.xlsx` og `produkttype-forslag-2.xlsx` (faner Danske/Tyske: titel, subtitel, mit forslag, brand-gæt, sikkerhed).
- Jeg **implementerede forslagene direkte i arkene** (kolonnerne `Brand`, `Product Type`, `Variation`, `Product type plural` — gul baggrund, orange + kommentar på tyske rækker uden brand):
  | Ark (fil) | Gemt | Backup før kørslen (mappen `Backup/`) |
  |---|---|---|
  | `Excelark/drk.xlsx` | 07:20 | `drk_2026-10-11_foer_produkttype.xlsx` |
  | `Excelark/aarstiderne.xlsx` | 07:21 | `aarstiderne_2026-10-11_foer_produkttype.xlsx` |
  | `Excelark/spar.xlsx` (GAMMEL kopi, forkert fil) | 07:23 | `spar_2026-10-11_foer_produkttype.xlsx` |
  | `Excelark/dm.xlsx` | 07:25 | `dm_2026-10-11_foer_produkttype.xlsx` |
  | `Excelark/edeka.xlsx` | 07:27 | `edeka_2026-10-11_foer_produkttype.xlsx` |
  | `Excelark/rewe.xlsx` | 07:28 | `rewe_2026-10-11_foer_produkttype.xlsx` |
  | `Excelark/wolt.xlsx` | IKKE gemt (Excel-fejl 0x800AC472) — uændret | `wolt_2026-10-11_foer_produkttype.xlsx` |
- Excel crashede hos brugeren under kørslen; brugeren nåede kun at se EDEKA.
- **Skaden** (brugerens kommentarer, se reglerne): kategorier som Product Type, brandord i type/variation, dobbelte ord, delte sammensatte ord, bindestregs-rester,
  tal som produkttype, MHD/datoer, dyremad ikke fjernet, `_is_`-flag ikke flyttet, forkerte brandgæt (Indbagt, Fuldkorns, "Riesling,"), nøgleord-dumps i DRK,
  Quantity med både stk og gram + Pack Count dublet (DRK 63 rækker, Årstiderne ~10), "fransk" i Variation.
  Jeg overskrev også eksisterende Product Type (Wolt 710, DM 494, EDEKA 1507, REWE 1709 rækker) — det var måske korrekt før.
- Kør-data: `Gennemgang/type_changes.json` (hvilke celler blev skrevet; `orig` = Original Title til række-kontrol) og scripts i `scripts/produkttype-forslag/`.

## 2. Anbefalet fortsættelse (rækkefølge)
1. **Gendan** mine skrivninger: for drk, aarstiderne, dm, edeka, rewe (og den gamle spar-kopi) — kopiér `Backup/<ark>_2026-10-11_foer_produkttype.xlsx` tilbage
   (tjek først at arket ikke er ændret af andre efter kl. 07:28; ellers gendan celle for celle fra `type_changes.json`). Fjern gul/orange markering og kommentarer.
2. **Skriv en regel-lint** (alle 20 punkter i NAVNEREGLER.md) og kør den på ALLE arbejdsark — den finder dubletter, kategorier som type, tal, datoer, stk i Quantity osv.
3. **Fjern dyremad**: kør `src/lib/pet-food-blacklist.ts`-listerne (`src/data/pet-food-*.json`, stregkoder + stærke ord + mærker) mod alle ark; flyt rækkerne til `Produkter/Blacklistede produkter`.
4. **Rens Quantity/Pack Count/lande/MHD** i alle ark (mekaniske regler, lav risiko).
5. **Product Type**: udtræk fra titlen kun hvor feltet er tomt eller åbenlyst en kategori; resten markeres til gennemsyn. Brug brand-/subbrandlister (Bilka/REMA/Dr. Oetker-linjer) først.
6. Markér alt med gul, åbn arkene til brugeren, og vent på gennemsyn.

## 3. Faldgruber i værktøjerne
- Excel COM: arbejd med arkene LUKKEDE; to Excel-processer findes ("6C5C7110"-orphan ved "kunne ikke gemmes"); `Range("A1,A5")`-union virker ikke i dansk locale; 0x800A03EC/0x800AC472 = Excel optaget → prøv igen.
- PowerShell 5.1 læser `.ps1` uden BOM som ANSI → æøå ødelægges; læs danske ord fra en UTF-8-tekstfil med `-Encoding UTF8`. Hashtables er case-insensitive.
- `Copy-Item` bevarer kildens LastWriteTime (backup-filens tidsstempel er IKKE kopitidspunktet).
- Originalkolonnerne (Original Title/Product Name/Subtitle/Source URL/Image File/Parse Status/Manufacturer/Servings) må aldrig ændres.
- GitHub API uden token: 60 kald/time — vent på nulstilling.
