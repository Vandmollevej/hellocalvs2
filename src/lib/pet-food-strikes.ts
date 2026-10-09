import { prisma } from "@/lib/prisma";
import {
  ACCOUNT_BLOCKED_MESSAGE,
  PET_FOOD_BLOCKED_MESSAGE,
  PET_FOOD_WARNING_MESSAGE,
} from "@/lib/pet-food-messages";
import { saveDataUrlImage } from "@/lib/qc-image-storage";

// Dyrefoder-spærringens hændelser og "to chancer" (docs/DECISIONS.md 2026-10-07).
//
// Hver afvisning gemmes som en PetFoodIncident — med de billeder, brugeren forsøgte at oprette —
// og vises i admin-oversigten, til en admin har gennemgået den: en afvisning kan ramme en kunde,
// der scannede en legitim vare, og kunden risikerer at forlade appen. Admin kan frikende en fejl
// (varen sættes tilbage, og en spærring ophæves, hvis den kun skyldtes den hændelse).
//
// En bruger, der bliver taget i at ville oprette dyrefoder, får første gang en advarsel på
// skærmen. Næste gang spærres kontoen: den logges ud overalt (src/lib/session.ts) og kan
// ikke logge ind (src/lib/user-login.ts), til en admin ophæver spærringen under admin →
// Brugere. Administratorer og anonyme besøgende rammes ikke af tællingen, men hændelsen
// vises stadig.

export type PetFoodSource = "LOOKUP" | "CREATE" | "QUICK" | "ENRICHMENT" | "NIGHT" | "SCREEN";
export type PetFoodIncidentKind = "BLOCKED" | "AUTO_REJECTED" | "FLAGGED_EXISTING";

export const STRIKES_BEFORE_BLOCK = 2;
// Kameraet læser samme stregkode flere gange, og et flow rammer spærringen flere steder —
// gentagelser af samme stregkode/vare inden for få minutter er den samme hændelse, og
// flere forskellige hændelser inden for få minutter tæller som ét forsøg mod kontoen.
const SAME_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
// Et foto kan kun hænges på en hændelse kort efter, at den opstod (kameraflowet sender det bagefter).
const PHOTO_ATTACH_WINDOW_MS = 5 * 60 * 1000;
const MAX_INCIDENT_IMAGES = 4;

export type PetFoodAttemptOutcome = {
  /** 0 = ikke talt (anonym/administrator), 1 = advarsel, 2 = spærret. */
  strikes: number;
  blocked: boolean;
  message: string;
  /** Hændelsen i admin-oversigten (klienten kan sende kameraets billede til den). */
  incidentId: string | null;
};

function notCounted(incidentId: string | null): PetFoodAttemptOutcome {
  return { strikes: 0, blocked: false, message: PET_FOOD_BLOCKED_MESSAGE, incidentId };
}

