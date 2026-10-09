import { prisma } from "@/lib/prisma";
import { claimForward, ForwardAbuseError } from "@/lib/forwards";
import { defaultAmountGrams } from "@/lib/default-amount";
import { mediumHandSizeGrams } from "@/lib/hand-sizes";

// Modtager-visningen af "Videresend ret/produkt til en ven" (docs/DECISIONS.md
// 2026-09-02). Fælles for siden /forward/[token] og GET /api/forwards/[token]
// (den native app), så begge claimer og slår op på præcis samme måde.
//
// Kalderen skal selv sikre, at brugeren er logget ind: claimForward() sætter
// recipientId + status OPENED ved første besøg og tjekker krydsspærringen.

export type ForwardViewItem = { id: string; name: string };

export type ForwardView =
  // Krydsspærring (ForwardAbuseError) eller anden fejl ved claim — vises med rødt.
  | { status: "error"; reason: "abuse" | "failed"; message: string }
  | { status: "invalid"; message: string }
  | { status: "missing"; message: string }
  | {
      status: "ok";
      kind: "PRODUCT" | "DISH";
      item: ForwardViewItem;
      senderDisplayName: string | null;
      // Samme startmængde som mængdevælgeren (fx en hel 33 cl dåse), ikke 100 g.
      amountGrams: number;
    };

export const FORWARD_SENDER_FALLBACK = "En ven";

export async function loadForwardView(token: string, userId: string): Promise<ForwardView> {
  let forward;
  try {
    forward = await claimForward(token, userId);
  } catch (error) {
    return error instanceof ForwardAbuseError
      ? { status: "error", reason: "abuse", message: error.message }
      : { status: "error", reason: "failed", message: "Kunne ikke åbne linket." };
  }

  if (!forward) return { status: "invalid", message: "Linket er ikke gyldigt." };

  const item =
    forward.kind === "PRODUCT" && forward.productId
      ? await prisma.product.findUnique({ where: { id: forward.productId } })
      : forward.dishId
        ? await prisma.dish.findUnique({ where: { id: forward.dishId } })
        : null;
  const sender = await prisma.user.findUnique({ where: { id: forward.senderId } });
  const amountGrams =
    forward.kind === "PRODUCT" && item && "kcalPer100g" in item ? defaultAmountGrams(item, mediumHandSizeGrams(item.name)) : 100;

  if (!item) return { status: "missing", message: "Varen findes ikke længere." };

  return {
    status: "ok",
    kind: forward.kind,
    item: { id: item.id, name: item.name },
    senderDisplayName: sender?.displayName ?? null,
    amountGrams,
  };
}
