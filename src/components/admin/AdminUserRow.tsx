"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconCoins, IconLockOpen, IconUserOff } from "@tabler/icons-react";

export type AdminUserRowData = {
  id: string;
  displayName: string;
  createdAt: string;
  pointsBalance: number;
  subscriptionStatus: string;
  wantsUpdateNewsEmails: boolean;
  wantsAdviceEmails: boolean;
  wantsPartnerOffersEmails: boolean;
  forgottenAt: string | null;
  // Brugerens egen "Luk konto" — kan genåbnes ved login i 3 måneder.
  closedAt: string | null;
  // Dyrefoder-spærringen (docs/DECISIONS.md 2026-10-07): kontoen er spærret og kan
  // ikke logge ind, før en admin ophæver spærringen.
  blockedAt: string | null;
  blockedReason: string | null;
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
  const [busy, setBusy] = useState<"forget" | "unblock" | null>(null);

  async function unblock() {
    if (!confirm(`Ophæv spærringen af ${user.displayName}? Brugeren kan logge ind igen og har én advarsel tilbage.`)) return;
    setBusy("unblock");
    try {
      const res = await fetch(`/api/admin/users/${user.id}/unblock`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function forget() {
    if (!confirm(`Anonymisér ${user.displayName}? Dette kan ikke fortrydes.`)) return;
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
      <tr className="border-b border-hf-tan-dark text-text-muted">
        <td className="py-2 pr-3">Slettet bruger</td>
        <td className="py-2 pr-3" colSpan={5}>
          Anonymiseret {new Date(user.forgottenAt).toLocaleDateString("da-DK")}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-hf-tan-dark">
      <td className="py-2 pr-3">
        <p className="hf-type-strong text-hf-black">{user.displayName}</p>
        {user.blockedAt && (
          <p className="hf-type-small mt-1">
            <span className="rounded-full bg-hf-red-dark px-2 py-0.5 text-hf-white">Spærret</span>{" "}
            <span className="text-hf-red-dark">
              {new Date(user.blockedAt).toLocaleDateString("da-DK")}
              {user.blockedReason ? ` — ${user.blockedReason}` : ""}
            </span>
          </p>
        )}
        {user.closedAt && (
          <p className="hf-type-small text-text-secondary">
            Lukket {new Date(user.closedAt).toLocaleDateString("da-DK")} — anonymiseres efter 3 måneder
          </p>
        )}
      </td>
      <td className="py-2 pr-3">
        <span
          className={`hf-type-small rounded-full px-2 py-0.5 ${
            isActive ? "bg-hf-green-dark text-hf-white" : "bg-hf-tan text-text-secondary"
          }`}
        >
          {SUBSCRIPTION_LABELS[user.subscriptionStatus] ?? user.subscriptionStatus}
        </span>
      </td>
      <td className="hf-type-body py-2 pr-3 text-text-secondary">{user.pointsBalance}</td>
      <td className="hf-type-small py-2 pr-3 text-text-secondary">
        {[
          user.wantsUpdateNewsEmails && "Nyheder",
          user.wantsAdviceEmails && "Gode råd",
          user.wantsPartnerOffersEmails && "Partnertilbud",
        ]
          .filter(Boolean)
          .join(", ") || "Ingen"}
      </td>
      <td className="hf-type-small py-2 pr-3 text-text-muted">
        {new Date(user.createdAt).toLocaleDateString("da-DK")}
      </td>
      <td className="py-2">
        <div className="flex gap-2">
          {user.blockedAt && (
            <button
              type="button"
              onClick={unblock}
              disabled={busy !== null}
              title="Ophæv spærring"
              className="flex h-8 w-8 items-center justify-center rounded-full text-hf-green-dark hover:bg-hf-tan disabled:opacity-50"
            >
              <IconLockOpen size={16} />
            </button>
          )}
          {!user.closedAt && (
            <Link
              href={`/admin/users/points?user=${user.id}`}
              title="Tildel points"
              className="flex h-8 w-8 items-center justify-center rounded-full text-hf-green-dark hover:bg-hf-tan"
            >
              <IconCoins size={16} />
            </Link>
          )}
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
