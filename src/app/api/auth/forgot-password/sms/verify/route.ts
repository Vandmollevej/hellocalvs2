import { NextResponse } from "next/server";
import { verifyPasswordResetSmsCode } from "@/lib/password-reset-sms";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

// Glemt adgangskode via SMS, trin 2: tjek koden. Ved korrekt kode returneres
// et almindeligt reset-token, som /reset-password bruger.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";
  const rateLimitKey = `forgot-password-sms-verify:${email}`;
  if (!email || isLocked(rateLimitKey)) {
    return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });
  }

  const token = await verifyPasswordResetSmsCode(email, code);
  if (!token) {
    recordFailure(rateLimitKey);
    return NextResponse.json({ message: "Koden er forkert eller udløbet." }, { status: 400 });
  }
  recordSuccess(rateLimitKey);
  return NextResponse.json({ token });
}
