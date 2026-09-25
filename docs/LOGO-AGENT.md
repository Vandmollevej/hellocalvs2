# Logo-robot (scripts/logo-agent)

Status 2026-09-25: bygget (container + database + admin-side "Logoer"), ikke
kørt mod rigtige data endnu. Oprindelige krav: samtale 850e575e / 0669f736.

## Hvad den gør

Natlig kørsel (standard kl. 03:00 dansk tid) i sin egen container:

1. **Isolér logoet.** For hvert brand uden `Brand.logoUrl` tages det nyeste
   produkts forsidefoto. Google Vision `LOGO_DETECTION` finder logoet, og det
   beskæres som et rektangel (klippet ud, ikke fritlagt). Udsnittet gemmes som
   "originalen".
2. **Søg på nettet.** Udsnittet sendes til Vision `WEB_DETECTION`, som
   returnerer samme/lignende billeder og siderne, de ligger på.
3. **Vurdér op til 10 kandidater.** Hver kandidat hentes, konverteres til PNG
   (ensfarvet baggrund gøres transparent) og får en procent:
   - 35 %: Visions egen logo-genkendelse af kandidaten = samme brand
   - 25 %: match-type (fuldt match > delvist > visuelt lignende)
   - 25 %: visuel lighed med originalen (perceptuel hash)
   - 15 %: brandnavnet står i linket/sidens titel
   - lille bonus for transparent baggrund og høj opløsning
4. **Afgørelse.**
   - ≥ 90 % **og** brandnavnet på siden/linket → gemmes automatisk som
     brandets logo (`/product-images/brand-logos/<brandId>.png`).
   - Ellers vises alle kandidater ≥ 50 % i admin **Logoer**.
5. **Oprydning.** Hentede kandidater (fil + databaserække) slettes 7 dage
   efter afgørelsen. Det valgte logo er kopieret ud og bevares.

## Admin "Logoer" (`/admin/logos`)

- Hver række: brandnavn → thumbnail af originalen → thumbnail af bedste fund →
  procent.
- Klik på rækken: stor visning med original og fund side om side, og 5–10
  alternativer nedenunder. Klik på et alternativ forstørrer det (lightbox).
  "VÆLG" under hvert billede gør det til brandets logo.
- "Ingen af dem passer" lukker sagen uden logo.

## Hvorfor Google Vision og ikke Custom Search

Googles Custom Search JSON API (som `scripts/image-agent` bruger) er lukket
for nye kunder og stopper helt 1. januar 2027. Brugeren har allerede en Google
Vision-nøgle, og Vision `WEB_DETECTION` søger ud fra selve billedet — præcis
det, robotten skal. Besluttet af brugeren 2026-09-24.

## Miljøvariabler (`.env.production` på serveren)

| Variabel | Standard | Formål |
| --- | --- | --- |
| `GOOGLE_VISION_API_KEY` | — | Nøgle med Cloud Vision API slået til. Mangler den, bruges `GOOGLE_API_KEY`; mangler begge, logger robotten og springer natten over. |
| `LOGO_AGENT_RUN_HOUR` | `3` | Time (dansk tid) for natkørslen |
| `LOGO_AGENT_BATCH_SIZE` | `25` | Maks. antal brands pr. nat |

Øvrige (valgfri): `LOGO_AGENT_MAX_CANDIDATES` (10), `LOGO_AGENT_AUTO_ACCEPT`
(0.90), `LOGO_AGENT_MIN_CONFIDENCE` (0.50), `LOGO_AGENT_RETENTION_DAYS` (7),
`LOGO_AGENT_RUN_ON_START` (false — sæt `true` for en testkørsel ved start).

## Ikke med i denne opgave

- **Logo-match i selve scanningen** (trin 1 i den oprindelige brief: når
  brugeren fotograferer forsiden, isoleres logoet og holdes op mod
  eksisterende logoer, og brand + subbrand udfyldes). Brugeren bad om, at det
  lægges i "den anden opgave" (kamera-/oprettelsesflowet,
  `src/app/camera/create`), som ikke er G5's filer.
- Et brand prøves højst igen efter 30 dage, hvis der ikke blev fundet noget.
