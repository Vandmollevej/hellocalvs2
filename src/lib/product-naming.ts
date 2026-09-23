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
  return [parts.subbrand, parts.productType, parts.variant]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

// "500" + "g" → "500 g"; accepts Danish decimal comma ("1,5" → "1.5 L").
export function formatPackageSize(amount: string, unit: PackageSizeUnit) {
  const value = parseFloat(amount.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return `${value} ${unit}`;
}
