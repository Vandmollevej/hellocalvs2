"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconCreditCard } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { SkeletonCards, SkeletonScreen } from "@/components/hf/Skeleton";
import { useTranslation } from "@/i18n/LocaleProvider";

// Betalingsmetode (docs/DECISIONS.md 2026-10-02): siden findes kun for
// betalende (Indstillinger viser rækken kun til dem) og viser det kort eller
// den wallet, Stripe trækker abonnementet på — Visa/Mastercard/EC-kort med
// sidste 4 cifre og udløb, Apple Pay/Google Pay med kortet bagved, eller
// MobilePay. Kortnumre indtastes aldrig her: "Skift betalingsmetode" åbner
// Stripes kundeportal, og MobilePay Recurring godkendes i MobilePay-appen.

type Subscription = {
  status: string;
  provider?: string | null;
  freeMonthsRemaining: number;
  currentPeriodEnd?: string | null;
};
type PaymentMethod = {
  id: string;
  brand: string;
  provider?: string;
  last4: string | null;
  expiryMonth?: number | null;
  expiryYear?: number | null;
  wallet?: "APPLE_PAY" | "GOOGLE_PAY" | null;
};
type SubscriptionResponse = {
  subscription: Subscription | null;
  paymentMethods: PaymentMethod[];
  mobilePayAvailable: boolean;
  stripeAvailable?: boolean;
  mobilePayPending: boolean;
};

// Små logo-chips nederst (samme størrelse som købssidens PaymentMethodBadges).
const SUPPORTED_METHODS = [
  { id: "visa", label: "Visa", logo: "/payment/visa.svg" },
  { id: "mastercard", label: "Mastercard", logo: "/payment/mastercard.svg" },
  { id: "applepay", label: "Apple Pay", logo: "/payment/applepay.svg" },
  { id: "googlepay", label: "Google Pay", logo: "/payment/googlepay.svg" },
  { id: "mobilepay", label: "MobilePay", logo: "/payment/mobilepay.svg", withName: true },
];

// Ikon for det, Stripe faktisk trækker på (card.brand / card.wallet.type):
// kortmærke som Stripe selv viser det i Checkout. Andre mærker (EC-kort,
// Amex, ukendt) får et neutralt kort-ikon.
const METHOD_LOGOS: Record<string, string> = {
  APPLE_PAY: "/payment/applepay.svg",
  GOOGLE_PAY: "/payment/googlepay.svg",
  MOBILEPAY: "/payment/mobilepay.svg",
  VISA: "/payment/visa.svg",
  MASTERCARD: "/payment/mastercard.svg",
};

function formatExpiry(month?: number | null, year?: number | null) {
  if (!month || !year) return null;
  return `${String(month).padStart(2, "0")}/${String(year).slice(-2)}`;
}

function previewData(kind: string): SubscriptionResponse {
  const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const method: PaymentMethod =
    kind === "DK"
      ? { id: "preview", brand: "MOBILEPAY", provider: "STRIPE", last4: null }
      : kind === "APPLE"
        ? { id: "preview", brand: "VISA", provider: "STRIPE", last4: "4242", expiryMonth: 9, expiryYear: 2027, wallet: "APPLE_PAY" }
        : kind === "GOOGLE"
          ? { id: "preview", brand: "MASTERCARD", provider: "STRIPE", last4: "4444", expiryMonth: 3, expiryYear: 2028, wallet: "GOOGLE_PAY" }
          : { id: "preview", brand: "GIROCARD", provider: "STRIPE", last4: "4242", expiryMonth: 12, expiryYear: 2026 };
  return {
    subscription: { status: "ACTIVE", provider: "STRIPE", freeMonthsRemaining: 0, currentPeriodEnd: end },
    paymentMethods: [method],
    mobilePayAvailable: false,
    stripeAvailable: true,
    mobilePayPending: false,
  };
}

