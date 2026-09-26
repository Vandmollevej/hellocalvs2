import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// Udtrykkeligt samtykke til helbredsoplysninger (GDPR art. 9, docs/DECISIONS.md
// 2026-09-25) for brugere, der ikke gav det ved e-mail-tilmelding (fx login via
// Google/Apple/Facebook eller konti oprettet før samtykket fandtes).
export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!user.healthDataConsentAt) {
    await prisma.user.update({ where: { id: user.id }, data: { healthDataConsentAt: new Date() } });
  }
  return NextResponse.json({ ok: true });
}
