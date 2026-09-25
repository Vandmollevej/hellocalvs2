// Visningsenhed for mængdevælgeren (docs/DECISIONS.md 2026-09-24).
//
// Produktets registrerede produktkategori (Product.productCategory) er
// autoritativ: drikkevarer vises i ml/cl, alt andet i g. Enheden gættes aldrig
// ud fra produktnavnet. Mængden gemmes altid i basisenheden (g eller ml), som
// næringsværdierne pr. 100 er regnet ud fra — cl er kun en visning (1 cl =
// 10 ml), så kcal-beregningen er uændret.

export const PRODUCT_CATEGORIES = ["DRINK", "VEGETABLES", "GENERIC", "PROCESSED", "RAW", "INGREDIENT"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

// Brugerens grove regnearks-kategorier (docs/DECISIONS.md 2026-09-24, G3).
// ID'erne er uændrede; kun de viste navne følger regnearket.
export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  DRINK: "Drikkevarer",
  VEGETABLES: "Grøntsager",
  RAW: "Råvarer",
  PROCESSED: "Forarbejdede varer",
  GENERIC: "Generisk",
  INGREDIENT: "Ingrediens",
};

export type ProductDisplayUnit = "g" | "ml" | "cl";

export type ProductUnitSource = {
  productCategory?: string | null;
  packageSizeText?: string | null;
};

export function isProductCategory(value: unknown): value is ProductCategory {
  return typeof value === "string" && (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

// Normaliserer en enhed skrevet på forskellige måder ("gr.", "Ltr", "centiliter").
// Liter vises som ml, da mængdevælgeren arbejder i små trin.
export function normalizeUnit(unit?: string | null): ProductDisplayUnit | null {
  if (!unit) return null;
  switch (unit.trim().toLowerCase()) {
    case "g":
    case "gr":
    case "gr.":
    case "gram":
      return "g";
    case "ml":
    case "milliliter":
    case "l":
    case "ltr":
    case "liter":
      return "ml";
    case "cl":
    case "centiliter":
      return "cl";
    default:
      return null;
  }
}

// Enheden i en pakningsstørrelse som "33cl", "50 cl", "1Ltr", "500 ml".
export function unitFromPackageSize(text?: string | null): ProductDisplayUnit | null {
  const match = text?.match(/\d\s*([a-zA-Z.]+)\s*$/);
  return match ? normalizeUnit(match[1]) : null;
}

export function getProductDisplayUnit(product: ProductUnitSource | null | undefined): ProductDisplayUnit {
  if (product?.productCategory !== "DRINK") return "g";
  // Et fejlagtigt "g" på en drikkevare må aldrig give gram.
  return unitFromPackageSize(product.packageSizeText) === "cl" ? "cl" : "ml";
}

// Basismængde (g/ml) → tal i visningsenheden.
export function toDisplayAmount(baseAmount: number, unit: ProductDisplayUnit): number {
  return unit === "cl" ? Math.round(baseAmount) / 10 : baseAmount;
}

// Tal i visningsenheden → basismængde (g/ml).
export function fromDisplayAmount(displayAmount: number, unit: ProductDisplayUnit): number {
  return unit === "cl" ? Math.round(displayAmount * 10) : displayAmount;
}

export function formatProductAmount(baseAmount: number, unit: ProductDisplayUnit): string {
  const value = toDisplayAmount(baseAmount, unit);
  return `${new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(value)} ${unit}`;
}

// Enheden næringsgrundlaget "pr. 100" er angivet i.
export function nutritionBasisUnit(unit: ProductDisplayUnit): "g" | "ml" {
  return unit === "g" ? "g" : "ml";
}
