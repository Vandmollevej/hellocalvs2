# Frida (DTU Fødevaredatabanken) — opbygning og brug

Samlet til brug i en ny chat. Kilde: `FCDB_6.1_Dataset.xlsx` (Frida, version 6.1, DTU Fødevareinstituttet).
Filen ligger på NAS'en: `\\192.168.1.90\Hello Cal\Arkiv - historiske kilde- og importfiler\frida-import-raadata\`
(samme mappe har `.ods`-versionen og dokumentationen `FCDB_6.1_Documentation_English.pdf` / `FCDB_6.1_Dokumentation_Dansk.pdf`).

## Faner

| Fane | Indhold |
|---|---|
| `Readme` | Ophavsret og betingelser (20 linjer). |
| `Data_Table` | Bred tabel: én række pr. fødevare (1.390), én kolonne pr. næringsstof. Øverst tre overskriftsrækker (dansk navn, engelsk navn, enhed), række 4 har `FoodID` / `ParameterID`. |
| `Data_Normalised` | Samme data som lange rækker (144.247): `FoodID`, navne, `ParameterID`, `ResVal` (værdi pr. 100 g), `Min`, `Max`, `Median`, `NumberOfDeterminations`, `Source`, `SourceFood`. Importscriptet læser denne fane. |
| `Food` | Fødevarerne (1.390): `FødevareNavn`, `FoodName`, `FoodID`, `TaxonomicName`, `NCBI`, `FoodEx2Code`, `FoodEx2Description`, `FoodOntology`, `LangualCode`, `Nøglehulsmærket`, `FoodGroupID`, `FødevareGruppe`, `FoodGroup`, `EurofirFoodGroup`. |
| `FoodGroup` | Gruppehierarki (169 rækker): hovedgruppe → undergruppe, dansk og engelsk. |
| `Parameter` | De 231 næringsstoffer: navn (dansk/engelsk), `Unit`, `ParameterID`, parametergruppe. |
| `Source` | 503 litteraturkilder. |

Nøgler: `Food.FoodID` → `Data_Normalised.FoodID` + `Data_Normalised.ParameterID` → `Parameter.ParameterID`.
Eksempel: `FoodID 1` = "Jordbær, rå"; `ParameterID 137` = Energi (kJ) = 161,95 kJ/100 g.

## Rå / kogt (undersøgt 2026-10-08)

- Der er **ingen særskilt kolonne** for rå/kogt. Tilstanden står kun i navnet (`FødevareNavn` / `FoodName`) og kan læses ud af kodefelterne `FoodEx2Code` / `LangualCode`.
- Ud af 1.390 fødevarer har ca. 417 "rå"/"råt" som selvstændigt ord i `FødevareNavn` (420 som tekst inkl. "Forårsrulle"; 430 med "raw" i `FoodName`). Øverst i `Food` er ca. 61 % rå (frugt/grønt), længere nede 17-45 %.
- Øvrige tilstande i navnet: kogt 37, stegt/ristet/bagt/grillet 30, tørret 46, konserves/dåse 65, frosset 71, syltet/marineret/saltet/røget 49, ingen angivelse 720 (mejeri, mel, fedt m.m.).
- Eksempel på koder: *Torsk, filet, rå* `A02BX#F21.A07RY…` / LanguaL `…A0802…F0003…`; *Torsk, filet, kogt* `A02BX#F28.A07GL…` / `…A0803…F0014…` — tilstanden kan altså læses sikrere af koderne end af navnet (ikke gjort endnu).
- Brugerens ønske (2026-10-08): generiske varer og databasen skal have Raw / Cooked; frugt på konserves må ikke stå som frisk frugt.

## Brug i appen

- `scripts/frida-import/agent.py` importerer Frida som `Product` med `externalSource = "FRIDA"`, `externalId = FoodID` (læser fanen `Data_Normalised`), og `GenericIngredient` får næring fra bedste Frida-match (`src/lib/generic-ingredient-match.ts`; se `docs/DECISIONS.md`, Frida-indlæg 2026-08-27 og 2026-09-24).
- Ental/flertal og Raw/Cooked på generiske varer: se `docs/REGLER.md` og `docs/DECISIONS.md` 2026-10-08.
