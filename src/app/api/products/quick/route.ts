import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { inferGs1OriginCountryCode } from "@/lib/regions";
import { saveDataUrlImage } from "@/lib/qc-image-storage";
import { enrichQuickProduct, type PendingField } from "@/lib/quick-product-enrichment";

// POST /api/products/quick — "opret straks" fra kameraflowet under Tilføj
// (docs/DECISIONS.md 2026-09-27). Varen oprettes, så snart den lokale OCR er
// kørt, med det kameraet allerede har (stregkode, fotos, evt. lokalt aflæst
// næring/ingredienser), og id'et returneres med det samme, så brugeren kan
// tilføje den. Navn, brand, næring og ingredienser læses bagefter af OpenAI
// (after()), og /add/[id] viser en grøn load-cirkel i dem imens.
// Oprettes som PENDING som alle brugerindsendte varer (docs/ADMIN.md).

function isPhoto(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

function cleanNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const barcode = typeof body?.barcode === "string" ? body.barcode.replace(/\D/g, "") : "";
  const marketRegion = typeof body?.marketRegion === "string" ? body.marketRegion : "DK";
  const frontPhoto = body?.frontPhoto;
  const nutritionPhoto = body?.nutritionPhoto;
  const ingredientsPhoto = isPhoto(body?.ingredientsPhoto) ? body.ingredientsPhoto : undefined;
  const nutritionOcrText = typeof body?.nutritionOcrText === "string" ? body.nutritionOcrText.slice(0, 8000) : "";
  const ingredientsOcrText = typeof body?.ingredientsOcrText === "string" ? body.ingredientsOcrText.slice(0, 8000) : "";
  const localIngredients = typeof body?.localIngredientsText === "string" ? body.localIngredientsText.trim() : "";
  const barcodeAnalysisId = typeof body?.barcodeAnalysisId === "string" ? body.barcodeAnalysisId : null;
  // Sprogsignaler og OCR-sikkerhed (brugerens valg 2026-09-27). Signalerne
  // valideres i buildBarcodeContext; sikkerheden afgør, om telefonens egen
  // aflæsning kan bruges uden OpenAI (src/lib/local-label.ts).
  const signals = body?.signals;
  const nutritionOcrConfidence = cleanNumber(body?.nutritionOcrConfidence) ?? 0;
  const ingredientsOcrConfidence = cleanNumber(body?.ingredientsOcrConfidence) ?? 0;
  const local = body?.localNutrition ?? null;
  const localNutrition =
    local &&
    cleanNumber(local.kcalPer100g) !== null &&
    cleanNumber(local.proteinPer100g) !== null &&
    cleanNumber(local.carbsPer100g) !== null &&
    cleanNumber(local.fatPer100g) !== null
      ? {
          kcalPer100g: local.kcalPer100g as number,
          proteinPer100g: local.proteinPer100g as number,
          carbsPer100g: local.carbsPer100g as number,
          fatPer100g: local.fatPer100g as number,
        }
      : null;

  if (!barcode || !isPhoto(frontPhoto) || !isPhoto(nutritionPhoto)) {
    return NextResponse.json({ message: "Stregkode, forside og energi er påkrævet" }, { status: 400 });
  }

  try {
    // Samme stregkode kan være oprettet imens (fx af en anden bruger) — så
    // går brugeren bare til den eksisterende vare.
    const existing = await prisma.barcode.findUnique({ where: { code: barcode }, select: { productId: true } });
    if (existing?.productId) return NextResponse.json({ product: { id: existing.productId } });

    const sessionUser = await getSessionUser();
    const imageUrl = (await saveDataUrlImage(frontPhoto).catch(() => null)) ?? undefined;
    const fallbackName = `Vare ${barcode}`;
    const pendingFields: PendingField[] = ["name", "brand", "nutrition", "ingredients"];

    const product = await prisma.product.create({
      data: {
        name: fallbackName,
        kcalPer100g: localNutrition?.kcalPer100g ?? 0,
        proteinPer100g: localNutrition?.proteinPer100g ?? 0,
        carbsPer100g: localNutrition?.carbsPer100g ?? 0,
        fatPer100g: localNutrition?.fatPer100g ?? 0,
        ingredientsText: localIngredients || undefined,
        imageUrl,
        pendingFields,
        originCountryCode: inferGs1OriginCountryCode(barcode),
        createdByUserId: sessionUser?.id,
        barcodes: { create: { code: barcode } },
      },
      select: { id: true },
    });

    // Stregkode-fotoet (POST /api/ai/save-barcode-photo) kobles til varen,
    // så kvalitetskontrol-agenten kan finde det.
    if (barcodeAnalysisId) {
      await prisma.aiProductAnalysis
        .updateMany({ where: { id: barcodeAnalysisId, kind: "BARCODE" }, data: { productId: product.id } })
        .catch(() => {});
    }

    after(() =>
      enrichQuickProduct({
        productId: product.id,
        barcode,
        marketRegion,
        signals,
        frontPhoto,
        nutritionPhoto,
        ingredientsPhoto,
        nutritionOcrText,
        nutritionOcrConfidence,
        ingredientsOcrText,
        ingredientsOcrConfidence,
        fallbackName,
      }).catch((error) => console.error("Quick product enrichment failed", product.id, error)),
    );

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Quick product creation failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
