import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { consumeStartWeightToken, isStartWeightTokenValid } from "@/lib/start-weight-verification";

// Start-vægt-verificeringen (docs/DECISIONS.md 2026-09-22). Selve vægten
// ligger i brugerens krypterede boks; serveren validerer og forbruger kun
// engangslinket (docs/PRIVACY.md). Fejlsvar er bevidst generiske.
const INVALID_LINK = "Verificeringslinket er ugyldigt, udløbet eller allerede brugt.";

// GET ?token=… — kontrollerer linket uden at forbruge det.
export async function GET(req: Request) {
  const user = await getSessionUser();
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!user || !(await isStartWeightTokenValid(token, user.id))) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
  return NextResponse.json({ valid: true });
}

// POST { token } — forbruger linket. Klienten skriver derefter vægten i boksen.
export async function POST(req: Request) {
  const user = await getSessionUser();
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  if (!user || !(await consumeStartWeightToken(token, user.id))) {
    return NextResponse.json({ message: INVALID_LINK, code: "invalid_token" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
