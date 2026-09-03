"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { useTranslation } from "@/i18n/LocaleProvider";

// Betaling (docs/DECISIONS.md 2026-09-02): databasen (Subscription,
// PaymentMethod) og denne side er forberedt til Visa, Apple Pay, Google Pay
// og MobilePay — men UDBYDER-UAFHÆNGIGT, fordi der endnu ikke er en
// indløsningsaftale. Siden viser derfor status og de fire understøttede
// metoder som information, men indeholder BEVIDST ingen felter til at
// indtaste kortnumre direkte: rigtig kortindtastning skal altid gå gennem
// en PSP's egne sikre/hostede felter (fx Reepay/Quickpay/Stripe), aldrig
// rå felter i denne kode — se docs/DECISIONS.md for hvorfor.

function statusLabels(t: (key: string) => string): Record<string, string> {
  return {
    INACTIVE: t("payment.status.inactive"),
    ACTIVE: t("payment.status.active"),
    TRIALING: t("payment.status.trialing"),
    FREE_MONTH: t("payment.status.freeMonth"),
    CANCELED: t("payment.status.canceled"),
  };
}

type Subscription = { status: string; freeMonthsRemaining: number; currentPeriodEnd?: string | null };
type PaymentMethod = { id: string; brand: string; last4: string | null };

export default function PaymentPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    fetch("/api/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setSubscription(data.subscription);
        setPaymentMethods(data.paymentMethods);
      });
  }, []);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title={t("payment.title")} onBack={() => router.back()} />

      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-[8px] p-4" style={{ background: "var(--hf-color-brand)" }}>
          <p className="hf-type-body-sm font-bold text-hf-white">
            {statusLabels(t)[subscription?.status ?? "INACTIVE"]}
          </p>
          {subscription && subscription.freeMonthsRemaining > 0 && (
            <p className="hf-type-caption mt-1 text-hf-white opacity-90">
              {t("payment.freeMonthsRemaining", { count: subscription.freeMonthsRemaining })}
            </p>
          )}
        </div>

        <div>
          <p className="hf-type-section-title">{t("payment.paymentMethodsTitle")}</p>
          {paymentMethods.length === 0 ? (
            <div className="mt-2 rounded-[8px] bg-hf-tan p-4 text-center">
              <p className="hf-type-body-sm font-bold text-hf-black">
                {t("payment.noPaymentMethod")}
              </p>
              <p className="hf-type-caption mt-1 text-hf-black opacity-60">
                {t("payment.noPaymentMethodHint")}
              </p>
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              {paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className="flex items-center justify-between rounded-[8px] border p-3"
                  style={{ borderColor: "var(--hf-color-line)" }}
                >
                  <span className="hf-type-body">{pm.brand}</span>
                  {pm.last4 && <span className="hf-type-body-sm opacity-70">•••• {pm.last4}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="hf-type-section-title">{t("payment.supportedMethodsTitle")}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {["Visa", "Apple Pay", "Google Pay", "MobilePay"].map((method) => (
              <div
                key={method}
                className="rounded-[8px] border p-3 text-center opacity-60"
                style={{ borderColor: "var(--hf-color-line)" }}
              >
                <span className="hf-type-body-sm">{method}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
