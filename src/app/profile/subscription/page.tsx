"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconArrowRight, IconStar } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";

// Ingen betalingsudbyder endnu (docs/DECISIONS.md 2026-09-19); knappen åbnes,
// når betaling er tilsluttet.
const PAYMENT_AVAILABLE = false;

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
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [giftCode, setGiftCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Bekræftelse af straks-levering og fortrydelsesret (forbrugeraftaleloven,
  // docs/DECISIONS.md 2026-09-25) før køb.
  const [withdrawalAck, setWithdrawalAck] = useState(false);

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
        <p className="p-4 text-center text-[14px] text-hf-black opacity-60">
          {loading ? t("subscription.loading") : t("subscription.loadError")}
        </p>
      ) : (
        <div className="hf-page">
          <div className="hf-card">
            <label htmlFor="gift-code" className="hf-type-body-sm block opacity-70">
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
                className="hf-type-body h-12 min-w-0 flex-1 rounded-lg bg-hf-white px-4 uppercase tracking-wide"
                disabled={redeeming}
              />
              <button
                type="button"
                onClick={redeemGiftCode}
                disabled={redeeming || !giftCode.trim()}
                aria-label={t("subscription.giftCode.submitAria")}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-hf-white"
                style={{ background: "var(--hf-black)" }}
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
            <span className="hf-type-body-sm" style={{ color: "var(--hf-color-white)" }}>
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
                <p className="hf-type-body-sm">
                  {t(
                    data.status === "ACTIVE" || data.status === "TRIALING"
                      ? "subscription.nextPayment"
                      : "subscription.activeUntil",
                    { date: formattedPeriodEnd },
                  )}
                </p>
              ) : null
            ) : (
              <p className="hf-type-body-sm">{t("subscription.freePlan.description")}</p>
            )}
          </div>

          <Link href="/settings/payment" className="hf-btn-secondary hf-type-button h-12 w-full">
            {t("subscription.paymentMethods")}
          </Link>

          {data.tier === "FREE" && (
            <div className="hf-card hf-card--outline hf-card--form">
              <div className="hf-stack">
                <p className="hf-type-section-title" style={{ margin: 0 }}>
                  {data.priceDkk} {t("subscription.seriousPlan.priceSuffix")}
                </p>
                <p className="hf-type-body-sm">{t("subscription.seriousPlan.description")}</p>
              </div>
              <Toggle
                checked={withdrawalAck}
                onChange={setWithdrawalAck}
                label={t("subscription.seriousPlan.withdrawalConsent")}
              />
              <div className="hf-stack">
                <button
                  type="button"
                  disabled={!PAYMENT_AVAILABLE || !withdrawalAck}
                  className="hf-btn-primary hf-type-button h-12 w-full px-4 disabled:opacity-40"
                >
                  {t("subscription.seriousPlan.upgradeCta")}
                </button>
                <p className="hf-type-caption">{t("subscription.seriousPlan.upgradeUnavailable")}</p>
              </div>
            </div>
          )}

          <p className="hf-type-caption">{t("subscription.retentionNote")}</p>

        </div>
      )}
    </HfScreen>
  );
}
