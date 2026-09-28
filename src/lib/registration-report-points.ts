// Points a user can flag on the registration "Indberet fejl" screen
// (src/app/registration/[id]/report-error/page.tsx). Each point maps to the
// existing BugReportCategory where one fits, so admin triage keeps working.

export type ReportPointKey = "image" | "name" | "brand" | "ean" | "energy" | "macros" | "ingredients";

export type ReportPoint = {
  key: ReportPointKey;
  labelKey: string;
  value: string;
  imageUrl?: string | null;
  category?: "EAN" | "ENERGY" | "CONTENT" | "PRODUCT_IMAGE";
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
    { key: "image", labelKey: "registrationReportError.point.image", value: "", imageUrl: product.imageUrl, category: "PRODUCT_IMAGE" },
    { key: "name", labelKey: "registrationReportError.point.name", value: product.name },
    { key: "brand", labelKey: "registrationReportError.point.brand", value: product.brand?.name ?? "" },
  ];
  if (product.barcodes?.length) {
    points.push({
      key: "ean",
      labelKey: "registrationReportError.point.ean",
      value: product.barcodes.map((b) => b.code).join(", "),
      category: "EAN",
    });
  }
  points.push(
    { key: "energy", labelKey: "registrationReportError.point.energy", value: `${Math.round(product.kcalPer100g)} kcal / 100 g`, category: "ENERGY" },
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

export function buildReportDescription(items: { label: string; note: string }[]): string {
  return items.map((i) => `${i.label}: ${i.note.trim()}`).join("\n");
}
