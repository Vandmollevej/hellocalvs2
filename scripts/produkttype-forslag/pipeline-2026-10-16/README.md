# Produkttype-udtræk 2026-10-16 (DRK, Årstiderne, Wolt, dm, EDEKA, REWE)

Værktøjer brugt til at gennemgå arkene efter Peters 20 regler (+ subbrand/co-brand-reglerne 2026-10-15). Se
`docs/handoffs/2026-10-11-produkttype-gennemgang.md` (afsnit «Opdatering 2026-10-16») for resultat og rester.

Arbejdsmappe under kørslen var Claude-sessionens scratchpad (slettes); ret `ROOT`/`BASE`-stierne før genkørsel.

| Fil | Hvad |
|---|---|
| `AGENT_RULES.md` | reglerne agenterne læser (output-skema, 20 regler, eksempler fra Peters EDEKA-gennemgang) |
| `rule_check.py` | validator V1–V16 (type/kategori, brandord, dubletter, titelord ikke fordelt, bindestreg, MHD, flag, alkohol-%, dyremad, certifikat, oprindelsesadjektiv, subbrand = almindeligt ord, produkttype = hele titlen); `known_brands.json` |
| `make_batches.py` | læser de nuværende ark, vælger kun rækker der stadig fejler (eller mangler type/brand), skriver `batches/<ark>_<nnn>.in.json` + `manifest.json` (90 rækker pr. batch) |
| Workflow | pr. batch: udtræk-agent → uafhængig kontrol-agent → evt. fixer; hver agent kører `rule_check.py` på sin output (`batches/*.out.json`). ≤ 4 workflows ad gangen (forbrugsgrænse); genoptag med `resumeFromRunId` |
| `check_all.py`, `diff_batch.py`, `sample_changes.py` | kvalitetskontrol af outputtet (fejl pr. ark, før/efter, stikprøver) |
| `merge_apply.py` | samler outputtet til `final_changes.json` (titel-vagt pr. række; opfundet land/alkohol-% droppes; brand/type ryddes aldrig; ægte subbrand ryddes aldrig; tyske ark får tomt flertal) + eksport af slettede ikke-mad-rækker |
| `apply_mech2.ps1`, `run_apply_all.ps1` | skriver ændringerne med gul baggrund via egen Excel-instans, backup i `Produkter\Backup` først, sletter ikke-mad-rækker nedefra |
| `lower_var.py` | dansk Variation → lille begyndelsesbogstav (springer alkohol og egennavne over) |
| `log_changes.py` | CSV med før/efter pr. felt (`Produkter\Backup\produkttype_udtraek_aendringer_*.csv`) |
| `sheetlint.py`, `clean_mech.py` | regel-lint af hele arket / mekanisk rensning (Quantity, Pack Count, MHD, certifikat, dyremad). `clean_mech.py` skal have `src/data/pet-food-patterns.json` + `pet-food-barcodes.json` (fra origin/master) i `<BASE>\petdata` |
