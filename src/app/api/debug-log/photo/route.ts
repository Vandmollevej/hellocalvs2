import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { cleanFlowId, debugLog, isDebugLogEnabled } from "@/lib/debug-log";
import { saveScanLogImage } from "@/lib/scan-log-images";

// POST /api/debug-log/photo — et foto fra kameraflowet (forside, energi,
// indhold) til admin "Log" (docs/DECISIONS.md 2026-10-03), så en afbrudt
// oprettelse kan ses med de billeder, der nåede at blive taget. Gemmes kun,
// mens loggen er slået til.

const STEPS = ["front", "nutrition", "ingredients"] as const;
// Telefonen skalerer til 1280 px JPEG (~100–300 kB); alt over er en fejl.
const MAX_PHOTO_CHARS = 3_000_000;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const flowId = cleanFlowId(body?.flowId);
  const step = STEPS.find((item) => item === body?.step);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  if (!flowId || !step || !photo.startsWith("data:image/") || photo.length > MAX_PHOTO_CHARS) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!(await isDebugLogEnabled())) return NextResponse.json({ ok: true, saved: false });

  const barcode = typeof body?.barcode === "string" ? body.barcode.replace(/\D/g, "").slice(0, 32) || null : null;
  const imageUrl = await saveScanLogImage(photo).catch(() => null);
  if (!imageUrl) {
    await debugLog({ category: "scan", event: "flow_photo", level: "warn", message: `Fotoet (${step}) kunne ikke gemmes til loggen`, flowId, userId: user.id, barcode, data: { step } });
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  await debugLog({
    category: "scan",
    event: "flow_photo",
    message: `Foto gemt til loggen (${step})`,
    flowId,
    userId: user.id,
    barcode,
    data: { step, imageUrl },
  });
  return NextResponse.json({ ok: true, saved: true });
}
