import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { joinFamily } from "@/lib/family";
import { clientKey, familyErrorResponse, readCodeInput, readJson } from "@/lib/family-api";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

// Kode + e-mail (skrevet) eller token (QR-kode). E-mailen skal være den,
// koden blev lavet til, og den indloggede kontos egen.
export async function POST(req: Request) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const rateLimitKey = clientKey(req, `family-join:${login.id}`);
  if (isLocked(rateLimitKey)) return NextResponse.json({ code: "tooManyAttempts" }, { status: 429 });
  const body = await readJson(req);
  try {
    await joinFamily(login.id, readCodeInput(body));
    recordSuccess(rateLimitKey);
    return NextResponse.json({ ok: true });
  } catch (error) {
    recordFailure(rateLimitKey);
    return familyErrorResponse(error);
  }
}
