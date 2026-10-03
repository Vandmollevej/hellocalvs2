import { prisma } from "@/lib/prisma";
import { getSubscriptionTier, SUBSCRIPTION_PRICES_DKK } from "@/lib/subscription";
import { isStripeConfigured, listStripeSubscriptions, type StripeSubscription } from "@/lib/payments/stripe-client";

// Tal til /admin/economy (docs/DECISIONS.md 2026-10-02 "Admin: Economy").
// Alt er aggregeret: hverken siden eller AI-kaldet får e-mails, navne eller
// bruger-id'er. Kun betalende abonnenter tælles (provider sat, ACTIVE/CANCELED);
// gavekoder og points-måneder giver ingen indtægt.

const DAY_MS = 86_400_000;
const MONTH_DAYS = 30.44;
// Samme kurs som de foreløbige euro-priser i stripe-markets.ts.
const EUR_TO_DKK = 7.46;
const PAID_CHARGE_STATUSES = ["CHARGED", "PARTIALLY_CAPTURED", "PARTIALLY_REFUNDED"];

export type EconomyKind = "monthly" | "quarterly" | "annual";
export const ECONOMY_KINDS: { kind: EconomyKind; months: 1 | 3 | 12; label: string }[] = [
  { kind: "annual", months: 12, label: "Årsabonnementer" },
  { kind: "monthly", months: 1, label: "Månedsabonnementer" },
  { kind: "quarterly", months: 3, label: "3-måneders abonnementer" },
];

type LiveSub = {
  kind: EconomyKind;
  months: 1 | 3 | 12;
  // Pris pr. periode i hele kroner (ikke pr. måned).
  priceDkk: number;
  // true = pris/periode er ikke fundet hos betalingsudbyderen og er skønnet.
  estimated: boolean;
  renewing: boolean; // ACTIVE (fornyes) mod CANCELED (løber ud)
  periodEnd: Date | null;
};

export type ChurnInput = {
  // Andel (0–1), der afmelder før næste fornyelse, pr. abonnementstype.
  monthly: number;
  quarterly: number;
  annual: number;
};

export type KindSummary = {
  kind: EconomyKind;
  label: string;
  months: 1 | 3 | 12;
  count: number;
  renewing: number;
  canceled: number;
  // Samlet pris for én periode for alle (kr.), og omregnet pr. måned / pr. år.
  periodTotalDkk: number;
  perMonthDkk: number;
  perYearDkk: number;
  canceledPeriodTotalDkk: number;
  estimatedCount: number;
};

export type AnnualCover = {
  // Længst sikrede slutdato og antal måneder dertil (null = ingen årsabonnementer).
  latestEnd: string | null;
  monthsToLatest: number | null;
  // Gennemsnitlig restløbetid vægtet efter beløb.
  weightedMonths: number | null;
  // Betalt men endnu ikke "optjent" indtægt (kr.).
  remainingValueDkk: number;
  runway: { label: string; securedDkk: number }[];
};

export type Forecast = {
  churn: ChurnInput;
  monthly: { count: number; amountDkk: number };
  quarterly: { count: number; amountDkk: number };
  annual: { count: number; amountDkk: number };
  totalDkk: number;
  windowLabel: string;
};

export type ChurnObservation = {
  liveRenewing: number;
  canceledLast30: number;
  endedLast30: number;
  canceledLast90: number;
  endedLast90: number;
  observedMonthlyRate: number | null;
  baseline: ChurnInput;
  basis: string;
};

export type EconomyData = {
  generatedAt: string;
  payingNow: number;
  stripeLive: boolean;
  estimatedSubscriptions: number;
  kinds: KindSummary[];
  annualCover: AnnualCover;
  churn: ChurnObservation;
  forecast: Forecast;
  mrrDkk: number;
};

