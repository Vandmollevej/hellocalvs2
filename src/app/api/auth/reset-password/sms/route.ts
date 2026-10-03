import { NextResponse } from "next/server";
import { hashPasswordResetToken, peekPasswordResetToken } from "@/lib/password-reset";
import { maskPhone } from "@/lib/phone";
import { sendVerificationCode, smsFailureMessage } from "@/lib/sms-verification";
import { isLocked, recordFailure } from "@/lib/rate-limit";

// Glemt adgangskode, trin 2: har kontoen et bekræftet mobilnummer, skal der
// både et gyldigt e-mail-link og en SMS-kode til. action "status" fortæller
// kun, om SMS kræves; action "send" sender koden.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const action = body.action === "send" ? "send" : "status";
  const user = token ? await peekPasswordResetToken(token) : null;
  if (!user) {
    return NextResponse.json({ message: "Linket er ugyldigt eller udløbet. Anmod om et nyt." }, { status: 400 });
  }
  if (!user.phone || !user.phoneVerifiedAt) {
    return NextResponse.json({ requiresSms: false });
  }
  const masked = maskPhone(user.phone);
  if (action === "status") return NextResponse.json({ requiresSms: true, phone: masked });

  const key = `reset-sms:${user.id}`;
  if (isLocked(key)) {
    return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });
  }
  recordFailure(key);

  const result = await sendVerificationCode({
    purpose: "PASSWORD_RESET",
    phone: user.phone,
    userId: user.id,
    resetTokenHash: hashPasswordResetToken(token),
  });
  if (!result.ok) {
    const status = result.reason === "too-soon" || result.reason === "too-many" ? 429 : 503;
    return NextResponse.json({ message: smsFailureMessage(result.reason) }, { status });
  }
  return NextResponse.json({ requiresSms: true, phone: masked, verificationId: result.verificationId });
}
