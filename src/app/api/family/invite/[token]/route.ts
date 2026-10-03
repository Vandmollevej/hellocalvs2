import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { getFamilyInvitation, joinFamily } from "@/lib/family";
import { familyErrorResponse } from "@/lib/family-api";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ token: string }> };

function rateLimitKey(req: Request) {
  return `family-invite:${req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown"}`;
}

// Linket fra invitationsmailen (/family-invite/<token>). GET viser, hvem der
// inviterer og til hvad — også før modtageren er logget ind.
export async function GET(req: Request, { params }: RouteContext) {
  const key = rateLimitKey(req);
  if (isLocked(key)) return NextResponse.json({ code: "tooManyAttempts" }, { status: 429 });
  const { token } = await params;
  try {
    const invitation = await getFamilyInvitation(token);
    recordSuccess(key);
    return NextResponse.json({ invitation });
  } catch (error) {
    recordFailure(key);
    return familyErrorResponse(error);
  }
}

// Modtageren siger ja: den indloggede konto kobles på familien og får
// indsigt i de profiler, betaleren valgte.
export async function POST(_req: Request, { params }: RouteContext) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const { token } = await params;
  try {
    await getFamilyInvitation(token);
    await joinFamily(login.id, token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
