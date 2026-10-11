# Krav

## Dummy-/prototypebilleder

- Brug altid rigtige produktbilleder (via Open Food Facts) i stedet for tomme/hvide cirkler i lister og prototyper.
- Foretræk produkter med indpakning/emballage (dvs. noget med en stregkode) frem for løse ingredienser eller frugt — medmindre varen netop *er* en ingrediens eller frugt uden stregkode, hvor et løst billede er korrekt.

## Bundark (screen-overlay/popup)

- Når der tales om **screen-overlay** eller **popup**, menes altid bundarket:
  vinduet glider op nedefra på en mørk scrim, har en trækstreg øverst (samme
  streg som kalenderens nat/dag-håndtag: 40 × 4 px, grå, rund) og kan trækkes
  ned. Et hurtigt swipe ned lukker det (ligesom "Spring over"); et langsomt
  træk under 30 % af højden glider tilbage. Klik på scrim/Escape lukker også.
- Fast klasse: `.hf-bottom-sheet` (med `__panel`, `__grab`, `__handle`,
  `__title`, `__body`, `__footer`, `__dots`, `__skip`). Komponent:
  `BottomSheet` i `src/components/hf/BottomSheet.tsx`. Byg aldrig et nyt
  overlay/popup uden om den.
- Bundarket bruges (og erstatter tidligere dummy-/fuldskærms-opsætning) ved:
  velkomst efter kontooprettelse, guiden (onboarding + admin-guidebyggerens
  startup-guide/tooltips), manglende e-mailbekræftelse, "Tilføj" ud for et
  produkt i søgelisten, "Tilføj" i kalenderen og "Se alle" i tilføj-hjulet.
- Popups vises **aldrig** som fuldskærms-overlay eller
  `window.confirm`/`prompt` — på mobil kun som bundark nedefra (ejerens regel
  2026-10-07). På web er de en lightbox, se "Popups på web" nedenfor.
  Swipe ned = annullér. Bundark har ingen synlig overskrift.
  Bekræftelser: `useConfirmSheet`/`useTypedConfirmSheet`
  (`src/lib/use-confirm-sheet.tsx`). Vælgere med hjul markeres med
  `data-sheet-no-drag`.
- Vist live i admin → Designmanual → Overlay.

## Popups på web (lightbox) — ejerens regel 2026-10-11

- Et bundark er mobilens form og ser forkert ud på en bred skærm. Fra
  1024 px bredde (samme grænse som desktop-skallen `WebShell`;
  `useDesktopViewport` i `src/lib/use-desktop-viewport.ts`) er en popup derfor
  en **lightbox**: centreret over en mørk scrim, alle hjørner runde og
  rummelig — 680 px bred, `size="full"` 960 px og næsten fuld højde,
  bekræftelser (`useConfirmSheet`) 480 px. Ingen trækstreg og intet swipe.
- Lukkes med X øverst til højre, klik på scrim eller Escape. Arkets
  `headerAction` (fx "Færdig") står til venstre for X.
- Samme komponent og API som bundarket (`BottomSheet`): en ny popup bygges
  stadig kun med `BottomSheet`, og den bliver automatisk lightbox på web.
- Popups, der ellers kommer ind fra oven eller bunden uden at bruge
  `BottomSheet` (fx `StaleSyncPrompt`, rescan-banneret når det er åbent og
  scan-appens ark), er på web også en lightbox midt på skærmen (`lg:`-klasser).
- Under 1024 px (mobil) er alt uændret: bundark med trækstreg. Native
  (iOS/Android) er uændret.

## Navngivning

- "Mit bibliotek" (madvarer-siden) hedder **"Gemte madvarer"**.
