import { prisma } from "@/lib/prisma";
import {
  ACCOUNT_BLOCKED_MESSAGE,
  PET_FOOD_BLOCKED_MESSAGE,
  PET_FOOD_WARNING_MESSAGE,
} from "@/lib/pet-food-messages";

// Dyrefoder-spærringens "to chancer" (docs/DECISIONS.md 2026-10-07): en bruger,
// der bliver taget i at ville oprette dyrefoder, får en advarsel på skærmen.
// Næste gang spærres kontoen: den logges ud overalt (src/lib/session.ts) og kan
// ikke logge ind (src/lib/user-login.ts), til en admin ophæver spærringen under
// admin → Brugere. Administratorer rammes ikke.

export type PetFoodSource = "LOOKUP" | "CREATE" | "QUICK" | "ENRICHMENT" | "NIGHT";

export const STRIKES_BEFORE_BLOCK = 2;
// Kameraet læser samme stregkode flere gange, og et flow rammer spærringen flere
// steder — gentagelser inden for få minutter tæller derfor som ét forsøg.
const SAME_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

export type PetFoodAttemptOutcome = {
  /** 0 = ingen bruger/ikke talt, 1 = advarsel, 2 = spærret. */
  strikes: number;
  blocked: boolean;
  message: string;
};

const NOT_COUNTED: PetFoodAttemptOutcome = { strikes: 0, blocked: false, message: PET_FOOD_BLOCKED_MESSAGE };

export async function recordPetFoodAttempt(input: {
  userId: string | null | undefined;
  source: PetFoodSource;
  barcode?: string | null;
  productId?: string | null;
  matchedBy?: string | null;
}): Promise<PetFoodAttemptOutcome> {
  if (!input.userId) return NOT_COUNTED;
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { role: true, blockedAt: true, petFoodStrikesResetAt: true },
    });
    if (!user || user.role === "ADMIN") return NOT_COUNTED;
    if (user.blockedAt) return { strikes: STRIKES_BEFORE_BLOCK, blocked: true, message: ACCOUNT_BLOCKED_MESSAGE };

    const incidents = await prisma.petFoodIncident.findMany({
      where: { userId: input.userId, createdAt: { gt: user.petFoodStrikesResetAt ?? new Date(0) } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const last = incidents[0];
    if (last && Date.now() - last.createdAt.getTime() < SAME_ATTEMPT_WINDOW_MS) {
      return { strikes: incidents.length, blocked: false, message: PET_FOOD_WARNING_MESSAGE };
    }

    await prisma.petFoodIncident.create({
      data: {
        userId: input.userId,
        source: input.source,
        barcode: input.barcode ?? null,
        productId: input.productId ?? null,
        matchedBy: input.matchedBy?.slice(0, 200) ?? null,
      },
    });
    const strikes = incidents.length + 1;
    if (strikes >= STRIKES_BEFORE_BLOCK) {
      await prisma.user.update({
        where: { id: input.userId },
        data: { blockedAt: new Date(), blockedReason: "Dyrefoder: gentaget forsøg på at oprette dyrefoder" },
      });
      return { strikes, blocked: true, message: ACCOUNT_BLOCKED_MESSAGE };
    }
    return { strikes, blocked: false, message: PET_FOOD_WARNING_MESSAGE };
  } catch (error) {
    // Spærringen af selve varen må aldrig vælte, fordi tællingen fejlede.
    console.error("Pet food strike recording failed", error);
    return NOT_COUNTED;
  }
}

// Admin → Brugere: ophæv spærringen (brugeren skriver typisk til support).
// Tællingen nulstilles, så brugeren igen har en advarsel.
export async function unblockUser(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { blockedAt: null, blockedReason: null, petFoodStrikesResetAt: new Date() },
    select: { id: true },
  });
}

// Admin-oversigten: spærrede konti og seneste advarsler/forsøg.
export async function loadPetFoodStrikeSummary(now: Date = new Date()) {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [blocked, incidents7d, recent] = await Promise.all([
    prisma.user.count({ where: { blockedAt: { not: null }, forgottenAt: null } }),
    prisma.petFoodIncident.count({ where: { createdAt: { gte: since } } }),
    prisma.petFoodIncident.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, userId: true, source: true, createdAt: true, user: { select: { blockedAt: true } } },
    }),
  ]);
  return { blocked, incidents7d, recent };
}
