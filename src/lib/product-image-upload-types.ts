import type { LogoStep } from "@/lib/brand-logo-upload-types";

// Fælles typer og rene hjælpefunktioner for admin → Varedatabase →
// Billed-upload (docs/DECISIONS.md 2026-10-04). Ingen server- eller DOM-adgang,
// så både serveren (API + side) og browseren (upload + historik) kan bruge filen.

export type ImageStep = LogoStep;

// Billeder over disse grænser nedskaleres i browseren, før de sendes.
export const PRODUCT_IMAGE_MAX_SIDE = 2000;
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

// Rolle ud fra suffikset i filnavnet (brugerens regel 2026-09-17): `_raw` = utilberedt
// vare (vises ved opskrifter, tag "Raw"), `_pl` = flere stk. (pluralis, vises ved
// store mængder, tag "Multiple"), intet suffiks = hovedbilledet.
export type ImageRole = "MAIN" | "RAW" | "PLURAL";
export type ImageKeyKind = "EAN" | "TYPE";

export const ROLE_LABEL: Record<ImageRole, string> = {
  MAIN: "Hovedbillede",
  RAW: "Utilberedt (_raw)",
  PLURAL: "Flere stk. (_pl)",
};

export type ParsedImageName =
  | { ok: true; key: string; keyKind: ImageKeyKind; role: ImageRole }
  | { ok: false; reason: string };

const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i;
const EAN_LENGTHS = [8, 12, 13, 14];

export const NAME_RULE_TEXT =
  "Filnavnet skal være et EAN (8, 12, 13 eller 14 cifre) eller en produkttype, evt. efterfulgt af _raw (utilberedt) eller _pl (flere stk.) — fx 5701234567890.png, Banan.png, Banan_raw.png, Banan_pl.png.";

// Kun disse navne må lægges op: EAN eller produkttype, evt. med _raw / _pl til sidst.
export function parseProductImageName(fileName: string): ParsedImageName {
  const base = (fileName.split(/[\\/]/).pop() ?? fileName).replace(IMAGE_EXTENSION, "").trim();
  const match = /^(.*?)(?:_(raw|pl))?$/i.exec(base);
  const stem = (match?.[1] ?? base).trim();
  const suffix = match?.[2]?.toLowerCase();
  const role: ImageRole = suffix === "raw" ? "RAW" : suffix === "pl" ? "PLURAL" : "MAIN";

  if (!stem) return { ok: false, reason: "Filnavnet mangler EAN eller produkttype" };
  if (/^\d+$/.test(stem)) {
    if (EAN_LENGTHS.includes(stem.length)) return { ok: true, key: stem, keyKind: "EAN", role };
    return { ok: false, reason: `«${stem}» er ikke et EAN-nummer (skal være 8, 12, 13 eller 14 cifre)` };
  }
  if (stem.includes("_")) {
    return { ok: false, reason: `«${base}» følger ikke reglen: kun _raw eller _pl må stå til sidst, ingen andre understreger (fx _2)` };
  }
  if (!/\p{L}/u.test(stem)) return { ok: false, reason: `«${stem}» er hverken et EAN eller en produkttype` };
  return { ok: true, key: stem.replace(/\s+/g, " "), keyKind: "TYPE", role };
}

export function isImageFileName(fileName: string) {
  return IMAGE_EXTENSION.test(fileName);
}

// Det browseren sender sammen med billedet.
export type ProductImageClientMeta = {
  fileName: string;
  originalWidth: number | null;
  originalHeight: number | null;
  originalBytes: number;
  originalType: string;
  hasAlpha: boolean;
  steps: ImageStep[];
  // Sat, når browseren ikke kunne behandle filen (så der ingen fil følger med).
  failed?: string;
};

export type ProductImageStatus = "APPLIED" | "CONFLICT" | "IGNORED" | "REJECTED" | "FAILED";

// Den vare (eller generiske ingrediens), billedet gælder for.
export type ProductImageTarget = {
  kind: "product" | "generic";
  id: string;
  name: string;
  // Billedet, der allerede sidder på pladsen (kun sat, hvis der er et).
  existingUrl: string | null;
  // Billedet, dette upload erstattede (sat, når der er valgt Erstat).
  replacedUrl?: string | null;
};

export type ProductImageUploadItem = {
  id: string;
  batchId: string;
  fileName: string;
  key: string | null;
  keyKind: ImageKeyKind | null;
  role: ImageRole | null;
  status: ProductImageStatus;
  imageUrl: string | null;
  hasAlpha: boolean;
  originalWidth: number | null;
  originalHeight: number | null;
  originalBytes: number | null;
  originalType: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  targets: ProductImageTarget[];
  steps: ImageStep[];
  message: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type ProductImageUploadBatch = {
  id: string;
  createdAt: string;
  items: ProductImageUploadItem[];
};

export function targetsLabel(targets: ProductImageTarget[]) {
  if (targets.length === 0) return null;
  const names = targets.slice(0, 3).map((target) => target.name);
  return targets.length > 3 ? `${names.join(", ")} og ${targets.length - 3} flere` : names.join(", ");
}
