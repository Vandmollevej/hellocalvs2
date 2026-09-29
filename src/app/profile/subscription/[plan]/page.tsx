"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { IconCheck, IconStar } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import { TermsSheet } from "@/components/hf/TermsSheet";
import { SUBSCRIPTION_PLAN_TERMS } from "@/lib/terms-hints";
import {
  isSubscriptionPeriod,
  isSubscriptionPlan,
  SUBSCRIPTION_PERIODS,
  type SubscriptionPeriodMonths,
} from "@/lib/subscription-plans";
import { marketPrice, STRIPE_MARKETS, type StripeMarket } from "@/lib/payments/stripe-markets";
import { PaymentMethodBadges } from "@/components/hf/PaymentMethodBadges";

// Egen side pr. abonnement — Seriøs og Seriøs Familie — med tre vandrette
// periodebokse: 1, 3 eller 12 måneder med fuld adgang (docs/DECISIONS.md
// 2026-09-26). Købet går via MobilePay-aftalen, når den er tilsluttet.

// Alt, Seriøs låser op (samme liste som de låste funktioner i appen).
const FEATURE_KEYS = [
  "history",
  "statistics",
  "photoDiary",
  "customize",
  "display",
  "allergens",
  "integrations",
  "subGoals",
  "helloDoc",
] as const;

