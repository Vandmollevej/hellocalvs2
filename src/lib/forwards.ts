import { prisma } from "@/lib/prisma";
import { awardForwardPointsIfUnderCap } from "@/lib/points";
import { queueMessage } from "@/lib/messaging";

// "Videresend ret/produkt til en ven" (docs/DECISIONS.md 2026-09-02),
// omlagt efter docs/PRIVACY.md "Sociale funktioner":
// - Modtageren gemmes aldrig. Serveren ved kun, at linket er åbnet og brugt.
// - Afsenderens navn og en delt egen ret ligger krypteret i payload; nøglen
//   findes kun i linkets URL-fragment.
// - Den tidligere krydsspærring (frem-og-tilbage mellem to brugere) kræver
//   at kende begge parter og er derfor fjernet. Pointloftet pr. måned
//   (awardForwardPointsIfUnderCap) begrænser fortsat misbrug.

export class ForwardError extends Error {}

export async function createForward(
  senderId: string,
  kind: "PRODUCT" | "DISH",
  productId: string | null,
  payload: { iv: string; ciphertext: string }
) {
  return prisma.forward.create({
    data: {
      senderId,
      kind,
      productId: kind === "PRODUCT" ? productId : null,
      payloadIv: payload.iv,
      payloadCiphertext: payload.ciphertext,
    },
    select: { token: true },
  });
}

export async function getForward(token: string) {
  return prisma.forward.findUnique({
    where: { token },
    select: {
      token: true,
      senderId: true,
      kind: true,
      productId: true,
      status: true,
      payloadIv: true,
      payloadCiphertext: true,
      id: true,
    },
  });
}

// Modtageren åbner linket. Hvem modtageren er, gemmes ikke — kun at linket
// er åbnet. Afsenderen kan ikke åbne sit eget link.
export async function openForward(token: string, userId: string) {
  const forward = await getForward(token);
  if (!forward) return null;
  if (forward.senderId === userId) throw new ForwardError("Du kan ikke videresende til dig selv.");
  if (forward.status === "PENDING") {
    await prisma.forward.updateMany({
      where: { token, status: "PENDING" },
      data: { status: "OPENED", openedAt: new Date() },
    });
  }
  return forward;
}

// Modtageren har tilføjet varen. Afsenderen får points (første gang, under
// månedsloftet). Kun et åbnet link kan opfyldes, og kun én gang.
export async function fulfillForward(token: string, userId: string, now: Date = new Date()) {
  const forward = await getForward(token);
  if (!forward || forward.senderId === userId) return false;
  const claimed = await prisma.forward.updateMany({
    where: { token, status: "OPENED" },
    data: { status: "FULFILLED", fulfilledAt: now },
  });
  if (claimed.count !== 1) return false;

  const awarded = await awardForwardPointsIfUnderCap(forward.senderId, forward.id, now);
  if (awarded) {
    await queueMessage("POINTS_AWARDED", {
      userId: forward.senderId,
      vars: { points: String(awarded.amount) },
    });
  }
  return true;
}
