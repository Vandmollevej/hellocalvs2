"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

type SyncState = "checking" | "active" | "pending" | "none";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

// Hertil sender Stripe Checkout brugeren tilbage (success_url med session_id).
// Abonnementet kobles med det samme via sessionen; kommer bekræftelsen sent,
// spørges igen hvert 3. sekund.
export default function StripeReturnPage() {
  const { t } = useTranslation();
  const [state, setState] = useState<SyncState>("checking");

  useEffect(() => {
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sessionId = new URLSearchParams(window.location.search).get("session_id");

    async function check() {
      polls += 1;
      const res = await fetch("/api/payments/stripe/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => null);
      const json = res?.ok ? ((await res.json()) as { state: "active" | "pending" | "none" }) : null;
      if (cancelled) return;
      const next = json?.state ?? "pending";
      setState(next);
      if (next === "pending" && polls < MAX_POLLS) timer = setTimeout(check, POLL_INTERVAL_MS);
    }

    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <HfScreen title={t("payment.stripeReturn.title")}>
      <div className="flex flex-col items-center gap-6 p-6 text-center">
        <p className="hf-type-body">{t(`payment.stripeReturn.${state}`)}</p>
        {state !== "checking" && (
          <Link href="/settings/payment" className="hf-control hf-btn-primary w-full">
            {t("payment.stripeReturn.back")}
          </Link>
        )}
      </div>
    </HfScreen>
  );
}
