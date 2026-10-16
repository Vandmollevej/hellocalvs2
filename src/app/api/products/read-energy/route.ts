import { NextResponse } from "next/server";
import { analyzeNutritionPhoto } from "@/lib/product-photo-analysis";
import { energyReadOk, isAiQuotaError } from "@/lib/energy-read";
import { debugLog, errorText, flowIdFromRequest } from "@/lib/debug-log";

// POST /api/products/read-energy — energi-trinnet i kameraflowet (web +
// native, brugerens krav 2026-10-16): kunne telefonen ikke selv læse
// næringstabellen, læser AI'en fotoet, MENS brugeren står på trinnet. Kun et
// komplet svar (pr. 100 g/ml, eller en alkoholisk drik over 1,2 % vol) klarer
// trinnet; ellers tages billedet om. Aflæsningen (analysisId) sendes med
// oprettelsen, så den ikke læses igen.

export async function POST(req: Request) {
  const flowId = flowIdFromRequest(req);
  const startedAt = Date.now();
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  const barcode = typeof body?.barcode === "string" ? body.barcode.replace(/\D/g, "") : "";
  const marketRegion = typeof body?.marketRegion === "string" ? body.marketRegion : "DK";
  const ocrText = typeof body?.ocrText === "string" ? body.ocrText.slice(0, 8000) : "";
  if (!photo.startsWith("data:image/") || !barcode) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  try {
    const { analysisId, result } = await analyzeNutritionPhoto({ photo, barcode, marketRegion, ocrText, signals: body?.signals });
    const ok = energyReadOk(result);
    void debugLog({
      category: "scan",
      event: "energy_read",
      level: ok ? "info" : "warn",
      message: ok
        ? `Energi læst af AI under flowet: ${result.kcalPer100g ?? "–"} kcal/100${result.alcoholPercent ? ` · ${result.alcoholPercent} % vol` : ""}`
        : "Energi: AI kunne ikke læse en komplet næringstabel — brugeren tager billedet om",
      flowId,
      barcode,
      durationMs: Date.now() - startedAt,
      data: { analysisId, basis: result.basis, kcal: result.kcalPer100g, alcoholPercent: result.alcoholPercent ?? null },
    });
    return NextResponse.json(ok ? { ok: true, analysisId } : { ok: false, reason: "unreadable" });
  } catch (error) {
    const message = errorText(error);
    const quota = isAiQuotaError(message);
    void debugLog({
      category: "scan",
      event: "energy_read",
      level: "error",
      message: quota
        ? "Energi kunne ikke læses: OpenAI-kontoen har ingen kredit tilbage"
        : `Energi kunne ikke læses: ${message.slice(0, 300)}`,
      flowId,
      barcode,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ ok: false, reason: quota ? "ai_unavailable" : "error" }, { status: 503 });
  }
}
