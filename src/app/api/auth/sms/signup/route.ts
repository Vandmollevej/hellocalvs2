import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { sendVerificationCode, smsFailureMessage } from "@/lib/sms-verification";
import { isLocked, recordFailure } from "@/lib/rate-limit";

function clientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// Trin 1 af tilmelding: sender en 6-cifret SMS-kode til mobilnummeret.
// Selve kontoen oprettes først i /api/auth/register, når koden er rigtig.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
  if (!email || !email.includes("@")) {
    return NextResponse.json({ message: "Angiv en gyldig e-mailadresse" }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ message: "Angiv et gyldigt mobilnummer" }, { status: 400 });
  }

  // Maks. 5 SMS-udsendelser pr. IP pr. 15 min. (beskytter mod SMS-misbrug).
  const ipKey = `sms-send:${clientIp(req)}`;
  if (isLocked(ipKey)) {
    return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });
  }
  recordFailure(ipKey);

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ message: "Der findes allerede en konto med den e-mail" }, { status: 409 });
  }

  const result = await sendVerificationCode({ purpose: "SIGNUP", phone });
  if (!result.ok) {
    const status = result.reason === "too-soon" || result.reason === "too-many" ? 429 : 503;
    return NextResponse.json({ message: smsFailureMessage(result.reason) }, { status });
  }
  return NextResponse.json({ verificationId: result.verificationId, phone });
}
