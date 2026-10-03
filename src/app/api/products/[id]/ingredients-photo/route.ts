import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { analyzeIngredientsPhoto } from "@/lib/product-photo-analysis";
import { syncProductNutritionFeaturesSafely } from "@/lib/product-nutrition-features";
import { debugLog, errorText, flowIdFromRequest } from "@/lib/debug-log";

// POST /api/products/[id]/ingredients-photo — nyt foto af ingredienslisten,
// når AI ikke kunne læse det første (docs/DECISIONS.md 2026-10-02). Kun den,
// der oprettede varen, og kun mens varen stadig mangler ingredienser.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const startedAt = Date.now();
  const flowId = flowIdFromRequest(req);
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  if (!photo.startsWith("data:image/")) {
    return NextResponse.json({ message: "photo er påkrævet" }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, ingredientsText: true, createdByUserId: true, barcodes: { select: { code: true }, take: 1 } },
  });
  if (!product || product.createdByUserId !== user.id) {
    return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  }
  if (product.ingredientsText?.trim()) {
    return NextResponse.json({ ingredientsFound: true });
  }

  // Region og sprogsignaler følger den første aflæsning af varen.
  const previous = await prisma.aiProductAnalysis.findFirst({
    where: { productId: id },
    orderBy: { createdAt: "desc" },
    select: { barcode: true, marketRegion: true },
  });
  const barcode = product.barcodes[0]?.code ?? previous?.barcode ?? "";
  const marketRegion = previous?.marketRegion ?? "DK";
  const context = { flowId, userId: user.id, barcode: barcode || null, productId: id };

  try {
    const { analysisId, result } = await analyzeIngredientsPhoto({ photo, barcode, marketRegion });
    await prisma.aiProductAnalysis.update({ where: { id: analysisId }, data: { productId: id } });
    const ingredientsText = result.ingredientsText?.trim() ?? "";
    if (ingredientsText) {
      await prisma.product.update({ where: { id }, data: { ingredientsText } });
      await syncProductNutritionFeaturesSafely(id);
    }
    void debugLog({
      category: "scan",
      event: "ingredients_retake",
      level: ingredientsText ? "info" : "warn",
      message: ingredientsText
        ? `Nyt indholdsfoto læst af AI: ${ingredientsText.length} tegn`
        : "Nyt indholdsfoto: AI kunne stadig ikke læse ingredienslisten",
      ...context,
      durationMs: Date.now() - startedAt,
      data: { confidence: result.confidence, ingredientsText: ingredientsText.slice(0, 500) },
    });
    return NextResponse.json({ ingredientsFound: Boolean(ingredientsText) });
  } catch (error) {
    console.error("Ingredients retake failed", id, error);
    void debugLog({
      category: "scan",
      event: "ingredients_retake",
      level: "error",
      message: `Nyt indholdsfoto fejlede: ${errorText(error)}`,
      ...context,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ message: "Kunne ikke læse ingredienslisten" }, { status: 503 });
  }
}
