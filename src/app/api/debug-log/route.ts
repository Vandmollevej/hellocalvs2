import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { cleanFlowId, debugLog, type DebugLogLevel } from "@/lib/debug-log";

// POST /api/debug-log — telefonens egne trin i kameraflowet (kamerastart,
// stregkodeaflæsning, lokal OCR, afbrudte scanninger) til admin "Log"
// (docs/DECISIONS.md 2026-09-28). Kun for indloggede brugere; serveren
// logger sine egne trin direkte.

const EVENT_PATTERN = /^[a-z_]{1,48}$/;
const LEVELS: DebugLogLevel[] = ["info", "warn", "error"];

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const event = typeof body?.event === "string" ? body.event : "";
  const message = typeof body?.message === "string" ? body.message.slice(0, 500) : "";
  if (!EVENT_PATTERN.test(event) || !message) return NextResponse.json({ ok: false }, { status: 400 });

  const level = LEVELS.includes(body?.level as DebugLogLevel) ? (body?.level as DebugLogLevel) : "info";
  const data = body?.data && typeof body.data === "object" && !Array.isArray(body.data) ? (body.data as Record<string, unknown>) : null;
  const barcode = typeof body?.barcode === "string" ? body.barcode.replace(/\D/g, "").slice(0, 32) || null : null;
  const productId = typeof body?.productId === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(body.productId) ? body.productId : null;
  const durationMs = typeof body?.durationMs === "number" && body.durationMs >= 0 ? body.durationMs : null;

  await debugLog({
    category: "scan",
    event,
    level,
    message,
    flowId: cleanFlowId(body?.flowId),
    userId: user.id,
    barcode,
    productId,
    durationMs,
    data: data && JSON.stringify(data).length <= 8000 ? data : null,
  });
  return NextResponse.json({ ok: true });
}
