"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconArrowRight, IconChevronRight, IconStar, IconUsers } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { TermsSheet } from "@/components/hf/TermsSheet";
import { SUBSCRIPTION_OVERVIEW_TERMS } from "@/lib/terms-hints";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SUBSCRIPTION_PLANS, SUBSCRIPTION_PRICES_DKK } from "@/lib/subscription-plans";
import { Skeleton, SkeletonCards, SkeletonScreen } from "@/components/hf/Skeleton";

type SubscriptionData = {
  tier: "FREE" | "SERIOUS";
  status: "INACTIVE" | "ACTIVE" | "TRIALING" | "FREE_MONTH" | "CANCELED";
  currentPeriodEnd: string | null;
  pointsBalance: number;
  freeMonthCost: number;
  priceDkk: number;
  plan: "INDIVIDUAL" | "FAMILY";
  coveredByFamily: boolean;
};

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [giftCode, setGiftCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch("/api/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function redeemGiftCode() {
    if (!giftCode.trim()) return;
    setRedeeming(true);
    setMessage(null);
    try {
      const res = await fetch("/api/subscription/redeem-gift-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: giftCode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.message ?? t("subscription.giftCode.genericError"));
        return;
      }
      setGiftCode("");
      setMessage(
        t("subscription.giftCode.success", {
          date: new Date(json.currentPeriodEnd).toLocaleDateString("da-DK"),
        })
      );
      load();
    } finally {
      setRedeeming(false);
    }
  }

  const formattedPeriodEnd =
    data?.currentPeriodEnd ? new Date(data.currentPeriodEnd).toLocaleDateString("da-DK") : null;

  return (
    <HfScreen title={t("subscription.title")}>
      {loading || !data ? (
        loading ? (
          <SkeletonScreen>
            <div className="hf-card">
              <Skeleton type="body-sm" width="40%" />
              <Skeleton type="field" />
            </div>
            <SkeletonCards count={2} height={140} gap={16} />
          </SkeletonScreen>
        ) : (
          <p className="hf-type-body text-text-secondary p-4 text-center">{t("subscription.loadError")}</p>
        )
      ) : (
        <div className="hf-page">
          <div className="hf-card">
            <label htmlFor="gift-code" className="text-text-secondary hf-type-body block">
              {t("subscription.giftCode.label")}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="gift-code"
                type="text"
                value={giftCode}
                onChange={(event) => setGiftCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") redeemGiftCode();
                }}
                placeholder={t("subscription.giftCode.placeholder")}
                className="hf-field hf-type-body min-w-0 flex-1 rounded-lg bg-hf-white px-4 uppercase tracking-wide"
                disabled={redeeming}
              />
              <button
                type="button"
                onClick={redeemGiftCode}
                disabled={redeeming || !giftCode.trim()}
                aria-label={t("subscription.giftCode.submitAria")}
                className="hf-control hf-btn-primary w-12 shrink-0"
              >
                <IconArrowRight size={20} />
              </button>
            </div>
            {message && <p className="hf-type-caption">{message}</p>}
          </div>

          <Link
            href="/profile/subscription/redeem-points"
            className="hf-card"
            style={{ background: "var(--hf-color-disabled)" }}
          >
            <span className="hf-type-card-title" style={{ color: "var(--hf-color-white)" }}>
              {t("subscription.redeemPoints")}
            </span>
            <span className="hf-type-body" style={{ color: "var(--hf-color-white)" }}>
              {t("subscription.pointsEarned", { balance: data.pointsBalance })}
            </span>
          </Link>

          <h2 className="hf-type-section-title">{t("subscription.currentPlan")}</h2>

          <div className={data.tier === "SERIOUS" ? "hf-card hf-card--brand" : "hf-card"}>
            <div className="flex items-center gap-2">
              {data.tier === "SERIOUS" && <IconStar size={18} />}
              <p className="hf-type-card-title">{t(`subscription.tier.${data.tier === "SERIOUS" ? "serious" : "free"}`)}</p>
            </div>
            {data.tier === "SERIOUS" ? (
              formattedPeriodEnd ? (
                // Et løbende betalt abonnement fornyes på periodens slutdato; gavekode/
                // gratis måned udløber blot.
                <p className="hf-type-body">
                  {t(
                    data.status === "ACTIVE" || data.status === "TRIALING"
                      ? "subscription.nextPayment"
                      : "subscription.activeUntil",
                    { date: formattedPeriodEnd },
                  )}
                </p>
              ) : null
            ) : (
              <p className="hf-type-body">{t("subscription.freePlan.description")}</p>
            )}
          </div>

          {/* Seriøs Familie: invitation, profiler og adgang styres på
              /profile/family (docs/FAMILY.md). */}
          {(data.plan === "FAMILY" || data.coveredByFamily) && (
            <Link
              href="/profile/family"
              className="hf-control-row hf-type-body flex items-center gap-3 rounded-lg bg-hf-tan px-4"
            >
              <IconUsers size={20} aria-hidden="true" />
              <span className="min-w-0 flex-1">{t("family.switcher.manage")}</span>
              <IconChevronRight size={20} aria-hidden="true" className="opacity-60" />
            </Link>
          )}

          <Link href="/settings/payment" className="hf-control hf-btn-secondary w-full">
            {t("subscription.paymentMethods")}
          </Link>

          {/* Seriøs og Seriøs Familie har hver deres side med periodevalg og
              køb (docs/DECISIONS.md 2026-09-26). */}
          <h2 className="hf-type-section-title mt-2">{t("subscription.plansHeading")}</h2>
          {SUBSCRIPTION_PLANS.map((plan) => (
            <Link
              key={plan}
              href={`/profile/subscription/${plan}`}
              className="flex items-center gap-3 rounded-lg border p-4"
              style={{ borderColor: "var(--hf-color-line)" }}
            >
              <div className="min-w-0 flex-1">
                <p className="hf-type-section-title">{t(`subscription.plans.${plan}.title`)}</p>
                <p className="text-text-secondary hf-type-body mt-1">{t(`subscription.plans.${plan}.teaser`)}</p>
                <p className="hf-type-body hf-type-strong mt-1">
                  {t("subscription.planPage.fromPrice", { price: SUBSCRIPTION_PRICES_DKK[plan][1] })}
                </p>
              </div>
              <IconChevronRight size={20} aria-hidden="true" className="shrink-0 opacity-60" />
            </Link>
          ))}

          {/* Vilkår og betingelser står nederst i sidens indhold, ikke i en
              fast footer midt på skærmen. */}
          <div className="mt-2">
            <TermsSheet hint={SUBSCRIPTION_OVERVIEW_TERMS} />
          </div>
        </div>
      )}
    </HfScreen>
  );
}
