// Fælles typer og rene hjælpefunktioner for admin → Varedatabase → Logo-upload
// (docs/DECISIONS.md 2026-10-04). Ingen server- eller DOM-adgang, så både
// serveren (API + side) og browseren (upload + historik) kan bruge filen.

export type LogoStepStatus = "ok" | "skipped" | "warn" | "error";

// Ét trin i en fils proces. `ms` er tiden trinnet tog, `detail` en kort
// forklaring (mål, størrelser, hvilket brand der blev fundet osv.).
export type LogoStep = {
  key: string;
  label: string;
  status: LogoStepStatus;
  ms?: number;
  detail?: string;
};

// Længste side på det gemte logo (samme grænse som logo-robottens import,
// scripts/logo-agent/import_logos.py). Logoer vises som små kort/ikoner, så
// 640 px giver skarpt billede på 3x-skærme uden at fylde. Små billeder forstørres aldrig.
export const LOGO_MAX_SIDE = 640;
export const LOGO_MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

// Det browseren sender sammen med den behandlede PNG.
export type LogoClientMeta = {
  fileName: string;
  originalWidth: number | null;
  originalHeight: number | null;
  originalBytes: number;
  originalType: string;
  steps: LogoStep[];
  // Sat, når browseren ikke kunne behandle filen (så der ingen PNG følger med).
  failed?: string;
};

export type LogoUploadStatus = "DONE" | "UNMATCHED" | "FAILED";

export type LogoUploadItem = {
  id: string;
  batchId: string;
  fileName: string;
  suggestedName: string;
  status: LogoUploadStatus;
  brandId: string | null;
  brandName: string | null;
  imageUrl: string | null;
  applied: boolean;
  // Er dette billede brandets logo lige nu?
  inUse: boolean;
  hadPreviousLogo: boolean;
  originalWidth: number | null;
  originalHeight: number | null;
  originalBytes: number | null;
  originalType: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  steps: LogoStep[];
  message: string | null;
  createdAt: string;
};

export type LogoUploadBatch = {
  id: string;
  createdAt: string;
  items: LogoUploadItem[];
};

export type BrandSearchHit = { id: string; name: string; logoUrl: string | null };

const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i;

export function hasImageExtension(fileName: string) {
  return IMAGE_EXTENSION.test(fileName);
}

// "Choco Bella_2.png" → { baseName: "Choco Bella", variant: 2 }. Kun `_2` og
// ` (2)` regnes for en ekstra udgave; et tal midt i navnet er en del af brandet.
export function parseLogoFileName(fileName: string): { baseName: string; variant: number | null } {
  const withoutPath = fileName.split(/[\\/]/).pop() ?? fileName;
  const withoutExtension = withoutPath.replace(IMAGE_EXTENSION, "");
  const match = /^(.*?)(?:_(\d{1,2})|\s*\((\d{1,2})\))$/.exec(withoutExtension);
  const raw = match ? match[1] : withoutExtension;
  const variant = match ? Number.parseInt(match[2] ?? match[3], 10) : null;
  const baseName = raw.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return { baseName: baseName || withoutExtension.trim(), variant };
}

const bytesFormat = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });

export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return "–";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${bytesFormat.format(bytes / 1024)} KB`;
  return `${bytesFormat.format(bytes / (1024 * 1024))} MB`;
}

export function formatDimensions(width: number | null | undefined, height: number | null | undefined) {
  return width && height ? `${width} × ${height} px` : "–";
}

const timestampFormat = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function formatTimestamp(value: string | Date) {
  return timestampFormat.format(typeof value === "string" ? new Date(value) : value);
}

const clockFormat = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function formatClock(value: string) {
  return clockFormat.format(new Date(value));
}
