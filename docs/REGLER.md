# REGLER — globale regler for hvordan systemet opfører sig

Ét opslagssted. Hver regel: kort tekst + hvor detaljerne står. Når en ny regel
besluttes: tilføj den HER først (og i DECISIONS.md hvis den er arkitektonisk).
Søg aldrig i STATUS.md/DECISIONS.md/gamle sessioner efter en regel — står den
ikke her, er den ikke registreret og skal tilføjes.

## Varer og navngivning

- **Key-format**: `Brand Produktnavn (Mængde)`. Mængden står præcis én gang;
  brand og mængde fjernes først fra den rå titel.
- **Generiske varer (uden brandnavn/EAN)**: 100 % uden brandnavn (grøntsager,
  frugt, kød m.m.) er råvarer / generiske ingredienser (`GenericIngredient`,
  altid `INGREDIENT`, enhed g) og scannes ikke. Kilde: session
  "HelloCal OpenAI produktgenkendelse", 2026-09-18; se også DECISIONS.md
  (Frida-match, mikrodata kopieres fra Frida).
- **Billedfilnavne** (udledt af `Productdatabase/Bilka/bilka.py`, `build_key`/
  `download_image`, og `Produkter klar til import/_rename_log.csv`; mønster
  afledt 2026-10-08, afventer brugerens bekræftelse):
  - Har varen EAN → `<EAN>.<ext>`. Dublet (samme EAN fra anden kilde) →
    `<EAN>_2`, `_3` … Første rang: BILKA (DK) / EDEKA (DE).
  - Har varen IKKE EAN → filnavn = Key: `Navn, mængde (Brand)`.
  - Generisk vare uden brand og uden EAN → `Navn, mængde` (ingen parentes),
    fx `Apfel Jonagold ca., 250g.png`, `Bio Ingwer ca., 100g.png`.
  - Ikke afklaret: 601 filer i `Færdige produktbilleder` hedder kun et kort
    tal (`100.png`, `1068.png`) — kilde ukendt.
  - Skal gælde alle steder: originale, til gennemgang, færdige. Filer i
    Færdig-mapper må også ligge i Original, men aldrig i Fejlet/Til gennemgang.
- **Boolske felter**: aldrig "Ja"; brug beskrivende ord (Sukkerfri, Laktosefri,
  Vegansk).
- **Dyrefoder**: spærres (blacklist) — se docs/DECISIONS.md "Pet-food blacklist".

## Logoer og billeder

- Kun mad-/drikkevaremærker får logo (ikke husholdning/rengøring/køkkenudstyr);
  foretræk rent wordmark uden tagline. Se docs/LOGO-AGENT.md.
- Brugerens uploadede PNG-kunst bruges som den er (skaleret/CSS-mask), aldrig
  gen-tegnet som SVG.

## UI

- "Overlay"/"popup" = den træk-bare BottomSheet (`.hf-bottom-sheet`), se KRAV.md.
- Visuelle ændringer: læs design.md; størrelse/vægt ændres i moderate trin.

## Sikkerhed

- Streng sikkerhed (vault) kun for admin; almindelige brugere får normalt login
  (email/adgangskode, Face ID, Google/Apple/Facebook).

## Proces

- Flere parallelle sessioner: stage snævert, deploy-linjen er origin/master.
- Efter rebase der rører `prisma/schema.prisma`: kør `prisma validate` + typecheck.
