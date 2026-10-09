"use client";

import { useCallback, useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

type PendingApproval = { id: string; device: string; country: string | null; createdAt: string };

// Åbnes fra push-notifikationen på en enhed, hvor brugeren allerede er logget
// ind. Viser ventende logins fra nye enheder med Godkend / Afvis.
export default function ApproveLoginPage() {
  const { t } = useTranslation();
  const [approvals, setApprovals] = useState<PendingApproval[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/login-approval/pending");
      if (response.status === 401) {
        window.location.assign("/login?next=/approve-login");
        return;
      }
      const data = await response.json();
      setApprovals(data.approvals ?? []);
    } catch {
      setError(t("loginApproval.error.failed"));
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- henter ventende logins ved visning
    void load();
    const timer = window.setInterval(load, 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function respond(id: string, approve: boolean) {
    setError(null);
    const response = await fetch("/api/auth/login-approval/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId: id, approve }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message ?? t("loginApproval.error.failed"));
    }
    void load();
  }

  return (
    <HfScreen title={t("loginApproval.approveTitle")}>
      <div className="flex flex-col gap-4 p-4">
        {approvals && approvals.length === 0 && (
          <p className="hf-type-body text-text-secondary text-center">{t("loginApproval.nonePending")}</p>
        )}
        {approvals?.map((approval) => (
          <div key={approval.id} className="flex flex-col gap-3 rounded-xl bg-hf-white p-4">
            <p className="hf-type-body hf-type-strong">{t("loginApproval.question", { device: approval.device })}</p>
            {approval.country && <p className="hf-type-caption text-text-secondary">{approval.country}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => respond(approval.id, false)}
                className="hf-control flex-1 rounded-full border border-hf-gray-border"
              >
                {t("loginApproval.deny")}
              </button>
              <button type="button" onClick={() => respond(approval.id, true)} className="hf-control hf-btn-primary flex-1">
                {t("loginApproval.approve")}
              </button>
            </div>
          </div>
        ))}
        {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}
      </div>
    </HfScreen>
  );
}
