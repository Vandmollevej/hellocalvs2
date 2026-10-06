# Importerede åbne opgaver — peter@packroff.dk (2026-10-06)

Kopi af alle LOKALE udestående opgaver (cloud-sessioner/claude.ai er udeladt: G-FAM og G14) fra `docs/handoffs/OPEN-TASKS.md` på kontoen peter@packroff.dk, taget FØR sessionen "Slet udestående opgaver" rydder den fil.
Denne fil er bevidst adskilt fra OPEN-TASKS.md, så den ikke bliver slettet sammen med oprydningen. Slet først rækker her, når opgaven er løst.

Status-værdier: `Ikke startet` · `Venter på bruger` · `I gang` · `Blokeret` · `Deployet (mangler noget)` · `Færdig (kode), mangler noget`

| Gruppe | Id | Opgave | Status | Næste skridt |
| --- | --- | --- | --- | --- |
| G5 Agent-app | 548ca51e | Ny invite-only agent-app (hyldebillede, opret vare, 2FA, admin-oversigt, aflønnings-backend) | Deployet (2026-09-26), mangler noget | Merget til master (29b7f28); `scan-app` (port 3101) startes i deploy-workflowet. Mangler: brugeren opretter Cloudflare *Published application route* `scanhellocal.packroff.dk` → `http://192.168.1.90:3101`. Face ID-login bygget 2026-09-29 (branch `claude/scan-passkey-keys`). Mangler: merge af PR #104 og test med rigtig hylde |
| G5 Agent-app | 850e575e / 0669f736 | Logo-robot: isolér logo ved scanning, match mod DB, natlig Google-søgning, admin-kø under 90 % | Deployet (2026-09-26), mangler noget | `logo-agent` i deploy-workflowet; bruger `GOOGLE_API_KEY` (Cloud Vision API skal være slået til på nøglens Google-projekt). Natlig Google-søgning ikke lavet |
| G5 Agent-app | — | Deploy-trinnet "Build and start catalog agents" i `.github/workflows` fejler ved hvert push til master siden 2026-09-24 (fx run 50a5a47) | Åben (rettelse bedt om af brugeren) | Læs job-loggen på GitHub og ret |
| G8 Integrationer | 8d98b548 | Withings + Google Health koblet på, egen data-sync | Venter på bruger | Nøglerne ligger på serveren. Mangler kun testbruger packroff@gmail.com i Google Cloud (se STATUS "Integrationssiden") |
| G8 Integrationer | d0442775 | Valdemarsro (DK-only) + scraper | Venter på bruger | Scraper + kalorie-matcher færdige (scripts/valdemarsro-import, 157cff9). IKKE bygget: import til appen + Valdemarsro-kort/toggle på Integrationer — byg når brugeren siger til |
| G8 Integrationer | 6068f78a | 8 sundhedsintegrationer + nye ikoner | Færdig (22184fe), mangler noget | Mangler kun nøgler på serveren + deploy |
| G8 Integrationer | 300489b5 | Push til Health/integrationer | Færdig (ce1bc7f), mangler noget | Brugeren: skriveadgang i Google Cloud-klienten + Strava (activity:write); native app til Apple Health/Health Connect mangler |
| Widgets | c4b41bf9 | Forbered widgets (plus-knap, hurtig-tilføj, statistik-graf, 2×2 boks, seneste registreringer) | Venter på bruger | Brugeren godkender designet på `/widgets`; derefter native (Swift/Kotlin) kompileres på Mac/Android Studio efter `native/README.md` |
| Ingen gruppe | d595e6bc | REMA-appelsin har "Zimbabwe" som produkttype → skal være land | Venter på bruger | Kør SQL via SSH/sudo mod tabellen `products` (se transcript for kommandoen) |
| G12 / G13 | — | Sidste 5 filer: `calendar/page.tsx`, `settings/page.tsx`, `settings/support/page.tsx`, `settings/display/front-page/page.tsx`, `admin/ApiKeysManager.tsx` (48 px-højde) | Blokeret | Når filerne er committet: kalender-rækker → `hf-control-row`, support-rækker/knapper → `hf-control-row`/`hf-control`, front-page-rækker → `hf-control-row`, ApiKeysManager `inputClass` → `hf-field` (OBS: G12 står som Færdig (3a3b398) i samme fil — tjek git før arbejde) |
| Opsætningsguide | onboarding-integration | Vægt + Aktivitetsniveau: tekstlink "Tilføj gennem integration i stedet"; Aktivitetsniveau som HelloFresh-slidersider (5 sider, DESIGN_V2 §8) | Ikke startet | Klar til bygning |
| G13 HelloFresh | ed3c2525 | HelloFresh-opskriftsvisning | Færdig, mangler deploy | Migration 20260927100000 + genstart hellofresh-agent. Afventer brugerens visuelle godkendelse |
| G7 Profil | — | Samlet deploy af G7 (migration 20260926090000_body_measurement_neck) | Deploy afventer | Se OPEN-TASKS.md G7 |
| G6 Madvare-flow | — | Trin-baren på Opsætning | Afventer godkendelse | Mangler kun brugerens visuelle godkendelse |
| Ikke fordelt | — | Ikke-committede filer uden kendt ejer: `docs/AI.md`, `src/components/AddButton.tsx`, `src/components/hf/PointsPromoBanner.tsx`, `src/i18n/locales/*.json`, `src/lib/vault/webauthn-client.ts` | Åben | Læs `git diff` før du rører dem |

Planlagte opgaver i Claude (`C:\Users\Peter\.claude\scheduled-tasks\`, ligger uden for repoet og påvirkes ikke af oprydningen): spar-vare-cleanup-finish, resume-hello-cal-header-accordion-fix, resume-hello-doc-pause, resume-bottomnav-fix, product-create-scan-flow — alle engangs-opgaver, slået fra efter kørsel.
