"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconArrowRight, IconChevronRight, IconStar } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";

type SubscriptionData = {
  tier: "FREE" | "SERIOUS";
  status: "INACTIVE" | "ACTIVE" | "TRIALING" | "FREE_MONTH" | "CANCELED";
  currentPeriodEnd: string | null;
  pointsBalance: number;
  freeMonthCost: number;
  priceDkk: number;
};

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const router = useRouter();
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
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? t("subscription.loading") : t("subscription.loadError")}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <div className="rounded-lg bg-hf-tan p-4">
            <label htmlFor="gift-code" className="hf-type-body-sm mb-1 block opacity-70">
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
                className="hf-type-body h-11 flex-1 rounded-md bg-hf-white px-3 uppercase tracking-wide"
                disabled={redeeming}
              />
              <button
                type="button"
                onClick={redeemGiftCode}
                disabled={redeeming || !giftCode.trim()}
                aria-label={t("subscription.giftCode.submitAria")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-hf-white disabled:opacity-40"
                style={{ background: "var(--hf-black)" }}
              >
                <IconArrowRight size={20} />
              </button>
            </div>
            {message && <p className="hf-type-caption mt-2">{message}</p>}
          </div>

          <button
            type="button"
            onClick={() => router.push("/profile/points")}
            className="hf-type-body flex h-12 items-center justify-between rounded-lg bg-hf-tan px-4 text-left"
          >
            <span>{t("subscription.redeemPoints")}</span>
            <span className="hf-type-caption opacity-70">
              {t("subscription.redeemPointsHint", { cost: data.freeMonthCost })}
            </span>
          </button>

          <h2 className="hf-type-section-title mt-2">{t("subscription.currentPlan")}</h2>

          <div
            className="rounded-lg p-4"
            style={{
              background: data.tier === "SERIOUS" ? "var(--hf-color-brand)" : "var(--hf-tan)",
              color: data.tier === "SERIOUS" ? "var(--hf-color-white)" : undefined,
            }}
          >
            <div className="flex items-center gap-2">
              {data.tier === "SERIOUS" && <IconStar size={18} />}
              <p className="hf-type-section-title">{t(`subscription.tier.${data.tier === "SERIOUS" ? "serious" : "free"}`)}</p>
            </div>
            {data.tier === "SERIOUS" ? (
              <p className="hf-type-body-sm mt-1 opacity-90">
                {/* Et løbende betalt abonnement fornyes på periodens slutdato; gavekode/
                    gratis måned udløber blot. */}
                {formattedPeriodEnd
                  ? t(
                      data.status === "ACTIVE" || data.status === "TRIALING"
                        ? "subscription.nextPayment"
                        : "subscription.activeUntil",
                      { date: formattedPeriodEnd },
                    )
                  : null}
              </p>
            ) : (
              <p className="hf-type-body-sm mt-1 opacity-80">{t("subscription.freePlan.description")}</p>
            )}
          </div>

          <Link href="/settings/payment" className="hf-btn-secondary hf-type-button h-12 w-full">
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
                <p className="hf-type-body mt-1 opacity-70">{t(`subscription.plans.${plan}.teaser`)}</p>
              </div>
              <IconChevronRight size={20} aria-hidden="true" className="shrink-0 opacity-60" />
            </Link>
          ))}

          <p className="hf-type-caption mt-2 opacity-60">{t("subscription.retentionNote")}</p>

        </div>
      )}
    </HfScreen>
  );
}
