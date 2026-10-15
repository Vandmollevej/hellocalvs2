import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { saveDataUrlImage } from "@/lib/qc-image-storage";
import { debugLog, flowIdFromRequest } from "@/lib/debug-log";

const STEPS = new Set(["front", "nutrition", "ingredients"]);

// Skjult helbillede af hele varen (docs/DECISIONS.md 2026-10-15): kamera-flowet
// beskærer forside/energi/indhold, men tager i skjul også et billede uden
// beskæring, så det natlige mærkat-job kan finde mærker og certifikater på
// alle sider. Intet AI-kald her — fotoet gemmes blot som en PACKAGE-analyse,
// der kobles til varen ved oprettelsen (som stregkode-fotoet).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  const step = typeof body?.step === "string" && STEPS.has(body.step) ? body.step : null;
  const barcode = typeof body?.barcode === "string" ? body.barcode.replace(/\D/g, "") : "";
  const marketRegion = typeof body?.marketRegion === "string" ? body.marketRegion : "DK";

  if (!photo.startsWith("data:image/") || !step) {
    return NextResponse.json({ message: "photo og step er påkrævet" }, { status: 400 });
  }

  const startedAt = Date.now();
  const flowId = flowIdFromRequest(req);
  const imageUrl = await saveDataUrlImage(photo).catch(() => null);
  if (!imageUrl) {
    void debugLog({ category: "scan", event: "package_photo_saved", level: "error", message: `Helbilledet (${step}) kunne ikke gemmes`, flowId, barcode: barcode || null, durationMs: Date.now() - startedAt });
    return NextResponse.json({ analysisId: null, message: "Kunne ikke gemme billedet" }, { status: 503 });
  }

  const context = buildBarcodeContext(barcode, marketRegion, body?.signals);
  const analysis = await prisma.aiProductAnalysis.create({
    data: {
      kind: "PACKAGE",
      barcode: barcode || null,
      marketRegion: context.marketRegion,
      gs1Regions: barcode ? context.gs1Regions : [],
      languages: context.primaryOcrLanguages,
      model: "none",
      promptVersion: "package-photo-1",
      prediction: { step },
      imageUrl,
    },
    select: { id: true },
  });
  void debugLog({
    category: "scan",
    event: "package_photo_saved",
    message: `Helbillede af varen gemt (${step}) til mærkat-jobbet`,
    flowId,
    barcode: barcode || null,
    durationMs: Date.now() - startedAt,
    data: { imageUrl, analysisId: analysis.id, step },
  });

  return NextResponse.json({ analysisId: analysis.id });
}
