"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { FREE_MONTH_COST } from "@/lib/points-constants";

type Transaction = {
  id: string;
  reason: string;
  amount: number;
  createdAt: string;
};

const REASON_LABELS: Record<string, string> = {
  PRODUCT_APPROVED: "Produkt godkendt",
  PRODUCT_INGREDIENTS_BONUS: "Varedeklaration tilføjet",
  PRODUCT_PHOTOS_BONUS: "Billeder fra flere vinkler",
  BUG_REPORT_APPROVED: "Fejlrapport godkendt",
  FRIEND_FORWARD_FULFILLED: "Videresendelse brugt af en ven",
  FRIEND_REFERRAL: "Invitér en ven",
  FREE_MONTH_REDEEMED: "Indløst til gratis måned",
};

export default function PointsPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch("/api/points")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setBalance(data.balance);
        setTransactions(data.transactions);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function redeem() {
    setRedeeming(true);
    setMessage(null);
    try {
      const res = await fetch("/api/points/redeem", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message ?? "Kunne ikke indløse points");
        return;
      }
      setMessage("1 gratis måned er tilføjet dit abonnement!");
      load();
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <ScreenHeader title="Points" onBack={() => router.back()} />

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <div className="rounded-lg p-4 text-center" style={{ background: "var(--hf-color-brand)" }}>
          <p className="hf-type-caption text-hf-white opacity-80">Din saldo</p>
          <p className="hf-type-hero text-hf-white">{balance ?? "…"}</p>
          <p className="hf-type-caption text-hf-white opacity-80">points</p>
        </div>

        <div className="mt-4 rounded-lg border p-4" style={{ borderColor: "var(--hf-color-line)" }}>
          <p className="hf-type-body">
            {FREE_MONTH_COST} points kan indløses til 1 gratis abonnementsmåned. Kræver en gemt
            betalingsmetode under Betaling, så abonnementet fortsætter automatisk bagefter.
          </p>
          <button
            type="button"
            onClick={redeem}
            disabled={redeeming || (balance ?? 0) < FREE_MONTH_COST}
            className="hf-btn-primary hf-type-button mt-3 h-12 w-full disabled:opacity-40"
          >
            {redeeming ? "Indløser…" : `Indløs ${FREE_MONTH_COST} points til 1 gratis måned`}
          </button>
          {message && <p className="hf-type-caption mt-2">{message}</p>}
        </div>

        <h2 className="hf-type-section-title mt-6">Historik</h2>
        {transactions.length === 0 ? (
          <p className="hf-type-body-sm mt-2 opacity-70">Ingen points optjent endnu.</p>
        ) : (
          <div className="mt-2 flex flex-col">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between border-b py-3"
                style={{ borderColor: "var(--hf-color-line)" }}
              >
                <div>
                  <p className="hf-type-body">{REASON_LABELS[tx.reason] ?? tx.reason}</p>
                  <p className="hf-type-caption opacity-70">
                    {new Date(tx.createdAt).toLocaleDateString("da-DK")}
                  </p>
                </div>
                <p className="hf-type-body" style={{ color: tx.amount < 0 ? "var(--hf-color-inactive)" : undefined }}>
                  {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
