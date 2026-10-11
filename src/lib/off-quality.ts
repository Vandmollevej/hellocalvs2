// Open Food Facts-kontrol (docs/DECISIONS.md 2026-10-11): ren vurdering af,
// hvor godt en Open Food Facts-vare lever op til Hello Cals kvalitetskrav.
// Ingen imports og ingen database, så reglerne kan testes med `npm test`
// (src/lib/off-quality.test.mjs). Robotten og admin-siden ligger i
// src/lib/off-quality-job.ts og src/app/admin/scan-invites/off-kvalitet.
//
// Hver regel giver et fund med kategori, vægt (point der trækkes fra 100) og
// en kommentar på dansk, der forklarer HVORFOR varen ikke er god nok. Kun
// kategorier med fund vises som mangler.

export const OFF_QUALITY_CATEGORIES = [
  "IMAGE",
  "NAME",
  "BRAND",
  "NUTRITION",
  "INGREDIENTS",
  "PACKAGE",
  "CLASSIFICATION",
  "BARCODE",
  "TRANSLATION",
] as const;
export type OffQualityCategory = (typeof OFF_QUALITY_CATEGORIES)[number];

export const OFF_QUALITY_CATEGORY_LABELS: Record<OffQualityCategory, string> = {
  IMAGE: "Billede",
  NAME: "Varenavn",
  BRAND: "Mærke",
  NUTRITION: "Næringsværdier",
  INGREDIENTS: "Ingredienser og allergener",
  PACKAGE: "Mængde og pakning",
  CLASSIFICATION: "Varetype og kategori",
  BARCODE: "Stregkode",
  TRANSLATION: "Oversættelse",
};

export const OFF_QUALITY_RATINGS = ["POOR", "WEAK", "OK", "GOOD"] as const;
export type OffQualityRating = (typeof OFF_QUALITY_RATINGS)[number];

export const OFF_QUALITY_RATING_LABELS: Record<OffQualityRating, string> = {
  POOR: "Dårlig",
  WEAK: "Svag",
  OK: "Acceptabel",
  GOOD: "God",
};

// Pointtal → vurdering. Under 90 er varen "ikke god nok" og kommer på listen.
export function ratingForScore(score: number): OffQualityRating {
  if (score < 50) return "POOR";
  if (score < 75) return "WEAK";
  if (score < 90) return "OK";
  return "GOOD";
}

export type OffQualityFinding = {
  category: OffQualityCategory;
  code: string;
  // Point der trækkes fra 100.
  severity: number;
  comment: string;
};

export type OffQualityAssessment = {
  score: number;
  rating: OffQualityRating;
  categories: OffQualityCategory[];
  findings: OffQualityFinding[];
};

export type OffQualityInput = {
  name: string;
  brandName: string | null;
  imageUrl: string | null;
  // Fritlagt PNG fra billedrobotten (src/lib/product-rescan-offer.ts: hasProperCutout).
  hasCutout: boolean;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  saturatedFatPer100g: number | null;
  sugarPer100g: number | null;
  saltPer100g: number | null;
  ingredientsText: string | null;
  allergens: string[];
  packageSizeText: string | null;
  productType: string | null;
  productCategory: string | null;
  barcodes: string[];
  nameOriginal: string | null;
  translationSourceLang: string | null;
  translationStatus: string | null;
};