type SubRow = {
  userId: string;
  status: "ACTIVE" | "CANCELED" | "INACTIVE" | "TRIALING" | "FREE_MONTH";
  plan: "INDIVIDUAL" | "FAMILY";
  provider: "REEPAY" | "QUICKPAY" | "STRIPE" | "MOBILEPAY_ONLINE" | null;
  providerSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  updatedAt: Date;
};

function kindForMonths(months: number): { kind: EconomyKind; months: 1 | 3 | 12 } {
  if (months >= 8) return { kind: "annual", months: 12 };
  if (months >= 2) return { kind: "quarterly", months: 3 };
  return { kind: "monthly", months: 1 };
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / DAY_MS / MONTH_DAYS);
}

const round = (n: number) => Math.round(n);
const MONTH_LABEL = new Intl.DateTimeFormat("da-DK", { month: "short", year: "numeric", timeZone: "Europe/Copenhagen" });

// Pris og periodelængde pr. bruger fra betalingsudbyderne: MobilePay-trækket
// i vores egen tabel, Stripe live fra Stripes API.
async function loadPricing(subs: SubRow[]) {
  const mobilepay = new Map<string, { priceDkk: number; months: number }>();
  const charges = await prisma.$queryRaw<{ userId: string; ore: number; days: number }[]>`
    SELECT DISTINCT ON (c."userId") c."userId", c."amountOre"::int AS ore,
      GREATEST(1, extract(epoch FROM (c."periodEnd" - c."periodStart")) / 86400)::float AS days
    FROM payment_charges c
    WHERE c.status = ANY(${PAID_CHARGE_STATUSES}::text[])
    ORDER BY c."userId", c."dueDate" DESC`;
  for (const charge of charges) {
    mobilepay.set(charge.userId, { priceDkk: charge.ore / 100, months: Math.max(1, Math.round(charge.days / MONTH_DAYS)) });
  }

  const stripe = new Map<string, { priceDkk: number; months: number }>();
  let stripeLive = false;
  if (isStripeConfigured() && subs.some((s) => s.provider === "STRIPE")) {
    try {
      const remote: StripeSubscription[] = await listStripeSubscriptions();
      for (const sub of remote) {
        const item = sub.items?.data[0];
        const price = item?.price;
        const recurring = price?.recurring;
        if (!item || !price || !recurring || price.unit_amount == null) continue;
        const months = (recurring.interval === "year" ? 12 : 1) * (recurring.interval_count ?? 1);
        const amount = (price.unit_amount * (item.quantity ?? 1)) / 100;
        stripe.set(sub.id, { priceDkk: price.currency === "eur" ? amount * EUR_TO_DKK : amount, months });
      }
      stripeLive = true;
    } catch (error) {
      console.error("Economy: kunne ikke hente Stripe-abonnementer", error);
    }
  }
  return { mobilepay, stripe, stripeLive };
}

function pricedSub(
  sub: SubRow,
  pricing: Awaited<ReturnType<typeof loadPricing>>,
): { months: number; priceDkk: number; estimated: boolean } {
  const found =
    sub.provider === "STRIPE" && sub.providerSubscriptionId
      ? pricing.stripe.get(sub.providerSubscriptionId)
      : pricing.mobilepay.get(sub.userId);
  if (found) return { months: found.months, priceDkk: found.priceDkk, estimated: false };
  const plan = sub.plan === "FAMILY" ? "family" : "serious";
  return { months: 1, priceDkk: SUBSCRIPTION_PRICES_DKK[plan][1], estimated: true };
}

// Afmeldingsprocent: observeret pr. måned, blandet med en forsigtig prior
// (7 % pr. måned, vægtet som 10 observationer), så få data ikke giver
// tilfældige udsving. Længere perioder: sandsynligheden for at afmelde i
// mindst én af månederne frem til næste fornyelse, aldrig over 50 %.
const PRIOR_MONTHLY_RATE = 0.07;
const PRIOR_WEIGHT = 10;

