import { NextResponse } from "next/server";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { analyzeFrontPhoto } from "@/lib/product-photo-analysis";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  const barcode = typeof body?.barcode === "string" ? body.barcode.replace(/\D/g, "") : "";
  const marketRegion = typeof body?.marketRegion === "string" ? body.marketRegion : "DK";

  if (!photo.startsWith("data:image/") && !photo.startsWith("https://")) {
    return NextResponse.json({ message: "photo er påkrævet" }, { status: 400 });
  }
  if (!barcode) {
    return NextResponse.json({ message: "barcode er påkrævet før forsideanalyse" }, { status: 400 });
  }

  const signals = body?.signals;
  const context = buildBarcodeContext(barcode, marketRegion, signals);

  try {
    const { analysisId, result, brandMatch } = await analyzeFrontPhoto({ photo, barcode, marketRegion, signals });
    return NextResponse.json({ analysisId, context, result, brandMatch });
  } catch (error) {
    console.error("Product front analysis failed", error);
    return NextResponse.json(
      { analysisId: null, result: null, brandMatch: null, context, message: "Kunne ikke analysere produktforsiden" },
      { status: 503 },
    );
  }
}
