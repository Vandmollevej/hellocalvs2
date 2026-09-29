// Stripe-markeder (docs/DECISIONS.md 2026-09-29): Hello Cal starter med to
// lande. Danmark betaler med MobilePay (DKK), Tyskland med kort inkl. EC-kort
// (girocard, EUR). Prisma-fri konstant-fil, så klienten også kan bruge den.
import type { SubscriptionPeriodMonths, SubscriptionPlan } from "@/lib/subscription-plans";
import { SUBSCRIPTION_PRICES_DKK } from "@/lib/subscription-plans";

export type StripeCountry = "DK" | "DE";
export type StripeMarket = {
  country: StripeCountry;
  currency: "dkk" | "eur";
  // Stripe Checkout payment_method_types. Girocard (EC-kort) kører som kort:
  // Stripe accepterer girocard via kort-metoden, hvor kortet bærer det.
  paymentMethodTypes: string[];
  locale: "da" | "de";
};

export const STRIPE_MARKETS: Record<StripeCountry, StripeMarket> = {
  DK: { country: "DK", currency: "dkk", paymentMethodTypes: ["mobilepay"], locale: "da" },
  DE: { country: "DE", currency: "eur", paymentMethodTypes: ["card"], locale: "de" },
};

// Samlet pris i euro pr. periode (foreløbig: DKK-prisen ÷ 7,46 afrundet til
// x,99; helt år = 25 % rabat som i DKK).
export const SUBSCRIPTION_PRICES_EUR: Record<SubscriptionPlan, Record<SubscriptionPeriodMonths, number>> = {
  serious: { 1: 15.99, 3: 39.99, 12: 143.99 },
  family: { 1: 23.99, 3: 59.99, 12: 215.99 },
};

export function stripeMarketFor(region: string | null | undefined): StripeMarket | null {
  const code = (region ?? "").toUpperCase();
  return code === "DK" || code === "DE" ? STRIPE_MARKETS[code] : null;
}

export function marketPrice(market: StripeMarket | null, plan: SubscriptionPlan, months: SubscriptionPeriodMonths) {
  return market?.currency === "eur" ? SUBSCRIPTION_PRICES_EUR[plan][months] : SUBSCRIPTION_PRICES_DKK[plan][months];
}
