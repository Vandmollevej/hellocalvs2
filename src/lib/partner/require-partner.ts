import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { PARTNER_SESSION_COOKIE, verifyPartnerSession } from "@/lib/partner/auth";

// Server-side tjek ud over middleware.ts: hver side/rute i partnerportalen
// kalder denne, så beskyttelsen ikke kun afhænger af middleware-matcheren.
// Deaktiverede brugere og sessioner udstedt før "log ud overalt" afvises her —
// også midt i en igangværende session.
export async function requirePartnerUser() {
  const store = await cookies();
  const token = store.get(PARTNER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifyPartnerSession(token);
  if (!session) return null;

  const user = await prisma.partnerUser.findUnique({
    where: { id: session.partnerUserId },
    include: { partner: { select: { id: true, name: true } } },
  });
  if (!user || !user.active || !user.passwordHash || !user.totpSecret || !user.acceptedAt) return null;
  if (user.sessionsValidFrom && session.issuedAt < user.sessionsValidFrom.getTime()) return null;
  return user;
}