export async function recordPetFoodAttempt(input: {
  userId?: string | null;
  source: PetFoodSource;
  kind?: PetFoodIncidentKind;
  barcode?: string | null;
  productId?: string | null;
  productName?: string | null;
  matchedBy?: string | null;
  /** De billeder, brugeren forsøgte at oprette (gemte URL'er), så admin kan se dem. */
  imageUrls?: string[];
  /** false = kun markering til admin (fx fund i en eksisterende vare); aldrig et forsøg mod en bruger. */
  countAsStrike?: boolean;
}): Promise<PetFoodAttemptOutcome> {
  try {
    const kind = input.kind ?? "BLOCKED";
    const user = input.userId
      ? await prisma.user.findUnique({
          where: { id: input.userId },
          select: { id: true, role: true, blockedAt: true, petFoodStrikesResetAt: true },
        })
      : null;
    const eligible = Boolean(user) && user!.role !== "ADMIN" && input.countAsStrike !== false && kind !== "FLAGGED_EXISTING";
    const now = Date.now();
    const windowStart = new Date(now - SAME_ATTEMPT_WINDOW_MS);

    // Samme stregkode/vare igen inden for få minutter = samme hændelse.
    const key = input.barcode ? { barcode: input.barcode } : input.productId ? { productId: input.productId } : null;
    const duplicate =
      key !== null
        ? await prisma.petFoodIncident.findFirst({
            where: { userId: user?.id ?? null, createdAt: { gt: windowStart }, ...key },
            select: { id: true },
          })
        : null;

    // Tæller hændelsens bruger allerede et forsøg inden for vinduet, tæller denne ikke igen.
    const since = user?.petFoodStrikesResetAt ?? new Date(0);
    const counted = eligible
      ? await prisma.petFoodIncident.findMany({
          where: { userId: user!.id, countedAsStrike: true, falsePositive: false, createdAt: { gt: since } },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
      : [];
    const recentStrike = counted[0] && now - counted[0].createdAt.getTime() < SAME_ATTEMPT_WINDOW_MS;
    const countsNow = eligible && !recentStrike;

    let incidentId: string | null = duplicate?.id ?? null;
    if (!duplicate) {
      const created = await prisma.petFoodIncident.create({
        data: {
          userId: user?.id ?? null,
          source: input.source,
          kind,
          barcode: input.barcode ?? null,
          productId: input.productId ?? null,
          productName: input.productName?.slice(0, 200) ?? null,
          matchedBy: input.matchedBy?.slice(0, 200) ?? null,
          imageUrls: (input.imageUrls ?? []).slice(0, MAX_INCIDENT_IMAGES),
          countedAsStrike: countsNow,
        },
        select: { id: true },
      });
      incidentId = created.id;
    }

    if (!user || !eligible) return notCounted(incidentId);
    if (user.blockedAt) return { strikes: STRIKES_BEFORE_BLOCK, blocked: true, message: ACCOUNT_BLOCKED_MESSAGE, incidentId };

    const strikes = counted.length + (countsNow && !duplicate ? 1 : 0);
    if (strikes >= STRIKES_BEFORE_BLOCK) {
      await prisma.user.update({
        where: { id: user.id },
        data: { blockedAt: new Date(), blockedReason: "Dyrefoder: gentaget forsøg på at oprette dyrefoder" },
      });
      return { strikes, blocked: true, message: ACCOUNT_BLOCKED_MESSAGE, incidentId };
    }
    return { strikes: Math.max(strikes, 1), blocked: false, message: PET_FOOD_WARNING_MESSAGE, incidentId };
  } catch (error) {
    // Spærringen af selve varen må aldrig vælte, fordi registreringen fejlede.
    console.error("Pet food incident recording failed", error);
    return notCounted(null);
  }
}

// Kameraflowet sender billedet, brugeren forsøgte at scanne, kort efter at stregkoden blev spærret
// (opslaget har kun stregkoden). Billedet hænges på hændelsen, så admin kan se det.
// Kun den bruger, der ejer hændelsen (eller en anonym hændelse), og kun kort efter den opstod.
export async function attachPetFoodIncidentPhoto(
  incidentId: string,
  sessionUserId: string | null,
  photo: string
): Promise<boolean> {
  const incident = await prisma.petFoodIncident.findUnique({
    where: { id: incidentId },
    select: { userId: true, imageUrls: true, createdAt: true },
  });
  if (!incident) return false;
  if (incident.userId && incident.userId !== sessionUserId) return false;
  if (incident.imageUrls.length >= MAX_INCIDENT_IMAGES) return false;
  if (Date.now() - incident.createdAt.getTime() > PHOTO_ATTACH_WINDOW_MS) return false;
  const url = await saveDataUrlImage(photo).catch(() => null);
  if (!url) return false;
  await prisma.petFoodIncident.update({ where: { id: incidentId }, data: { imageUrls: { push: url } } });
  return true;
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

export type PetFoodReviewAction = "false-positive" | "confirm" | "reject-product";

// Admin gennemgår en hændelse i oversigten.
// - false-positive: fejlagtig afvisning. Hændelsen tæller ikke længere som forsøg; en spærring, der kun
//   skyldtes den, ophæves; en afvist vare sættes tilbage til afventende.
// - confirm: det var dyrefoder, hændelsen er set.
// - reject-product: (fund i eksisterende vare) varen afvises.
export async function reviewPetFoodIncident(id: string, action: PetFoodReviewAction) {
  const incident = await prisma.petFoodIncident.findUnique({ where: { id } });
  if (!incident) throw new Error("Hændelsen findes ikke");
  const now = new Date();

  if (action === "false-positive") {
    await prisma.petFoodIncident.update({
      where: { id },
      data: { reviewedAt: now, falsePositive: true, countedAsStrike: false },
    });
    if (incident.userId) {
      const user = await prisma.user.findUnique({
        where: { id: incident.userId },
        select: { blockedAt: true, petFoodStrikesResetAt: true },
      });
      const remaining = await prisma.petFoodIncident.count({
        where: {
          userId: incident.userId,
          countedAsStrike: true,
          falsePositive: false,
          createdAt: { gt: user?.petFoodStrikesResetAt ?? new Date(0) },
        },
      });
      if (user?.blockedAt && remaining < STRIKES_BEFORE_BLOCK) {
        await prisma.user.update({ where: { id: incident.userId }, data: { blockedAt: null, blockedReason: null } });
      }
    }
    if (incident.kind === "AUTO_REJECTED" && incident.productId) {
      await prisma.product.updateMany({ where: { id: incident.productId, status: "REJECTED" }, data: { status: "PENDING" } });
    }
  } else if (action === "reject-product") {
    if (incident.productId) {
      await prisma.product.updateMany({ where: { id: incident.productId, status: { not: "REJECTED" } }, data: { status: "REJECTED" } });
    }
    await prisma.petFoodIncident.update({ where: { id }, data: { reviewedAt: now } });
  } else {
    await prisma.petFoodIncident.update({ where: { id }, data: { reviewedAt: now } });
  }
}

// Admin-oversigten: hændelser, der venter på gennemgang, og spærrede konti.
export async function loadPetFoodStrikeSummary(now: Date = new Date()) {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [blocked, unreviewed, last7d, recent] = await Promise.all([
    prisma.user.count({ where: { blockedAt: { not: null }, forgottenAt: null } }),
    prisma.petFoodIncident.count({ where: { reviewedAt: null } }),
    prisma.petFoodIncident.count({ where: { createdAt: { gte: since } } }),
    prisma.petFoodIncident.findMany({
      where: { reviewedAt: null },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        kind: true,
        source: true,
        barcode: true,
        productId: true,
        productName: true,
        matchedBy: true,
        imageUrls: true,
        createdAt: true,
        userId: true,
        user: { select: { blockedAt: true } },
      },
    }),
  ]);
  return {
    blocked,
    unreviewed,
    last7d,
    recent: recent.map((row) => ({
      id: row.id,
      kind: row.kind,
      source: row.source,
      barcode: row.barcode,
      productId: row.productId,
      productName: row.productName,
      matchedBy: row.matchedBy,
      imageUrls: row.imageUrls,
      createdAt: row.createdAt,
      // Navn og e-mail vises aldrig for admin (brugerdata er fortrolige): kun et pseudonym.
      userLabel: row.userId ? `Bruger ${row.userId.slice(-6)}` : "Ikke logget ind",
      userBlocked: Boolean(row.user?.blockedAt),
    })),
  };
}
