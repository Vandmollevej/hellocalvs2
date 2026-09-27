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
- Vist live i admin → Designmanual → Overlay.

## Navngivning

- "Mit bibliotek" (madvarer-siden) hedder **"Gemte madvarer"**.
