import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// Den indloggede bruger (AuthGate og "Log ind med Face ID"-tilbuddet).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const passkeys = await prisma.passkey.count({ where: { userId: user.id } });
  return NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName, hasPasskey: passkeys > 0, hasHealthDataConsent: user.healthDataConsentAt !== null },
  });
}
