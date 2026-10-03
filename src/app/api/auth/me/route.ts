import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// Den indloggede bruger (AuthGate og "Log ind med Face ID"-tilbuddet).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const passkeys = await prisma.passkey.count({ where: { userId: user.id } });
  // Telefonnummer er obligatorisk (docs/DECISIONS.md 2026-10-02) for alle, der
  // logger ind — også børneprofiler i en familie (brugerens valg: de kan
  // fjerne forældrenes adgang, når de fylder 18). AuthGate sender brugeren
  // til /account/phone, til det er udfyldt.
  const phoneRequired = !user.phone;
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      appLocale: user.appLocale,
      hasPasskey: passkeys > 0,
      hasHealthDataConsent: user.healthDataConsentAt !== null,
      emailVerified: Boolean(user.emailVerifiedAt),
      hasPhone: Boolean(user.phone),
      phoneRequired,
    },
  });
}
