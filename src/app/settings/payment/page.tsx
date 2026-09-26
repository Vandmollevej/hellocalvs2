"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

// Betaling (docs/DECISIONS.md 2026-09-26): MobilePay er koblet på via Vipps
// MobilePay Recurring — brugeren godkender aftalen i MobilePay-appen, og
// Hello Cal gemmer kun aftale-id'et. Kortnumre indtastes aldrig her.

type Subscription = {
  status: string;
  freeMonthsRemaining: number;
  currentPeriodEnd?: string | null;
};
type PaymentMethod = { id: string; brand: string; last4: string | null };
type SubscriptionResponse = {
  subscription: Subscription | null;
  paymentMethods: PaymentMethod[];
  mobilePayAvailable: boolean;
  mobilePayPending: boolean;
};

const SUPPORTED_METHODS = [
  { id: "visa", label: "Visa", logo: "/payment/visa.svg", className: "h-14" },
  { id: "applepay", label: "Apple Pay", logo: "/payment/applepay.svg", className: "h-12" },
  { id: "googlepay", label: "Google Pay", logo: "/payment/googlepay.svg", className: "h-12" },
  { id: "mobilepay", label: "MobilePay", logo: "/payment/mobilepay.svg", className: "h-7" },
];

function MobilePayMark() {
  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/payment/mobilepay.svg" alt="" className="h-7 w-7" />
      <span className="hf-type-body">MobilePay</span>
    </span>
  );
}

export default function PaymentPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<SubscriptionResponse | null>(null);
  const [stopping, setStopping] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setData(json);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function stopAgreement() {
    setStopping(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/mobilepay/cancel", { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.message ?? t("payment.stopError"));
        return;
      }
      setConfirmStop(false);
      load();
    } finally {
      setStopping(false);
    }
  }

  const subscription = data?.subscription ?? null;
  const status = subscription?.status ?? "INACTIVE";
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("da-DK")
    : null;
  const mobilePayMethod = data?.paymentMethods.find((pm) => pm.brand === "MOBILEPAY") ?? null;
  const otherMethods = data?.paymentMethods.filter((pm) => pm.brand !== "MOBILEPAY") ?? [];

  const statusDetail =
    status === "ACTIVE" && periodEnd
      ? t("payment.nextPayment", { date: periodEnd })
      : status === "CANCELED" && periodEnd
        ? t("payment.canceledUntil", { date: periodEnd })
        : null;

  return (
    <HfScreen title={t("payment.title")}>
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-[8px] p-4" style={{ background: "var(--hf-black)" }}>
          <p className="hf-type-body" style={{ color: "var(--hf-color-white)" }}>
            {t(`payment.status.${statusKey(status)}`)}
          </p>
          {statusDetail && (
            <p className="hf-type-caption mt-1 opacity-90" style={{ color: "var(--hf-color-white)" }}>
              {statusDetail}
            </p>
          )}
          {subscription && subscription.freeMonthsRemaining > 0 && (
            <p className="hf-type-caption mt-1 opacity-90" style={{ color: "var(--hf-color-white)" }}>
              {t("payment.freeMonthsRemaining", { count: subscription.freeMonthsRemaining })}
            </p>
          )}
        </div>

        <div>
          <p className="hf-type-section-title">{t("payment.paymentMethodsTitle")}</p>
          <div className="mt-2 flex flex-col gap-2">
            {mobilePayMethod && (
              <div
                className="flex flex-col gap-3 rounded-[8px] border p-3"
                style={{ borderColor: "var(--hf-color-line)" }}
              >
                <div className="flex items-center justify-between">
                  <MobilePayMark />
                  <span className="hf-type-caption opacity-70">{t("payment.mobilePayAgreement")}</span>
                </div>
                {confirmStop ? (
                  <div className="flex flex-col gap-2">
                    <p className="hf-type-caption opacity-70">
                      {periodEnd ? t("payment.stopConfirmUntil", { date: periodEnd }) : t("payment.stopConfirm")}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmStop(false)}
                        className="hf-btn-secondary hf-type-button h-12 flex-1"
                        disabled={stopping}
                      >
                        {t("payment.keepAgreement")}
                      </button>
                      <button
                        type="button"
                        onClick={stopAgreement}
                        className="hf-btn-primary hf-type-button h-12 flex-1 disabled:opacity-40"
                        disabled={stopping}
                      >
                        {stopping ? t("payment.stopping") : t("payment.stopAgreement")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmStop(true)}
                    className="hf-btn-secondary hf-type-button h-12 w-full"
                  >
                    {t("payment.stopAgreement")}
                  </button>
                )}
                {error && <p className="hf-type-caption">{error}</p>}
              </div>
            )}

            {otherMethods.map((pm) => (
              <div
                key={pm.id}
                className="flex items-center justify-between rounded-[8px] border p-3"
                style={{ borderColor: "var(--hf-color-line)" }}
              >
                <span className="hf-type-body">{pm.brand}</span>
                {pm.last4 && <span className="hf-type-body opacity-70">•••• {pm.last4}</span>}
              </div>
            ))}

            {data && !mobilePayMethod && otherMethods.length === 0 && (
              <div className="rounded-[8px] bg-hf-tan p-4 text-center">
                <p className="hf-type-body text-hf-black">
                  {data.mobilePayPending ? t("payment.pendingApproval") : t("payment.noPaymentMethod")}
                </p>
              </div>
            )}

            {data && !mobilePayMethod && !data.mobilePayPending && data.mobilePayAvailable && (
              <Link href="/profile/subscription" className="hf-btn-primary hf-type-button h-12 w-full">
                {t("payment.chooseSubscription")}
              </Link>
            )}
          </div>
        </div>

        <div>
          <p className="hf-type-section-title">{t("payment.supportedMethodsTitle")}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SUPPORTED_METHODS.map((method) => (
              <div
                key={method.id}
                className="flex h-16 items-center justify-center gap-2 rounded-[8px] border bg-hf-white"
                style={{ borderColor: "var(--hf-color-line)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={method.logo} alt={method.label} className={`${method.className} w-auto`} />
                {method.id === "mobilepay" && <span className="hf-type-body">MobilePay</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </HfScreen>
  );
}

function statusKey(status: string) {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "TRIALING":
      return "trialing";
    case "FREE_MONTH":
      return "freeMonth";
    case "CANCELED":
      return "canceled";
    default:
      return "inactive";
  }
}
