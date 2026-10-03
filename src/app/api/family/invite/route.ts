import { NextResponse } from "next/server";
import { previewFamilyInvite, resolveFamilyCode } from "@/lib/family";
import { clientKey, familyErrorResponse, readJson } from "@/lib/family-api";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

// Tilknytningssiden efter scanning af QR-koden: hvem inviterer, og til hvilken
// e-mail. Kræver ikke login, så siden kan bede om det rigtige login.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const rateLimitKey = clientKey(req, "family-invite");
  if (isLocked(rateLimitKey)) return NextResponse.json({ code: "tooManyAttempts" }, { status: 429 });
  try {
    const invite = await previewFamilyInvite(token);
    recordSuccess(rateLimitKey);
    return NextResponse.json(invite);
  } catch (error) {
    recordFailure(rateLimitKey);
    return familyErrorResponse(error);
  }
}

// Indtastet invitationskode + e-mail → samme token som QR-koden giver.
export async function POST(req: Request) {
  const rateLimitKey = clientKey(req, "family-invite");
  if (isLocked(rateLimitKey)) return NextResponse.json({ code: "tooManyAttempts" }, { status: 429 });
  const body = await readJson(req);
  try {
    const result = await resolveFamilyCode(
      typeof body.code === "string" ? body.code : "",
      typeof body.email === "string" ? body.email : ""
    );
    recordSuccess(rateLimitKey);
    return NextResponse.json(result);
  } catch (error) {
    recordFailure(rateLimitKey);
    return familyErrorResponse(error);
  }
}
