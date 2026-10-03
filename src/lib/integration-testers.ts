import { Prisma, type IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { awardPoints } from "@/lib/points";
import { INTEGRATION_TESTER_POINTS } from "@/lib/points-constants";

// Testperson-program pr. integration (docs/DECISIONS.md 2026-10-02): kun den
// allerførste bruger, der tilmelder sig, får pladsen (unik pr. provider i
// databasen). Points gives først ved admin-godkendelse — samme regel som
// produkter og fejlrapporter (docs/DECISIONS.md 2026-09-02). Afvisning
// sletter tilmeldingen, så pladsen bliver ledig igen.

export type TesterOffer = {
  // Pladsen er ledig, og brugeren kan tilmelde sig.
  available: boolean;
  // Brugerens egen tilmelding, hvis det er brugeren, der har pladsen.
  mine: "PENDING" | "APPROVED" | null;
  points: number;
};

export async function getTesterOffer(userId: string, provider: IntegrationProvider): Promise<TesterOffer> {
  const slot = await prisma.integrationTester.findUnique({ where: { provider }, select: { userId: true, status: true } });
  return {
    available: !slot,
    mine: slot?.userId === userId ? slot.status : null,
    points: INTEGRATION_TESTER_POINTS,
  };
}

export class TesterSlotTakenError extends Error {}

export async function claimTesterSlot(userId: string, provider: IntegrationProvider) {
  try {
    return await prisma.integrationTester.create({ data: { userId, provider } });
  } catch (error) {
    // Unik pr. provider: en anden nåede først (eller brugeren har allerede pladsen).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const slot = await prisma.integrationTester.findUnique({ where: { provider } });
      if (slot?.userId === userId) return slot;
      throw new TesterSlotTakenError();
    }
    throw error;
  }
}

export async function approveTester(id: string) {
  return prisma.$transaction(async (tx) => {
    // Kun PENDING → APPROVED, så points aldrig gives to gange.
    const updated = await tx.integrationTester.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "APPROVED", approvedAt: new Date() },
    });
    const tester = await tx.integrationTester.findUnique({ where: { id } });
    if (!tester) return null;
    if (updated.count === 1) {
      await awardPoints(tester.userId, "INTEGRATION_TESTER", INTEGRATION_TESTER_POINTS, undefined, tx);
    }
    return tester;
  });
}

export async function rejectTester(id: string) {
  const deleted = await prisma.integrationTester.deleteMany({ where: { id, status: "PENDING" } });
  return deleted.count === 1;
}
