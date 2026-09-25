import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { isValidGtin } from "@/lib/uncertainties";

// Admin "Uncertainties" (docs/DECISIONS.md 2026-09-24): gemmer adminens
// rettelse fra redigerings-lightboxen. Værdierne skrives til produktet, og
// analysen markeres som rettet (correction + correctedAt), så den forsvinder
// fra listen. Rettelsen gemmes også som fremtidig træningsdata, samme
// princip som AiProductAnalysis.correction i øvrigt.

function text(values: Record<string, unknown>, key: string): string | null {
  const value = values[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function number(values: Record<string, unknown>, key: string): number | null | "invalid" {
  const raw = text(values, key);
  if (raw === null) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : "invalid";
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const values = body?.values && typeof body.values === "object" ? (body.values as Record<string, unknown>) : null;
  if (!values) return NextResponse.json({ message: "values er påkrævet" }, { status: 400 });

  const analysis = await prisma.aiProductAnalysis.findUnique({
    where: { id },
    include: { product: { select: { id: true, productType: true, subbrand: true, variant: true } } },
  });
  if (!analysis?.product) return NextResponse.json({ message: "Analysen findes ikke" }, { status: 404 });
  if (analysis.correctedAt) return NextResponse.json({ message: "Allerede rettet" }, { status: 409 });
  const product = analysis.product;

  try {
    await prisma.$transaction(async (tx) => {
      if (analysis.kind === "FRONT") {
        const productName = text(values, "productName");
        const subbrand = text(values, "subbrand");
        const variant = text(values, "variant");
        const data: Prisma.ProductUpdateInput = {
          subbrand,
          variant,
          packageSizeText: text(values, "packageSizeText"),
        };
        if (productName) {
          // Manuelt oprettede produkter sammensætter navnet af
          // produktserie + produkttype + variant (DECISIONS 2026-09-23).
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
        const core = ["kcalPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g"] as const;
        if (core.some((f) => parsed[f] === null)) throw new Error("MISSING_CORE");
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
          sugarSource: parsed.sugarsPer100g === null ? null : ("MANUAL" as const),
          fiberPer100g: parsed.fiberPer100g as number | null,
          fiberSource: parsed.fiberPer100g === null ? null : ("MANUAL" as const),
          saltPer100g: parsed.saltPer100g as number | null,
          saltSource: parsed.saltPer100g === null ? null : ("MANUAL" as const),
        };
        await tx.productNutritionFeatures.upsert({
          where: { productId: product.id },
          create: { productId: product.id, ...features },
          update: features,
        });
      } else if (analysis.kind === "INGREDIENTS") {
        await tx.product.update({
          where: { id: product.id },
          data: { ingredientsText: text(values, "ingredientsText") },
        });
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

      await tx.aiProductAnalysis.update({
        where: { id },
        data: { correction: values as Prisma.InputJsonValue, correctedAt: new Date() },
      });
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      INVALID_NUMBER: "Et af tallene er ugyldigt.",
      MISSING_CORE: "Energi, protein, kulhydrat og fedt skal udfyldes.",
      INVALID_GTIN: "EAN-koden har et forkert kontrolciffer.",
      BARCODE_TAKEN: "EAN-koden hører allerede til et andet produkt.",
    };
    if (messages[code]) return NextResponse.json({ message: messages[code] }, { status: 400 });
    console.error("Uncertainty correction failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
