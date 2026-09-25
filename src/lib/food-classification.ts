// G3 (docs/DECISIONS.md 2026-09-24): klassifikation af hvad en registrering
// ernæringsmæssigt er — kødtype, alkohol og sukkerholdig drik — til
// statistikboksene, "Største kilder" og "Månedens synder".
//
// Kilden er produktets egne felter fra regnearkene (REMA-importen gemmer dem i
// Product.dietaryTags): `meat` (fx "Kylling", "Gris, Okse"), `isSugarFree`,
// `isAlcoholFree` og `pct` (alkohol-%), plus Product.productType,
// Product.productCategory og sukker pr. 100 g i Product.nutritionExtra.
// Klassifikationen gemmes som snapshot på registreringen (samme princip som
// kcal/makro-snapshots) og ændres ikke, hvis produktet senere rettes.

export type MeatType = "BEEF" | "PORK" | "POULTRY" | "FISH";

export const MEAT_TYPES: MeatType[] = ["BEEF", "PORK", "POULTRY", "FISH"];

export type FoodClassification = {
  productCategory: string | null;
  productType: string | null;
  isDrink: boolean;
  // Andel af varens vægt pr. kødtype (0-1). "Gris, Okse" deles ligeligt.
  meat: { type: MeatType; share: number }[];
  isAlcohol: boolean;
  alcoholPercent: number | null;
  isSugaryDrink: boolean;
  sugarPer100g: number | null;
};

// Den del af et offentligt produkt (/api/products/:id), klassifikationen læser.
export type ClassifiableProduct = {
  productCategory?: string | null;
  productType?: string | null;
  servingSizeGrams?: number | null;
  dietaryTags?: unknown;
  nutritionExtra?: unknown;
};

// Regnearkets kødord -> kødtype. Fjerkræ samler al fjerkræ; fisk inkluderer
// skaldyr. Lam og "Ukendt" tæller ikke i nogen af de fire bokse.
const MEAT_WORDS: Record<string, MeatType> = {
  okse: "BEEF",
  oksekød: "BEEF",
  kalv: "BEEF",
  gris: "PORK",
  svin: "PORK",
  svinekød: "PORK",
  kylling: "POULTRY",
  kalkun: "POULTRY",
  and: "POULTRY",
  gås: "POULTRY",
  fjerkræ: "POULTRY",
  fisk: "FISH",
  skaldyr: "FISH",
  rejer: "FISH",
  laks: "FISH",
  tun: "FISH",
};

// Bruges kun når alkohol-% mangler i regnearket.
const ALCOHOL_TYPE_PATTERN = /(øl|vin|snaps|gin|rom|whisky|vodka|akvavit|likør|cider|vermouth|spiritus)$/i;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseMeat(value: unknown): FoodClassification["meat"] {
  const text = str(value);
  if (!text) return [];
  const types = Array.from(
    new Set(
      text
        .split(",")
        .map((part) => MEAT_WORDS[part.trim().toLowerCase()])
        .filter((type): type is MeatType => Boolean(type)),
    ),
  );
  return types.map((type) => ({ type, share: 1 / types.length }));
}

