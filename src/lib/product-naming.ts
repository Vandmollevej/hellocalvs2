// Manual product creation (docs/DECISIONS.md 2026-09-23): the product name is
// never typed directly — it is composed from Sub brand + Produkttype + Variant.
// Brand lives in its own relation and the total quantity in packageSizeText,
// so neither is repeated in the name.

export const PACKAGE_SIZE_UNITS = ["g", "kg", "ml", "cl", "L", "stk"] as const;
export type PackageSizeUnit = (typeof PACKAGE_SIZE_UNITS)[number];

export function composeProductName(parts: {
  subbrand?: string;
  productType: string;
  variant?: string;
}) {
  return [parts.subbrand, normalizeProductType(parts.productType), parts.variant]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

// En emballeret vare med produkttypen "Vand" er flaskevand; "Vand" alene er
// også app'ens vandregistrering, så søgeresultatet skal skelne (punkt 7).
// Kun præcis "Vand" omdøbes — "Kildevand", "Danskvand" osv. står urørt.
export function normalizeProductType(productType: string) {
  return productType.trim().toLowerCase() === "vand" ? "Flaskevand" : productType;
}

// Samme regel på et færdigt navn: "Vand" / "Vand Uden brus" → "Flaskevand …".
export function normalizeProductName(name: string) {
  return name.replace(/^vand(?=\s|$)/i, "Flaskevand");
}

// "500" + "g" → "500 g"; accepts Danish decimal comma ("1,5" → "1.5 L").
export function formatPackageSize(amount: string, unit: PackageSizeUnit) {
  const value = parseFloat(amount.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return `${value} ${unit}`;
}

// ---------------------------------------------------------------------------
// Varesidens H1/H2 (docs/DECISIONS.md 2026-10-02): smagsvarianten må kun stå
// i H2. Product.name indeholder ofte varianten (navnet sammensættes af
// produkttype + variant, og importer/AI giver fx "Marmelade Pære & havtorn"),
// så den fjernes fra titlen før visning. Det gemte navn røres ikke — det
// bruges stadig i søgning og lister uden H2.

// Ord, der binder ord sammen; "og"/"and"/"+" sidestilles med "&", så
// "Pære og havtorn" matcher varianten "Pære & havtorn".
const AMPERSAND_WORDS = new Set(["&", "og", "and", "+"]);
// Bindeord, der bliver hængende, når varianten fjernes ("Skyr med jordbær").
const DANGLING_WORDS = new Set(["&", "og", "and", "+", "med", "with", "m", "i", "in", "smag", "flavour", "flavor"]);

type Token = { norm: string; start: number; end: number };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.normalize("NFC").matchAll(/[\p{L}\p{N}%]+(?:[.,][\p{N}]+)*|[&+]/gu)) {
    const raw = match[0].toLocaleLowerCase("da");
    tokens.push({
      norm: AMPERSAND_WORDS.has(raw) ? "&" : raw,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

// Fjerner hver forekomst af `phrase` (som hele ord) fra `text`.
export function removeVariantPhrase(text: string, phrase: string): string {
  const needle = tokenize(phrase);
  // En "variant" af lutter bindeord ("&") ville fjerne alle bindeord i navnet.
  if (!needle.some((token) => token.norm !== "&")) return text.normalize("NFC");
  let result = text.normalize("NFC");
  for (;;) {
    const hay = tokenize(result);
    let found = -1;
    for (let i = 0; i + needle.length <= hay.length; i++) {
      if (needle.every((token, j) => hay[i + j].norm === token.norm)) {
        found = i;
        break;
      }
    }
    if (found < 0) return result;
    const start = hay[found].start;
    const end = hay[found + needle.length - 1].end;
    result = `${result.slice(0, start)} ${result.slice(end)}`;
  }
}

function tidyTitle(text: string) {
  let title = text
    .replace(/\(\s*\)/g, " ")
    // "Yoghurt - - 1 kg" → "Yoghurt - 1 kg"
    .replace(/(\s[-–—·/|])(?:\s+[-–—·/|,])+(?=\s)/g, "$1")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Fjern løse skilletegn og bindeord i enderne ("Marmelade -", "Skyr med").
  for (;;) {
    const before = title;
    title = title.replace(/^[\s,.;:·\-–—/|]+|[\s,;:·\-–—/|]+$/g, "");
    const tokens = tokenize(title);
    const last = tokens.at(-1);
    if (last && tokens.length > 1 && DANGLING_WORDS.has(last.norm) && last.end === title.length) {
      title = title.slice(0, last.start);
    }
    const first = tokens[0];
    if (first && tokens.length > 1 && DANGLING_WORDS.has(first.norm) && first.start === 0 && first.norm === "&") {
      title = title.slice(first.end);
    }
    if (title === before) break;
  }
  return title.trim();
}

function containsPhrase(outer: string, inner: string) {
  return removeVariantPhrase(outer, inner) !== outer.normalize("NFC");
}

function samePhrase(a: string, b: string) {
  const ta = tokenize(a).map((token) => token.norm).join(" ");
  const tb = tokenize(b).map((token) => token.norm).join(" ");
  return ta.length > 0 && ta === tb;
}

function capitalize(text: string) {
  return text ? text.charAt(0).toLocaleUpperCase("da") + text.slice(1) : text;
}

export type ProductHeading = {
  // H1: varenavnet uden smagsvariant.
  title: string;
  // H2: smagsvarianter (variant og evt. særskilt smag), uden dubletter.
  variants: string[];
};

// Deler et varenavn i H1 (titel) og H2 (smagsvariant). Garanti: ingen af de
// returnerede `variants` forekommer som hele ord i `title`.
export function splitProductHeading(product: {
  name: string;
  variant?: string | null;
  flavor?: string | null;
  productType?: string | null;
}): ProductHeading {
  const variants: string[] = [];
  for (const candidate of [product.variant, product.flavor]) {
    const value = candidate?.trim();
    if (!value || !tokenize(value).some((token) => token.norm !== "&")) continue;
    // "Pære" er overflødig ved siden af "Pære & havtorn" — den længste vinder.
    if (variants.some((existing) => containsPhrase(existing, value))) continue;
    const covered = variants.findIndex((existing) => containsPhrase(value, existing));
    if (covered >= 0) variants[covered] = value;
    else variants.push(value);
  }

  let title = product.name;
  for (const variant of variants) title = removeVariantPhrase(title, variant);
  title = tidyTitle(title);

  if (!title) {
    // Navnet var kun smagen ("Pære & havtorn"): brug produkttypen som titel,
    // hvis den ikke selv er smagen. Ellers bliver navnet stående i H1, og
    // smagen udelades af H2, så den aldrig står to gange.
    const productType = product.productType?.trim();
    if (productType && !variants.some((variant) => samePhrase(variant, productType))) {
      let typeTitle = productType;
      for (const variant of variants) typeTitle = removeVariantPhrase(typeTitle, variant);
      typeTitle = tidyTitle(typeTitle);
      if (typeTitle) return { title: capitalize(normalizeProductType(typeTitle)), variants };
    }
    return { title: product.name.trim(), variants: [] };
  }
  return { title: capitalize(title), variants };
}
