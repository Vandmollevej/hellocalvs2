import { prisma } from "@/lib/prisma";
import type { Subscription, SubscriptionStatus } from "@prisma/client";

// Abonnement (docs/DECISIONS.md 2026-09-19): Gratis vs. Seriøs. Der findes
// bevidst intet eget "tier"-felt — tier udledes af den allerede eksisterende
// Subscription.status/currentPeriodEnd, så der kun er én kilde til sandhed.
// ACTIVE/TRIALING/FREE_MONTH betyder Seriøs, uanset om det stammer fra en
// rigtig betalende PSP-aftale (endnu ikke koblet til nogen udbyder), en
// gavekode (src/lib/gift-codes.ts), eller points-indløsning
// (src/lib/points.ts) — alle tre bruger samme status/currentPeriodEnd-felter.

export const SERIOUS_MONTHLY_PRICE_DKK = 119;
export const FREE_TIER_RETENTION_DAYS = 30;

export type SubscriptionTier = "FREE" | "SERIOUS";

const SERIOUS_STATUSES: SubscriptionStatus[] = ["ACTIVE", "TRIALING", "FREE_MONTH"];

export function getSubscriptionTier(
  subscription: Pick<Subscription, "status" | "currentPeriodEnd"> | null,
  now: Date = new Date()
): SubscriptionTier {
  if (!subscription) return "FREE";
  if (!SERIOUS_STATUSES.includes(subscription.status)) return "FREE";
  // A comped period (gift code/points, never a real recurring PSP charge yet)
  // falls back to Free once currentPeriodEnd has passed, even though the
  // stored status field itself isn't reconciled back to INACTIVE anywhere —
  // tier is always computed fresh from these two fields, never cached.
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() < now.getTime()) {
    return "FREE";
  }
  return "SERIOUS";
}

export async function getUserSubscriptionTier(userId: string, now: Date = new Date()): Promise<SubscriptionTier> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  return getSubscriptionTier(subscription, now);
}

// Rullende 30-dages historik for gratisbrugere (docs/DECISIONS.md
// 2026-09-19): som et overvågningskamera der optager i loop — data ældre end
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

// Strammer en vilkårlig historik-grænse (fx Hello Doc's valgte historyRange)
// ind til abonnementets 30-dages-grænse, så Gratis aldrig kan se — eller dele —
// data ældre end grænsen. Returnerer den seneste af de to datoer.
export async function applyRetentionCutoff(
  userId: string,
  cutoff: Date | null,
  now: Date = new Date()
): Promise<Date | null> {
  const retention = getRetentionCutoffDate(await getUserSubscriptionTier(userId, now), now);
  if (!retention) return cutoff;
  if (!cutoff) return retention;
  return cutoff.getTime() > retention.getTime() ? cutoff : retention;
}
