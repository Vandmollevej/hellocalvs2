import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  analyzeFrontPhoto,
  analyzeIngredientsPhoto,
  analyzeNutritionPhoto,
} from "@/lib/product-photo-analysis";
import { recordNutrientSources } from "@/lib/product-nutrient-sources";
import { syncProductNutritionFeaturesSafely } from "@/lib/product-nutrition-features";
import {
  PRODUCT_UPDATE_POINTS,
  awardUpdatePointsOnce,
  isFreshCameraPhoto,
  productGaps,
  updateKindsFor,
  type ProductUpdateKind,
} from "@/lib/product-update";
import { debugLog, errorText, flowIdFromRequest } from "@/lib/debug-log";

// POST /api/products/[id]/update — brugeren udfylder en manglende ting på en
// eksisterende vare med et foto (forside → billede + logo, energi, indhold).
// Fotoet læses af AI; kun det, der mangler, udfyldes — eksisterende data
// overskrives aldrig. Giver 20 points én gang pr. bruger og vare, også til
// admin (brugerbeslutning 2026-10-03, så det kan testes).
const KINDS: ProductUpdateKind[] = ["FRONT", "NUTRITION", "INGREDIENTS"];
const MIN_FRONT_CONFIDENCE = 0.5;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const startedAt = Date.now();
  const flowId = flowIdFromRequest(req);
  const body = await req.json().catch(() => null);
  const kind = body?.kind as ProductUpdateKind;
  const photo = typeof body?.photo === "string" ? body.photo : "";
  if (!KINDS.includes(kind) || !photo.startsWith("data:image/")) {
    return NextResponse.json({ message: "kind og photo er påkrævet" }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      brandId: true,
      imageUrl: true,
      pendingImageUrl: true,
      ingredientsText: true,
      nutritionMissing: true,
      pendingFields: true,
      privateOwnerId: true,
      brand: { select: { logoUrl: true } },
      barcodes: { select: { code: true }, take: 1 },
    },
  });
  if (!product || product.privateOwnerId) {
    return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  }

  const gaps = productGaps(product);
  if (!updateKindsFor(gaps).includes(kind)) {
    // Det, fotoet skulle udfylde, mangler ikke (mere).
    return NextResponse.json({ accepted: false, reason: "not-missing" });
  }

  const previous = await prisma.aiProductAnalysis.findFirst({
    where: { productId: id },
    orderBy: { createdAt: "desc" },
    select: { barcode: true, marketRegion: true },
  });
  const base = {
    photo,
    barcode: product.barcodes[0]?.code ?? previous?.barcode ?? "",
    marketRegion: previous?.marketRegion ?? "DK",
  };
  const photoSource = isFreshCameraPhoto(body?.photoTakenAt) ? "CAMERA" : "UPLOAD";
  const context = { flowId, userId: user.id, barcode: base.barcode || null, productId: id };

  try {
    let accepted = false;

    if (kind === "FRONT") {
      const { analysisId, result, brandMatch } = await analyzeFrontPhoto(base);
      await prisma.aiProductAnalysis.update({ where: { id: analysisId }, data: { productId: id, photoSource } });
      accepted = result.overallConfidence >= MIN_FRONT_CONFIDENCE;
      if (accepted && !product.brandId) {
        const brandName = (brandMatch?.name ?? result.brand ?? result.logoText ?? "").trim();
        if (brandName) {
          const brand = await prisma.brand.upsert({ where: { name: brandName }, update: {}, create: { name: brandName } });
          await prisma.product.update({ where: { id }, data: { brandId: brand.id } });
        }
      }
    } else if (kind === "NUTRITION") {
      const { analysisId, result } = await analyzeNutritionPhoto(base);
      await prisma.aiProductAnalysis.update({ where: { id: analysisId }, data: { productId: id, photoSource } });
      const complete =
        result.kcalPer100g != null &&
        result.proteinPer100g != null &&
        result.carbsPer100g != null &&
        result.fatPer100g != null;
      if (complete) {
        await prisma.product.update({
          where: { id },
          data: {
            kcalPer100g: result.kcalPer100g!,
            proteinPer100g: result.proteinPer100g!,
            carbsPer100g: result.carbsPer100g!,
            fatPer100g: result.fatPer100g!,
            nutritionMissing: false,
          },
        });
        await recordNutrientSources(id, analysisId).catch(() => {});
        await syncProductNutritionFeaturesSafely(id);
        accepted = true;
      }
    } else {
      const { analysisId, result } = await analyzeIngredientsPhoto(base);
      await prisma.aiProductAnalysis.update({ where: { id: analysisId }, data: { productId: id, photoSource } });
      const ingredientsText = result.ingredientsText?.trim() ?? "";
      if (ingredientsText) {
        await prisma.product.update({ where: { id }, data: { ingredientsText } });
        await syncProductNutritionFeaturesSafely(id);
        accepted = true;
      }
    }

    const pointsAwarded =
      accepted && photoSource === "CAMERA"
        ? await awardUpdatePointsOnce(user.id, id)
        : false;
    void debugLog({
      category: "scan",
      event: "product_update",
      level: accepted ? "info" : "warn",
      message: `Opdater vare (${kind}): ${accepted ? "udfyldt" : "kunne ikke læses"}${pointsAwarded ? ` · ${PRODUCT_UPDATE_POINTS} points givet` : ""}`,
      ...context,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ accepted, pointsAwarded: pointsAwarded ? PRODUCT_UPDATE_POINTS : 0 });
  } catch (error) {
    console.error("Product update failed", id, error);
    void debugLog({
      category: "scan",
      event: "product_update",
      level: "error",
      message: `Opdater vare (${kind}) fejlede: ${errorText(error)}`,
      ...context,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ message: "Kunne ikke læse fotoet" }, { status: 503 });
  }
}
