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
// Familieplan (docs/FAMILY.md): op til 6 profiler, altid betalt. Foreslået
// pris, ikke endeligt godkendt af brugeren.
export const FAMILY_MONTHLY_PRICE_DKK = 179;
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
  if (getSubscriptionTier(subscription, now) === "SERIOUS") return "SERIOUS";
  return (await isCoveredByFamilyPlan(userId, now)) ? "SERIOUS" : "FREE";
}

// Alle medlemmer af en familie, hvis betaler har et aktivt familieabonnement,
// er Seriøs (docs/FAMILY.md punkt 1).
export async function isCoveredByFamilyPlan(userId: string, now: Date = new Date()): Promise<boolean> {
  const membership = await prisma.familyMember.findUnique({
    where: { userId },
    select: { family: { select: { owner: { select: { subscription: true } } } } },
  });
  const ownerSubscription = membership?.family.owner.subscription ?? null;
  return Boolean(
    ownerSubscription && ownerSubscription.plan === "FAMILY" && getSubscriptionTier(ownerSubscription, now) === "SERIOUS"
  );
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
