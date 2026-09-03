import { prisma } from "@/lib/prisma";
import { awardForwardPointsIfUnderCap } from "@/lib/points";
import { queueMessage } from "@/lib/messaging";

// "Videresend ret/produkt til en ven" (docs/DECISIONS.md 2026-09-02).

const ABUSE_WINDOW_HOURS = 24;

export class ForwardAbuseError extends Error {}

// Krydsspærring: hvis der allerede er sket mindst én tur-retur (mindst 1
// videresendelse i hver retning) mellem de to brugere inden for de sidste
// 24 timer, blokeres en NY videresendelse mellem dem — det ville være
// begyndelsen på en anden tur-retur samme dag. Begge brugere flages, så
// admin kan se og rydde det fra Advarsler.
async function checkCrossSendAbuse(senderId: string, recipientId: string, now: Date) {
  const since = new Date(now.getTime() - ABUSE_WINDOW_HOURS * 60 * 60 * 1000);

  const [outgoing, incoming] = await Promise.all([
    prisma.forward.count({
      where: { senderId, recipientId, createdAt: { gte: since } },
    }),
    prisma.forward.count({
      where: { senderId: recipientId, recipientId: senderId, createdAt: { gte: since } },
    }),
  ]);

  if (outgoing >= 1 && incoming >= 1) {
    await prisma.user.updateMany({
      where: { id: { in: [senderId, recipientId] } },
      data: { forwardAbuseFlaggedAt: now },
    });
    throw new ForwardAbuseError(
      "I har allerede videresendt frem og tilbage i dag — prøv igen i morgen."
    );
  }
}

// Ved oprettelse kendes modtageren typisk ikke endnu (anonymt delelink) —
// krydsspærringen kan derfor først tjekkes ved claimForward(), hvor
// modtageren rent faktisk identificeres.
export async function createForward(senderId: string, kind: "PRODUCT" | "DISH", itemId: string) {
  return prisma.forward.create({
    data: {
      senderId,
      kind,
      productId: kind === "PRODUCT" ? itemId : undefined,
      dishId: kind === "DISH" ? itemId : undefined,
    },
  });
}

// Kaldes når en logget ind bruger åbner /forward/[token] første gang.
// Idempotent: en allerede-claimet forward returneres blot uændret, så et
// gensyn af siden ikke fejler eller tjekker misbrug igen.
export async function claimForward(token: string, recipientId: string, now: Date = new Date()) {
  const forward = await prisma.forward.findUnique({ where: { token } });
  if (!forward) return null;
  if (forward.recipientId) return forward;

  if (forward.senderId === recipientId) {
    throw new ForwardAbuseError("Du kan ikke videresende til dig selv.");
  }

  await checkCrossSendAbuse(forward.senderId, recipientId, now);

  return prisma.forward.update({
    where: { token },
    data: { recipientId, status: "OPENED", openedAt: now },
  });
}

// Kaldes når en bruger opretter en registrering — tjekker om der findes en
// OPENED videresendelse af samme produkt/ret til denne bruger, og giver i så
// fald afsenderen points (kun når modtageren rent faktisk har brugt varen,
// ikke blot åbnet linket).
export async function fulfillMatchingForward(
  recipientId: string,
  kind: "PRODUCT" | "DISH",
  itemId: string,
  now: Date = new Date()
) {
  const forward = await prisma.forward.findFirst({
    where: {
      recipientId,
      status: "OPENED",
      ...(kind === "PRODUCT" ? { productId: itemId } : { dishId: itemId }),
    },
  });
  if (!forward) return;

  await prisma.forward.update({
    where: { id: forward.id },
    data: { status: "FULFILLED", fulfilledAt: now },
  });

  const awarded = await awardForwardPointsIfUnderCap(forward.senderId, forward.id, now);
  if (awarded) {
    await queueMessage("POINTS_AWARDED", {
      userId: forward.senderId,
      vars: { points: String(awarded.amount) },
    });
  }
}
