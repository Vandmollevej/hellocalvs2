"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Til/fra og "Ryd log" øverst på admin "Log" (docs/DECISIONS.md 2026-09-28).
export function DebugLogControls({ enabled, total }: { enabled: boolean; total: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/debug-log", init);
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setError("Kunne ikke gemme — prøv igen.");
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    void send({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
  }

  function clear() {
    if (!window.confirm(`Slet alle ${total} log-rækker? Det kan ikke fortrydes.`)) return;
    void send({ method: "DELETE" });
  }

  return (
    <div className="sm:flex-row sm:items-center sm:justify-between hf-panel">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${enabled ? "bg-hf-green" : "bg-hf-red-dark"}`}
        />
        <p className="hf-type-body text-hf-black">
          {enabled ? "Logningen er slået til" : "Logningen er slået fra"}
          <span className="text-text-secondary"> · {total} rækker · ryddes automatisk efter 30 dage</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={toggle} disabled={busy} className="hf-btn-secondary h-10 px-4">
          {enabled ? "Slå fra" : "Slå til"}
        </button>
        <button type="button" onClick={clear} disabled={busy || total === 0} className="hf-btn-danger h-10 px-4">
          Ryd log
        </button>
      </div>
      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
    </div>
  );
}
