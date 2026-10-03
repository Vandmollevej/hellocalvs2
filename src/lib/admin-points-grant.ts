import { prisma } from "@/lib/prisma";
import { canGrantAdminPoints, nextAdminGrantAllowedAt, type AdminGrantInput } from "@/lib/admin-points-grant-rules";

// Admin → Brugere → Tildel points (docs/DECISIONS.md 2026-10-03): en
// administrator giver en bruger points, fx som kompensation. Højst 300
// points (én gratis måned) pr. tildeling og højst én gang pr. måned pr.
// bruger. Reglerne ligger i admin-points-grant-rules.ts.

export class AdminGrantError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function lastAdminGrantAt(userId: string): Promise<Date | null> {
  const last = await prisma.pointsTransaction.findFirst({
    where: { userId, reason: "ADMIN_GRANT" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return last?.createdAt ?? null;
}

export async function grantAdminPoints(userId: string, adminId: string, input: AdminGrantInput) {
  return prisma.$transaction(async (tx) => {
    // Lås brugerens række, så to samtidige tildelinger ikke begge kommer
    // igennem månedsgrænsen.
    const locked = await tx.$queryRaw<{ id: string; role: string; forgottenAt: Date | null; closedAt: Date | null }[]>`
      SELECT "id", "role"::text AS "role", "forgottenAt", "closedAt" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
    const user = locked[0];
    if (!user || user.role !== "USER") throw new AdminGrantError("Brugeren findes ikke.", 404);
    if (user.forgottenAt || user.closedAt) throw new AdminGrantError("Kontoen er lukket eller anonymiseret.", 400);

    const last = await tx.pointsTransaction.findFirst({
      where: { userId, reason: "ADMIN_GRANT" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (last && !canGrantAdminPoints(last.createdAt)) {
      const next = nextAdminGrantAllowedAt(last.createdAt).toLocaleDateString("da-DK");
      throw new AdminGrantError(`Brugeren har fået points inden for den seneste måned. Næste mulige tildeling: ${next}.`, 409);
    }

    const transaction = await tx.pointsTransaction.create({
      data: { userId, reason: "ADMIN_GRANT", amount: input.amount, note: input.note, grantedById: adminId },
    });
    await tx.adminAuditLog.create({ data: { adminId, action: "ADMIN_GRANT_POINTS", targetUserId: userId } });
    return transaction;
  });
}
