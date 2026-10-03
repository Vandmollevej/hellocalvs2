// Reklamemuligheder i Hello Cal (docs/DECISIONS.md 2026-10-02). Kataloget er
// statisk: det beskriver, hvor en partners banner kan vises, og om pladsen
// kan udløses af produktkategori/produkttype. Et konkret spot (AdLocation)
// peger på en nøgle herfra via `inventoryKey`.

export type AdInventoryItem = {
  key: string;
  name: string;
  placement: string;
  description: string;
  /** Anbefalet bannerformat i pixels (bredde × højde). */
  format: string;
  /** Kan spottet udløses af produktkategori og/eller produkttype? */
  triggerable: boolean;
};

export const AD_INVENTORY: AdInventoryItem[] = [
  {
    key: "home_banner",
    name: "Forsidebanner",
    placement: "Forside",
    description: "Bred banner under dagens tal på forsiden. Ses af alle, der åbner appen.",
    format: "1200 × 300",
    triggerable: false,
  },
  {
    key: "calendar_day",
    name: "Kalender, dagsvisning",
    placement: "Kalender",
    description: "Banner under dagens måltider i kalenderens dagsvisning.",
    format: "1200 × 300",
    triggerable: false,
  },
  {
    key: "product_page",
    name: "Produktside",
    placement: "Produktside",
    description: "Banner under ingredienslisten på en vare. Kan vises kun for en bestemt produktkategori eller produkttype (fx skyr).",
    format: "1200 × 300",
    triggerable: true,
  },
  {
    key: "search_results",
    name: "Sponsoreret søgeresultat",
    placement: "Søgning",
    description: "Fremhævet række øverst i søgeresultatet, når søgningen rammer en produkttype eller kategori.",
    format: "600 × 160",
    triggerable: true,
  },
  {
    key: "scan_result",
    name: "Efter scanning",
    placement: "Kamera",
    description: "Banner på resultatsiden efter scanning af en vare. Kan udløses af varens kategori eller type.",
    format: "1200 × 300",
    triggerable: true,
  },
  {
    key: "recipe_page",
    name: "Opskrift og ret",
    placement: "Retter",
    description: "Banner nederst på en opskrift eller ret.",
    format: "1200 × 300",
    triggerable: false,
  },
  {
    key: "statistics",
    name: "Statistik",
    placement: "Statistik",
    description: "Banner mellem graferne på statistiksiden.",
    format: "1200 × 300",
    triggerable: false,
  },
  {
    key: "knowledge",
    name: "Viden om",
    placement: "Artikler",
    description: "Banner i bunden af artikler under Viden om (vitaminer, E-numre, sundhedstips).",
    format: "1200 × 300",
    triggerable: false,
  },
];

export function inventoryItem(key: string): AdInventoryItem | undefined {
  return AD_INVENTORY.find((item) => item.key === key);
}

export const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  DRINK: "Drikkevare",
  VEGETABLES: "Grøntsager",
  GENERIC: "Generisk",
  PROCESSED: "Forarbejdet (brand)",
  RAW: "Råvare",
  INGREDIENT: "Ingrediens",
};
