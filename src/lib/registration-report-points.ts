// Points a user can flag on the registration "Indberet fejl" screen
// (src/app/registration/[id]/report-error/page.tsx). Each point maps to the
// existing BugReportCategory where one fits, so admin triage keeps working.

import type { BugReportPhotos, BugReportSectionKey, BugReportSections } from "@/lib/bug-report-sections";

export type ReportPointKey = "image" | "name" | "brand" | "ean" | "energy" | "macros" | "ingredients";

export type ReportPoint = {
  key: ReportPointKey;
  labelKey: string;
  value: string;
  imageUrl?: string | null;
  category?: "EAN" | "ENERGY" | "CONTENT" | "PRODUCT_IMAGE";
  /** Direct camera button under the point (user rule 2026-10-17). */
  capture?: ReportCapture;
};

// Produktbillede → nyt foto, EAN → scan stregkoden, Energi → foto af
// næringsdeklarationen (brugerens regel 2026-10-17).
export type ReportCapture = "photo" | "barcode" | "nutrition";

// Each point is filed under the product report section it belongs to
// (src/lib/bug-report-sections.ts), so photos land where admin looks.
const POINT_SECTION: Record<ReportPointKey, BugReportSectionKey> = {
  image: "IMAGE",
  name: "TITLE",
  brand: "TITLE",
  ean: "OTHER",
  energy: "ENERGY",
  macros: "ENERGY",
  ingredients: "INGREDIENTS",
};

type ProductLike = {
  name: string;
  brand?: { name: string } | null;
  imageUrl?: string | null;
  barcodes?: { code: string }[];
  kcalPer100g: number;
  proteinPer100g?: number | null;
  carbsPer100g?: number | null;
  fatPer100g?: number | null;
  ingredientsText?: string | null;
};

const round = (n: number | null | undefined) => (n == null ? "–" : String(Math.round(n * 10) / 10));

export function reportPointsFor(product: ProductLike): ReportPoint[] {
  const points: ReportPoint[] = [
    { key: "image", labelKey: "registrationReportError.point.image", value: "", imageUrl: product.imageUrl, category: "PRODUCT_IMAGE", capture: "photo" },
    { key: "name", labelKey: "registrationReportError.point.name", value: product.name },
    { key: "brand", labelKey: "registrationReportError.point.brand", value: product.brand?.name ?? "" },
  ];
  if (product.barcodes?.length) {
    points.push({
      key: "ean",
      labelKey: "registrationReportError.point.ean",
      value: product.barcodes.map((b) => b.code).join(", "),
      category: "EAN",
      capture: "barcode",
    });
  }
  points.push(
    { key: "energy", labelKey: "registrationReportError.point.energy", value: `${Math.round(product.kcalPer100g)} kcal / 100 g`, category: "ENERGY", capture: "nutrition" },
    {
      key: "macros",
      labelKey: "registrationReportError.point.macros",
      value: `P ${round(product.proteinPer100g)} g · K ${round(product.carbsPer100g)} g · F ${round(product.fatPer100g)} g`,
      category: "ENERGY",
    },
    { key: "ingredients", labelKey: "registrationReportError.point.ingredients", value: product.ingredientsText ?? "", category: "CONTENT" },
  );
  return points;
}

export type ReportEntry = { key: ReportPointKey; label: string; note: string; photo?: string | null };

/**
 * Sections and photos for POST /api/bug-reports. A point with only a photo is
 * still sent: the server fills in "Se vedhæftet foto".
 */
export function buildReportSections(entries: ReportEntry[]): { sections: BugReportSections; sectionPhotos: BugReportPhotos } {
  const sections: BugReportSections = {};
  const sectionPhotos: BugReportPhotos = {};
  for (const entry of entries) {
    const section = POINT_SECTION[entry.key];
    const note = entry.note.trim();
    if (note) sections[section] = [sections[section], `${entry.label}: ${note}`].filter(Boolean).join("\n");
    if (entry.photo) sectionPhotos[section] = entry.photo;
  }
  return { sections, sectionPhotos };
}
