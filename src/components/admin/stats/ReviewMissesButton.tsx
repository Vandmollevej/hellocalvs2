"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Kører vurderingen af søgninger uden resultat nu (ellers hver nat kl. 03.30).
export function ReviewMissesButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/search-analytics/review", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setMessage(data.message ?? (res.ok ? "Færdig" : "Vurderingen fejlede"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} disabled={busy} className="hf-btn-secondary h-10 px-3 !text-sm">
        {busy ? "Vurderer …" : "Vurdér nye søgninger nu"}
      </button>
      {message && <span className="hf-type-small text-text-secondary">{message}</span>}
    </div>
  );
}
