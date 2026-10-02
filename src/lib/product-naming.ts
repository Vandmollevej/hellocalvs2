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

// Ingen gentagelser mellem varesidens titel (h1, sort) og den grønne linje
// (h2: pakningsstørrelse · variant) — brugerens regel 2026-10-02. Fedtprocent,
// "laktosefri", smag osv. hører til varianten, så de fjernes fra navnet,
// når de også står i varianten eller pakningsstørrelsen. Tegn som %, kommaer
// og mellemrum sammenlignes løst ("1,5 % Fett" = "1,5% fett").
function looseKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s,.;:·/()-]+/g, "")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Fjerner hver sætningsdel fra h2 (og dens enkeltled adskilt af komma/·) fra
// navnet. Bliver navnet tomt, beholdes det oprindelige, så en vare aldrig
// står uden titel.
export function stripHeadingRepeats(name: string, parts: (string | null | undefined)[]): string {
  let title = name;
  const pieces = parts
    // Komma deler led — men ikke decimalkommaet i "1,5 %".
    .flatMap((part) => (part ?? "").split(/\s*(?:·|(?<!\d),|,(?!\d))\s*/))
    .map((piece) => piece.trim())
    .filter((piece) => piece.length >= 2)
    .sort((a, b) => b.length - a.length);
  for (const piece of pieces) {
    // Mellemrum/kommaer i stykket må variere i navnet ("1,5 %" vs "1,5%").
    const pattern = piece
      .split(/\s+/)
      .map(escapeRegExp)
      .join("\\s*")
      .replace(/\\%/g, "\\s*%");
    const regex = new RegExp(`(^|[\\s,(·/-])${pattern}(?=$|[\\s,)·/.-])`, "giu");
    title = title.replace(regex, "$1");
  }
  title = title
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[,·]\s*(?=[,·]|$)/g, "")
    .replace(/^[\s,.·\-–]+|[\s,·\-–]+$/g, "")
    .trim();
  if (!title || looseKey(title).length < 2) return name.trim();
  return title;
}

// h1/h2 til varesiden: h1 = navnet uden det, h2 allerede siger; h2 =
// pakningsstørrelse · variant (variant udelades, hvis den blot gentager
// pakningsstørrelsen).
export function splitProductHeadings(input: {
  name: string;
  packageSizeText?: string | null;
  variant?: string | null;
}): { title: string; subtitle: string | null } {
  const size = input.packageSizeText?.trim() || null;
  let variant = input.variant?.trim() || null;
  if (variant && size && looseKey(variant) === looseKey(size)) variant = null;
  const title = stripHeadingRepeats(input.name, [size, variant]);
  const subtitle = [size, variant].filter(Boolean).join(" · ") || null;
  return { title, subtitle };
}
