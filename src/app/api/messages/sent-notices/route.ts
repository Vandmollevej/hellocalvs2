import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { ackSentNotices, listSentNotices } from "@/lib/sent-notices";

// GET /api/messages/sent-notices — mails/sms'er sendt til den indloggede
// bruger, som endnu ikke er kvitteret med "Læst".
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({ notices: await listSentNotices(user.id) });
}

// POST /api/messages/sent-notices { ids } — "Læst".
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 50) : [];
  if (ids.length > 0) await ackSentNotices(user.id, ids);
  return NextResponse.json({ ok: true });
}
