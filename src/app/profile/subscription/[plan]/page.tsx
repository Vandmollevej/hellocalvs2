"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { IconCheck, IconStar } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  isSubscriptionPlan,
  SUBSCRIPTION_PERIODS,
  SUBSCRIPTION_PRICES_DKK,
  type SubscriptionPeriodMonths,
} from "@/lib/subscription-plans";

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

function formatDkk(value: number) {
  return value.toLocaleString("da-DK", { maximumFractionDigits: 0 });
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
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { mobilePayAvailable?: boolean } | null) => setPaymentAvailable(Boolean(json?.mobilePayAvailable)))
      .catch(() => setPaymentAvailable(false));
  }, []);

  if (!isSubscriptionPlan(plan)) notFound();

  const prices = SUBSCRIPTION_PRICES_DKK[plan];
  const monthlyBase = prices[1];
  const price = prices[months];

  async function buy() {
    if (!paymentAvailable || !withdrawalAck || buying) return;
    setBuying(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/mobilepay/agreement", {
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
          <Toggle
            checked={withdrawalAck}
            onChange={setWithdrawalAck}
            label={t("subscription.seriousPlan.withdrawalConsent")}
          />
          <button
            type="button"
            onClick={buy}
            disabled={!paymentAvailable || !withdrawalAck || buying}
            aria-busy={buying}
            className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-40"
          >
            {t("subscription.planPage.buyCta", { price: formatDkk(price) })}
          </button>
          {error && <p className="hf-type-caption text-center text-hf-red-dark">{error}</p>}
          {!paymentAvailable && (
            <p className="hf-type-caption text-center opacity-70">{t("subscription.seriousPlan.upgradeUnavailable")}</p>
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
            const total = prices[period];
            const perMonth = Math.round(total / period);
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
                <span className="hf-type-section-title">{t("subscription.planPage.price", { price: formatDkk(total) })}</span>
                <span className="hf-type-caption opacity-70">
                  {t("subscription.planPage.perMonth", { price: formatDkk(perMonth) })}
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
        <p className="hf-type-caption opacity-70">{t("subscription.planPage.renewalNote")}</p>
      </div>
    </HfScreen>
  );
}
