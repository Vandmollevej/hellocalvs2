import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { rescanStepsFor } from "@/lib/product-rescan-offer";
import { enrichRescan } from "@/lib/product-rescan";
import type { PendingField } from "@/lib/quick-product-enrichment";
import { debugLog, errorText, flowIdFromRequest, withDebugContext } from "@/lib/debug-log";

// POST /api/products/[id]/rescan — "Scan varen igen" fra banneret på
// /add/[id] (docs/DECISIONS.md 2026-10-02). Kameraets fotos (som ved "opret
// straks") læses bagefter i baggrunden; første genscanning giver 10 points.
// Kun første gang: findes der allerede en genscanning, svares 409.

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
  if (!user) return NextResponse.json({ message: "Log ind for at optjene points" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const frontPhoto = body?.frontPhoto;
  const nutritionPhoto = isPhoto(body?.nutritionPhoto) ? body.nutritionPhoto : undefined;
  const ingredientsPhoto = isPhoto(body?.ingredientsPhoto) ? body.ingredientsPhoto : undefined;
  const marketRegion = typeof body?.marketRegion === "string" ? body.marketRegion : "DK";

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        externalSource: true,
        imageUrl: true,
        rescannedAt: true,
        privateOwnerId: true,
        images: { select: { url: true, tags: true } },
        barcodes: { select: { code: true } },
      },
    });
    if (!product) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });

    const steps = rescanStepsFor(product);
    if (!steps.length) {
      return NextResponse.json({ message: "Varen er allerede scannet igen" }, { status: 409 });
    }
    if (!isPhoto(frontPhoto) || (steps.includes("nutrition") && !nutritionPhoto)) {
      return NextResponse.json({ message: "Forside og energi er påkrævet" }, { status: 400 });
    }

    // Felterne der læses igen vises med skelet på /add/[id] imens.
    const pendingFields: PendingField[] = steps.includes("nutrition") ? ["name", "brand", "nutrition", "ingredients"] : [];
    // Atomisk "første gang": to samtidige genscanninger kan ikke begge vinde.
    const claimed = await prisma.product.updateMany({
      where: { id, rescannedAt: null },
      data: { rescannedAt: new Date(), rescannedByUserId: user.id, ...(pendingFields.length ? { pendingFields } : {}) },
    });
    if (claimed.count !== 1) {
      return NextResponse.json({ message: "Varen er allerede scannet igen" }, { status: 409 });
    }

    const barcode = product.barcodes[0].code;
    const debugContext = { flowId, userId: user.id, barcode, productId: id };
    void debugLog({
      category: "scan",
      event: "rescan_submitted",
      message: `Genscanning modtaget (${steps.join(", ")}) — AI læser fotos i baggrunden`,
      ...debugContext,
    });

    after(() =>
      withDebugContext(debugContext, () =>
        enrichRescan({
          productId: id,
          userId: user.id,
          steps,
          barcode,
          marketRegion,
          signals: body?.signals,
          frontPhoto,
          nutritionPhoto,
          ingredientsPhoto,
          nutritionOcrText: cleanText(body?.nutritionOcrText),
          nutritionOcrConfidence: cleanNumber(body?.nutritionOcrConfidence),
          ingredientsOcrText: cleanText(body?.ingredientsOcrText),
          ingredientsOcrConfidence: cleanNumber(body?.ingredientsOcrConfidence),
        }),
      ).catch(async (error) => {
        console.error("Rescan enrichment failed", id, error);
        if (pendingFields.length) await prisma.product.update({ where: { id }, data: { pendingFields: [] } }).catch(() => {});
        void debugLog({ category: "scan", event: "rescan_done", level: "error", message: `Genscanningen fejlede: ${errorText(error)}`, ...debugContext });
      }),
    );

    return NextResponse.json({ ok: true, steps }, { status: 202 });
  } catch (error) {
    console.error("Rescan failed", id, error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