// "4,6%" -> 4.6. "4% fedt" er en fedtprocent, ikke alkohol.
export function parseAlcoholPercent(value: unknown): number | null {
  const text = str(value);
  if (!text || /fedt/i.test(text)) return null;
  const match = text.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function sugarPer100g(product: ClassifiableProduct): number | null {
  const extra = record(product.nutritionExtra);
  const direct = num(extra.sugarPer100g);
  if (direct !== null) return direct;
  // HelloFresh-retter har sukker pr. portion.
  const perServing = num(extra.sugarG);
  if (perServing !== null && product.servingSizeGrams) return (perServing / product.servingSizeGrams) * 100;
  return null;
}

export function classifyProduct(product: ClassifiableProduct): FoodClassification {
  const tags = record(product.dietaryTags);
  const productCategory = str(product.productCategory);
  const productType = str(product.productType);
  const isDrink = productCategory === "DRINK";
  const alcoholFree = Boolean(str(tags.isAlcoholFree));
  const percent = alcoholFree ? 0 : parseAlcoholPercent(tags.pct);
  const isAlcohol =
    isDrink &&
    !alcoholFree &&
    (percent !== null ? percent > 0.5 : Boolean(productType && ALCOHOL_TYPE_PATTERN.test(productType)));
  const sugarFree = Boolean(str(tags.isSugarFree));
  const sugar = sugarPer100g(product);
  // Brugerens regel: en drikkevare, der indeholder sukker, er sukkerholdig —
  // også mælk, smoothie og drikkeyoghurt. Sukkerfri/light tæller ikke.
  const isSugaryDrink = isDrink && !isAlcohol && !sugarFree && sugar !== null && sugar > 0;

  return {
    productCategory,
    productType,
    isDrink,
    meat: parseMeat(tags.meat),
    isAlcohol,
    alcoholPercent: isAlcohol ? percent : null,
    isSugaryDrink,
    sugarPer100g: sugar,
  };
}

// --- Beregninger på registreringer ---

export type SourceRegistration = {
  id?: string;
  productId?: string | null;
  dishId?: string | null;
  genericIngredientId?: string | null;
  titleSnapshot?: string;
  kcalSnapshot: number;
  fatSnapshot?: number;
  sugarSnapshot?: number | null;
  amountGrams?: number;
  createdAt: string;
  product?: { imageUrl: string | null } | null;
  // undefined = ikke klassificeret endnu; null = intet produkt at klassificere.
  classification?: FoodClassification | null;
};

export type SourceMetric = "kcal" | "fat" | "sugar";

export const SOURCE_METRICS: { key: SourceMetric; label: string }[] = [
  { key: "kcal", label: "Kalorier" },
  { key: "fat", label: "Fedt" },
  { key: "sugar", label: "Sukker" },
];

export function isSourceMetric(value: unknown): value is SourceMetric {
  return value === "kcal" || value === "fat" || value === "sugar";
}

// Snapshot først; ellers produktets sukker pr. 100 g × spist mængde.
export function registrationSugarGrams(registration: SourceRegistration): number {
  if (typeof registration.sugarSnapshot === "number") return registration.sugarSnapshot;
  const per100 = registration.classification?.sugarPer100g;
  return per100 != null && registration.amountGrams ? (per100 * registration.amountGrams) / 100 : 0;
}

export function metricValue(registration: SourceRegistration, metric: SourceMetric): number {
  if (metric === "kcal") return registration.kcalSnapshot;
  if (metric === "fat") return registration.fatSnapshot ?? 0;
  return registrationSugarGrams(registration);
}

export type MeatTotals = Record<MeatType, { grams: number; kcal: number }>;

// Andelen af varen, der er den pågældende kødtype, tæller i både gram og kcal.
export function meatTotals(registrations: SourceRegistration[]): MeatTotals {
  const totals = Object.fromEntries(MEAT_TYPES.map((type) => [type, { grams: 0, kcal: 0 }])) as MeatTotals;
  for (const registration of registrations) {
    for (const { type, share } of registration.classification?.meat ?? []) {
      totals[type].grams += (registration.amountGrams ?? 0) * share;
      totals[type].kcal += registration.kcalSnapshot * share;
    }
  }
  return totals;
}

export function sugaryDrinkKcal(registrations: SourceRegistration[]): number {
  return registrations
    .filter((r) => r.classification?.isSugaryDrink)
    .reduce((sum, r) => sum + r.kcalSnapshot, 0);
}

// 1 genstand = 12 g ren alkohol; ethanol vejer 0,789 g/ml. Drikkevarers
// mængde er i ml (samme basisenhed som mængdevælgeren).
const ETHANOL_DENSITY = 0.789;
const GRAMS_PER_UNIT = 12;

export function alcoholTotals(registrations: SourceRegistration[]) {
  let kcal = 0;
  let volumeMl = 0;
  let units = 0;
  for (const registration of registrations) {
    const c = registration.classification;
    if (!c?.isAlcohol) continue;
    const ml = registration.amountGrams ?? 0;
    kcal += registration.kcalSnapshot;
    volumeMl += ml;
    if (c.alcoholPercent !== null) units += (ml * (c.alcoholPercent / 100) * ETHANOL_DENSITY) / GRAMS_PER_UNIT;
  }
  return { kcal, volumeMl, units };
}

// --- Største kilder (samlet pr. vare / pr. produkttype) ---

export type SourceItem = {
  key: string;
  productId: string | null;
  title: string;
  imageUrl: string | null;
  productType: string;
  value: number;
};

export function productTypeLabel(registration: SourceRegistration): string {
  const type = registration.classification?.productType;
  if (type) return type;
  if (registration.dishId) return "Egne retter";
  return "Andet";
}

function sourceKey(registration: SourceRegistration): string {
  if (registration.productId) return `p:${registration.productId}`;
  if (registration.genericIngredientId) return `g:${registration.genericIngredientId}`;
  if (registration.dishId) return `d:${registration.dishId}`;
  return `t:${registration.titleSnapshot ?? ""}`;
}

/** Alle registreringer af samme vare lægges sammen; størst først. */
export function aggregateSources(registrations: SourceRegistration[], metric: SourceMetric): SourceItem[] {
  const byKey = new Map<string, SourceItem>();
  for (const registration of registrations) {
    const key = sourceKey(registration);
    const existing = byKey.get(key);
    const value = metricValue(registration, metric);
    if (existing) {
      existing.value += value;
      if (!existing.imageUrl && registration.product?.imageUrl) existing.imageUrl = registration.product.imageUrl;
      continue;
    }
    byKey.set(key, {
      key,
      productId: registration.productId ?? null,
      title: registration.titleSnapshot ?? "",
      imageUrl: registration.product?.imageUrl ?? null,
      productType: productTypeLabel(registration),
      value,
    });
  }
  return Array.from(byKey.values())
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

export type SourceGroup = {
  productType: string;
  value: number;
  // Andel af periodens samlede værdi (0-1).
  share: number;
  items: SourceItem[];
};

/** Varerne grupperet efter produkttype, største gruppe først. */
export function groupSourcesByProductType(registrations: SourceRegistration[], metric: SourceMetric): SourceGroup[] {
  const items = aggregateSources(registrations, metric);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const byType = new Map<string, SourceGroup>();
  for (const item of items) {
    const group = byType.get(item.productType) ?? { productType: item.productType, value: 0, share: 0, items: [] };
    group.value += item.value;
    group.items.push(item);
    byType.set(item.productType, group);
  }
  return Array.from(byType.values())
    .map((group) => ({ ...group, share: total > 0 ? group.value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

export function filterRegistrationsInRange<T extends { createdAt: string }>(
  registrations: T[],
  range: { start: Date; end: Date },
): T[] {
  const start = range.start.getTime();
  const end = range.end.getTime();
  return registrations.filter((r) => {
    const time = new Date(r.createdAt).getTime();
    return time >= start && time < end;
  });
}

export function registrationsWithinLastDays<T extends { createdAt: string }>(registrations: T[], days: number): T[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return registrations.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
}

// --- Formatering ---

export function formatAmount(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits }).format(value);
}

/** Gram op til 999 g, derefter kg. */
export function formatGrams(grams: number): string {
  if (Math.round(grams) >= 1000) return `${formatAmount(grams / 1000, 1)} kg`;
  return `${formatAmount(grams)} g`;
}

/** cl under 1 liter, derefter liter. */
export function formatVolume(ml: number): string {
  if (Math.round(ml) >= 1000) return `${formatAmount(ml / 1000, 1)} l`;
  return `${formatAmount(ml / 10)} cl`;
}

export function formatMetric(value: number, metric: SourceMetric): string {
  return metric === "kcal" ? `${formatAmount(value)} kcal` : `${formatAmount(value, value < 10 ? 1 : 0)} g`;
}

export function formatShare(share: number): string {
  return `${formatAmount(share * 100)} %`;
}