const ALLERGEN_HINTS: { key: string; label: string; pattern: RegExp }[] = [
  { key: "gluten", label: "gluten", pattern: /(?<![\p{L}])(hvede\p{L}*|wheat\p{L}*|rug\p{L}*|rye|byg\p{L}*|barley|havre\p{L}*|oat\p{L}*|spelt\p{L}*|gluten\p{L}*)/iu },
  { key: "milk", label: "mælk", pattern: /(?<![\p{L}])(mælk\p{L}*|milk\p{L}*|laktose\p{L}*|lactose\p{L}*|fløde\p{L}*|cream|smør\p{L}*|butter|valle\p{L}*|whey)/iu },
  { key: "eggs", label: "æg", pattern: /(?<![\p{L}])(æg|ægge\p{L}*|egg\p{L}*)(?![\p{L}])/iu },
  { key: "soybeans", label: "soja", pattern: /(?<![\p{L}])(soja\p{L}*|soy\p{L}*)/iu },
  { key: "peanuts", label: "jordnødder", pattern: /(?<![\p{L}])(jordnød\p{L}*|peanut\p{L}*)/iu },
  { key: "nuts", label: "nødder", pattern: /(?<![\p{L}])(mandel\p{L}*|mandler|almond\p{L}*|hasselnød\p{L}*|hazelnut\p{L}*|valnød\p{L}*|walnut\p{L}*|cashew\p{L}*|pistacie\p{L}*|pistachio\p{L}*|pecan\p{L}*|paranød\p{L}*)/iu },
  { key: "fish", label: "fisk", pattern: /(?<![\p{L}])(fisk\p{L}*|fish|torsk\p{L}*|laks\p{L}*|salmon|tunfisk|tuna)(?![\p{L}])/iu },
  { key: "celery", label: "selleri", pattern: /(?<![\p{L}])(selleri\p{L}*|celery)/iu },
  { key: "mustard", label: "sennep", pattern: /(?<![\p{L}])(sennep\p{L}*|mustard)/iu },
  { key: "sesame-seeds", label: "sesam", pattern: /(?<![\p{L}])(sesam\p{L}*|sesame)/iu },
  { key: "sulphur-dioxide-and-sulphites", label: "sulfit", pattern: /(?<![\p{L}])(sulfit\p{L}*|sulphite\p{L}*|sulfite\p{L}*|svovldioxid\p{L}*)/iu },
  { key: "lupin", label: "lupin", pattern: /(?<![\p{L}])lupin\p{L}*/iu },
  { key: "crustaceans", label: "skaldyr", pattern: /(?<![\p{L}])(rejer|shrimp\p{L}*|krabbe\p{L}*|crab|hummer|lobster)/iu },
  { key: "molluscs", label: "bløddyr", pattern: /(?<![\p{L}])(musling\p{L}*|mussel\p{L}*|blæksprutte\p{L}*|østers|oyster\p{L}*)/iu },
];

