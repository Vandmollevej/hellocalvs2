# Admin: genveje og automatisering (AutoHotkey / UI Automation)

Admin kan styres uden mus på to måder: **tastaturgenveje** (`/admin/shortcuts`,
admin → Indstillinger → Genveje) og **faste mærker** på menuer, knapper og
felter, så AutoHotkey (UI Automation) eller en browser-automatisering kan
finde dem.

## Genveje

Kilden er `src/lib/admin-shortcuts.ts` (side-adresse → genvej). Hver side i
menuen (`NAV` i `AdminShell.tsx`) skal have en; `npm test` fejler, hvis en side
mangler. Genveje-siden læser menuen og viser genvej + AutoHotkey-tekst.

| Gruppe | Regel |
| --- | --- |
| Alt + bogstav | De hyppigste sider (Oversigt Alt+O, Statistik Alt+S, Kvalitetskontrol Alt+K, Usikkerheder Alt+U, Nye varer Alt+N, Varer Alt+P, Alle brugere Alt+B, Beskeder Alt+M, Genveje Alt+G …) |
| Alt + Shift + bogstav | De øvrige menupunkter (fx Economy Alt+Shift+E, Brands Alt+Shift+R, Cronjobs Alt+Shift+J) |
| Alt + 1…6 | Partnere (Reklamer, Kontakter, B2B-brugere, Rapporter) og Roadmap (Roadmap, Claude-integration) i menuens rækkefølge |
| Ctrl + P | Varer (Produkter) — ejerens ønske, ud over Alt+P |
| Ctrl + K | "Gå til…" (søg i alle sider) |
| Ctrl + B | Skjul/vis sidebjælken (skuffen under 1024 px) |

Sikkerhedsregler (testet i `src/lib/admin-shortcuts.test.mjs`):

- Genvejene virker fra hele siden, også mens fokus står i et felt. Ctrl bruges
  kun til Ctrl+P, Ctrl+K og Ctrl+B — aldrig til Ctrl+A/C/V/X/Z eller
  browserens faneskift (Ctrl+N/T/W).
- Alt + D/E/F er sprunget over (browserens adresse- og menugenveje).
- AltGr (= Ctrl + Alt på Windows) og Cmd + Alt ignoreres, så @, € og { } kan
  skrives. På Mac ignoreres Alt-genveje i felter (Option skriver specialtegn).
- Ctrl + P erstatter udskrivning af admin-sider; brug browsermenuen til print.
- Tegnet læses fra `event.key` (A–Z/0–9, følger tastaturlayoutet), ellers fra
  `event.code`. Æ/Ø/Å bruges ikke.

Genveje vises som tastaturmærke (`.hf-kbd`) i "Gå til…" og ved hover på en
menurække, og som `aria-keyshortcuts` på hvert menupunkt (Chrome/Edge viser
den som UIA `AcceleratorKey`).

## Mærker til automatisering

Chrome/Edge gør DOM-`id` til UIA **AutomationId** og elementets navn
(`aria-label`/tekst) til **Name**; `data-automation` har samme værdi til
DOM-selectors (Playwright, DevTools). Browseren skal have tilgængelighed slået
til — Chrome gør det selv, når en UIA-klient spørger, ellers start den med
`--force-renderer-accessibility`.

1. **Skallen er mærket i hånden** (`AdminShell.tsx`, ids uafhængige af sprog,
   `src/lib/automation-markers.ts` → `automationProps`):

   | Element | id |
   | --- | --- |
   | Sidebjælke, logo, "Gå til…"-felt, sammenfold-håndtag | `hc-sidebar-nav`, `hc-sidebar-logo`, `hc-sidebar-search`, `hc-sidebar-toggle` |
   | Menupunkt (side) | `hc-nav-<nøgle>` — nøglen er menuens oversættelsesnøgle uden `nav_`, fx `hc-nav-product-database-products`, `hc-nav-log`, `hc-nav-shortcuts` |
   | Menugruppe (fold ud/ind) | `hc-nav-group-<id>`, fx `hc-nav-group-settings` |
   | Skuffen under 1024 px | samme, men `hc-drawer-nav-…`, `hc-drawer-search`, `hc-drawer-close` |
   | Topbjælke | `hc-topbar-menu`, `hc-topbar-logo`, `hc-topbar-search`, `hc-breadcrumbs` |
   | Brugermenu | `hc-user-menu`, `hc-user-menu-admin-users`, `hc-user-menu-language`, `hc-user-menu-logout` |
   | Gå til… | `hc-quick-search`, `hc-quick-search-input`, `hc-quick-search-<nøgle>` |
   | Indhold | `hc-main`; Genveje-siden `hc-shortcuts…`, `hc-shortcut-<nøgle>` |

2. **Alt andet i admin mærkes automatisk** (`AutomationMarkers.tsx`, monteret
   i skallen): hver knap, link, input, select, textarea, fane og switch, der
   ikke allerede har `data-automation`, får
   `data-automation="<type>-<navn>"` og, hvis den mangler `id`, `id="hc-<side>--<type>-<navn>"`.
   Navnet kommer fra `aria-label`, feltets `label`, `name`, `placeholder`,
   teksten eller `title`, translittereret til a–z/0–9 (`Ønskede` → `oenskede`).
   Gentagelser på samme side får `-2`, `-3` i DOM-rækkefølge. Mærkerne følger
   derfor sproget (DA/EN) og er "best effort": for en stabil automatisering af
   en bestemt knap eller et felt, giv den et fast id i koden med
   `{...automationProps("hc-<navn>")}`.

Fælles klasser (`.hf-field`, `.hf-control`, `.hf-btn-*`, `.hf-navrow`,
`.hf-surface`) er til DOM-selectors; de er ikke et UIA-id.

## Nye menupunkter

Tilføj siden i `NAV` (AdminShell), en oversættelsesnøgle i `admin-i18n.ts`, en
genvej i `ADMIN_PAGE_SHORTCUTS` og en linje i `page-tree.ts`. Menupunktet får
sit `hc-nav-…`-id og sin genvej af sig selv.
