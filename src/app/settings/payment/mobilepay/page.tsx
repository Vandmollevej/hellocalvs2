"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

type SyncState = "checking" | "active" | "pending" | "none";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 40;

// Hertil sender MobilePay brugeren tilbage efter godkendelse (merchantRedirectUrl).
// Status hentes fra MobilePay med det samme og derefter hvert 3. sekund, så
// længe aftalen afventer godkendelse.
export default function MobilePayReturnPage() {
  const { t } = useTranslation();
  const [state, setState] = useState<SyncState>("checking");

  useEffect(() => {
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      polls += 1;
      const res = await fetch("/api/payments/mobilepay/sync", { method: "POST" }).catch(() => null);
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
    <HfScreen title={t("payment.mobilePayReturn.title")}>
      <div className="flex flex-col items-center gap-6 p-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/payment/mobilepay.svg" alt="MobilePay" className="h-16 w-16" />
        <p className="hf-type-body">{t(`payment.mobilePayReturn.${state}`)}</p>
        {state !== "checking" && (
          <Link href="/settings/payment" className="hf-btn-primary hf-type-button h-12 w-full">
            {t("payment.mobilePayReturn.back")}
          </Link>
        )}
      </div>
    </HfScreen>
  );
}
