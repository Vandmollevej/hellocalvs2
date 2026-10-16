import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { submitProductRecheck } from "@/lib/product-recheck";
import { debugLog, errorText, flowIdFromRequest } from "@/lib/debug-log";

// POST /api/products/[id]/quality-check — 2-års kvalitetstjek
// (docs/DECISIONS.md 2026-10-15). Kameraets fotos af en vare, der har ligget i
// databasen i over to år, gemmes kun; det natlige job "product-recheck"
// sammenligner og læser dem. Kunden går videre til varen med dens tidligere
// info, uanset svaret.

function isPhoto(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

function cleanNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" ? value.slice(0, 8000) : undefined;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const flowId = flowIdFromRequest(req);
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!isPhoto(body?.frontPhoto)) return NextResponse.json({ message: "Forsiden er påkrævet" }, { status: 400 });

  try {
    const recheckId = await submitProductRecheck({
      productId: id,
      userId: user.id,
      marketRegion: typeof body?.marketRegion === "string" ? body.marketRegion : "DK",
      signals: body?.signals,
      frontPhoto: body.frontPhoto,
      nutritionPhoto: isPhoto(body?.nutritionPhoto) ? body.nutritionPhoto : undefined,
      ingredientsPhoto: isPhoto(body?.ingredientsPhoto) ? body.ingredientsPhoto : undefined,
      nutritionOcrText: cleanText(body?.nutritionOcrText),
      nutritionOcrConfidence: cleanNumber(body?.nutritionOcrConfidence),
      ingredientsOcrText: cleanText(body?.ingredientsOcrText),
      ingredientsOcrConfidence: cleanNumber(body?.ingredientsOcrConfidence),
    });
    void debugLog({
      category: "scan",
      event: "product_recheck_submitted",
      level: recheckId ? "info" : "warn",
      message: recheckId
        ? "2-års tjek: fotos gemt — vurderes i nat"
        : "2-års tjek: fotos ikke gemt (varen tjekkes allerede, eller forsiden kunne ikke gemmes)",
      flowId,
      userId: user.id,
      productId: id,
    });
    return NextResponse.json({ ok: Boolean(recheckId) }, { status: recheckId ? 202 : 200 });
  } catch (error) {
    console.error("Product recheck failed", id, error);
    void debugLog({ category: "scan", event: "product_recheck_submitted", level: "error", message: `2-års tjek fejlede: ${errorText(error)}`, flowId, productId: id });
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
