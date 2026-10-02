// Startmængde i mængdevælgeren (docs/DECISIONS.md 2026-09-28 og 2026-10-02).
//
// Rækkefølge:
// 1. Brugerens egen seneste mængde for varen.
// 2. En rigtig portionsenhed (servingSizeGrams + enhedsnavne, fx HelloFresh
//    "portion") — tælles i hele portioner.
// 3. Drikkevarer og alkohol: pakkens størrelse, når den er én servering
//    (33 cl dåse, 25 cl flaske, 50 cl øl) — fra pakningsstørrelsen eller navnet.
// 4. Typisk mængde for varens kategori (tabellen nedenfor).
// 5. Producentens portion (fx Open Food Facts' serving_quantity).
// 6. 100 g/ml som sidste udvej.
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
  dietaryTags?: unknown;
  lastAmountGrams?: number | null;
};

// Første match vinder, så de mest specifikke ord står først. Mængder i g
// (eller ml for drikkevarer).
const TYPICAL_AMOUNTS: { pattern: RegExp; grams: number }[] = [
  // Drikkevarer
  { pattern: /(øl|pilsner|lager|ipa|stout|porter|cider|shandy|radler)\b/i, grams: 330 },
  { pattern: /(vin|rosé|champagne|cava|prosecco|crémant|cremant)\b/i, grams: 150 },
  { pattern: /(portvin|sherry|vermouth|hedvin)\b/i, grams: 50 },
  { pattern: /(snaps|\bgin\b|\brom\b|whisky|whiskey|vodka|akvavit|likør|spiritus|cognac|brandy|tequila|bitter)\b/i, grams: 40 },
  { pattern: /(sodavand|cola|energidrik|lemonade|limonade|tonic|danskvand|kildevand|sportsdrik|iste|ice tea|\bvand)\b/i, grams: 330 },
  { pattern: /(juice|saft|smoothie|nektar|most)\b/i, grams: 250 },
  { pattern: /(drikkeyoghurt|kærnemælk|havredrik|sojadrik|mandeldrik|risdrik|kakaomælk|chokolademælk|mælk|kakao)\b/i, grams: 250 },
  { pattern: /(kaffe|\bte\b|latte|cappuccino|espresso)\b/i, grams: 250 },
  // Morgenmad og mejeri
  { pattern: /(müsli|musli|mysli|granola|havregryn|cornflakes|morgenmad|cereal)/i, grams: 70 },
  { pattern: /(skyr|yoghurt|ymer|a38|kvark|fromage frais|cottage cheese|hytteost)/i, grams: 200 },
  { pattern: /(fløde|creme fraiche|crème fraîche|cremefraiche)/i, grams: 30 },
  { pattern: /\bæg\b|\bæggene\b/i, grams: 60 },
  // Pålæg, brød og smørbart
  { pattern: /(pålæg|skinke|hamburgerryg|spegepølse|rullepølse|salami|leverpostej|kalkunbryst|bacon|kyllingebryst i skiver)/i, grams: 25 },
  { pattern: /(smør|margarine|smørbar)/i, grams: 10 },
  { pattern: /(hummus|tapenade|pesto|tzatziki|dip)\b/i, grams: 30 },
  { pattern: /(ost|brie|cheddar|mozzarella|feta|parmesan|gouda|danbo)\b/i, grams: 25 },
  { pattern: /(rugbrød|franskbrød|brød|toast|bolle|bagel|pita|tortilla|wrap|knækbrød|riskiks)/i, grams: 50 },
  // Snacks og søde sager
  { pattern: /(chips|snacks|nødder|mandler|popcorn|peanuts|cashew)/i, grams: 40 },
  { pattern: /(rosiner|tørret frugt|dadler|abrikoser)/i, grams: 30 },
  { pattern: /(chokolade|slik|vingummi|lakrids|proteinbar|müslibar|bar\b|bar$)/i, grams: 30 },
  { pattern: /(kiks|småkager|cookies|kage|wienerbrød|croissant|muffin)/i, grams: 50 },
  { pattern: /(\bis\b|flødeis|sorbet)/i, grams: 100 },
  // Måltider
  { pattern: /(pizza)/i, grams: 350 },
  { pattern: /(lasagne|færdigret|ret til én|mikroret)/i, grams: 400 },
  { pattern: /(suppe)/i, grams: 300 },
  { pattern: /(pasta|spaghetti|ris|nudler|couscous|bulgur|quinoa)/i, grams: 90 },
  { pattern: /(kartoffel|kartofler|pommes frites)/i, grams: 200 },
  { pattern: /(hakket|hakkekød|oksekød|svinekød|kyllingebryst|kyllingefilet|kylling|kalkun|bøf|kotelet|mørbrad|steak)/i, grams: 150 },
  { pattern: /(laks|torsk|rejer|tun|fisk|sej|rødspætte|makrel|sild)/i, grams: 125 },
  { pattern: /(frikadelle|pølse|hotdog|burgerbøf)/i, grams: 75 },
  // Frugt
  { pattern: /(banan)/i, grams: 120 },
  { pattern: /(æble|pære|appelsin|nektarin|fersken)/i, grams: 150 },
  { pattern: /(blåbær|hindbær|jordbær|vindruer|bær)/i, grams: 100 },
  // Tilbehør
  { pattern: /(ketchup|mayonnaise|remoulade|dressing|sennep|sauce)/i, grams: 20 },
  { pattern: /(marmelade|syltetøj|honning|nutella|peanutbutter|jordnøddesmør)/i, grams: 20 },
  { pattern: /(olie|olivenolie|rapsolie)/i, grams: 10 },
];

