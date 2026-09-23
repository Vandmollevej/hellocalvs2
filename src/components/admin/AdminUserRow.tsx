"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconUserOff } from "@tabler/icons-react";

export type AdminUserRowData = {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
  pointsBalance: number;
  subscriptionStatus: string;
  wantsUpdateNewsEmails: boolean;
  wantsAdviceEmails: boolean;
  wantsPartnerOffersEmails: boolean;
  forgottenAt: string | null;
};

const SUBSCRIPTION_LABELS: Record<string, string> = {
  INACTIVE: "Ikke aktiv",
  ACTIVE: "Aktiv",
  TRIALING: "Prøveperiode",
  FREE_MONTH: "Gratis måned",
  CANCELED: "Opsagt",
};

export function AdminUserRow({ user }: { user: AdminUserRowData }) {
  const router = useRouter();
  // "Log ind som bruger" er fjernet (docs/PRIVACY.md, docs/DECISIONS.md
  // 2026-09-23): Support ser kun det, brugeren selv giver adgang til.
  const [busy, setBusy] = useState<"forget" | null>(null);

  async function forget() {
    if (!confirm(`Anonymisér ${user.displayName} (${user.email})? Dette kan ikke fortrydes.`)) return;
    setBusy("forget");
    try {
      const res = await fetch(`/api/admin/users/${user.id}/forget`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const isActive = user.subscriptionStatus === "ACTIVE" || user.subscriptionStatus === "FREE_MONTH";

  if (user.forgottenAt) {
    return (
      <tr className="border-b border-border-strong text-text-muted">
        <td className="py-2 pr-3">Slettet bruger</td>
        <td className="py-2 pr-3" colSpan={5}>
          Anonymiseret {new Date(user.forgottenAt).toLocaleDateString("da-DK")}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border-strong">
      <td className="py-2 pr-3">
        <p className="font-medium text-text-primary">{user.displayName}</p>
        <p className="text-xs text-text-muted">{user.email}</p>
      </td>
      <td className="py-2 pr-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            isActive ? "bg-hf-green-dark text-hf-white" : "bg-hf-tan text-text-secondary"
          }`}
        >
          {SUBSCRIPTION_LABELS[user.subscriptionStatus] ?? user.subscriptionStatus}
        </span>
      </td>
      <td className="py-2 pr-3 text-sm text-text-secondary">{user.pointsBalance}</td>
      <td className="py-2 pr-3 text-xs text-text-secondary">
        {[
          user.wantsUpdateNewsEmails && "Nyheder",
          user.wantsAdviceEmails && "Gode råd",
          user.wantsPartnerOffersEmails && "Partnertilbud",
        ]
          .filter(Boolean)
          .join(", ") || "Ingen"}
      </td>
      <td className="py-2 pr-3 text-xs text-text-muted">
        {new Date(user.createdAt).toLocaleDateString("da-DK")}
      </td>
      <td className="py-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={forget}
            disabled={busy !== null}
            title="Ret til at blive glemt"
            className="flex h-8 w-8 items-center justify-center rounded-full text-hf-red-dark hover:bg-hf-tan disabled:opacity-50"
          >
            <IconUserOff size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}
