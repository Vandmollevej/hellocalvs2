// Startmængde i mængdevælgeren (docs/DECISIONS.md 2026-09-28).
//
// Rækkefølge:
// 1. Brugerens egen seneste mængde for varen.
// 2. En rigtig portionsenhed (servingSizeGrams + enhedsnavne, fx HelloFresh
//    "portion") — tælles i hele portioner.
// 3. Typisk mængde for varens kategori (tabellen nedenfor).
// 6. Producentens portion (fx Open Food Facts' serving_quantity).
// 7. 100 g/ml som sidste udvej.
//
// Producentens portion bruges bevidst ikke før kategorien: den er ofte
// urealistisk lille (musli 30 g, sodavand 10 cl).

export type DefaultAmountProduct = {
  name?: string | null;
  productType?: string | null;
  productCategory?: string | null;
  servingSizeGrams?: number | null;
  servingSizeUnitSingular?: string | null;
  servingSizeUnitPlural?: string | null;
  packageSizeText?: string | null;
  keywords?: string[] | null;
  lastAmountGrams?: number | null;
};

// Første match vinder, så de mest specifikke ord står først. Mængder i g
// (eller ml for drikkevarer).
const TYPICAL_AMOUNTS: { pattern: RegExp; grams: number }[] = [
  { pattern: /(øl|pilsner|lager|ipa|cider)\b/i, grams: 330 },
  { pattern: /(vin|rosé|champagne|cava|prosecco)\b/i, grams: 150 },
  { pattern: /(snaps|\bgin|\brom|whisky|vodka|akvavit|likør|spiritus)\b/i, grams: 40 },
  { pattern: /(sodavand|cola|energidrik|lemonade|limonade|tonic|danskvand|kildevand|\bvand)\b/i, grams: 330 },
  { pattern: /(juice|saft|smoothie|nektar)\b/i, grams: 250 },
  { pattern: /(mælk|kakao|drikkeyoghurt|kærnemælk|havredrik|sojadrik)\b/i, grams: 250 },
  { pattern: /(kaffe|\bte|latte|cappuccino)\b/i, grams: 250 },
  { pattern: /(müsli|musli|mysli|granola|havregryn|cornflakes|morgenmad|cereal)/i, grams: 70 },
  { pattern: /(skyr|yoghurt|ymer|a38|kvark|fromage frais)/i, grams: 200 },
  { pattern: /(pålæg|skinke|hamburgerryg|spegepølse|rullepølse|salami|leverpostej|kalkunbryst|bacon)/i, grams: 25 },
  { pattern: /(smør|margarine|smørbar)/i, grams: 10 },
  { pattern: /(ost|brie|cheddar|mozzarella|feta|parmesan)\b/i, grams: 25 },
  { pattern: /(rugbrød|franskbrød|brød|toast|bolle|bagel|pita|tortilla|wrap)/i, grams: 50 },
  { pattern: /(chips|snacks|nødder|mandler|popcorn)/i, grams: 40 },
  { pattern: /(chokolade|slik|vingummi|lakrids|bar\b|bar$)/i, grams: 30 },
  { pattern: /(kiks|småkager|cookies|kage)/i, grams: 30 },
  { pattern: /(\bis\b|flødeis)/i, grams: 100 },
  { pattern: /(pasta|spaghetti|ris|nudler|couscous|bulgur|quinoa)/i, grams: 90 },
  { pattern: /(ketchup|mayonnaise|remoulade|dressing|sennep|sauce)/i, grams: 20 },
  { pattern: /(marmelade|syltetøj|honning|nutella|peanutbutter|jordnøddesmør)/i, grams: 20 },
];

const CATEGORY_AMOUNTS: Record<string, number> = {
  DRINK: 250,
};

const WINE_PATTERN = /(vin|rosé|champagne|cava|prosecco)\b/i;
const WINE_GLASS_ML = 150;
const DRINK_GLASS_ML = 250;
const SINGLE_DRINK_MAX_ML = 500;

function productText(product: DefaultAmountProduct): string {
  return [product.productType, product.name, ...(product.keywords ?? [])].filter(Boolean).join(" ");
}

export function isSlicedProduct(product: DefaultAmountProduct): boolean {
  return /skive/i.test(productText(product));
}

// "33 cl", "1,5 l", "250ml", "6 x 33 cl" (pr. enhed) → ml. Null hvis ukendt.
export function packageVolumeMl(text?: string | null): number | null {
  const match = text?.match(/(\d+(?:[.,]\d+)?)\s*(ml|cl|l|ltr|liter)\b/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();
  const ml = unit === "ml" ? value : unit === "cl" ? value * 10 : value * 1000;
  return Number.isFinite(ml) && ml > 0 ? ml : null;
}

function drinkAmountMl(product: DefaultAmountProduct): number | null {
  if (product.productCategory !== "DRINK") return null;
  if (WINE_PATTERN.test(productText(product))) return WINE_GLASS_ML;
  const volume = packageVolumeMl(product.packageSizeText);
  if (volume === null) return null;
  return volume <= SINGLE_DRINK_MAX_ML ? volume : DRINK_GLASS_ML;
}

export function typicalAmountGrams(product: DefaultAmountProduct): number | null {
  const text = productText(product);
  if (text) {
    const match = TYPICAL_AMOUNTS.find((entry) => entry.pattern.test(text));
    if (match) return match.grams;
  }
  return (product.productCategory && CATEGORY_AMOUNTS[product.productCategory]) || null;
}

export function defaultAmountGrams(product: DefaultAmountProduct): number {
  if (product.lastAmountGrams && product.lastAmountGrams > 0) return product.lastAmountGrams;
  const serving = product.servingSizeGrams && product.servingSizeGrams > 0 ? product.servingSizeGrams : null;
  if (serving && product.servingSizeUnitSingular && product.servingSizeUnitPlural) return serving;
  if (serving && isSlicedProduct(product)) return serving;
  return drinkAmountMl(product) ?? typicalAmountGrams(product) ?? serving ?? 100;
}