function finding(category: OffQualityCategory, code: string, severity: number, comment: string): OffQualityFinding {
  return { category, code, severity, comment };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => String(round1(n)).replace(".", ",");

// GTIN-8/12/13/14: kontrolcifferet er (10 − vægtet sum mod 10) mod 10, vægt 3/1 fra højre.
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop() as number;
  let sum = 0;
  digits.reverse().forEach((digit, index) => {
    sum += digit * (index % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

function nameFindings(input: OffQualityInput): OffQualityFinding[] {
  const out: OffQualityFinding[] = [];
  const name = input.name.trim();
  if (!name || /^(ukendt vare|unknown|unknown product|produkt)$/i.test(name)) {
    out.push(finding("NAME", "NAME_UNKNOWN", 30, `Varen hedder "${name || "(tomt)"}" — Open Food Facts havde intet brugbart navn.`));
    return out;
  }
  if (name.length < 3) out.push(finding("NAME", "NAME_SHORT", 15, `Navnet "${name}" er kun ${name.length} tegn.`));
  const letters = name.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 4 && name === name.toUpperCase()) {
    out.push(finding("NAME", "NAME_UPPERCASE", 8, `Navnet er skrevet med store bogstaver ("${name}").`));
  }
  if (input.brandName) {
    const firstBrand = input.brandName.split(",")[0].trim().toLowerCase();
    if (firstBrand.length >= 2 && name.toLowerCase().startsWith(firstBrand)) {
      out.push(finding("NAME", "NAME_STARTS_WITH_BRAND", 5, `Navnet starter med mærket "${firstBrand}", som skal stå i mærkefeltet, ikke i navnet.`));
    }
  }
  const quantity = name.match(/(?<![\p{L}\d])\d+(?:[.,]\d+)?\s?(?:kg|g|gr|ml|cl|l|stk|pk)(?![\p{L}])/iu);
  if (quantity) {
    out.push(finding("NAME", "NAME_HAS_QUANTITY", 4, `Navnet indeholder mængden "${quantity[0]}", som hører til pakningsfeltet.`));
  }
  if (/[�]|&(?:amp|quot|#\d+);|<\/?[a-z]/i.test(name)) {
    out.push(finding("NAME", "NAME_GARBLED", 10, `Navnet indeholder ulæselige tegn eller HTML ("${name.slice(0, 40)}").`));
  }
  if (name.length > 90) {
    out.push(finding("NAME", "NAME_LONG", 5, `Navnet er meget langt (${name.length} tegn) og ligner en beskrivelse, ikke et varenavn.`));
  }
  return out;
}

function brandFindings(input: OffQualityInput): OffQualityFinding[] {
  const brand = input.brandName?.trim() ?? "";
  if (!brand || /^(unknown|ukendt|ukendt mærke|-|n\/a)$/i.test(brand)) {
    return [finding("BRAND", "BRAND_MISSING", 12, "Intet mærke registreret.")];
  }
  if (brand.includes(",")) {
    return [finding("BRAND", "BRAND_MULTIPLE", 4, `Flere mærker i ét felt ("${brand}") — der skal kun stå ét.`)];
  }
  return [];
}

function nutritionFindings(input: OffQualityInput): OffQualityFinding[] {
  const out: OffQualityFinding[] = [];
  const { kcalPer100g: kcal, proteinPer100g: protein, carbsPer100g: carbs, fatPer100g: fat } = input;
  const macros = protein + carbs + fat;
  if (kcal === 0 && macros === 0) {
    out.push(finding("NUTRITION", "NUTRITION_EMPTY", 30, "Ingen næringsværdier: kalorier, protein, kulhydrat og fedt er alle 0."));
  } else {
    if (kcal === 0) {
      out.push(finding("NUTRITION", "KCAL_MISSING", 12, "Kalorier mangler (0 kcal), men protein/kulhydrat/fedt er udfyldt."));
    }
    if (macros > 100.5) {
      out.push(finding("NUTRITION", "MACROS_OVER_100", 20, `Protein + kulhydrat + fedt er ${fmt(macros)} g pr. 100 g — det kan ikke lade sig gøre.`));
    }
    if (kcal > 900) {
      out.push(finding("NUTRITION", "KCAL_IMPOSSIBLE", 20, `${fmt(kcal)} kcal pr. 100 g er over det mulige (ren fedt er ca. 900).`));
    }
    const expected = protein * 4 + carbs * 4 + fat * 9;
    if (kcal > 0 && expected > 0 && Math.abs(kcal - expected) > 40 && Math.abs(kcal - expected) / Math.max(kcal, expected) > 0.35) {
      out.push(finding("NUTRITION", "KCAL_MISMATCH", 15, `Kalorierne (${fmt(kcal)} kcal) passer ikke til makroerne (de giver ca. ${fmt(expected)} kcal).`));
    }
  }
  if (input.saturatedFatPer100g !== null && input.saturatedFatPer100g > fat + 0.5) {
    out.push(finding("NUTRITION", "SATFAT_OVER_FAT", 8, `Mættet fedt (${fmt(input.saturatedFatPer100g)} g) er mere end samlet fedt (${fmt(fat)} g).`));
  }
  if (input.sugarPer100g !== null && input.sugarPer100g > carbs + 0.5) {
    out.push(finding("NUTRITION", "SUGAR_OVER_CARBS", 8, `Sukker (${fmt(input.sugarPer100g)} g) er mere end kulhydrat (${fmt(carbs)} g).`));
  }
  if (input.saltPer100g === null) out.push(finding("NUTRITION", "SALT_MISSING", 6, "Salt mangler."));
  if (input.sugarPer100g === null) out.push(finding("NUTRITION", "SUGAR_MISSING", 4, "Sukker mangler."));
  return out;
}

function ingredientFindings(input: OffQualityInput): OffQualityFinding[] {
  const out: OffQualityFinding[] = [];
  const text = input.ingredientsText?.trim() ?? "";
  if (!text) {
    out.push(finding("INGREDIENTS", "INGREDIENTS_MISSING", 20, "Ingen ingrediensliste."));
    return out;
  }
  if (text.length < 15) {
    out.push(finding("INGREDIENTS", "INGREDIENTS_SHORT", 10, `Ingredienslisten er kun ${text.length} tegn ("${text}") og er sandsynligvis ufuldstændig.`));
  }
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  if (text.includes("�") || letters / text.length < 0.5) {
    out.push(finding("INGREDIENTS", "INGREDIENTS_GARBLED", 10, "Ingredienslisten indeholder mange ulæselige tegn eller tal."));
  }
  if (input.allergens.length === 0) {
    const hits = ALLERGEN_HINTS.filter((hint) => hint.pattern.test(text)).map((hint) => hint.label);
    if (hits.length) {
      out.push(
        finding(
          "INGREDIENTS",
          "ALLERGENS_MISSING",
          8,
          `Ingredienserne nævner ${hits.slice(0, 3).join(", ")}, men allergenlisten er tom.`,
        ),
      );
    }
  }
  return out;
}

function packageFindings(input: OffQualityInput): OffQualityFinding[] {
  const text = input.packageSizeText?.trim() ?? "";
  if (!text) return [finding("PACKAGE", "PACKAGE_MISSING", 8, "Ingen pakningsstørrelse (mængde i g eller ml).")];
  if (!/\d/.test(text)) {
    return [finding("PACKAGE", "PACKAGE_NO_NUMBER", 5, `Pakningsstørrelsen "${text}" indeholder intet tal.`)];
  }
  return [];
}

function classificationFindings(input: OffQualityInput): OffQualityFinding[] {
  const out: OffQualityFinding[] = [];
  if (!input.productType?.trim()) {
    out.push(finding("CLASSIFICATION", "TYPE_MISSING", 6, 'Ingen varetype (fx "Skyr" eller "Rugbrød") — varen kan ikke grupperes eller findes på type.'));
  }
  if (!input.productCategory) {
    out.push(finding("CLASSIFICATION", "CATEGORY_MISSING", 4, "Ingen produktkategori (drikkevare, generisk, forarbejdet …) — mængdeenheden gættes som gram."));
  }
  return out;
}

function barcodeFindings(input: OffQualityInput): OffQualityFinding[] {
  if (input.barcodes.length === 0) return [finding("BARCODE", "BARCODE_MISSING", 25, "Ingen stregkode på varen.")];
  const invalid = input.barcodes.filter((code) => !isValidGtin(code));
  if (invalid.length === input.barcodes.length) {
    return [finding("BARCODE", "BARCODE_INVALID", 10, `Stregkoden ${invalid[0]} har forkert længde eller kontrolciffer.`)];
  }
  return [];
}

function imageFindings(input: OffQualityInput): OffQualityFinding[] {
  if (!input.imageUrl) return [finding("IMAGE", "IMAGE_MISSING", 25, "Ingen forsidebillede.")];
  if (!input.hasCutout) {
    return [finding("IMAGE", "IMAGE_NOT_CUTOUT", 8, "Billedet er Open Food Facts' eget foto og er ikke fritlagt i Hello Cals ens stil.")];
  }
  return [];
}

function translationFindings(input: OffQualityInput): OffQualityFinding[] {
  if (input.translationStatus !== "PENDING") return [];
  const from = input.translationSourceLang ? ` fra ${input.translationSourceLang}` : "";
  const original = input.nameOriginal ? ` (original: "${input.nameOriginal.slice(0, 60)}")` : "";
  return [finding("TRANSLATION", "TRANSLATION_PENDING", 10, `Navn og ingredienser er maskinoversat${from} og endnu ikke godkendt${original}.`)];
}

export function assessOffProduct(input: OffQualityInput): OffQualityAssessment {
  const findings = [
    ...imageFindings(input),
    ...nameFindings(input),
    ...brandFindings(input),
    ...nutritionFindings(input),
    ...ingredientFindings(input),
    ...packageFindings(input),
    ...classificationFindings(input),
    ...barcodeFindings(input),
    ...translationFindings(input),
  ];
  const penalty = findings.reduce((sum, f) => sum + f.severity, 0);
  const score = Math.max(0, 100 - penalty);
  const categories = OFF_QUALITY_CATEGORIES.filter((category) => findings.some((f) => f.category === category));
  return { score, rating: ratingForScore(score), categories, findings };
}
