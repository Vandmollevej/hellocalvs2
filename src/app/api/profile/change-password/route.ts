import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { queueMessage } from "@/lib/messaging";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

const APP_BASE_URL = process.env.APP_BASE_URL || "https://hellocal.packroff.dk";

// Skift adgangskode for den indloggede bruger (docs/DECISIONS.md 2026-09-22).
// Brugeren findes udelukkende via sessionen — body indeholder kun de to
// adgangskoder, aldrig userId/email. Samme bcryptjs-hash (cost 12) og samme
// 8-tegns-krav som /api/auth/register og /api/auth/reset-password.
type Field = "currentPassword" | "newPassword";

function fail(message: string, status: number, field?: Field) {
  return NextResponse.json({ message, field }, { status });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return fail("Du er ikke logget ind.", 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Ugyldig anmodning", 400);
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!currentPassword) {
    return fail("Udfyld din nuværende adgangskode.", 400, "currentPassword");
  }
  if (newPassword.length < 8) {
    return fail("Adgangskoden skal være mindst 8 tegn.", 400, "newPassword");
  }
  if (!user.passwordHash) {
    return fail("Kontoen har ingen adgangskode, der kan ændres.", 400, "currentPassword");
  }

  const rateLimitKey = `change-password:${user.id}`;
  if (isLocked(rateLimitKey)) {
    return fail("For mange forsøg. Prøv igen senere.", 429);
  }

  const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentOk) {
    recordFailure(rateLimitKey);
    return fail("Den nuværende adgangskode er forkert.", 400, "currentPassword");
  }
  recordSuccess(rateLimitKey);

  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    return fail("Den nye adgangskode skal være forskellig fra den nuværende.", 400, "newPassword");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  // Databaseændringen er autoritativ: en fejl i mailkøen må ikke få et
  // gennemført skift til at ligne en fejl.
  try {
    await queueMessage("PASSWORD_CHANGED", {
      userId: user.id,
      vars: { displayName: user.displayName, resetLink: `${APP_BASE_URL}/forgot-password` },
    });
  } catch (error) {
    console.error("PASSWORD_CHANGED_EMAIL_ERROR", error instanceof Error ? error.message : "Ukendt fejl");
  }

  return NextResponse.json({ success: true });
}
