import { prisma } from "@/lib/prisma";
import type { Subscription, SubscriptionStatus } from "@prisma/client";
import { FREE_TIER_RETENTION_DAYS } from "@/lib/subscription-plans";

// Abonnement (docs/DECISIONS.md 2026-09-19): Gratis vs. Seriøs. Der findes
// bevidst intet eget "tier"-felt — tier udledes af den allerede eksisterende
// Subscription.status/currentPeriodEnd, så der kun er én kilde til sandhed.
// ACTIVE/TRIALING/FREE_MONTH betyder Seriøs, uanset om det stammer fra en
// rigtig betalende PSP-aftale (endnu ikke koblet til nogen udbyder), en
// gavekode (src/lib/gift-codes.ts), eller points-indløsning
// (src/lib/points.ts) — alle tre bruger samme status/currentPeriodEnd-felter.

// Planer, perioder, priser og gratis-grænser bor i den Prisma-fri
// src/lib/subscription-plans.ts, så klientkomponenter også kan bruge dem.
export * from "@/lib/subscription-plans";

export type SubscriptionTier = "FREE" | "SERIOUS";

// CANCELED = opsagt, men den betalte periode løber ud (MobilePay, docs/DECISIONS.md 2026-09-26).
const SERIOUS_STATUSES: SubscriptionStatus[] = ["ACTIVE", "TRIALING", "FREE_MONTH", "CANCELED"];
// Et løbende betalt abonnement (ACTIVE) har et par dages henstand, mens
// MobilePay gennemfører og genforsøger fornyelsestrækket på forfaldsdagen.
const ACTIVE_RENEWAL_GRACE_MS = 6 * 24 * 60 * 60 * 1000;

export function getSubscriptionTier(
  subscription: Pick<Subscription, "status" | "currentPeriodEnd"> | null,
  now: Date = new Date()
): SubscriptionTier {
  if (!subscription) return "FREE";
  if (!SERIOUS_STATUSES.includes(subscription.status)) return "FREE";
  if (subscription.status === "CANCELED" && !subscription.currentPeriodEnd) return "FREE";
  // A comped period (gift code/points, never a real recurring PSP charge yet)
  // falls back to Free once currentPeriodEnd has passed, even though the
  // stored status field itself isn't reconciled back to INACTIVE anywhere —
  // tier is always computed fresh from these two fields, never cached.
  const grace = subscription.status === "ACTIVE" ? ACTIVE_RENEWAL_GRACE_MS : 0;
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() + grace < now.getTime()) {
    return "FREE";
  }
  return "SERIOUS";
}

export async function getUserSubscriptionTier(userId: string, now: Date = new Date()): Promise<SubscriptionTier> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  return getSubscriptionTier(subscription, now);
}

// Rullende 3 måneders (90 dage) historik for gratisbrugere (docs/DECISIONS.md
// 2026-09-19, udvidet fra 30 dage 2026-09-26): som et overvågningskamera der optager i loop — data ældre end
// grænsen skjules, men slettes aldrig, og bliver synlig igen med det samme
// hvis brugeren bliver Seriøs, fordi det er en ren forespørgselsgrænse og
// ikke en fysisk "skjult"-markering på selve rækkerne. Returnerer null for
// Seriøs (ingen grænse, hele historikken vises).
export function getRetentionCutoffDate(tier: SubscriptionTier, now: Date = new Date()): Date | null {
  if (tier === "SERIOUS") return null;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - FREE_TIER_RETENTION_DAYS);
  return cutoff;
}
