// Startmængde i mængdevælgeren (docs/DECISIONS.md 2026-09-28).
//
// Rækkefølge:
// 1. Brugerens egen seneste mængde for varen.
// 2. En rigtig portionsenhed (servingSizeGrams + enhedsnavne, fx HelloFresh
//    "portion") — tælles i hele portioner.
// 3. Typisk mængde for varens kategori (tabellen nedenfor).
// 4. Producentens portion (fx Open Food Facts' serving_quantity).
// 5. 100 g/ml som sidste udvej.
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

export function typicalAmountGrams(product: DefaultAmountProduct): number | null {
  const text = [product.productType, product.name].filter(Boolean).join(" ");
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
  return typicalAmountGrams(product) ?? serving ?? 100;
}
