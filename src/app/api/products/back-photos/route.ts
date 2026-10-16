import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { debugLog, errorText, flowIdFromRequest } from "@/lib/debug-log";
import { BACK_PHOTO_MAX_BYTES, isBackPhotoStep, saveBackPhoto } from "@/lib/product-back-photos";

// POST /api/products/back-photos — { photo: data-URL, step: "nutrition" |
// "ingredients", width, height } med flowets id i headeren. Tilføj-kameraet
// uploader energi-/indholdstrinnets hele, ubeskårne kamerabillede under
// flowet (docs/DECISIONS.md 2026-10-15). Det gemmes uden beskæring og kobles
// til varen ved oprettelsen; nattens robot "back-photo-scan" analyserer det
// én gang (src/lib/product-back-photos.ts).

function cleanSide(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 20000 ? value : null;
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const flowId = flowIdFromRequest(req);
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  if (!flowId) return NextResponse.json({ message: "Flow-id mangler" }, { status: 400 });
  if (!isBackPhotoStep(body?.step)) return NextResponse.json({ message: "Ukendt trin" }, { status: 400 });
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(photo)) {
    return NextResponse.json({ message: "photo er påkrævet" }, { status: 400 });
  }
  if (photo.length * 0.75 > BACK_PHOTO_MAX_BYTES) {
    return NextResponse.json({ message: "Billedet er for stort" }, { status: 413 });
  }
  try {
    const row = await saveBackPhoto({
      photo,
      step: body.step,
      flowId,
      userId: user.id,
      width: cleanSide(body?.width),
      height: cleanSide(body?.height),
    });
    if (!row) return NextResponse.json({ message: "Billedet kunne ikke gemmes" }, { status: 400 });
    void debugLog({
      category: "scan",
      event: "back_photo_saved",
      message: `Ubeskåret bagsidebillede gemt (${body.step}${cleanSide(body?.width) ? `, ${body.width}×${body.height}` : ""})${row.productId ? " — koblet til varen" : ""}`,
      flowId,
      userId: user.id,
      productId: row.productId,
      durationMs: Date.now() - startedAt,
      data: { step: body.step, width: cleanSide(body?.width), height: cleanSide(body?.height), bytes: Math.round(photo.length * 0.75) },
    });
    return NextResponse.json({ id: row.id });
  } catch (error) {
    void debugLog({
      category: "scan",
      event: "back_photo_saved",
      level: "error",
      message: `Bagsidebilledet kunne ikke gemmes: ${errorText(error)}`,
      flowId,
      userId: user.id,
    });
    return NextResponse.json({ message: "Billedet kunne ikke gemmes" }, { status: 500 });
  }
}
