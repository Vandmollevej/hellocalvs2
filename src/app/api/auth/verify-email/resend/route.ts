import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { sendEmailVerification } from "@/lib/email-verification";
import { isLocked, recordFailure } from "@/lib/rate-limit";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.emailVerifiedAt) return NextResponse.json({ ok: true, alreadyVerified: true });

  const key = `verify-email-resend:${user.id}`;
  if (isLocked(key)) {
    return NextResponse.json({ message: "Vent lidt, før du beder om en ny mail." }, { status: 429 });
  }
  recordFailure(key);
  await sendEmailVerification(user);
  return NextResponse.json({ ok: true });
}
