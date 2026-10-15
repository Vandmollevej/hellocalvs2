// "Vis original" på varesiden (docs/DECISIONS.md 2026-10-15): en oversat
// vare kommer fra GET /api/products/[id] med den viste tekst i felterne og
// den anden version (original eller oversættelse) i translation.alternate.
// Byt dem om, uden at hente varen igen. Rene funktioner — bruges af både
// API'et og varesiden (native: ProductTextSwap.kt).

export type ProductTexts = Record<string, string | null>;

export type ProductTranslationInfo = {
  // Hvad felterne viser lige nu.
  showing: "translated" | "original";
  sourceLanguageName: string | null;
  targetLanguageName: string;
  // Den anden version af de samme felter (brand = brandets navn).
  alternate: ProductTexts;
  // Hvor linjen "Oversat til …" står: over titlen, eller over ingredienslisten,
  // når kun ingredienserne er oversat (titel, variant, mængde … er ens).
  placement: TranslationPlacement;
};

export type TranslationPlacement = "title" | "ingredients";

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (value: string | null | undefined) => (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return norm(a) === norm(b);
}

// Hvor oversættelsen skal nævnes — null, når den ikke ændrer noget (så vises
// ingen linje). Kun ingredienserne ændret = "ingredients".
export function translationPlacement(original: ProductTexts, translated: ProductTexts): TranslationPlacement | null {
  const changed = Object.keys(translated).filter((key) => !sameText(original[key], translated[key]));
  if (!changed.length) return null;
  return changed.every((key) => key === "ingredientsText") ? "ingredients" : "title";
}

type WithTexts = { brand?: { name: string } | null } & Record<string, unknown>;

// Felterne fra texts lagt ind i varen; "brand" er brandets navn.
export function applyProductTexts<T extends WithTexts>(product: T, texts: ProductTexts): T {
  const next: Record<string, unknown> = { ...product };
  for (const [key, value] of Object.entries(texts)) {
    if (key === "brand") {
      if (product.brand && value) next.brand = { ...product.brand, name: value };
    } else {
      next[key] = value;
    }
  }
  return next as T;
}

// Varens nuværende værdier for de samme nøgler som texts.
export function productTextsFor(product: WithTexts, keys: string[]): ProductTexts {
  const out: ProductTexts = {};
  for (const key of keys) {
    const value = key === "brand" ? product.brand?.name : product[key];
    out[key] = typeof value === "string" ? value : null;
  }
  return out;
}

// Viser den anden version: felterne og alternate bytter plads.
export function swapProductTexts<T extends WithTexts>(
  product: T,
  translation: ProductTranslationInfo,
): { product: T; translation: ProductTranslationInfo } {
  const current = productTextsFor(product, Object.keys(translation.alternate));
  return {
    product: applyProductTexts(product, translation.alternate),
    translation: {
      ...translation,
      showing: translation.showing === "translated" ? "original" : "translated",
      alternate: current,
    },
  };
}
