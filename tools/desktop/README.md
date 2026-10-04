# HelloCal-programmer til Windows

To "dumme" programmer, der hver viser en adresse i eget vindue og husker login mellem starter. Bygget med Electron (ingen Edge). Ingen administratorrettigheder kræves.

| Program | Viser | Profil (login gemmes her) |
| --- | --- | --- |
| **HelloCal Admin** (ikon med "A") | `https://admin.hellocal.io/admin` | `%APPDATA%\HelloCal Admin` |
| **HelloCal** | `https://hellocal.io/` | `%APPDATA%\HelloCal` |

## Installér / opdatér

```
powershell -ExecutionPolicy Bypass -File tools\desktop\build.ps1
```

- Bygger begge programmer og lægger dem i `%LOCALAPPDATA%\HelloCalDesktop\admin` og `\app`. Kørende udgaver lukkes og startes igen.
- Første start opretter genvejene "HelloCal Admin" og "HelloCal" i Startmenuen.
- Fastgør til proceslinjen: højreklik på programmets ikon i proceslinjen → Fastgør (Windows 11 tillader ikke, at programmer gør det selv).
- Adminsessionen varer 24 timer (`src/lib/admin-auth.ts`), så admin-adgangskoden skal skrives én gang i døgnet.
- Menu (skjult, vises med Alt): Forside (Alt+Home), Genindlæs (Ctrl+R / F5), Tilbage/Frem (Alt+←/→), Zoom, "Ryd gemt login…".
- Admin starter på `/admin` og ikke `/`, fordi brugerappen på bare `/` sender videre til kalenderen (som er 404 på admin-værten).

Programmerne ændres kun, hvis adresse eller adfærd skal ændres (`main.js`); selve siderne opdateres på serveren som altid.
