"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconX } from "@tabler/icons-react";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { Toggle } from "@/components/ui/Toggle";
import { PaymentMethodBadges } from "@/components/hf/PaymentMethodBadges";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { LandingPlan } from "@/lib/landing-content";
import {
  SUBSCRIPTION_PERIODS,
  SUBSCRIPTION_PRICES_DKK,
  type SubscriptionPeriodMonths,
  type SubscriptionPlan,
} from "@/lib/subscription-plans";

// Planerne på forsiden. "Vælg" på Seriøs/Seriøs Familie åbner et bundark med
// periode og betaling; uden konto sendes man først til oprettelse og lander
// derefter på abonnementssiden med samme plan og periode valgt.

const PERIOD_LABEL: Record<SubscriptionPeriodMonths, string> = { 1: "1 måned", 3: "3 måneder", 12: "1 år" };

function kr(value: number) {
  return `${value.toLocaleString("da-DK")} kr.`;
}

function CheckoutSheet({ plan, name, onClose }: { plan: SubscriptionPlan; name: string; onClose: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [months, setMonths] = useState<SubscriptionPeriodMonths>(12);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prices = SUBSCRIPTION_PRICES_DKK[plan];
  const planPage = `/profile/subscription/${plan}?months=${months}`;

  async function pay() {
    if (!ack || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, months, withdrawalAck: true }),
      });
      if (res.status === 401) {
        router.push(`/signup?next=${encodeURIComponent(planPage)}`);
        return;
      }
      const json = (await res.json().catch(() => null)) as { confirmationUrl?: string } | null;
      if (res.ok && json?.confirmationUrl) {
        window.location.href = json.confirmationUrl;
        return;
      }
      // Stripe ikke åben i brugerens land o.l.: abonnementssiden vælger selv betalingen.
      router.push(planPage);
    } catch {
      setError("Betalingen svarer ikke lige nu. Prøv igen om lidt.");
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      onClose={onClose}
      title={name}
      footer={
        <div className="flex flex-col gap-3">
          <Toggle checked={ack} onChange={setAck} label={t("subscription.seriousPlan.withdrawalConsent")} />
          <PaymentMethodBadges country="DK" />
          <button
            type="button"
            onClick={pay}
            disabled={!ack || busy}
            aria-busy={busy}
            className="hf-control hf-btn-primary w-full"
          >
            Fortsæt til betaling — {kr(prices[months])}
          </button>
          {error && <p className="hf-type-caption text-center text-hf-red-dark">{error}</p>}
          <p className="hf-type-caption text-center text-text-secondary">
            Har du ikke en konto, opretter du den først — derefter kommer du direkte til betalingen.
          </p>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-4 pb-2">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Periode">
          {SUBSCRIPTION_PERIODS.map((period) => {
            const total = prices[period];
            const saving = Math.round((1 - total / (prices[1] * period)) * 100);
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
                <span className="hf-type-small hf-type-strong">{PERIOD_LABEL[period]}</span>
                <span className="hf-type-section-title">{kr(total)}</span>
                <span className="hf-type-caption text-text-secondary">{kr(Math.round(total / period))}/md.</span>
                {saving > 0 && (
                  <span className="hf-type-caption hf-type-strong rounded-full bg-hf-green px-2 py-0.5 text-hf-white">
                    Spar {saving} %
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="hf-type-body rounded-lg bg-hf-tan p-4">
          Du betaler {kr(prices[months])} for {PERIOD_LABEL[months]}. Abonnementet fornyes automatisk og kan opsiges når
          som helst inden næste periode.
        </p>
      </div>
    </BottomSheet>
  );
}

export function planAnchorId(plan: SubscriptionPlan | null) {
  return `plan-${plan ?? "free"}`;
}

// Kompakt oversigt i tre kolonner øverst på abonnementssiden: navn og pris,
// og et tryk ruller ned til planens fulde kort (LandingPlans nedenfor).
export function PlanOverview({
  plans,
  currentPlan,
}: {
  plans: LandingPlan[];
  currentPlan?: SubscriptionPlan | "free";
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {plans.map((p) => {
        const isCurrent = currentPlan === (p.plan ?? "free");
        return (
          <button
            key={p.name}
            type="button"
            onClick={() =>
              document.getElementById(planAnchorId(p.plan))?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-3 text-center ${
              p.plan ? "bg-gradient-to-br from-hf-green to-hf-green-dark text-hf-white" : "bg-hf-white text-hf-black"
            } ${isCurrent ? "ring-4 ring-hf-green-light" : ""}`}
          >
            <span className="hf-type-small hf-type-strong">{p.name}</span>
            <span className="hf-type-title">{p.price}</span>
            <span className="hf-type-micro opacity-75">{p.note}</span>
            <span className="hf-type-micro hf-type-strong mt-1 underline underline-offset-2">
              {isCurrent ? "Din plan" : "Se mere"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// currentPlan sættes kun inde i appen (abonnementssiden): brugerens egen plan
// markeres "Din plan", og Gratis har ingen "Kom i gang", da kontoen findes.
export function LandingPlans({
  plans,
  currentPlan,
}: {
  plans: LandingPlan[];
  currentPlan?: SubscriptionPlan | "free";
}) {
  const router = useRouter();
  const [open, setOpen] = useState<{ plan: SubscriptionPlan; name: string } | null>(null);

  return (
    <>
      <div className="grid items-start gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const key = p.plan;
          const isCurrent = currentPlan !== undefined && currentPlan === (key ?? "free");
          return (
            <div
              key={p.name}
              id={planAnchorId(key)}
              className={`scroll-mt-4 overflow-hidden rounded-3xl bg-hf-white shadow-[0_24px_60px_-28px_rgba(0,0,0,0.35)] ${
                p.featured ? "md:-mt-4 ring-4 ring-hf-green-light" : ""
              }`}
            >
              <div className="bg-gradient-to-br from-hf-green to-hf-green-dark px-6 py-8 text-center text-hf-white">
                {p.featured && (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-hf-green-light">Mest valgt</p>
                )}
                <p className="text-2xl font-bold">{p.name}</p>
                <p className="mt-3 text-5xl font-light">{p.price}</p>
                <p className="mt-1 text-sm text-hf-white/75">{p.note}</p>
              </div>
              <ul className="flex flex-col gap-3 px-8 py-6">
                {p.items.map((item) => (
                  <li key={item.text} className="flex items-center justify-between gap-3 text-[15px]">
                    <span className={item.included ? "text-hf-black" : "text-text-secondary"}>{item.text}</span>
                    {item.included ? (
                      <IconCheck size={18} className="shrink-0 text-hf-green" aria-label="Inkluderet" />
                    ) : (
                      <IconX size={18} className="shrink-0 text-hf-red-dark" aria-label="Ikke inkluderet" />
                    )}
                  </li>
                ))}
              </ul>
              <div className="px-8 pb-8 text-center">
                {isCurrent ? (
                  <span className="bg-hf-tan text-hf-black mk-btn mk-btn--upper">
                    Din plan
                  </span>
                ) : currentPlan !== undefined && !key ? null : (
                  <button
                    type="button"
                    onClick={() => (key ? setOpen({ plan: key, name: p.name }) : router.push("/signup"))}
                    className="mk-btn mk-btn--dark mk-btn--upper"
                  >
                    {key ? "Vælg" : "Kom i gang"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {open && <CheckoutSheet plan={open.plan} name={open.name} onClose={() => setOpen(null)} />}
    </>
  );
}