// Beløb i brugerens markedsvaluta (DKK i Danmark, EUR i Tyskland).
function formatMoney(value: number, currency: "dkk" | "eur") {
  return new Intl.NumberFormat(currency === "eur" ? "de-DE" : "da-DK", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function SubscriptionPlanPage() {
  const { t } = useTranslation();
  const params = useParams<{ plan: string }>();
  const plan = params.plan;
  const [months, setMonths] = useState<SubscriptionPeriodMonths>(12);
  // Bekræftelse af straks-levering og fortrydelsesret (forbrugeraftaleloven,
  // docs/DECISIONS.md 2026-09-25) før køb.
  const [withdrawalAck, setWithdrawalAck] = useState(false);
  const [paymentAvailable, setPaymentAvailable] = useState(false);
  // Stripe (DK: MobilePay, DE: kort/EC) hvis brugerens land er åbent; ellers MobilePay Recurring.
  const [useStripe, setUseStripe] = useState(false);
  const [market, setMarket] = useState<StripeMarket | null>(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dummy-visning uden Stripe-nøgle: /profile/subscription/serious?preview=DK eller =DE.
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    // Periode valgt i forsidens betalings-ark (?months=1|3|12).
    const presetMonths = Number(query.get("months"));
    if (isSubscriptionPeriod(presetMonths)) queueMicrotask(() => setMonths(presetMonths));
    const previewCountry = query.get("preview")?.toUpperCase();
    if (previewCountry === "DK" || previewCountry === "DE") {
      queueMicrotask(() => {
        setPreview(true);
        setUseStripe(true);
        setMarket(STRIPE_MARKETS[previewCountry]);
        setPaymentAvailable(true);
      });
      return;
    }
    fetch("/api/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { mobilePayAvailable?: boolean; stripeAvailable?: boolean; paymentMarket?: StripeMarket | null } | null) => {
        setUseStripe(Boolean(json?.stripeAvailable));
        setMarket(json?.paymentMarket ?? null);
        setPaymentAvailable(Boolean(json?.stripeAvailable || json?.mobilePayAvailable));
      })
      .catch(() => setPaymentAvailable(false));
  }, []);

  if (!isSubscriptionPlan(plan)) notFound();

  const currency = market?.currency ?? "dkk";
  const priceFor = (period: SubscriptionPeriodMonths) => marketPrice(market, plan, period);
  const monthlyBase = priceFor(1);
  const price = priceFor(months);

  async function buy() {
    if (!paymentAvailable || !withdrawalAck || buying) return;
    if (preview) return; // dummy: ingen rigtig betaling
    setBuying(true);
    setError(null);
    try {
      const res = await fetch(useStripe ? "/api/payments/stripe/checkout" : "/api/payments/mobilepay/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, months, withdrawalAck: true }),
      });
      const json = (await res.json().catch(() => null)) as { confirmationUrl?: string; message?: string } | null;
      if (!res.ok || !json?.confirmationUrl) {
        setError(json?.message ?? t("subscription.planPage.buyError"));
        setBuying(false);
        return;
      }
      window.location.href = json.confirmationUrl;
    } catch {
      setError(t("subscription.planPage.buyError"));
      setBuying(false);
    }
  }

  return (
    <HfScreen
      title={t(`subscription.plans.${plan}.title`)}
      footer={
        <div className="flex flex-col gap-2">
          <TermsSheet hint={SUBSCRIPTION_PLAN_TERMS[plan]} />
          <Toggle
            checked={withdrawalAck}
            onChange={setWithdrawalAck}
            label={t("subscription.seriousPlan.withdrawalConsent")}
          />
          {market && <PaymentMethodBadges country={market.country} />}
          <button
            type="button"
            onClick={buy}
            disabled={!paymentAvailable || !withdrawalAck || buying}
            aria-busy={buying}
            className="hf-control hf-btn-primary w-full disabled:opacity-40"
          >
            {t("subscription.planPage.buyCta")}
          </button>
          {error && <p className="hf-type-caption text-center text-hf-red-dark">{error}</p>}
          {!paymentAvailable && (
            <p className="text-text-secondary hf-type-caption text-center">{t("subscription.seriousPlan.upgradeUnavailable")}</p>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        <div
          className="rounded-lg p-4"
          style={{ background: "var(--hf-color-brand)", color: "var(--hf-color-white)" }}
        >
          <div className="flex items-center gap-2">
            <IconStar size={18} aria-hidden="true" />
            <p className="hf-type-section-title">{t(`subscription.plans.${plan}.title`)}</p>
          </div>
          <p className="hf-type-body mt-2 opacity-90">{t(`subscription.plans.${plan}.description`)}</p>
        </div>

        <div className="rounded-lg bg-hf-tan p-4">
          <p className="hf-type-body hf-type-strong">{t("subscription.planPage.includesHeading")}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {FEATURE_KEYS.map((key) => (
              <li key={key} className="hf-type-body flex items-start gap-2">
                <IconCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>{t(`subscription.features.${key}`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <h2 className="hf-type-section-title mt-2">{t("subscription.planPage.periodHeading")}</h2>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("subscription.planPage.periodHeading")}>
          {SUBSCRIPTION_PERIODS.map((period) => {
            const total = priceFor(period);
            const perMonth = total / period;
            const savingPct = Math.round((1 - total / (monthlyBase * period)) * 100);
            const selected = months === period;
            return (
              <button
                key={period}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMonths(period)}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border-2 px-1 py-3 text-center ${
                  selected ? "border-hf-black bg-hf-tan" : "border-transparent bg-hf-white"
                }`}
              >
                <span className="hf-type-small hf-type-strong">{t(`subscription.planPage.period.${period}`)}</span>
                <span className="hf-type-section-title">{t("subscription.planPage.price", { price: formatMoney(total, currency) })}</span>
                <span className="text-text-secondary hf-type-caption">
                  {t("subscription.planPage.perMonth", { price: formatMoney(Math.round(perMonth * (currency === "eur" ? 100 : 1)) / (currency === "eur" ? 100 : 1), currency) })}
                </span>
                {savingPct > 0 && (
                  <span className="hf-type-caption hf-type-strong rounded-full bg-hf-green px-2 py-0.5 text-hf-white">
                    {t("subscription.planPage.save", { pct: savingPct })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* Pris og bindingsperiode for den valgte periode står under boksene,
            så det er tydeligt, hvad man betaler og binder sig til (opgave 25). */}
        <div className="rounded-lg bg-hf-tan p-4" aria-live="polite">
          <p className="hf-type-section-title">
            {t("subscription.planPage.summaryPrice", {
              price: formatMoney(price, currency),
              unit: t(`subscription.planPage.unit.${months}`),
            })}
          </p>
          <p className="hf-type-body mt-1">
            {t("subscription.planPage.summaryBinding", {
              period: t(`subscription.planPage.bindingPeriod.${months}`),
            })}
          </p>
        </div>
        <p className="text-text-secondary hf-type-caption">{t("subscription.planPage.renewalNote")}</p>
      </div>
    </HfScreen>
  );
}