const CATEGORY_AMOUNTS: Record<string, number> = {
  DRINK: 250,
};

// Væsker, der ikke drikkes som en hel pakke (fløde, olie, eddike …), selv om
// de er registreret som drikkevare eller har en størrelse i cl.
const NOT_A_DRINK = /(fløde|madlavning|olie|eddike|sirup|sauce|dressing|bouillon|fond|marinade|ketchup|soja|kokosmælk|piskefløde|creme fraiche)/i;
// Ord, der gør en vare uden kategorien DRINK til en drikkevare.
const DRINK_WORDS =
  /(øl|pilsner|lager|ipa|stout|porter|cider|vin|rosé|champagne|cava|prosecco|snaps|gin|rom|whisky|whiskey|vodka|akvavit|likør|spiritus|cognac|sodavand|cola|energidrik|lemonade|limonade|tonic|danskvand|kildevand|flaskevand|vand|juice|saft|smoothie|nektar|drik|iste|ice tea|shot|alkopop|cocktail|mojito|spritz)\b/i;
const WINE = /(vin|rosé|champagne|cava|prosecco|crémant|cremant|portvin|sherry|vermouth|hedvin)\b/i;
const SPIRIT = /(snaps|\bgin\b|\brom\b|whisky|whiskey|vodka|akvavit|likør|spiritus|cognac|brandy|tequila|bitter)\b/i;
// Færdigblandede drinks (gin & tonic, rom og cola) drikkes som hele dåsen.
const MIXED = /(tonic|cola|lemon|mix|&|\bog\b|soda|spritz|cocktail|mojito|shot|alkopop|ready to drink|rtd)/i;

const WINE_GLASS_ML = 150;
const SPIRIT_SERVING_ML = 40;
const DRINK_GLASS_ML = 250;
const SINGLE_DRINK_MAX_ML = 500;
const SINGLE_WINE_MAX_ML = 250;
const SINGLE_SPIRIT_MAX_ML = 100;

function productText(product: DefaultAmountProduct): string {
  return [product.productType, product.name, ...(product.keywords ?? [])].filter(Boolean).join(" ");
}

export function isSlicedProduct(product: DefaultAmountProduct): boolean {
  return /skive/i.test(productText(product));
}

const VOLUME_PATTERN = /(\d+(?:[.,]\d+)?)\s*(ml|cl|dl|l|ltr|liter)\b/i;

// "33 cl", "1,5 l", "250ml", "6 x 33 cl" (pr. enhed) → ml. Null hvis ukendt.
export function packageVolumeMl(text?: string | null): number | null {
  const match = text?.match(VOLUME_PATTERN);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();
  const factor = unit === "ml" ? 1 : unit === "cl" ? 10 : unit === "dl" ? 100 : 1000;
  const ml = value * factor;
  return Number.isFinite(ml) && ml > 0 ? ml : null;
}

// Pakkens volumen fra pakningsstørrelsen, ellers fra navnet ("Tuborg Classic 33 cl").
export function productVolumeMl(product: DefaultAmountProduct): number | null {
  return packageVolumeMl(product.packageSizeText) ?? packageVolumeMl(product.name);
}

// Alkohol-% fra dietaryTags.pct ("4,6 %"), samme format som
// src/lib/food-classification.ts. Alkoholfri = 0.
function alcoholPercent(product: DefaultAmountProduct): number | null {
  const tags = product.dietaryTags;
  if (!tags || typeof tags !== "object") return null;
  const record = tags as Record<string, unknown>;
  if (record.isAlcoholFree) return 0;
  const text = typeof record.pct === "string" ? record.pct.trim() : "";
  if (!text || /fedt/i.test(text)) return null;
  const match = text.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function isDrinkProduct(product: DefaultAmountProduct): boolean {
  const text = productText(product);
  if (NOT_A_DRINK.test(text)) return false;
  if (product.productCategory === "DRINK") return true;
  // Varer uden kategorien DRINK tæller kun, når både navnet og størrelsen
  // siger drikkevare (fx "Carlsberg Pilsner 33 cl").
  return DRINK_WORDS.test(text) && productVolumeMl(product) !== null;
}

// Startmængde for en drikkevare i ml, eller null hvis varen ikke er en.
export function drinkAmountMl(product: DefaultAmountProduct): number | null {
  if (!isDrinkProduct(product)) return null;
  const text = productText(product);
  const volume = productVolumeMl(product);
  const percent = alcoholPercent(product);
  const isSpirit = (percent !== null && percent >= 20) || (percent === null && SPIRIT.test(text) && !MIXED.test(text));
  if (isSpirit) return volume !== null && volume <= SINGLE_SPIRIT_MAX_ML ? volume : SPIRIT_SERVING_ML;
  const isWine = WINE.test(text) && !MIXED.test(text);
  if (isWine) return volume !== null && volume <= SINGLE_WINE_MAX_ML ? volume : WINE_GLASS_ML;
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
