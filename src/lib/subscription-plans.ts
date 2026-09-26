// Abonnementer og bindingsperioder (docs/DECISIONS.md 2026-09-26): Seriøs og
// Seriøs Familie har hver deres side med tre perioder. Ren konstant-fil uden
// Prisma, så den også kan bruges i klientkomponenter; src/lib/subscription.ts
// re-eksporterer alt herfra. Priserne er foreløbige, indtil de endelige
// priser er besluttet.

export const SERIOUS_MONTHLY_PRICE_DKK = 119;

export const SUBSCRIPTION_PLANS = ["serious", "family"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];
export const SUBSCRIPTION_PERIODS = [1, 3, 12] as const;
export type SubscriptionPeriodMonths = (typeof SUBSCRIPTION_PERIODS)[number];

// Samlet pris for hele perioden (ikke pr. måned).
export const SUBSCRIPTION_PRICES_DKK: Record<SubscriptionPlan, Record<SubscriptionPeriodMonths, number>> = {
  serious: { 1: SERIOUS_MONTHLY_PRICE_DKK, 3: 299, 12: 899 },
  family: { 1: 179, 3: 449, 12: 1349 },
};

export function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return (SUBSCRIPTION_PLANS as readonly string[]).includes(value);
}

export function isSubscriptionPeriod(value: number): value is SubscriptionPeriodMonths {
  return (SUBSCRIPTION_PERIODS as readonly number[]).includes(value);
}

// Gratis: rullende 3 måneders historik (brugerens valg 2026-09-26, før 30 dage).
export const FREE_TIER_RETENTION_DAYS = 90;
