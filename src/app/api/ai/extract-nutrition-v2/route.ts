import { NextResponse } from "next/server";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { analyzeNutritionPhoto } from "@/lib/product-photo-analysis";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  const barcode = typeof body?.barcode === "string" ? body.barcode.replace(/\D/g, "") : "";
  const marketRegion = typeof body?.marketRegion === "string" ? body.marketRegion : "DK";
  const ocrText = typeof body?.ocrText === "string" ? body.ocrText.trim() : "";

  if (!photo.startsWith("data:image/") && !photo.startsWith("https://")) {
    return NextResponse.json({ message: "photo er påkrævet" }, { status: 400 });
  }
  if (!barcode) {
    return NextResponse.json({ message: "barcode er påkrævet før næringsanalyse" }, { status: 400 });
  }

  const context = buildBarcodeContext(barcode, marketRegion);

  try {
    const { analysisId, result } = await analyzeNutritionPhoto({ photo, barcode, marketRegion, ocrText });
    return NextResponse.json({ analysisId, context, result });
  } catch (error) {
    console.error("Nutrition photo extraction failed", error);
    return NextResponse.json(
      { analysisId: null, result: null, context, message: "Kunne ikke læse næringsindholdet" },
      { status: 503 },
    );
  }
}
