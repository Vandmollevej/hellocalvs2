import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { saveDataUrlImage } from "@/lib/qc-image-storage";

// Kvalitetskontrol/billed-match (docs/DECISIONS.md 2026-09-19): stregkode-
// fotoet fra det guidede kamera-flow (/camera/create) blev tidligere kun
// brugt til den lokale ZXing-afkodning og aldrig gemt. Denne route har intet
// AI-kald — den gemmer blot fotoet, så den lokale billedanalyse-agent kan
// sammenligne det mod produktets forsidefoto (Product.imageUrl) og beregne
// en match-confidence. Samme "productId udfyldes ved produktoprettelse"
// mønster som FRONT/INGREDIENTS/NUTRITION (POST /api/products).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  const barcode = typeof body?.barcode === "string" ? body.barcode.replace(/\D/g, "") : "";
  const marketRegion = typeof body?.marketRegion === "string" ? body.marketRegion : "DK";

  if (!photo.startsWith("data:image/")) {
    return NextResponse.json({ message: "photo er påkrævet" }, { status: 400 });
  }
  if (!barcode) {
    return NextResponse.json({ message: "barcode er påkrævet" }, { status: 400 });
  }

  const imageUrl = await saveDataUrlImage(photo).catch(() => null);
  if (!imageUrl) {
    return NextResponse.json({ analysisId: null, message: "Kunne ikke gemme billedet" }, { status: 503 });
  }

  const context = buildBarcodeContext(barcode, marketRegion);
  const analysis = await prisma.aiProductAnalysis.create({
    data: {
      kind: "BARCODE",
      barcode,
      marketRegion: context.marketRegion,
      gs1Regions: context.gs1Regions,
      languages: context.primaryOcrLanguages,
      model: "none",
      promptVersion: "qc-barcode-photo-1",
      prediction: { barcode },
      imageUrl,
    },
    select: { id: true },
  });

  return NextResponse.json({ analysisId: analysis.id });
}
