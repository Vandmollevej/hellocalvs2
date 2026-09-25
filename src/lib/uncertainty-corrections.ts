import type { AiAnalysisKind, Prisma } from "@prisma/client";
import { isValidGtin } from "@/lib/uncertainties";

// Skriver rettede/nyligt aflæste værdier fra en AI-analyse til produktet
// (admin "Uncertainties", docs/DECISIONS.md 2026-09-24/25). Bruges af både
// adminens rettelse (PATCH /api/admin/uncertainties/[id]) og den natlige
// AI-genkørsel (src/lib/uncertainty-rerun.ts). Kaster en Error med en af
// koderne i CORRECTION_ERRORS ved ugyldige værdier.

export const CORRECTION_ERRORS: Record<string, string> = {
  INVALID_NUMBER: "Et af tallene er ugyldigt.",
  MISSING_CORE: "Energi, protein, kulhydrat og fedt skal udfyldes.",
  INVALID_GTIN: "EAN-koden har et forkert kontrolciffer.",
  BARCODE_TAKEN: "EAN-koden hører allerede til et andet produkt.",
};

type Tx = Prisma.TransactionClient;
type Values = Record<string, unknown>;

function text(values: Values, key: string): string | null {
  const value = values[key];
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function number(values: Values, key: string): number | null | "invalid" {
  const raw = text(values, key);
  if (raw === null) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : "invalid";
}

export async function applyAnalysisValues(
  tx: Tx,
  analysis: { kind: AiAnalysisKind; barcode: string | null },
  product: { id: string; productType: string | null },
  values: Values,
) {
  if (analysis.kind === "FRONT") {
    const productName = text(values, "productName");
    const subbrand = text(values, "subbrand");
    const variant = text(values, "variant");
    const data: Prisma.ProductUpdateInput = { subbrand, variant, packageSizeText: text(values, "packageSizeText") };
    if (productName) {
      // Manuelt oprettede produkter sammensætter navnet af produktserie +
      // produkttype + variant (DECISIONS 2026-09-23).
      if (product.productType) {
        data.productType = productName;
        data.name = [subbrand, productName, variant].filter(Boolean).join(" ");
      } else {
        data.name = productName;
      }
    }
    await tx.product.update({ where: { id: product.id }, data });
  } else if (analysis.kind === "NUTRITION") {
    const fields = [
      "kcalPer100g",
      "proteinPer100g",
      "carbsPer100g",
      "fatPer100g",
      "saturatedFatPer100g",
      "sugarsPer100g",
      "fiberPer100g",
      "saltPer100g",
    ] as const;
    const parsed = Object.fromEntries(fields.map((f) => [f, number(values, f)]));
    if (Object.values(parsed).includes("invalid")) throw new Error("INVALID_NUMBER");
    if (["kcalPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g"].some((f) => parsed[f] === null)) {
      throw new Error("MISSING_CORE");
    }
    await tx.product.update({
      where: { id: product.id },
      data: {
        kcalPer100g: parsed.kcalPer100g as number,
        proteinPer100g: parsed.proteinPer100g as number,
        carbsPer100g: parsed.carbsPer100g as number,
        fatPer100g: parsed.fatPer100g as number,
        saturatedFatPer100g: parsed.saturatedFatPer100g as number | null,
      },
    });
    const features = {
      sugarsPer100g: parsed.sugarsPer100g as number | null,
      sugarSource: parsed.sugarsPer100g === null ? null : ("NUTRITION_LABEL" as const),
      fiberPer100g: parsed.fiberPer100g as number | null,
      fiberSource: parsed.fiberPer100g === null ? null : ("NUTRITION_LABEL" as const),
      saltPer100g: parsed.saltPer100g as number | null,
      saltSource: parsed.saltPer100g === null ? null : ("NUTRITION_LABEL" as const),
    };
    await tx.productNutritionFeatures.upsert({
      where: { productId: product.id },
      create: { productId: product.id, ...features },
      update: features,
    });
  } else if (analysis.kind === "INGREDIENTS") {
    await tx.product.update({ where: { id: product.id }, data: { ingredientsText: text(values, "ingredientsText") } });
  } else if (analysis.kind === "BARCODE") {
    const barcode = (text(values, "barcode") ?? "").replace(/\D/g, "");
    if (!isValidGtin(barcode)) throw new Error("INVALID_GTIN");
    const existing = await tx.barcode.findUnique({ where: { code: barcode } });
    if (existing && existing.productId !== product.id) throw new Error("BARCODE_TAKEN");
    if (!existing) await tx.barcode.create({ data: { code: barcode, productId: product.id } });
    // Den fejllæste kode fjernes, hvis den hørte til netop dette produkt.
    if (analysis.barcode && analysis.barcode !== barcode) {
      await tx.barcode.deleteMany({ where: { code: analysis.barcode, productId: product.id } });
    }
  }
}