export function baselineChurn(monthlyRate: number): ChurnInput {
  const compound = (months: number) => Math.min(0.5, 1 - Math.pow(1 - monthlyRate, months));
  return { monthly: monthlyRate, quarterly: compound(3), annual: compound(12) };
}

export function buildForecast(subs: LiveSub[], churn: ChurnInput, now: Date): Forecast {
  const horizon = new Date(now.getTime() + 30 * DAY_MS);
  const retention = { monthly: 1 - churn.monthly, quarterly: 1 - churn.quarterly, annual: 1 - churn.annual };
  const sums: Record<EconomyKind, { count: number; amountDkk: number }> = {
    monthly: { count: 0, amountDkk: 0 },
    quarterly: { count: 0, amountDkk: 0 },
    annual: { count: 0, amountDkk: 0 },
  };
  for (const sub of subs) {
    if (!sub.renewing) continue; // opsagte fornyes ikke
    // Månedlige trækkes hver måned; øvrige kun hvis fornyelsen falder i vinduet.
    const renewsInWindow = sub.kind === "monthly" || (sub.periodEnd !== null && sub.periodEnd <= horizon);
    if (!renewsInWindow) continue;
    sums[sub.kind].count += 1;
    sums[sub.kind].amountDkk += sub.priceDkk * retention[sub.kind];
  }
  const total = sums.monthly.amountDkk + sums.quarterly.amountDkk + sums.annual.amountDkk;
  const fmt = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", timeZone: "Europe/Copenhagen" });
  return {
    churn,
    monthly: { count: sums.monthly.count, amountDkk: round(sums.monthly.amountDkk) },
    quarterly: { count: sums.quarterly.count, amountDkk: round(sums.quarterly.amountDkk) },
    annual: { count: sums.annual.count, amountDkk: round(sums.annual.amountDkk) },
    totalDkk: round(total),
    windowLabel: `${fmt.format(now)} – ${fmt.format(horizon)}`,
  };
}

export async function loadLiveSubscriptions(now: Date = new Date()) {
  const rows = (await prisma.subscription.findMany({
    where: { provider: { not: null }, user: { role: "USER" } },
    select: {
      userId: true,
      status: true,
      plan: true,
      provider: true,
      providerSubscriptionId: true,
      currentPeriodEnd: true,
      updatedAt: true,
    },
  })) as SubRow[];
  const pricing = await loadPricing(rows);

  const live: LiveSub[] = [];
  let canceledLast30 = 0;
  let canceledLast90 = 0;
  let endedLast30 = 0;
  let endedLast90 = 0;
  const since30 = now.getTime() - 30 * DAY_MS;
  const since90 = now.getTime() - 90 * DAY_MS;
  for (const row of rows) {
    const isLive =
      (row.status === "ACTIVE" || row.status === "CANCELED") && getSubscriptionTier(row, now) === "SERIOUS";
    if (isLive) {
      const { months, priceDkk, estimated } = pricedSub(row, pricing);
      const { kind, months: bucket } = kindForMonths(months);
      live.push({ kind, months: bucket, priceDkk, estimated, renewing: row.status === "ACTIVE", periodEnd: row.currentPeriodEnd });
    }
    // Afmeldt (opsagt, men løber ud) eller udløbet (havde en periode, er nu inaktiv).
    const lost = row.status === "CANCELED" || (row.status === "INACTIVE" && row.currentPeriodEnd !== null);
    if (lost) {
      const at = row.updatedAt.getTime();
      const isEnded = row.status === "INACTIVE";
      if (at >= since30) {
        if (isEnded) endedLast30 += 1;
        else canceledLast30 += 1;
      }
      if (at >= since90) {
        if (isEnded) endedLast90 += 1;
        else canceledLast90 += 1;
      }
    }
  }
  return { live, canceledLast30, canceledLast90, endedLast30, endedLast90, stripeLive: pricing.stripeLive };
}