// Kort-ikon i fast ramme (som et lille betalingskort), så Visa, Mastercard,
// wallets og MobilePay fylder det samme i rækken.
function MethodLogo({ kind }: { kind: string }) {
  const logo = METHOD_LOGOS[kind];
  return (
    <span
      className="flex h-8 w-12 shrink-0 items-center justify-center rounded-[6px] border bg-hf-white"
      style={{ borderColor: "var(--hf-color-line)" }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-5 w-auto" />
      ) : (
        <IconCreditCard size={20} className="text-hf-black" aria-hidden="true" />
      )}
    </span>
  );
}

export default function PaymentPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<SubscriptionResponse | null>(null);
  const [stopping, setStopping] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function isPreview() {
    return Boolean(new URLSearchParams(window.location.search).get("preview"));
  }

  function load() {
    // Dummy-visning uden Stripe-nøgle: ?preview=DK (MobilePay), =DE (EC-kort),
    // =APPLE (Apple Pay med Visa bagved) eller =GOOGLE (Google Pay med Mastercard).
    const preview = new URLSearchParams(window.location.search).get("preview")?.toUpperCase();
    if (preview) {
      queueMicrotask(() => setData(previewData(preview)));
      return;
    }
    // refresh=1: status og kort hentes fra Stripe først, så siden viser det
    // kort, der faktisk trækkes på — også lige efter et kortskift i portalen.
    fetch("/api/subscription?refresh=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setData(json);
      });
  }

  useEffect(() => {
    load();
  }, []);

  const subscription = data?.subscription ?? null;
  const status = subscription?.status ?? "INACTIVE";
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("da-DK")
    : null;
  // Stripe-betaling (MobilePay i DK, kort/wallet i DE) og MobilePay Recurring kan begge opsiges her.
  const stripeMethod = data?.paymentMethods.find((pm) => pm.provider === "STRIPE") ?? null;
  const activeMethod =
    stripeMethod ?? data?.paymentMethods.find((pm) => pm.brand === "MOBILEPAY") ?? data?.paymentMethods[0] ?? null;
  const canChangeMethod = Boolean(stripeMethod) && (status === "ACTIVE" || status === "CANCELED");
  const canStop = Boolean(activeMethod) && status === "ACTIVE";

  const stopLabel =
    stripeMethod && stripeMethod.brand !== "MOBILEPAY" ? t("payment.stopSubscription") : t("payment.stopAgreement");

  const statusDetail =
    status === "ACTIVE" && periodEnd
      ? t("payment.nextPayment", { date: periodEnd })
      : status === "CANCELED" && periodEnd
        ? t("payment.canceledUntil", { date: periodEnd })
        : null;

  async function stopAgreement() {
    if (isPreview()) {
      setConfirmStop(false);
      return;
    }
    setStopping(true);
    setError(null);
    try {
      const res = await fetch(stripeMethod ? "/api/payments/stripe/cancel" : "/api/payments/mobilepay/cancel", {
        method: "POST",
      });
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

  async function changeMethod() {
    if (isPreview()) return;
    setOpening(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/stripe/portal", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !json.url) {
        setError(json.message ?? t("payment.changeError"));
        return;
      }
      window.location.assign(json.url);
    } catch {
      setError(t("payment.changeError"));
    } finally {
      setOpening(false);
    }
  }

  // Overskrift + undertekst for det aktive kort/wallet.
  function describeMethod(method: PaymentMethod) {
    const brandLabel = t(`payment.methodLabel.${method.brand}`);
    const card = method.last4 ? t("payment.walletCard", { brand: brandLabel, last4: method.last4 }) : brandLabel;
    const expiry = formatExpiry(method.expiryMonth, method.expiryYear);
    const expires = expiry ? t("payment.expires", { date: expiry }) : null;
    if (method.wallet) {
      return {
        logoKind: method.wallet,
        title: t(`payment.methodLabel.${method.wallet}`),
        caption: [card, expires].filter(Boolean).join(" · "),
      };
    }
    if (method.brand === "MOBILEPAY") {
      return { logoKind: "MOBILEPAY", title: "MobilePay", caption: t("payment.mobilePayAgreement") };
    }
    return { logoKind: method.brand, title: card, caption: expires ?? t("payment.recurringNote") };
  }

  return (
    <HfScreen title={t("payment.title")}>
      {!data ? (
        <SkeletonScreen>
          <SkeletonCards count={2} height={88} />
        </SkeletonScreen>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <div className="rounded-[8px] p-4" style={{ background: "var(--hf-black)" }}>
            <p className="hf-type-body text-hf-white">{t(`payment.status.${statusKey(status)}`)}</p>
            {statusDetail && <p className="hf-type-small mt-1 text-hf-white">{statusDetail}</p>}
            {subscription && subscription.freeMonthsRemaining > 0 && (
              <p className="hf-type-small mt-1 text-hf-white">
                {t("payment.freeMonthsRemaining", { count: subscription.freeMonthsRemaining })}
              </p>
            )}
          </div>

          <div>
            <p className="hf-type-section-title">{t("payment.paymentMethodsTitle")}</p>
            <div className="mt-2 flex flex-col gap-2">
              {activeMethod && (
                <div
                  className="flex flex-col gap-3 rounded-[8px] border p-3"
                  style={{ borderColor: "var(--hf-color-line)" }}
                >
                  {(() => {
                    const described = describeMethod(activeMethod);
                    return (
                      <div className="flex items-center gap-3">
                        <MethodLogo kind={described.logoKind} />
                        <div className="min-w-0 flex-1">
                          <p className="hf-type-body text-hf-black truncate">{described.title}</p>
                          <p className="hf-type-caption truncate">{described.caption}</p>
                        </div>
                      </div>
                    );
                  })()}

                  {canChangeMethod && !confirmStop && (
                    <button
                      type="button"
                      onClick={changeMethod}
                      className="hf-control hf-btn-secondary w-full disabled:opacity-40"
                      disabled={opening}
                    >
                      {opening ? t("payment.opening") : t("payment.changeMethod")}
                    </button>
                  )}

                  {canStop &&
                    (confirmStop ? (
                      <div className="flex flex-col gap-2">
                        <p className="hf-type-caption">
                          {periodEnd ? t("payment.stopConfirmUntil", { date: periodEnd }) : t("payment.stopConfirm")}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmStop(false)}
                            className="hf-control hf-btn-secondary flex-1"
                            disabled={stopping}
                          >
                            {t("payment.keepAgreement")}
                          </button>
                          <button
                            type="button"
                            onClick={stopAgreement}
                            className="hf-control hf-btn-primary flex-1 disabled:opacity-40"
                            disabled={stopping}
                          >
                            {stopping ? t("payment.stopping") : stopLabel}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmStop(true)} className="hf-control hf-btn-text self-start">
                        {stopLabel}
                      </button>
                    ))}
                  {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
                </div>
              )}

              {!activeMethod && (
                <div className="rounded-[8px] bg-hf-tan p-4 text-center">
                  <p className="hf-type-body text-hf-black">
                    {data.mobilePayPending ? t("payment.pendingApproval") : t("payment.noPaymentMethod")}
                  </p>
                </div>
              )}

              {!activeMethod && !data.mobilePayPending && (data.mobilePayAvailable || data.stripeAvailable) && (
                <Link href="/profile/subscription" className="hf-control hf-btn-primary w-full">
                  {t("payment.chooseSubscription")}
                </Link>
              )}
            </div>
          </div>

          <div>
            <p className="hf-type-section-title">{t("payment.supportedMethodsTitle")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {SUPPORTED_METHODS.map((method) => (
                <span
                  key={method.id}
                  className="flex h-10 items-center gap-2 rounded-[8px] border bg-hf-white px-3"
                  style={{ borderColor: "var(--hf-color-line)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={method.logo} alt={method.withName ? "" : method.label} className="h-5 w-auto" />
                  {method.withName && <span className="hf-type-small hf-type-strong">{method.label}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
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