export async function getEconomy(now: Date = new Date(), churnOverride?: ChurnInput): Promise<EconomyData> {
  const { live, canceledLast30, canceledLast90, endedLast30, endedLast90, stripeLive } = await loadLiveSubscriptions(now);

  const kinds: KindSummary[] = ECONOMY_KINDS.map(({ kind, months, label }) => {
    const group = live.filter((s) => s.kind === kind);
    const periodTotal = group.reduce((sum, s) => sum + s.priceDkk, 0);
    const canceled = group.filter((s) => !s.renewing);
    return {
      kind,
      label,
      months,
      count: group.length,
      renewing: group.length - canceled.length,
      canceled: canceled.length,
      periodTotalDkk: round(periodTotal),
      perMonthDkk: round(periodTotal / months),
      perYearDkk: round((periodTotal / months) * 12),
      canceledPeriodTotalDkk: round(canceled.reduce((sum, s) => sum + s.priceDkk, 0)),
      estimatedCount: group.filter((s) => s.estimated).length,
    };
  });

  // --- Årsabonnementer: hvor længe er økonomien sikret? --------------------
  const annual = live.filter((s) => s.kind === "annual" && s.periodEnd);
  const ends = annual.map((s) => s.periodEnd as Date);
  const latest = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
  const totalAnnualDkk = annual.reduce((sum, s) => sum + s.priceDkk, 0);
  const weighted = totalAnnualDkk
    ? annual.reduce((sum, s) => sum + s.priceDkk * monthsBetween(now, s.periodEnd as Date), 0) / totalAnnualDkk
    : null;
  const remainingValue = annual.reduce((sum, s) => {
    const left = Math.min(1, monthsBetween(now, s.periodEnd as Date) / 12);
    return sum + s.priceDkk * left;
  }, 0);
  const runwayMonths = latest ? Math.min(24, Math.ceil(monthsBetween(now, latest))) : 0;
  const runway: AnnualCover["runway"] = [];
  for (let i = 0; i < runwayMonths; i += 1) {
    const start = addMonths(now, i);
    const secured = annual.filter((s) => (s.periodEnd as Date) > start).reduce((sum, s) => sum + s.priceDkk / 12, 0);
    runway.push({ label: MONTH_LABEL.format(start), securedDkk: round(secured) });
  }

  // --- Afmelding og forventet indtjening -----------------------------------
  const liveRenewing = live.filter((s) => s.renewing).length;
  const lost30 = canceledLast30 + endedLast30;
  const base30 = liveRenewing + lost30;
  const observed = base30 > 0 ? lost30 / base30 : null;
  const blended = ((observed ?? 0) * base30 + PRIOR_MONTHLY_RATE * PRIOR_WEIGHT) / (base30 + PRIOR_WEIGHT);
  const baseline = baselineChurn(blended);
  const forecast = buildForecast(live, churnOverride ?? baseline, now);

  const mrr = live.reduce((sum, s) => (s.renewing ? sum + s.priceDkk / s.months : sum), 0);

  return {
    generatedAt: now.toISOString(),
    payingNow: live.length,
    stripeLive,
    estimatedSubscriptions: live.filter((s) => s.estimated).length,
    kinds,
    annualCover: {
      latestEnd: latest ? latest.toISOString() : null,
      monthsToLatest: latest ? Math.round(monthsBetween(now, latest) * 10) / 10 : null,
      weightedMonths: weighted === null ? null : Math.round(weighted * 10) / 10,
      remainingValueDkk: round(remainingValue),
      runway,
    },
    churn: {
      liveRenewing,
      canceledLast30,
      endedLast30,
      canceledLast90,
      endedLast90,
      observedMonthlyRate: observed,
      baseline,
      basis:
        base30 < 10
          ? "Få abonnenter: udregningen læner sig op ad en forsigtig standardsats (7 % pr. måned)."
          : "Afmeldinger de seneste 30 dage i forhold til alle betalende, blandet med en forsigtig standardsats.",
    },
    forecast,
    mrrDkk: round(mrr),
  };
}
